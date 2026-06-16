import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const EXCLUDED_PLATFORMS = ["plasopro", "flamp", "yell", "zoon"];
const API_URL = "https://remake.getloyalty.io/api/v2/reviews";
const BATCH_LIMIT = 100;
const TIMEOUT_MS = 15_000;

function normalizeSource(raw: string | undefined): string {
  if (!raw) return "Отзыв";
  const s = raw.toLowerCase();
  if (s.includes("yandex") || s.includes("яндекс")) return "Яндекс";
  if (s.includes("google")) return "Google";
  if (s.includes("avito") || s.includes("авито")) return "Авито";
  if (s.includes("2gis") || s.includes("2гис")) return "2ГИС";
  return raw;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

type SourcesMap = Record<string, { platform?: string; link?: string; reviews?: number }>;

interface BatchResult {
  items: Record<string, unknown>[];
  sources: SourcesMap | null;
}

async function fetchBatch(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<BatchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`GetLoyalty API error: ${resp.status}`);
  const json = (await resp.json()) as Record<string, unknown>;

  const items: Record<string, unknown>[] = Array.isArray(json.reviews)
    ? (json.reviews as Record<string, unknown>[])
    : [];

  const sources = json.sources
    ? (json.sources as SourcesMap)
    : null;

  return { items, sources };
}

export interface SyncResult {
  upserted: number;
  skipped: number;
  overallCount: number;
  durationMs: number;
}

async function syncReviews(cutoffDays: number): Promise<SyncResult> {
  const startedAt = Date.now();
  const apiKey = process.env.GETLOYALTY_API_KEY;
  if (!apiKey) throw new Error("GETLOYALTY_API_KEY not set");

  const dateFrom = toDateStr(new Date(Date.now() - cutoffDays * 24 * 3600 * 1000));
  const dateTo = toDateStr(new Date());

  logger.info({ dateFrom, dateTo, cutoffDays }, "[reviews-sync] fetching with server-side filters");

  /* ── 1. Get overall count (no date filter, just sources meta) ─────────── */
  let sourcesMap: SourcesMap = {};
  try {
    const { sources } = await fetchBatch(apiKey, { offset: 0, limit: 1 });
    if (sources) sourcesMap = sources;
  } catch (err) {
    logger.warn({ err }, "[reviews-sync] could not fetch sources meta");
  }

  const overallCount = Object.values(sourcesMap).reduce((sum, s) => {
    const p = (s.platform ?? "").toLowerCase();
    if (EXCLUDED_PLATFORMS.some((ex) => p.includes(ex))) return sum;
    return sum + (s.reviews ?? 0);
  }, 0);

  /* ── 2. Paginate filtered reviews ─────────────────────────────────────── */
  const allItems: Record<string, unknown>[] = [];
  let offset = 0;
  const MAX_BATCHES = 20; // safety cap: 20 × 100 = 2000 reviews max

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { items, sources } = await fetchBatch(apiKey, {
      date_from: dateFrom,
      date_to: dateTo,
      rate_from: 4,
      has_text: 1,
      offset,
      limit: BATCH_LIMIT,
    });

    /* Capture sources from first batch if meta call failed */
    if (batch === 0 && sources && overallCount === 0) {
      sourcesMap = sources;
    }

    logger.info({ batch, offset, returned: items.length }, "[reviews-sync] batch received");

    if (items.length === 0) break;
    allItems.push(...items);
    if (items.length < BATCH_LIMIT) break; // last page
    offset += BATCH_LIMIT;
  }

  logger.info({ total: allItems.length }, "[reviews-sync] all batches fetched");

  /* ── 3. Deduplicate by external ID ────────────────────────────────────── */
  const dedupeMap = new Map<string, Record<string, unknown>>();
  for (const r of allItems) {
    const key = String((r.id as string | number) ?? "");
    if (!dedupeMap.has(key)) dedupeMap.set(key, r);
  }
  const deduped = Array.from(dedupeMap.values());

  /* ── 4. Upsert into DB ────────────────────────────────────────────────── */
  let upserted = 0;
  let skipped = 0;

  for (const r of deduped) {
    const sourceKey = r.sources as string; // note: field name is "sources" (hash)
    const sourceInfo = sourcesMap[sourceKey];
    const platform = sourceInfo?.platform ?? sourceKey ?? "";
    const normalizedSource = normalizeSource(platform);

    /* Skip excluded platforms */
    if (EXCLUDED_PLATFORMS.some((p) => platform.toLowerCase().includes(p))) {
      skipped++;
      continue;
    }

    const user = r.user as Record<string, unknown> | undefined;
    const author =
      (user?.name as string) ||
      (r.author as string) ||
      (r.name as string) ||
      "Покупатель";

    const rating = Number((r.rate as number) ?? (r.rating as number) ?? 5);

    const text = ((r.text as string) || "").trim();

    const dateRaw = r.date as number | string;
    const dateStr =
      typeof dateRaw === "number"
        ? new Date(dateRaw * 1000).toISOString().split("T")[0]
        : (dateRaw as string) || "";

    const externalId = String((r.id as string | number) ?? `${author}-${dateStr}`);
    const sourceUrl = sourceInfo?.link || (r.link as string) || null;

    await db.execute(sql`
      INSERT INTO reviews (external_id, author, rating, text, date, source, source_url, synced_at)
      VALUES (
        ${externalId},
        ${author},
        ${rating},
        ${text},
        ${dateStr || null}::date,
        ${normalizedSource},
        ${sourceUrl},
        NOW()
      )
      ON CONFLICT (external_id) DO UPDATE SET
        author     = EXCLUDED.author,
        rating     = EXCLUDED.rating,
        text       = EXCLUDED.text,
        date       = EXCLUDED.date,
        source     = EXCLUDED.source,
        source_url = EXCLUDED.source_url,
        synced_at  = NOW()
    `);
    upserted++;
  }

  /* ── 5. Persist meta ──────────────────────────────────────────────────── */
  await db.execute(sql`
    INSERT INTO reviews_meta (id, overall_count, last_sync_at)
    VALUES (1, ${overallCount}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      overall_count = EXCLUDED.overall_count,
      last_sync_at  = NOW()
  `);

  return { upserted, skipped, overallCount, durationMs: Date.now() - startedAt };
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export async function syncAllReviews(): Promise<SyncResult> {
  logger.info("[reviews-sync] Starting full sync (90 days)");
  const result = await syncReviews(90);
  logger.info(result, "[reviews-sync] Full sync complete");
  return result;
}

export async function syncRecentReviews(): Promise<SyncResult> {
  logger.info("[reviews-sync] Starting recent sync (1 day)");
  const result = await syncReviews(1);
  logger.info(result, "[reviews-sync] Recent sync complete");
  return result;
}

export async function syncCustomDays(days: number): Promise<SyncResult> {
  const d = Math.max(1, Math.min(365, days));
  logger.info({ days: d }, "[reviews-sync] Starting custom sync");
  const result = await syncReviews(d);
  logger.info(result, "[reviews-sync] Custom sync complete");
  return result;
}
