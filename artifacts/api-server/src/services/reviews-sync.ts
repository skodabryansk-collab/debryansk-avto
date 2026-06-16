import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const EXCLUDED_PLATFORMS = ["plasopro", "flamp", "yell", "zoon"];
const API_URL = "https://remake.getloyalty.io/api/v2/reviews";

function normalizeSource(raw: string | undefined): string {
  if (!raw) return "Отзыв";
  const s = raw.toLowerCase();
  if (s.includes("yandex") || s.includes("яндекс")) return "Яндекс";
  if (s.includes("google")) return "Google";
  if (s.includes("avito") || s.includes("авито")) return "Авито";
  if (s.includes("2gis") || s.includes("2гис")) return "2ГИС";
  return raw;
}

async function fetchPage(
  apiKey: string,
  page: number,
): Promise<{
  sourcesMap: Record<string, { platform?: string; link?: string; reviews?: number }> | null;
  items: Record<string, unknown>[];
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let resp: Response;
  try {
    resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`GetLoyalty API error: ${resp.status}`);
  const json = (await resp.json()) as Record<string, unknown>;
  const items = Array.isArray(json.reviews)
    ? (json.reviews as Record<string, unknown>[])
    : Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : Array.isArray((json as Record<string, unknown[]>).data)
        ? ((json as Record<string, unknown[]>).data as Record<string, unknown>[])
        : [];
  const sm =
    page === 1
      ? ((json.sources ?? {}) as Record<
          string,
          { platform?: string; link?: string; reviews?: number }
        >)
      : null;
  return { sourcesMap: sm, items };
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

  const cutoffTs = Math.floor(Date.now() / 1000) - cutoffDays * 24 * 3600;

  let sourcesMap: Record<string, { platform?: string; link?: string; reviews?: number }> = {};
  const rawList: Record<string, unknown>[] = [];
  const seenIds = new Set<string>();
  const MAX_PAGES = 50;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { sourcesMap: sm, items } = await fetchPage(apiKey, page);
    if (sm) sourcesMap = sm;
    if (items.length === 0) break;

    /* Detect wrap-around: stop if first item of this page was already seen */
    if (page > 1 && items.length > 0) {
      const firstId = String((items[0] as any)?.id ?? "");
      if (firstId && seenIds.has(firstId)) break;
    }

    for (const item of items) {
      const rid = String((item as any)?.id ?? "");
      if (rid) seenIds.add(rid);
    }

    rawList.push(...items);
    const oldestTs = Math.min(
      ...items.map((r) => (typeof r.date === "number" ? (r.date as number) : 0)),
    );
    if (oldestTs > 0 && oldestTs < cutoffTs) break;
  }

  /* Deduplicate rawList by id (GetLoyalty may repeat entries across pages) */
  const dedupeMap = new Map<string, Record<string, unknown>>();
  for (const r of rawList) {
    const key = String((r.id as string | number) ?? "");
    if (key && !dedupeMap.has(key)) dedupeMap.set(key, r);
    else if (!key) dedupeMap.set(`nokey-${dedupeMap.size}`, r);
  }
  const deduped = Array.from(dedupeMap.values());

  /* Overall count — all non-excluded platforms (all time, from API meta) */
  const overallCount = Object.values(sourcesMap).reduce((sum, s) => {
    const p = (s.platform ?? "").toLowerCase();
    if (EXCLUDED_PLATFORMS.some((ex) => p.includes(ex))) return sum;
    return sum + (s.reviews ?? 0);
  }, 0);

  let upserted = 0;
  let skipped = 0;

  for (const r of deduped) {
    const sourceKey = r.source as string;
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
    const rating = Number(
      (r.rate as number) ?? (r.rating as number) ?? (r.score as number) ?? 5,
    );
    const text = (
      (r.text as string) ||
      (r.content as string) ||
      (r.body as string) ||
      ""
    ).trim();
    const dateRaw = r.date as number | string;
    const dateStr =
      typeof dateRaw === "number"
        ? new Date(dateRaw * 1000).toISOString().split("T")[0]
        : (dateRaw as string) || "";
    const externalId = String(
      (r.id as string | number) ?? `${author}-${dateStr}`,
    );
    const sourceUrl =
      sourceInfo?.link || (r.link as string) || null;

    /* Filter: 4–5 ★, non-empty text, within cutoff window */
    if (rating < 4 || !text) {
      skipped++;
      continue;
    }
    if (dateStr) {
      const ts = Math.floor(new Date(dateStr).getTime() / 1000);
      if (ts < cutoffTs) {
        skipped++;
        continue;
      }
    }

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

  /* Persist meta (overall count from API, sync timestamp) */
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
