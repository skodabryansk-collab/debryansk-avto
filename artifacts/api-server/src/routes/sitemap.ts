import { type Express } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getIndexNowKey } from "../services/indexnow";

const SITE = "https://debryansk-auto.ru";
const CACHE_TTL = 60 * 60 * 1000;

let cache: { xml: string; ts: number } | null = null;

export const STATIC_PAGES = [
  { loc: "/",          changefreq: "daily",   priority: "1.0" },
  { loc: "/brands",    changefreq: "weekly",  priority: "0.8" },
  { loc: "/new-cars",  changefreq: "daily",   priority: "0.9" },
  { loc: "/cars",      changefreq: "daily",   priority: "0.9" },
  { loc: "/buyout",    changefreq: "weekly",  priority: "0.8" },
  { loc: "/service",       changefreq: "weekly",  priority: "0.8" },
  { loc: "/service/bonus", changefreq: "weekly",  priority: "0.7" },
  { loc: "/corporate",     changefreq: "weekly",  priority: "0.7" },
  { loc: "/news",          changefreq: "daily",   priority: "0.8" },
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
  const [carsResult, newsResult, brandsResult, landingResult, extraResult] = await Promise.all([
    db.execute(sql`SELECT external_id, type, synced_at FROM cars ORDER BY synced_at DESC`),
    db.execute(sql`SELECT slug, updated_at FROM news ORDER BY updated_at DESC`),
    db.execute(sql`SELECT slug FROM brands WHERE slug IS NOT NULL AND slug NOT IN ('s-probegom', 'mb-bryansk') ORDER BY name`),
    db.execute(sql`SELECT slug, updated_at FROM seo_landing_pages WHERE is_published = true ORDER BY updated_at DESC`).catch(() => ({ rows: [] })),
    db.execute(sql`SELECT loc, changefreq, priority FROM sitemap_extra_pages ORDER BY added_at ASC`).catch(() => ({ rows: [] })),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [];

  // Track every loc emitted to prevent duplicates across all sections
  const emittedLocs = new Set<string>();

  function emitUrl(loc: string, opts: Parameters<typeof url>[1] = {}): void {
    const normalized = loc === "/" ? "/" : `/${loc.replace(/^\/+|\/+$/g, "")}`;
    if (emittedLocs.has(normalized)) return;
    emittedLocs.add(normalized);
    urls.push(url(normalized, opts));
  }

  // Static hardcoded pages
  for (const page of STATIC_PAGES) {
    emitUrl(page.loc, { lastmod: today, changefreq: page.changefreq, priority: page.priority });
  }

  // Extra pages approved via SEO Autopilot (durable, from DB)
  // Deduplication is handled by emitUrl — any loc already covered by the dynamic
  // sections below (brands, cars, news, landings) will be silently skipped.
  for (const row of extraResult.rows as { loc: string; changefreq: string; priority: string }[]) {
    emitUrl(row.loc, { lastmod: today, changefreq: row.changefreq, priority: row.priority });
  }

  for (const row of carsResult.rows as { external_id: string; type: string; synced_at: string }[]) {
    const path = row.type === "new" ? "/new-cars" : "/cars";
    const enc = encodeURIComponent(row.external_id);
    emitUrl(`${path}/${enc}`, {
      lastmod: fmt(row.synced_at),
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  for (const row of newsResult.rows as { slug: string; updated_at: string }[]) {
    emitUrl(`/news/${row.slug}`, {
      lastmod: fmt(row.updated_at),
      changefreq: "monthly",
      priority: "0.6",
    });
  }

  for (const row of brandsResult.rows as { slug: string }[]) {
    emitUrl(`/brands/${row.slug}`, {
      lastmod: today,
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  for (const row of landingResult.rows as { slug: string; updated_at: string }[]) {
    emitUrl(`/p/${row.slug}`, {
      lastmod: fmt(row.updated_at),
      changefreq: "weekly",
      priority: "0.7",
    });
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
 * Persist a URL to the sitemap_extra_pages DB table and update the in-memory
 * cache. Safe to call multiple times for the same URL (idempotent via UPSERT).
 * Always resets the XML cache so the next request rebuilds from scratch.
 * Returns true if the row was newly inserted, false if it already existed.
 */
/**
 * Return a Set of all path strings currently included in sitemap.xml:
 *   • STATIC_PAGES (hardcoded)
 *   • sitemap_extra_pages table (added via SEO Autopilot)
 *   • /brands/:slug for every brand in DB (auto-included by buildSitemap)
 *
 * Used by the GAP engine to avoid generating duplicate sitemap suggestions.
 */
export async function getSitemapLocs(): Promise<Set<string>> {
  const locs = new Set<string>(STATIC_PAGES.map(p => p.loc));

  await Promise.allSettled([
    db
      .execute(sql`SELECT loc FROM sitemap_extra_pages`)
      .then(r => {
        for (const row of r.rows as { loc: string }[]) {
          locs.add(row.loc === "/" ? "/" : `/${row.loc.replace(/^\/+|\/+$/g, "")}`);
        }
      }),
    db
       .execute(sql`SELECT slug FROM brands WHERE slug IS NOT NULL AND slug NOT IN ('s-probegom', 'mb-bryansk')`)
      .then(r => {
        for (const row of r.rows as { slug: string }[]) locs.add(`/brands/${row.slug}`);
      }),
  ]);

  return locs;
}

export async function addSitemapPage(
  loc: string,
  opts: { changefreq?: string; priority?: string } = {},
): Promise<boolean> {
  const normalizedPath = loc === "/" ? "/" : `/${loc.replace(/^\/+|\/+$/g, "")}`;
  const normalized = normalizedPath || "/";
  const changefreq = opts.changefreq ?? "weekly";
  const priority   = opts.priority   ?? "0.7";

  const result = await db.execute(sql`
    INSERT INTO sitemap_extra_pages (loc, changefreq, priority)
    VALUES (${normalized}, ${changefreq}, ${priority})
    ON CONFLICT (loc) DO NOTHING
    RETURNING loc
  `);

  cache = null; // always invalidate — ensures next /sitemap.xml reflects current state
  return result.rows.length > 0; // true = newly inserted
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
