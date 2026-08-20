import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  getPrerenderedMetadata,
  listPrerenderedRoutes,
  loadPrerendered,
  type PrerenderManifest,
} from "./prerenderStorage";
import { STATIC_PAGES } from "../routes/sitemap";

const SITE = "https://debryansk-auto.ru";
export const PRERENDER_ERROR_MARKERS = [
  "Бренд не найден",
  "Страница не найдена",
  "Page not found",
  "404 Not Found",
];

export type RouteHealthStatus = "healthy" | "missing" | "broken" | "orphan";

export interface RouteHealth {
  route: string;
  status: RouteHealthStatus;
  lifecycle: "active" | "gone";
  brandName: string | null;
  issues: string[];
  cacheUpdatedAt: string | null;
  manifest: PrerenderManifest | null;
  crawlerStatus: number | null;
}

function matchMeta(html: string, attribute: "name" | "property", key: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

function matchCanonical(html: string): string | null {
  const tag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/href=["']([^"']*)["']/i)?.[1] ?? null;
}

export function inspectSnapshot(route: string, html: string, known: boolean): string[] {
  const issues: string[] = [];
  if (!known) issues.push("URL отсутствует в текущем реестре страниц");
  if (PRERENDER_ERROR_MARKERS.some((marker) => html.includes(marker))) {
    issues.push("В кэше сохранена страница ошибки");
  }
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title || title === "Дебрянск Авто") issues.push("Отсутствует корректный title");
  const description = matchMeta(html, "name", "description");
  if (!description) issues.push("Отсутствует meta description");
  const canonical = matchCanonical(html);
  if (canonical !== `${SITE}${route}`) issues.push("Canonical не совпадает с URL страницы");
  const robots = matchMeta(html, "name", "robots");
  if (!robots || /noindex/i.test(robots)) issues.push("Некорректный robots");
  if (!/<h1[\s>]/i.test(html)) issues.push("Отсутствует H1");
  if (!/<script[^>]+application\/ld\+json/i.test(html)) issues.push("Отсутствует JSON-LD");
  if (!/<main[\s>]/i.test(html) || html.length < 5_000) issues.push("Похоже на пустую SPA-оболочку");
  return issues;
}

async function probeCrawler(route: string): Promise<number | null> {
  const baseUrl = (process.env.PRERENDER_SITE_URL || `http://localhost:${process.env.PORT || "8080"}`).replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      headers: { "User-Agent": "YandexBot/3.0 (+http://yandex.com/bots)" },
      signal: AbortSignal.timeout(5_000),
    });
    return response.status;
  } catch {
    return null;
  }
}

async function getExpectedPrerenderRoutes(): Promise<Map<string, string | null>> {
  const [brandRows, carRows, newsRows, promotionRows, landingRows, extraRows] = await Promise.all([
    db.execute(sql`SELECT name, slug FROM brands WHERE slug IS NOT NULL AND slug <> 's-probegom'`),
    db.execute(sql`
      SELECT type, external_id FROM cars
      WHERE type IN ('new', 'used') AND external_id IS NOT NULL
    `),
    db.execute(sql`SELECT slug FROM news WHERE slug IS NOT NULL`),
    db.execute(sql`
      SELECT slug FROM promotions
      WHERE slug IS NOT NULL AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    `),
    db.execute(sql`SELECT slug FROM seo_landing_pages WHERE is_published = TRUE AND slug IS NOT NULL`).catch(() => ({ rows: [] })),
    db.execute(sql`SELECT loc FROM sitemap_extra_pages WHERE loc IS NOT NULL`).catch(() => ({ rows: [] })),
  ]);
  const expected = new Map<string, string | null>(
    (brandRows.rows as { name: string; slug: string }[]).map((brand) => [`/brands/${brand.slug}`, brand.name]),
  );
  for (const car of carRows.rows as { type: "new" | "used"; external_id: string }[]) {
    expected.set(`/${car.type === "new" ? "new-cars" : "cars"}/${encodeURIComponent(car.external_id)}`, null);
  }
  for (const row of newsRows.rows as { slug: string }[]) {
    expected.set(`/news/${encodeURIComponent(row.slug)}`, null);
  }
  for (const row of promotionRows.rows as { slug: string }[]) {
    expected.set(`/promotions/${encodeURIComponent(row.slug)}`, null);
  }
  for (const row of landingRows.rows as { slug: string }[]) {
    expected.set(`/p/${encodeURIComponent(row.slug)}`, null);
  }
  for (const row of extraRows.rows as { loc: string }[]) {
    if (row.loc.startsWith("/")) expected.set(row.loc, null);
  }
  // Static sitemap routes are also legitimate cache routes, even when their
  // production HTML is currently supplied by SSG rather than Puppeteer.
  for (const { loc: route } of STATIC_PAGES) {
    expected.set(route, null);
  }
  return expected;
}

/**
 * Reconciles the active route registry against every cached route, not only
 * brand pages. Cached files are the source of truth for orphan discovery;
 * the DB-derived registry is the source of truth for active dynamic routes.
 */
export async function scanRouteHealth(): Promise<RouteHealth[]> {
  const [expected, cachedRoutes] = await Promise.all([
    getExpectedPrerenderRoutes(),
    listPrerenderedRoutes(),
  ]);
  const routes = [...new Set([...expected.keys(), ...cachedRoutes])].sort();

  const results: RouteHealth[] = [];
  for (const route of routes) {
    const brandName = expected.get(route) ?? null;
    const lifecycle = expected.has(route) ? "active" : "gone";
    const [html, metadata, crawlerStatus] = await Promise.all([
      loadPrerendered(route),
      getPrerenderedMetadata(route),
      // A crawler probe is especially important for the incident class that
      // motivated this work. Avoid N HTTP requests for large car inventories;
      // their cache/HTML validation still runs for every route.
      route.startsWith("/brands/") ? probeCrawler(route) : Promise.resolve(null),
    ]);
    if (!html) {
      results.push({
        route, brandName, lifecycle, status: lifecycle === "active" ? "missing" : "orphan",
        issues: lifecycle === "active" ? ["Нет опубликованного prerender-кэша"] : ["Orphan URL без HTML-кэша"],
        cacheUpdatedAt: null, manifest: metadata.manifest, crawlerStatus,
      });
      continue;
    }
    const issues = inspectSnapshot(route, html, lifecycle === "active");
    if (!metadata.manifest) issues.push("Нет manifest-файла кэша");
    if (lifecycle === "active" && crawlerStatus !== null && crawlerStatus !== 200) {
      issues.push(`Crawler получает HTTP ${crawlerStatus}, ожидается 200`);
    }
    if (lifecycle === "gone" && crawlerStatus !== null && crawlerStatus === 200) {
      issues.push("Crawler получает HTTP 200 для удалённого URL");
    }
    results.push({
      route, brandName, lifecycle,
      status: lifecycle === "gone" ? "orphan" : issues.length ? "broken" : "healthy",
      issues, cacheUpdatedAt: metadata.updatedAt, manifest: metadata.manifest, crawlerStatus,
    });
  }
  return results;
}

/** Kept for callers that specifically need the brand-only view. */
export async function scanBrandRouteHealth(): Promise<RouteHealth[]> {
  const all = await scanRouteHealth();
  return all.filter((item) => item.route.startsWith("/brands/"));
}
