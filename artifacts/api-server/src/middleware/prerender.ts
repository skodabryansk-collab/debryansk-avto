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

// Current build's asset tags, read once from dist/public/index.html at server
// startup (see index.ts). Cached snapshots (GCS/Puppeteer captures) bake in
// whatever asset hash was live at capture time; if a later deploy changes the
// bundle hash, the old snapshot's <script>/<link> tags point at deleted files
// (404). We rewrite those tags to the CURRENT build's tags on every serve, so
// content can be stale-ish but the referenced JS/CSS always exist on disk.
let currentAssetTags: { script: string | null; link: string | null } = {
  script: null,
  link: null,
};

export function setCurrentAssetTags(html: string): void {
  const scriptMatch = html.match(/<script[^>]*\ssrc="\/assets\/[^"]*\.js"[^>]*><\/script>/);
  const linkMatch = html.match(/<link[^>]*\shref="\/assets\/[^"]*\.css"[^>]*>/);
  currentAssetTags = {
    script: scriptMatch ? scriptMatch[0] : null,
    link: linkMatch ? linkMatch[0] : null,
  };
  logger.info(
    { hasScript: !!currentAssetTags.script, hasLink: !!currentAssetTags.link },
    "prerender: current build asset tags cached",
  );
}

// Cheap single-pass string replacement — no DOM parsing. Only swaps the
// index-*.js <script> tag and index-*.css <link> tag; everything else in the
// cached HTML is left untouched. Runs on every cached-page request
// (PRERENDER_ALL=true means every visitor), so it must stay O(1) regex work.
function rewriteAssetTagsToCurrent(html: string): string {
  let out = html;
  if (currentAssetTags.script) {
    out = out.replace(/<script[^>]*\ssrc="\/assets\/index-[^"]*\.js"[^>]*><\/script>/, currentAssetTags.script);
  }
  if (currentAssetTags.link) {
    out = out.replace(/<link[^>]*\shref="\/assets\/index-[^"]*\.css"[^>]*>/, currentAssetTags.link);
  }
  return out;
}

// Routes served to bots via seoMeta (SSG HTML + meta injection, no Puppeteer cache needed).
// "/" added here so the prerender middleware always falls through to seoMeta for the home page,
// which reads dist/public/index.html with the current build's CSS hash (never stale GCS cache).
const SSG_ROUTES = new Set([
  "/", "/vacancies", "/contacts", "/legal", "/privacy",
]);
function isSsgRoute(route: string): boolean {
  if (SSG_ROUTES.has(route)) return true;
  // /brands/* — NOT SSG: prerender.mjs renders them via Puppeteer and stores in GCS cache.
  // When cache is empty (new brand not yet crawled), middleware falls through to next()
  // which serves the SPA shell — same as normal user, no 500/empty response.
  if (route.startsWith("/news/")) return true;
  if (route.startsWith("/promotions/")) return true;
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
    // Cached snapshot may have been captured under a previous build — swap
    // its baked-in asset tags for the current build's so we never serve a
    // reference to a JS/CSS file that a later deploy has already deleted.
    const freshHtml = rewriteAssetTagsToCurrent(dedupedHtml);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Prerendered", "1");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(freshHtml);
    return;
  }

  next();
}
