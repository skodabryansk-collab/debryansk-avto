import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const SITE = "https://debryansk-auto.ru";

/** Return dynamic OG-image URL for brand/car routes, or null for other routes. */
function resolveOgImageUrl(route: string): string | null {
  const brand = route.match(/^\/brands\/([^/]+)$/);
  if (brand) return `${SITE}/api/og-image/brand/${brand[1]}.png`;
  const carNew = route.match(/^\/new-cars\/([^/]+)$/);
  if (carNew) return `${SITE}/api/og-image/car/new/${carNew[1]}.png`;
  const carUsed = route.match(/^\/cars\/([^/]+)$/);
  if (carUsed) return `${SITE}/api/og-image/car/used/${carUsed[1]}.png`;
  if (route === "/service") return `${SITE}/api/og-image/service.png`;
  if (route === "/service/bonus") return `${SITE}/api/og-image/bonus.png`;
  if (route.startsWith("/service/")) return `${SITE}/api/og-image/service.png`;
  if (route === "/vacancies") return `${SITE}/api/og-image/vacancies.png`;
  if (route === "/buyout") return `${SITE}/api/og-image/buyout.png`;
  if (route === "/new-cars") return `${SITE}/api/og-image/catalog/new.png`;
  if (route === "/cars") return `${SITE}/api/og-image/catalog/used.png`;
  return null;
}

const DEFAULT_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large";

/** Replace robots meta with the current DEFAULT_ROBOTS directive. */
function patchRobotsMeta(html: string): string {
  const hasRobots = /<meta\s+name="robots"\s+content="[^"]*"/i.test(html);
  if (hasRobots) {
    return html.replace(
      /<meta\s+name="robots"\s+content="[^"]*"/gi,
      `<meta name="robots" content="${DEFAULT_ROBOTS}"`,
    );
  }
  // Tag absent — inject before </head>
  const inject = `<meta name="robots" content="${DEFAULT_ROBOTS}" />`;
  return html.replace("</head>", `${inject}</head>`);
}

/** Replace or inject og:image + twitter:image with the dynamic URL in prerendered HTML. */
function patchOgImage(html: string, route: string): string {
  const url = resolveOgImageUrl(route);
  if (!url) return html;
  const hasOgImage = /<meta\s+property="og:image"/i.test(html);
  if (hasOgImage) {
    return html
      .replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/g, `$1${url}"`)
      .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*"/g, `$1${url}"`);
  }
  // Tag absent — inject before </head>
  const inject = `<meta property="og:image" content="${url}" /><meta name="twitter:image" content="${url}" />`;
  return html.replace("</head>", `${inject}</head>`);
}

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

const brandSlugCache = new Map<string, { exists: boolean; checkedAt: number }>();
const BRAND_SLUG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cached Puppeteer snapshots can outlive a brand that was removed or renamed.
 * Check the DB before serving a cached brand page so an old "Бренд не найден"
 * snapshot cannot be exposed to crawlers as HTTP 200.
 */
async function brandExists(slug: string): Promise<boolean | null> {
  const cached = brandSlugCache.get(slug);
  if (cached && Date.now() - cached.checkedAt < BRAND_SLUG_CACHE_TTL_MS) {
    return cached.exists;
  }

  try {
    const result = await db.execute(
      sql`SELECT 1 FROM brands WHERE slug = ${slug} AND slug IS NOT NULL LIMIT 1`,
    );
    const exists = result.rows.length > 0;
    brandSlugCache.set(slug, { exists, checkedAt: Date.now() });
    return exists;
  } catch (err) {
    // A transient DB outage must not turn a valid brand into a false 404.
    logger.warn({ err, slug }, "prerender: unable to validate brand slug");
    return null;
  }
}

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
export function rewriteAssetTagsToCurrent(html: string): string {
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
  "/", "/legal", "/privacy",
  // These static pages have SSG-generated HTML with correct meta — always pass through
  // to seoMetaMiddleware even when a Puppeteer snapshot exists in the cache.
  "/about", "/contacts", "/promotions",
  "/service", "/service/bonus", "/buyout", "/vacancies", "/corporate", "/new-cars", "/cars",
]);
export function isSsgRoute(route: string): boolean {
  if (SSG_ROUTES.has(route)) return true;
  // /brands/* — NOT SSG: prerender.mjs renders them via Puppeteer and stores in GCS cache.
  // When cache is empty (new brand not yet crawled), middleware falls through to next()
  // which serves the SPA shell — same as normal user, no 500/empty response.
  if (route === "/news") return true; // news list page has SSG-generated article grid
  if (route.startsWith("/news/")) return true;
  if (route.startsWith("/promotions/")) return true;
  return false;
}

export function getPrerenderCache(): PrerenderCacheState {
  return cache;
}

export async function loadPrerenderCacheFromDisk(): Promise<void> {
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
      "prerender: cache loaded from disk (SSG routes preserved)",
    );
  } catch (err) {
    logger.warn({ err }, "prerender: failed to load cache from disk");
  }
}

/** @deprecated Use loadPrerenderCacheFromDisk instead */
export const loadPrerenderCacheFromGCS = loadPrerenderCacheFromDisk;

export function updatePrerenderCache(route: string, html: string): void {
  cache.pages.set(route, html);
  cache.gone.delete(route);
}

export function deletePrerenderCache(route: string): void {
  cache.pages.delete(route);
  cache.gone.add(route);
}

export function invalidatePrerenderCache(route: string): void {
  cache.pages.delete(route);
  // Do NOT add to cache.gone — we want the next bot request to fall through
  // to seoMeta middleware and get fresh meta tags from the DB.
}

export async function prerenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

  const route = (req.path || "/").replace(/\/$/, "") || "/";
  console.log(
    `[DEBUG] path=${route}, ua=${ua.substring(0, 50)}, cached=${cache.pages.has(route)}, isGone=${cache.gone.has(route)}`,
  );

  const brandMatch = route.match(/^\/brands\/([^/]+)$/);
  if (isBot && brandMatch && cache.pages.has(route)) {
    const exists = await brandExists(brandMatch[1]);
    if (exists === false) {
      cache.pages.delete(route);
      cache.gone.delete(route);
      res.status(404).end();
      logger.info({ route }, "prerender: served 404 for cached unknown brand");
      return;
    }
  }

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
    // Dynamic routes (brands, car detail pages): React Helmet sets og:title correctly
    // at Puppeteer-render time, but document.title in the serialized DOM stays as
    // the SPA shell default ("Дебрянск Авто — официальный автосалон…").
    // Fix: sync <title> from og:title so Googlebot/Yandex sees the correct title in SERPs.
    const dedupedHtml = html.replace(/(<title>[^<]*<\/title>)(<title>[^<]*<\/title>)+/, "$1");
    // Cached snapshot may have been captured under a previous build — swap
    // its baked-in asset tags for the current build's so we never serve a
    // reference to a JS/CSS file that a later deploy has already deleted.
    const freshHtml = rewriteAssetTagsToCurrent(dedupedHtml);
    // Update og:image / twitter:image to dynamic PNG for brand/car pages
    const patchedOgHtml = patchOgImage(freshHtml, route);
    // Always patch robots to current DEFAULT_ROBOTS (cached HTML may have stale directive)
    let patchedHtml = patchRobotsMeta(patchedOgHtml);
    // Sync <title> from og:title (og:title is set correctly by React Helmet at render time;
    // document.title stays as the SPA shell default until JS runs in the browser).
    const ogTitleMatch = patchedHtml.match(/meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitleMatch) {
      patchedHtml = patchedHtml.replace(/<title>[^<]*<\/title>/, `<title>${ogTitleMatch[1]}</title>`);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Prerendered", "1");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(patchedHtml);
    return;
  }

  next();
}
