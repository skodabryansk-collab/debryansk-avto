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

interface ExpectedRoute {
  brandName: string | null;
  /** True only when bots are actually served from the Puppeteer snapshot. */
  snapshotRequired: boolean;
  /** Brand pages are the incident-sensitive crawler path. */
  probeCrawler: boolean;
}

const CRAWLER_PROBE_TTL_MS = 5 * 60_000;
const CRAWLER_PROBE_TIMEOUT_MS = 2_000;
const crawlerProbeCache = new Map<string, { status: number | null; expiresAt: number }>();

export function requiresPrerenderSnapshot(route: string): boolean {
  return /^\/brands\/[^/]+$/.test(route) || /^\/(?:cars|new-cars)\/[^/]+$/.test(route);
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
  const cached = crawlerProbeCache.get(route);
  if (cached && cached.expiresAt > Date.now()) return cached.status;
  const baseUrl = (process.env.PRERENDER_SITE_URL || `http://localhost:${process.env.PORT || "8080"}`).replace(/\/$/, "");
  let status: number | null = null;
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      headers: { "User-Agent": "YandexBot/3.0 (+http://yandex.com/bots)" },
      signal: AbortSignal.timeout(CRAWLER_PROBE_TIMEOUT_MS),
    });
    status = response.status;
  } catch {
    // Network availability is not a route defect; retain an explicit unknown
    // result briefly rather than repeatedly delaying the admin audit.
  }
  crawlerProbeCache.set(route, { status, expiresAt: Date.now() + CRAWLER_PROBE_TTL_MS });
  return status;
}

async function getExpectedPrerenderRoutes(): Promise<Map<string, ExpectedRoute>> {
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
  const expected = new Map<string, ExpectedRoute>(
    (brandRows.rows as { name: string; slug: string }[]).map((brand) => [
      `/brands/${brand.slug}`,
      { brandName: brand.name, snapshotRequired: true, probeCrawler: true },
    ]),
  );
  for (const car of carRows.rows as { type: "new" | "used"; external_id: string }[]) {
    expected.set(`/${car.type === "new" ? "new-cars" : "cars"}/${encodeURIComponent(car.external_id)}`, {
      brandName: null, snapshotRequired: true, probeCrawler: false,
    });
  }
  for (const row of newsRows.rows as { slug: string }[]) {
    expected.set(`/news/${encodeURIComponent(row.slug)}`, { brandName: null, snapshotRequired: false, probeCrawler: false });
  }
  for (const row of promotionRows.rows as { slug: string }[]) {
    expected.set(`/promotions/${encodeURIComponent(row.slug)}`, { brandName: null, snapshotRequired: false, probeCrawler: false });
  }
  for (const row of landingRows.rows as { slug: string }[]) {
    expected.set(`/p/${encodeURIComponent(row.slug)}`, { brandName: null, snapshotRequired: false, probeCrawler: false });
  }
  for (const row of extraRows.rows as { loc: string }[]) {
    if (row.loc.startsWith("/")) expected.set(row.loc, { brandName: null, snapshotRequired: requiresPrerenderSnapshot(row.loc), probeCrawler: false });
  }
  // Static sitemap routes are also legitimate cache routes, even when their
  // production HTML is currently supplied by SSG rather than Puppeteer.
  for (const { loc: route } of STATIC_PAGES) {
    expected.set(route, { brandName: null, snapshotRequired: false, probeCrawler: false });
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

  const inspectRoute = async (route: string): Promise<RouteHealth> => {
    const expectedRoute = expected.get(route);
    const brandName = expectedRoute?.brandName ?? null;
    const lifecycle = expectedRoute ? "active" : "gone";
    const [html, metadata, crawlerStatus] = await Promise.all([
      loadPrerendered(route),
      getPrerenderedMetadata(route),
      // A crawler probe is especially important for the incident class that
      // motivated this work. Avoid N HTTP requests for large car inventories;
      // their cache/HTML validation still runs for every route.
      expectedRoute?.probeCrawler ? probeCrawler(route) : Promise.resolve(null),
    ]);
    if (!html) {
      return {
        route, brandName, lifecycle,
        status: lifecycle === "gone" ? "orphan" : expectedRoute?.snapshotRequired ? "missing" : "healthy",
        issues: lifecycle === "gone"
          ? ["Orphan URL без HTML-кэша"]
          : expectedRoute?.snapshotRequired ? ["Нет опубликованного prerender-кэша"] : [],
        cacheUpdatedAt: null, manifest: metadata.manifest, crawlerStatus,
      };
    }
    // SSG routes may still have an old file on disk, but bots never consume it.
    // Keep it in inventory for orphan detection without surfacing it as a defect.
    const issues = lifecycle === "gone" || expectedRoute?.snapshotRequired
      ? inspectSnapshot(route, html, lifecycle === "active")
      : [];
    if (expectedRoute?.snapshotRequired && !metadata.manifest) issues.push("Нет manifest-файла кэша");
    if (lifecycle === "active" && crawlerStatus !== null && crawlerStatus !== 200) {
      issues.push(`Crawler получает HTTP ${crawlerStatus}, ожидается 200`);
    }
    if (lifecycle === "gone" && crawlerStatus !== null && crawlerStatus === 200) {
      issues.push("Crawler получает HTTP 200 для удалённого URL");
    }
    return {
      route, brandName, lifecycle,
      status: lifecycle === "gone" ? "orphan" : expectedRoute?.snapshotRequired && issues.length ? "broken" : "healthy",
      issues, cacheUpdatedAt: metadata.updatedAt, manifest: metadata.manifest, crawlerStatus,
    };
  };
  // Bounded workers prevent a large cache inventory from flooding the file
  // system or crawler endpoint. Brand probes are independently TTL-cached.
  const results: RouteHealth[] = [];
  const pending = [...routes];
  const workers = Array.from({ length: Math.min(8, pending.length) }, async () => {
    while (pending.length) {
      const route = pending.shift();
      if (route) results.push(await inspectRoute(route));
    }
  });
  await Promise.all(workers);
  return results.sort((a, b) => a.route.localeCompare(b.route));
}

/** Kept for callers that specifically need the brand-only view. */
export async function scanBrandRouteHealth(): Promise<RouteHealth[]> {
  const all = await scanRouteHealth();
  return all.filter((item) => item.route.startsWith("/brands/"));
}
