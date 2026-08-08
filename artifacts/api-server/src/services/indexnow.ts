import { logger } from "../lib/logger";

const SITE = "https://debryansk-auto.ru";
const DEFAULT_KEY = "debryansk-avto-indexnow-2026";

export function getIndexNowKey(): string {
  return process.env.INDEXNOW_KEY ?? DEFAULT_KEY;
}

export type IndexNowResult = { endpoint: string; status: number; ok: boolean }[];

/**
 * Ping IndexNow endpoints.  Returns a result per endpoint so callers can detect
 * non-2xx responses and adjust their verification status accordingly.
 * Network errors are caught internally and surfaced as ok=false entries.
 */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (!urls.length) return [];
  const key = getIndexNowKey();
  const body = {
    host: "debryansk-auto.ru",
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: urls.slice(0, 10_000),
  };
  const targets = [
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
  ];
  const results: IndexNowResult = [];
  for (const endpoint of targets) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const ok = r.status >= 200 && r.status < 300;
      logger.info({ endpoint, status: r.status, ok, count: urls.length }, "[indexnow] ping sent");
      results.push({ endpoint, status: r.status, ok });
    } catch (err) {
      logger.warn({ endpoint, err: String(err) }, "[indexnow] ping failed");
      results.push({ endpoint, status: 0, ok: false });
    }
  }
  return results;
}
