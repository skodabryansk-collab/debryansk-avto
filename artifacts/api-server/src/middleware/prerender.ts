import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const BOT_UA =
  /googlebot|yandexbot|bingbot|duckduckbot|facebookexternalhit|twitterbot|telegrambot|whatsapp|slackbot|linkedinbot|applebot|baiduspider|ia_archiver|vkshare|odklbot/i;

interface PrerenderCacheState {
  pages: Map<string, string>;
  gone: Set<string>;
}

const cache: PrerenderCacheState = {
  pages: new Map(),
  gone: new Set(),
};

export function getPrerenderCache(): PrerenderCacheState {
  return cache;
}

export async function loadPrerenderCacheFromGCS(): Promise<void> {
  if (process.env.PRERENDER_ENABLED !== "true") return;
  try {
    const { loadAllPrerendered } = await import("../lib/prerenderStorage");
    const loaded = await loadAllPrerendered();
    cache.pages.clear();
    for (const [route, html] of loaded) {
      cache.pages.set(route, html);
    }
    logger.info({ count: cache.pages.size }, "prerender: cache loaded from GCS");
  } catch (err) {
    logger.warn({ err }, "prerender: failed to load cache from GCS");
  }
}

export function updatePrerenderCache(route: string, html: string): void {
  cache.pages.set(route, html);
  cache.gone.delete(route);
}

export function deletePrerenderCache(route: string): void {
  cache.pages.delete(route);
  cache.gone.add(route);
}

export function prerenderMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.PRERENDER_ENABLED !== "true") {
    next();
    return;
  }

  const ua = (req.headers["user-agent"] ?? "") as string;
  if (!BOT_UA.test(ua)) {
    next();
    return;
  }

  if (/\.\w{2,10}$/.test(req.path)) {
    next();
    return;
  }

  const route = req.path || "/";

  if (cache.gone.has(route)) {
    res.status(410).end();
    return;
  }

  const html = cache.pages.get(route);
  if (html) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Prerendered", "1");
    res.setHeader("Cache-Control", "public, max-age=900");
    res.status(200).send(html);
    return;
  }

  next();
}
