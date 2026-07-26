import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const WEBMASTER_USER_ID = "140495458";
const HOST_ID = "https%3Adebryansk-auto.ru%3A443";
const API_URL =
  `https://api.webmaster.yandex.net/v4/user/${WEBMASTER_USER_ID}/hosts/${HOST_ID}/search-queries/popular` +
  `?order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION`;

/* ── Concurrency guard ── */
let isFetchingSeoPositions = false;

function getToken(): string {
  return process.env["YANDEX_WEBMASTER_TOKEN"] || "";
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface WmQuery {
  query_text: string;
  indicators: {
    TOTAL_SHOWS?: number;
    TOTAL_CLICKS?: number;
    AVG_SHOW_POSITION?: number;
  };
}
interface WmResponse {
  queries?: WmQuery[];
  error_code?: string;
  error_message?: string;
  message?: string;
}

async function fetchFromWebmaster(retries = 3, retryDelay = 7_000): Promise<WmQuery[]> {
  const token = getToken();
  if (!token) throw new Error("YANDEX_WEBMASTER_TOKEN не задан");

  for (let attempt = 1; attempt <= retries; attempt++) {
    const r = await fetch(API_URL, {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    const json = await r.json() as WmResponse;

    if (r.status === 429 || /quota|exceeded/i.test(json.error_message || json.message || "")) {
      if (attempt < retries) {
        logger.warn({ attempt, retryDelay }, "[seo-positions] Quota exceeded, retrying...");
        await sleep(retryDelay);
        continue;
      }
      throw new Error(`Webmaster quota exceeded after ${retries} attempts`);
    }

    if (!r.ok || json.error_code) {
      throw new Error(json.error_message || json.message || `HTTP ${r.status}`);
    }

    return json.queries || [];
  }

  throw new Error("[seo-positions] fetchFromWebmaster: unreachable");
}

export async function fetchSeoPositions(): Promise<{ upserted: number; skipped: boolean }> {
  if (isFetchingSeoPositions) {
    logger.warn("[seo-positions] Already running — skipping concurrent call");
    return { upserted: 0, skipped: true };
  }

  isFetchingSeoPositions = true;
  try {
    const token = getToken();
    if (!token) {
      logger.warn("[seo-positions] YANDEX_WEBMASTER_TOKEN not set — skipping");
      return { upserted: 0, skipped: true };
    }

    logger.info("[seo-positions] Fetching from Webmaster API...");
    const queries = await fetchFromWebmaster();
    logger.info({ count: queries.length }, "[seo-positions] Received queries");

    if (queries.length === 0) {
      logger.warn("[seo-positions] API returned 0 queries — not updating DB");
      return { upserted: 0, skipped: false };
    }

    const today = new Date().toISOString().split("T")[0];
    let upserted = 0;

    for (const q of queries) {
      const shows = q.indicators.TOTAL_SHOWS ?? 0;
      const clicks = q.indicators.TOTAL_CLICKS ?? 0;
      const pos = q.indicators.AVG_SHOW_POSITION ?? 0;

      await db.execute(sql`
        INSERT INTO seo_query_snapshots (query_text, total_shows, total_clicks, avg_position, snapshot_date)
        VALUES (${q.query_text}, ${shows}, ${clicks}, ${pos}, ${today})
        ON CONFLICT (query_text, snapshot_date)
        DO UPDATE SET
          total_shows   = EXCLUDED.total_shows,
          total_clicks  = EXCLUDED.total_clicks,
          avg_position  = EXCLUDED.avg_position
      `);
      upserted++;
    }

    logger.info({ upserted, date: today }, "[seo-positions] Upsert complete");
    return { upserted, skipped: false };

  } finally {
    isFetchingSeoPositions = false;
  }
}

export function isSeoFetchRunning(): boolean {
  return isFetchingSeoPositions;
}

/* ── Scheduler: воскресенье 10:00 МСК = 07:00 UTC ── */
export function scheduleSeoPositions(onComplete?: () => void): void {
  const TARGET_DAY = 0;   // Sunday
  const TARGET_HOUR = 7;  // 07:00 UTC
  const TARGET_MIN = 0;

  function msUntilNext(): number {
    const now = new Date();
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      TARGET_HOUR, TARGET_MIN, 0, 0,
    ));
    // Advance to next Sunday
    const daysUntilSun = (TARGET_DAY - next.getUTCDay() + 7) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilSun);
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    return next.getTime() - now.getTime();
  }

  function runAndNotify(): Promise<void> {
    return fetchSeoPositions()
      .then(r => {
        logger.info(r, "[seo-positions] Scheduled fetch done");
        if (onComplete) {
          try { onComplete(); }
          catch (cbErr) { logger.error({ cbErr }, "[seo-positions] onComplete callback failed"); }
        }
      })
      .catch(err => logger.error({ err }, "[seo-positions] Scheduled fetch failed"));
  }

  function scheduleNext() {
    const ms = msUntilNext();
    const days = Math.round(ms / 86_400_000 * 10) / 10;
    logger.info({ inDays: days }, "[seo-positions] Next scheduled fetch");
    setTimeout(() => {
      runAndNotify();
      setInterval(() => { runAndNotify(); }, 7 * 24 * 60 * 60 * 1000);
    }, ms);
  }

  scheduleNext();
}
