import { type Express } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getIndexNowKey } from "../services/indexnow";

const SITE = "https://debryansk-auto.ru";
const CACHE_TTL = 60 * 60 * 1000;

let cache: { xml: string; ts: number } | null = null;

const STATIC_PAGES = [
  { loc: "/",          changefreq: "daily",   priority: "1.0" },
  { loc: "/new-cars",  changefreq: "daily",   priority: "0.9" },
  { loc: "/cars",      changefreq: "daily",   priority: "0.9" },
  { loc: "/buyout",    changefreq: "weekly",  priority: "0.8" },
  { loc: "/service",   changefreq: "weekly",  priority: "0.8" },
  { loc: "/news",      changefreq: "daily",   priority: "0.8" },
  { loc: "/about",     changefreq: "monthly", priority: "0.7" },
  { loc: "/contacts",  changefreq: "monthly", priority: "0.7" },
  { loc: "/vacancies", changefreq: "weekly",  priority: "0.6" },
  { loc: "/privacy",   changefreq: "yearly",  priority: "0.3" },
];

function fmt(d: Date | string | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

function url(loc: string, opts: { lastmod?: string; changefreq?: string; priority?: string } = {}): string {
  return [
    "  <url>",
    `    <loc>${SITE}${loc}</loc>`,
    opts.lastmod    ? `    <lastmod>${opts.lastmod}</lastmod>` : "",
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>` : "",
    opts.priority   ? `    <priority>${opts.priority}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function buildSitemap(): Promise<string> {
  const [carsResult, newsResult, brandsResult, landingResult] = await Promise.all([
    db.execute(sql`SELECT external_id, type, synced_at FROM cars ORDER BY synced_at DESC`),
    db.execute(sql`SELECT slug, updated_at FROM news ORDER BY updated_at DESC`),
    db.execute(sql`SELECT slug FROM brands WHERE slug IS NOT NULL AND slug != 's-probegom' ORDER BY name`),
    db.execute(sql`SELECT slug, updated_at FROM seo_landing_pages WHERE is_published = true ORDER BY updated_at DESC`).catch(() => ({ rows: [] })),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [];

  for (const page of STATIC_PAGES) {
    urls.push(url(page.loc, { lastmod: today, changefreq: page.changefreq, priority: page.priority }));
  }

  for (const row of carsResult.rows as { external_id: string; type: string; synced_at: string }[]) {
    const path = row.type === "new" ? "/new-cars" : "/cars";
    const enc = encodeURIComponent(row.external_id);
    urls.push(url(`${path}/${enc}`, {
      lastmod: fmt(row.synced_at),
      changefreq: "weekly",
      priority: "0.7",
    }));
  }

  for (const row of newsResult.rows as { slug: string; updated_at: string }[]) {
    urls.push(url(`/news/${row.slug}`, {
      lastmod: fmt(row.updated_at),
      changefreq: "monthly",
      priority: "0.6",
    }));
  }

  for (const row of brandsResult.rows as { slug: string }[]) {
    urls.push(url(`/brands/${row.slug}`, {
      lastmod: today,
      changefreq: "weekly",
      priority: "0.8",
    }));
  }

  for (const row of landingResult.rows as { slug: string; updated_at: string }[]) {
    urls.push(url(`/p/${row.slug}`, {
      lastmod: fmt(row.updated_at),
      changefreq: "weekly",
      priority: "0.7",
    }));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

const FAKE_SITEMAPS = [
  "/news-sitemap.xml",
  "/page-sitemap.xml",
  "/post-sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
  "/sitemap1.xml",
  "/sitemap2.xml",
  "/wp-sitemap.xml",
];

/**
 * Add a URL to STATIC_PAGES at runtime and reset the sitemap cache.
 * Used by the SEO Autopilot when a 'sitemap' suggestion is approved.
 * Returns true if the URL was newly added, false if it was already present.
 */
export function addSitemapPage(
  loc: string,
  opts: { changefreq?: string; priority?: string } = {},
): boolean {
  const normalized = loc.startsWith("/") ? loc : `/${loc}`;
  const already = STATIC_PAGES.some(p => p.loc === normalized);
  if (already) return false;
  STATIC_PAGES.push({
    loc: normalized,
    changefreq: opts.changefreq ?? "weekly",
    priority: opts.priority ?? "0.7",
  });
  cache = null; // invalidate so next request rebuilds
  return true;
}

export function registerSitemapRoute(app: Express): void {
  const key = getIndexNowKey();

  for (const path of FAKE_SITEMAPS) {
    app.get(path, (_req, res) => res.status(404).end());
  }

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /admin/",
        "",
        `Sitemap: ${SITE}/sitemap.xml`,
        `# IndexNow key: ${SITE}/${key}.txt`,
      ].join("\n"),
    );
  });

  app.get(`/${key}.txt`, (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(key);
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      if (cache && Date.now() - cache.ts < CACHE_TTL) {
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.send(cache.xml);
      }
      const xml = await buildSitemap();
      cache = { xml, ts: Date.now() };
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(xml);
    } catch (err) {
      return res.status(500).send("Sitemap error");
    }
  });
}
