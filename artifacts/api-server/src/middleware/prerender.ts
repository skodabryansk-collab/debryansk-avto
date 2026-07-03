import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const BOT_UA =
  /googlebot|yandexbot|bingbot|duckduckbot|facebookexternalhit|twitterbot|telegrambot|whatsapp|slackbot|linkedinbot|applebot|baiduspider|ia_archiver|vkshare|odklbot|claude|anthropic|squirrel|squirrelscan|screamingfrog|ahrefs|semrush|mj12bot|dotbot/i;

interface PrerenderCacheState {
  pages: Map<string, string>;
  gone: Set<string>;
}

const cache: PrerenderCacheState = {
  pages: new Map(),
  gone: new Set(),
};

// Routes served to bots via seoMeta (SSG HTML + meta injection, no Puppeteer cache needed).
// Contentful pages (/, /service, /service/bonus, /about, /news, /buyout, /cars) are
// intentionally excluded — prerender.mjs renders them via Puppeteer so bots get real content.
const SSG_ROUTES = new Set([
  "/vacancies", "/contacts", "/new-cars", "/legal", "/privacy",
]);
function isSsgRoute(route: string): boolean {
  if (SSG_ROUTES.has(route)) return true;
  // /brands/* — NOT SSG: prerender.mjs renders them via Puppeteer and stores in GCS cache.
  // When cache is empty (new brand not yet crawled), middleware falls through to next()
  // which serves the SPA shell — same as normal user, no 500/empty response.
  if (route.startsWith("/news/")) return true;
  return false;
}

export function getPrerenderCache(): PrerenderCacheState {
  return cache;
}

export async function loadPrerenderCacheFromGCS(): Promise<void> {
  if (process.env.PRERENDER_ENABLED !== "true") return;
  try {
    const { loadAllPrerendered } = await import("../lib/prerenderStorage");
    const loaded = await loadAllPrerendered();
    // Do NOT clear cache — SSG HTML loaded at startup takes precedence
    // (SSG has fresh asset hashes and FAQPage JSON-LD schema)
    let added = 0;
    for (const [route, html] of loaded) {
      if (!cache.pages.has(route)) {
        cache.pages.set(route, html);
        added++;
      }
    }
    logger.info(
      { added, total: cache.pages.size },
      "prerender: cache loaded from GCS (SSG routes preserved)",
    );
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

export function prerenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.PRERENDER_ENABLED !== "true") {
    next();
    return;
  }

  const PRERENDER_ALL = process.env.PRERENDER_ALL === "true";

  const ua = (req.headers["user-agent"] ?? "") as string;
  const isBot = PRERENDER_ALL || BOT_UA.test(ua);
  logger.info(`[bot-check] path=${req.path} raw_ua="${ua}" matched=${BOT_UA.test(ua)}`);

  if (/\.\w{2,10}$/.test(req.path)) {
    next();
    return;
  }

  // Skip cache when Puppeteer is rendering fresh (X-Prerender-Bot header)
  // so that prerender.mjs captures the latest SSG HTML instead of stale cache
  if (req.headers["x-prerender-bot"] === "1") {
    next();
    return;
  }

  const route = req.path || "/";
  console.log(
    `[DEBUG] path=${route}, ua=${ua.substring(0, 50)}, cached=${cache.pages.has(route)}, isGone=${cache.gone.has(route)}`,
  );

  // 410 Gone — only for bots/crawlers; regular browsers get the SPA shell
  // so React can render a "not found" state instead of a blank page
  if (isBot && cache.gone.has(route)) {
    res.status(410).end();
    return;
  }

  if (!isBot) {
    next();
    return;
  }

  const html = cache.pages.get(route);
  if (html) {
    // SSG routes have correct FAQ schema but need seoMeta to add
    // meta description, canonical, OG tags, LocalBusiness schema.
    // Pass through to seoMeta middleware (which loads SSG HTML itself).
    if (isSsgRoute(route)) {
      next();
      return;
    }
    // Dynamic routes (car detail pages) already have full meta from Helmet
    const dedupedHtml = html.replace(/(<title>[^<]*<\/title>)(<title>[^<]*<\/title>)+/, "$1");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Prerendered", "1");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(dedupedHtml);
    return;
  }

  next();
}
