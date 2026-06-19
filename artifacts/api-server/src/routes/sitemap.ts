import { type Express } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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
  const [carsResult, newsResult, brandsResult] = await Promise.all([
    db.execute(sql`SELECT external_id, type, synced_at FROM cars ORDER BY synced_at DESC`),
    db.execute(sql`SELECT slug, updated_at FROM news ORDER BY updated_at DESC`),
    db.execute(sql`SELECT slug FROM brands WHERE slug IS NOT NULL AND slug != 's-probegom' ORDER BY name`),
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

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

export function registerSitemapRoute(app: Express): void {
  app.get("/api/sitemap.xml", async (_req, res) => {
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
