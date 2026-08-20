import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  getPrerenderedMetadata,
  listPrerenderedRoutes,
  loadPrerendered,
  type PrerenderManifest,
} from "./prerenderStorage";

const SITE = "https://debryansk-auto.ru";
const ERROR_MARKERS = [
  "Бренд не найден",
  "Страница не найдена",
  "Page not found",
];

export type BrandRouteHealthStatus = "healthy" | "missing" | "broken" | "orphan";

export interface BrandRouteHealth {
  route: string;
  status: BrandRouteHealthStatus;
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

export function inspectBrandSnapshot(route: string, html: string, known: boolean): string[] {
  const issues: string[] = [];
  if (!known) issues.push("URL отсутствует в текущем реестре брендов");
  if (ERROR_MARKERS.some((marker) => html.includes(marker))) {
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

/**
 * Reconciles the live brand registry against every cached /brands/* route.
 * The disk cache is the source of truth for orphan snapshots; the DB is the
 * source of truth for whether a route is allowed to be indexed.
 */
export async function scanBrandRouteHealth(): Promise<BrandRouteHealth[]> {
  const [brandRows, cachedRoutes] = await Promise.all([
    db.execute(sql`SELECT name, slug FROM brands WHERE slug IS NOT NULL AND slug <> 's-probegom'`),
    listPrerenderedRoutes(),
  ]);
  const active = new Map(
    (brandRows.rows as { name: string; slug: string }[]).map((brand) => [`/brands/${brand.slug}`, brand.name]),
  );
  const routes = [...new Set([
    ...active.keys(),
    ...cachedRoutes.filter((route) => /^\/brands\/[^/]+$/.test(route)),
  ])].sort();

  const results: BrandRouteHealth[] = [];
  for (const route of routes) {
    const brandName = active.get(route) ?? null;
    const lifecycle = brandName ? "active" : "gone";
    const [html, metadata, crawlerStatus] = await Promise.all([
      loadPrerendered(route),
      getPrerenderedMetadata(route),
      probeCrawler(route),
    ]);
    if (!html) {
      results.push({
        route, brandName, lifecycle, status: lifecycle === "active" ? "missing" : "orphan",
        issues: lifecycle === "active" ? ["Нет опубликованного prerender-кэша"] : ["Orphan URL без HTML-кэша"],
        cacheUpdatedAt: null, manifest: metadata.manifest, crawlerStatus,
      });
      continue;
    }
    const issues = inspectBrandSnapshot(route, html, lifecycle === "active");
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
