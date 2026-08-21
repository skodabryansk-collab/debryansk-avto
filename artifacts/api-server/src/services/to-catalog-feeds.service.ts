import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { saveCatalog, reloadFromDb } from "./to-catalog.service";
import type { ToCatalogEntry } from "./to-catalog.service";

export interface ToCatalogFeed {
  id: number;
  url: string;
  brandNames: string[];
  lastSyncedAt: string | null;
  lastCount: number | null;
  createdAt: string;
}

type FeedRow = {
  id: number;
  url: string;
  brand_names: string[];
  last_synced_at: string | null;
  last_count: number | null;
  created_at: string;
};

function mapRow(r: FeedRow): ToCatalogFeed {
  return {
    id: r.id,
    url: r.url,
    brandNames: Array.isArray(r.brand_names) ? r.brand_names : [],
    lastSyncedAt: r.last_synced_at ?? null,
    lastCount: r.last_count ?? null,
    createdAt: r.created_at,
  };
}

export async function listFeeds(): Promise<ToCatalogFeed[]> {
  const result = await db.execute(sql`
    SELECT id, url, brand_names, last_synced_at, last_count, created_at
    FROM to_catalog_feeds ORDER BY created_at ASC
  `);
  return (result.rows as FeedRow[]).map(mapRow);
}

function brandNamesArray(names: string[]) {
  // postgres.js doesn't support string→text[] casting via parameterized $n::text[].
  // Build an inline SQL array literal with standard SQL single-quote escaping
  // ('' to escape a literal '). Brand names come from admin UI — this is safe.
  if (names.length === 0) return sql.raw("ARRAY[]::text[]");
  const literals = names.map(n => "'" + n.replace(/'/g, "''") + "'").join(", ");
  return sql.raw(`ARRAY[${literals}]::text[]`);
}

export async function addFeed(url: string, brandNames: string[]): Promise<ToCatalogFeed> {
  const result = await db.execute(sql`
    INSERT INTO to_catalog_feeds (url, brand_name, brand_names)
    VALUES (${url}, '', ${brandNamesArray(brandNames)})
    RETURNING id, url, brand_names, last_synced_at, last_count, created_at
  `);
  return mapRow(result.rows[0] as FeedRow);
}

export async function updateFeed(id: number, url: string, brandNames: string[]): Promise<ToCatalogFeed | null> {
  const result = await db.execute(sql`
    UPDATE to_catalog_feeds SET url = ${url}, brand_names = ${brandNamesArray(brandNames)}
    WHERE id = ${id}
    RETURNING id, url, brand_names, last_synced_at, last_count, created_at
  `);
  if (!result.rows.length) return null;
  return mapRow(result.rows[0] as FeedRow);
}

export async function deleteFeed(id: number): Promise<boolean> {
  const result = await db.execute(sql`DELETE FROM to_catalog_feeds WHERE id = ${id}`);
  return ((result as unknown as { rowCount: number }).rowCount ?? 0) > 0;
}

async function fetchFeedEntries(url: string): Promise<ToCatalogEntry[]> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} при загрузке ${url}`);
  const raw = await resp.json() as unknown;
  if (!Array.isArray(raw)) throw new Error(`Фид не является массивом: ${url}`);
  return raw as ToCatalogEntry[];
}

async function loadCurrentEntries(): Promise<ToCatalogEntry[]> {
  const result = await db.execute(sql`SELECT data FROM to_catalog_store WHERE id = 1 LIMIT 1`);
  const row = result.rows[0] as { data?: ToCatalogEntry[] } | undefined;
  if (!row) return [];
  return Array.isArray(row.data) ? row.data : [];
}

function mergeFeedEntries(
  current: ToCatalogEntry[],
  entries: ToCatalogEntry[],
  configuredBrands: string[],
): ToCatalogEntry[] {
  const incomingBrands = entries
    .map(e => String(e.Brand ?? "").trim().toLowerCase())
    .filter(Boolean);
  const brandsToReplace = new Set([
    ...configuredBrands.map(b => b.trim().toLowerCase()).filter(Boolean),
    ...incomingBrands,
  ]);
  const withoutFeedBrands = current.filter(e =>
    !brandsToReplace.has(String(e.Brand ?? "").trim().toLowerCase())
  );
  return [...withoutFeedBrands, ...entries];
}

export async function syncFeed(feedId: number): Promise<{ count: number; brands: string[] }> {
  const feeds = await listFeeds();
  const feed = feeds.find(f => f.id === feedId);
  if (!feed) throw new Error(`Фид #${feedId} не найден`);

  const entries = await fetchFeedEntries(feed.url);
  if (entries.length === 0) throw new Error("Фид пустой, обновление не применено");

  const brandLowers = feed.brandNames.map(b => b.toLowerCase());
  const current = await loadCurrentEntries();
  await saveCatalog(mergeFeedEntries(current, entries, brandLowers));

  await db.execute(sql`
    UPDATE to_catalog_feeds
    SET last_synced_at = NOW(), last_count = ${entries.length}
    WHERE id = ${feedId}
  `);

  logger.info({ feedId, brands: feed.brandNames, count: entries.length }, "to-catalog feed synced");
  return { count: entries.length, brands: feed.brandNames };
}

export async function syncAllFeeds(): Promise<Array<{ feedId: number; brands: string[]; count?: number; error?: string }>> {
  const feeds = await listFeeds();
  const results: Array<{ feedId: number; brands: string[]; count?: number; error?: string }> = [];

  let working = await loadCurrentEntries();

  for (const feed of feeds) {
    try {
      const entries = await fetchFeedEntries(feed.url);
      if (entries.length === 0) {
        results.push({ feedId: feed.id, brands: feed.brandNames, error: "Фид пустой" });
        continue;
      }
      const brandLowers = feed.brandNames.map(b => b.toLowerCase());
      working = mergeFeedEntries(working, entries, brandLowers);

      await db.execute(sql`
        UPDATE to_catalog_feeds
        SET last_synced_at = NOW(), last_count = ${entries.length}
        WHERE id = ${feed.id}
      `);
      results.push({ feedId: feed.id, brands: feed.brandNames, count: entries.length });
    } catch (err) {
      logger.warn({ err, feedId: feed.id }, "to-catalog syncAllFeeds: feed failed");
      results.push({ feedId: feed.id, brands: feed.brandNames, error: String(err) });
    }
  }

  await saveCatalog(working);
  await reloadFromDb();
  logger.info({ results }, "to-catalog: all feeds synced");
  return results;
}
