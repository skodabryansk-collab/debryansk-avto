import { logger } from "../lib/logger";

const SITE = "https://debryansk-auto.ru";
const DEFAULT_KEY = "debryansk-avto-indexnow-2026";

export function getIndexNowKey(): string {
  return process.env.INDEXNOW_KEY ?? DEFAULT_KEY;
}

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;
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
  for (const endpoint of targets) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      logger.info({ endpoint, status: r.status, count: urls.length }, "[indexnow] ping sent");
    } catch (err) {
      logger.warn({ endpoint, err: String(err) }, "[indexnow] ping failed");
    }
  }
}
