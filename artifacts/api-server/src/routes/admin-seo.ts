import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { resolveMeta, STATIC_META } from "../middleware/seoMeta";
import { getPrerenderCache } from "../middleware/prerender";
import { loadPrerendered } from "../lib/prerenderStorage";
import { inspectSnapshot, repairLegacyManifest, scanRouteHealth } from "../lib/routeHealth";
import { deletePrerendered, getPrerenderedMetadata } from "../lib/prerenderStorage";
import { deletePrerenderCache } from "../middleware/prerender";
import { prerenderRouteAndWait, spawnPrerenderRoute } from "../lib/spawnBrandPrerender";
import { logger } from "../lib/logger";
import { readGeoCitationReport } from "../lib/geoCitationReport";

const WEBMASTER_USER_ID = "140495458";
const HOST_ID = "https%3Adebryansk-auto.ru%3A443";

function getWebmasterToken(): string {
  return process.env["YANDEX_WEBMASTER_TOKEN"] || "";
}

export interface SeoPageItem {
  route: string;
  title: string;
  description: string;
  source: "ssg" | "brand" | "promotion" | "car" | "static";
  isCached: boolean;
  isGone: boolean;
  canonical: string;
  ogImage?: string;
}

export interface SeoAuditItem extends SeoPageItem {
  issues: string[];
  isStale: boolean;
  cachedTitle?: string;
  cachedDescription?: string;
}

const STATIC_ROUTES = Object.keys(STATIC_META);

let lastAudit: { ranAt: string; items: SeoAuditItem[] } | null = null;

interface BrandCatalogInfo {
  brandName: string;
  slug: string;
  isServiceOnly: boolean;
  models: string[];
  minPrice: number | null;
  maxPrice: number | null;
  maxDiscount: number | null;
  bodyTypes: string[];
  count: number;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}

async function fetchBrandCatalogInfo(): Promise<BrandCatalogInfo[]> {
  const brands = await db.execute(sql`
    SELECT id, name, slug, is_service_only
    FROM brands
    WHERE slug IS NOT NULL
    ORDER BY name
  `);

  const result: BrandCatalogInfo[] = [];
  for (const brand of brands.rows as { id: number; name: string; slug: string; is_service_only: boolean }[]) {
    const catalog = await db.execute(sql`
      SELECT
        COUNT(*)::int AS count,
        MIN(price)::int AS min_price,
        MAX(price)::int AS max_price,
        MAX(max_discount)::int AS max_discount,
        ARRAY_AGG(DISTINCT body_type) FILTER (WHERE body_type IS NOT NULL) AS body_types,
        ARRAY_AGG(DISTINCT TRIM(SPLIT_PART(model, ',', 1))) FILTER (WHERE model IS NOT NULL) AS models
      FROM cars
      WHERE type = 'new' AND LOWER(dealer) = LOWER(${brand.name})
    `);
    const row = catalog.rows[0] as {
      count: number;
      min_price: number | null;
      max_price: number | null;
      max_discount: number | null;
      body_types: string[] | null;
      models: string[] | null;
    } | null;

    const models = (row?.models ?? []).slice(0, 5);
    const bodyTypes = (row?.body_types ?? []).slice(0, 3);
    result.push({
      brandName: brand.name,
      slug: brand.slug,
      isServiceOnly: brand.is_service_only,
      models,
      minPrice: row?.min_price ?? null,
      maxPrice: row?.max_price ?? null,
      maxDiscount: row?.max_discount ?? null,
      bodyTypes,
      count: row?.count ?? 0,
    });
  }
  return result;
}

function generateBrandDescription(info: BrandCatalogInfo): string {
  if (info.isServiceOnly) {
    return `Гарантийное и постгарантийное обслуживание, диагностика, ремонт и оригинальные запчасти.`;
  }
  if (info.count === 0) {
    return `Купить автомобиль в кредит или trade-in. Выгодные условия, гарантийный сервис.`;
  }
  const pricePart = info.minPrice ? ` от ${formatPrice(info.minPrice)} ₽` : "";
  const discountPart = info.maxDiscount && info.maxDiscount > 0 ? `, выгода до ${formatPrice(info.maxDiscount)} ₽` : "";
  const modelPart = info.models.length > 0 ? `${info.models.join(", ")}` : "";
  let desc = "";
  if (modelPart && pricePart) {
    desc = `Автомобили в наличии${pricePart}${discountPart}. Модели: ${modelPart}. Кредит, trade-in, сервис.`;
  } else if (pricePart) {
    desc = `Автомобили в наличии${pricePart}${discountPart}. Кредит, trade-in, сервис.`;
  } else if (modelPart) {
    desc = `Модели в наличии: ${modelPart}. Кредит, trade-in, сервис.`;
  } else {
    desc = `Купить автомобиль в кредит или trade-in. Выгодные условия, гарантийный сервис.`;
  }
  return desc.length > 170 ? `${desc.slice(0, 167)}...` : desc;
}

export async function generateBrandMetaDescriptions(): Promise<{ slug: string; brandName: string; description: string; title: string }[]> {
  const infos = await fetchBrandCatalogInfo();
  return infos.map((info) => ({
    slug: info.slug,
    brandName: info.brandName,
    description: generateBrandDescription(info),
    title: `${info.brandName} в Брянске — ${info.isServiceOnly ? "официальный сервис" : "официальный дилер"} | Дебрянск Авто`,
  }));
}

export async function applyBrandMetaDescriptions(descriptions: { slug: string; description: string; title: string }[]): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;

  for (const item of descriptions) {
    const brandResult = await db.execute(sql`SELECT id FROM brands WHERE slug = ${item.slug} LIMIT 1`);
    const brandRow = brandResult.rows[0] as { id: number } | undefined;
    if (!brandRow) {
      skipped++;
      continue;
    }
    const brandId = brandRow.id;
    const existing = await db.execute(sql`SELECT id FROM brand_page_content WHERE brand_id = ${brandId} LIMIT 1`);
    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE brand_page_content
        SET meta_title = ${item.title}, meta_description = ${item.description}, updated_at = NOW()
        WHERE brand_id = ${brandId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO brand_page_content (brand_id, meta_title, meta_description)
        VALUES (${brandId}, ${item.title}, ${item.description})
      `);
    }
    updated++;
  }
  return { updated, skipped };
}

function parseCachedMeta(html: string): { title: string; description: string } {
  // Prefer og:title — injectMeta() always strips all existing og:title tags before
  // inserting exactly one, so it's never duplicated even when React Helmet and seoMeta
  // both write <title> (causing the duplicate <title> problem on the home page).
  const ogTitleMatch =
    html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
    html.match(/<meta\s+content="([^"]*)"\s+property="og:title"/i);
  // Fallback: if no og:title, take the LAST <title> match (React Helmet prepends its
  // tag before the seoMeta-injected one, so last = seoMeta authoritative value).
  const allTitleMatches = [...html.matchAll(/<title>([^<]*)<\/title>/gi)];
  const titleFallback = allTitleMatches.at(-1)?.[1]?.trim() ?? "";

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  return {
    title: ogTitleMatch?.[1]?.trim() || titleFallback,
    description: descMatch?.[1]?.trim() ?? "",
  };
}

function detectIssues(
  page: SeoPageItem,
  cachedMeta: { title: string; description: string } | null,
): { issues: string[]; isStale: boolean } {
  const issues: string[] = [];
  let isStale = false;

  if (!page.title) issues.push("Пустой title");
  if (!page.description) issues.push("Пустой description");
  if (page.title.toLowerCase().includes("бренд не найден")) issues.push("Бренд не найден");
  if (page.title.toLowerCase().includes("redirecting")) issues.push("Редирект");
  if (page.isGone) issues.push("410 Gone — страница удалена из кеша");
  if (!page.isCached && page.source !== "static") {
    issues.push("Не в кеше пририндера");
  }
  if (page.title.includes("Дебрянск Авто | Дебрянск Авто") || page.title.includes("Дебрянск Авто — Дебрянск Авто")) {
    issues.push("Дублирование бренда в title");
  }

  const decodeHtml = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/\u00a0/g, " "); // non-breaking space unicode
  const norm = (s: string) =>
    decodeHtml(s).trim().replace(/\s+/g, " ").replace(/[«»„"]/g, '"');
  if (cachedMeta && page.isCached) {
    if (cachedMeta.title && norm(cachedMeta.title) !== norm(page.title)) {
      issues.push("Кеш устарел (title не совпадает)");
      isStale = true;
    }
    if (cachedMeta.description && norm(cachedMeta.description) !== norm(page.description)) {
      issues.push("Кеш устарел (description не совпадает)");
      isStale = true;
    }
  }

  return { issues, isStale };
}

async function runSeoAudit(): Promise<SeoAuditItem[]> {
  const pages = await buildSeoPages();
  // in-memory cache is only used for gone-routes check — isCached is re-evaluated
  // from disk below so it reflects what prerender.mjs wrote after the last run
  const inMemCache = getPrerenderCache();
  const items: SeoAuditItem[] = [];

  for (const page of pages) {
    // Read directly from disk so the audit always reflects the latest prerender.mjs
    // output, even though prerender runs as a detached child process and never
    // updates the in-memory Map.
    const cachedHtml = await loadPrerendered(page.route);
    const isCachedOnDisk = !!cachedHtml;
    const cachedMeta = cachedHtml ? parseCachedMeta(cachedHtml) : null;

    // Override isCached with disk reality; keep isGone from in-memory (it's
    // written synchronously by the clear endpoint, not by a background process)
    const pageWithDiskStatus: SeoPageItem = {
      ...page,
      isCached: isCachedOnDisk,
      isGone: inMemCache.gone.has(page.route),
    };

    const { issues, isStale } = detectIssues(pageWithDiskStatus, cachedMeta);
    items.push({
      ...pageWithDiskStatus,
      issues,
      isStale,
      cachedTitle: cachedMeta?.title,
      cachedDescription: cachedMeta?.description,
    });
  }

  // Cache inventory is deliberately scanned separately from buildSeoPages():
  // old /brands/* snapshots are not present in the DB page list but can still
  // be served to crawlers after a slug rename or deletion.
  const healthItems = await scanRouteHealth();
  for (const health of healthItems) {
    if (health.status === "healthy") continue;
    // A legacy HTML snapshot without its newer sidecar manifest is a migration
    // action, not an SEO defect. It stays visible in Route Health only.
    if (health.status === "needs_manifest") continue;
    const item = items.find((candidate) => candidate.route === health.route);
    const technicalIssues = health.issues.map((issue) => `Техническая проверка: ${issue}`);
    if (item) {
      item.issues.push(...technicalIssues);
      item.isStale ||= health.status === "broken" || health.status === "missing";
      continue;
    }
    items.push({
      route: health.route,
      title: health.brandName ? `${health.brandName} — устаревший маршрут` : "Удалённый бренд",
      description: "URL найден только в prerender-кэше и не должен индексироваться.",
      source: "brand",
      isCached: true,
      isGone: health.lifecycle === "gone",
      canonical: `https://debryansk-auto.ru${health.route}`,
      issues: technicalIssues,
      isStale: true,
    });
  }

  lastAudit = { ranAt: new Date().toISOString(), items };
  logger.info({ pages: items.length, issues: items.filter((i) => i.issues.length > 0).length }, "[admin-seo] Audit completed");
  return items;
}

async function buildSeoPages(): Promise<SeoPageItem[]> {
  const pages: SeoPageItem[] = [];
  const cache = getPrerenderCache();

  // Static / SSG routes
  for (const route of STATIC_ROUTES) {
    const meta = await resolveMeta(route);
    if (meta) {
      pages.push({
        route,
        title: meta.title,
        description: meta.description,
        source: "static",
        isCached: cache.pages.has(route),
        isGone: cache.gone.has(route),
        canonical: meta.canonical,
        ogImage: meta.ogImage,
      });
    }
  }

  // Brand pages
  const brandRows = await db.execute(sql`
    SELECT b.slug, b.name, b.is_service_only, bpc.meta_title, bpc.meta_description
    FROM brands b
    LEFT JOIN brand_page_content bpc ON bpc.brand_id = b.id
    ORDER BY b.name
  `);
  for (const row of brandRows.rows as Array<{
    slug: string;
    name: string;
    is_service_only: boolean;
    meta_title: string | null;
    meta_description: string | null;
  }>) {
    const route = `/brands/${row.slug}`;
    const meta = await resolveMeta(route);
    if (meta) {
      pages.push({
        route,
        title: meta.title,
        description: meta.description,
        source: "brand",
        isCached: cache.pages.has(route),
        isGone: cache.gone.has(route),
        canonical: meta.canonical,
        ogImage: meta.ogImage,
      });
    }
  }

  return pages;
}

export async function requestYandexRecrawl(url: string): Promise<{ task_id: string; quota_remainder: number }> {
  const token = getWebmasterToken();
  if (!token) throw new Error("YANDEX_WEBMASTER_TOKEN не задан");

  const apiUrl = `https://api.webmaster.yandex.net/v4/user/${WEBMASTER_USER_ID}/hosts/${HOST_ID}/recrawl/queue`;
  const r = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `OAuth ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30_000),
  });

  const json = await r.json() as { task_id?: string; quota_remainder?: number; error_message?: string; error_code?: string; message?: string };
  if (!r.ok || json.error_code) {
    logger.warn({ url, status: r.status, body: json }, "[admin-seo] Webmaster recrawl failed");
    throw new Error(json.error_message || json.message || `HTTP ${r.status}`);
  }
  if (!json.task_id || typeof json.quota_remainder !== "number") {
    throw new Error("Некорректный ответ Яндекс.Вебмастера");
  }
  logger.info({ url, task_id: json.task_id, quota: json.quota_remainder }, "[admin-seo] Webmaster recrawl requested");
  return { task_id: json.task_id, quota_remainder: json.quota_remainder };
}

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/pages", async (_req, res) => {
  try {
    const pages = await buildSeoPages();
    return res.json({ ok: true, data: pages });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/geo-citations", async (_req, res): Promise<void> => {
  const report = await readGeoCitationReport();
  if (report.status === "invalid") {
    logger.warn({ status: report.status }, "[admin-seo] GEO citation report is unavailable");
  }
  res.json({ ok: true, ...report });
});

router.post("/recrawl", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || !url.startsWith("https://debryansk-auto.ru")) {
      return res.status(400).json({ ok: false, error: "Укажите корректный URL сайта" });
    }
    const result = await requestYandexRecrawl(url);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/audit", async (_req, res) => {
  try {
    if (!lastAudit) {
      const items = await runSeoAudit();
      return res.json({ ok: true, data: { ranAt: new Date().toISOString(), items } });
    }
    return res.json({ ok: true, data: lastAudit });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/audit", async (_req, res) => {
  try {
    const items = await runSeoAudit();
    return res.json({ ok: true, data: { ranAt: new Date().toISOString(), items } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/route-health", async (_req, res) => {
  try {
    const items = await scanRouteHealth();
    const checkedAt = new Date().toISOString();
    const formatAge = (date: string | null): string | null => {
      if (!date) return null;
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
      return minutes < 60 ? `${minutes} мин` : minutes < 1440 ? `${Math.floor(minutes / 60)} ч` : `${Math.floor(minutes / 1440)} дн`;
    };
    return res.json({
      ok: true,
      checkedAt,
      items: items.map((item) => ({
        route: item.route,
        status: item.status === "healthy"
          ? "ok"
          : item.status === "needs_manifest"
          ? "needs_manifest"
          : "error",
        issueSummary: item.issues.join("; "),
        cacheAge: formatAge(item.cacheUpdatedAt),
        crawlerStatus: item.issues.some((issue) => issue.includes("robots"))
          ? "noindex"
          : item.crawlerStatus === 200 ? "indexed"
          : item.crawlerStatus !== null ? "blocked"
          : "unknown",
      })),
    });
  } catch (err) {
    logger.error({ err }, "[admin-seo] route health scan failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

interface ManifestRepairJob {
  status: "idle" | "running" | "completed" | "failed";
  total: number;
  processed: number;
  fixed: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  errors: Array<{ route: string; error: string }>;
}

let manifestRepairJob: ManifestRepairJob = {
  status: "idle", total: 0, processed: 0, fixed: 0, failed: 0,
  startedAt: null, completedAt: null, errors: [],
};

router.get("/route-health/manifest-repair/preview", async (_req, res) => {
  try {
    const items = await scanRouteHealth();
    const eligible = items.filter((item) => item.status === "needs_manifest").map((item) => item.route);
    return res.json({
      ok: true,
      total: eligible.length,
      routes: eligible,
      skipped: items.filter((item) => item.status === "broken" || item.status === "orphan").length,
    });
  } catch (err) {
    logger.error({ err }, "[admin-seo] manifest repair preview failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/route-health/manifest-repair/status", (_req, res) => {
  return res.json({ ok: true, ...manifestRepairJob });
});

router.post("/route-health/manifest-repair/start", async (_req, res) => {
  if (manifestRepairJob.status === "running") {
    return res.status(409).json({ ok: false, error: "Массовое обновление уже выполняется" });
  }
  try {
    const items = await scanRouteHealth();
    const routes = items.filter((item) => item.status === "needs_manifest").map((item) => item.route);
    manifestRepairJob = {
      status: "running", total: routes.length, processed: 0, fixed: 0, failed: 0,
      startedAt: new Date().toISOString(), completedAt: null, errors: [],
    };
    void (async () => {
      const pending = [...routes];
      const workers = Array.from({ length: Math.min(2, Math.max(1, pending.length)) }, async () => {
        while (pending.length) {
          const route = pending.shift();
          if (!route) break;
          try {
            await repairLegacyManifest(route);
            manifestRepairJob.fixed += 1;
          } catch (err) {
            manifestRepairJob.failed += 1;
            manifestRepairJob.errors.push({ route, error: String(err) });
          } finally {
            manifestRepairJob.processed += 1;
          }
        }
      });
      await Promise.all(workers);
      manifestRepairJob.status = manifestRepairJob.failed > 0 && manifestRepairJob.fixed === 0 ? "failed" : "completed";
      manifestRepairJob.completedAt = new Date().toISOString();
    })().catch((err) => {
      manifestRepairJob.status = "failed";
      manifestRepairJob.completedAt = new Date().toISOString();
      manifestRepairJob.errors.push({ route: "*", error: String(err) });
    });
    return res.status(202).json({ ok: true, total: routes.length, message: routes.length ? "Массовое обновление запущено" : "Маршрутов для обновления нет" });
  } catch (err) {
    logger.error({ err }, "[admin-seo] manifest repair start failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

interface CacheRepairJob {
  status: "idle" | "running" | "completed" | "failed";
  total: number;
  processed: number;
  fixed: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  errors: Array<{ route: string; error: string }>;
}

let cacheRepairJob: CacheRepairJob = {
  status: "idle", total: 0, processed: 0, fixed: 0, failed: 0,
  startedAt: null, completedAt: null, errors: [],
};

function isMissingPublishedCache(item: Awaited<ReturnType<typeof scanRouteHealth>>[number]): boolean {
  return item.status === "missing" &&
    item.lifecycle === "active" &&
    item.issues.length === 1 &&
    item.issues[0] === "Нет опубликованного prerender-кэша";
}

router.get("/route-health/cache-repair/preview", async (_req, res) => {
  try {
    const items = await scanRouteHealth();
    const eligible = items.filter(isMissingPublishedCache).map((item) => item.route);
    return res.json({
      ok: true,
      total: eligible.length,
      routes: eligible,
      skipped: items.filter((item) => item.status === "orphan" || item.status === "broken").length,
    });
  } catch (err) {
    logger.error({ err }, "[admin-seo] cache repair preview failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/route-health/cache-repair/status", (_req, res) => {
  return res.json({ ok: true, ...cacheRepairJob });
});

router.post("/route-health/cache-repair/start", async (_req, res) => {
  if (cacheRepairJob.status === "running") {
    return res.status(409).json({ ok: false, error: "Массовый прирендер уже выполняется" });
  }
  try {
    const items = await scanRouteHealth();
    const routes = items.filter(isMissingPublishedCache).map((item) => item.route);
    cacheRepairJob = {
      status: "running", total: routes.length, processed: 0, fixed: 0, failed: 0,
      startedAt: new Date().toISOString(), completedAt: null, errors: [],
    };
    void (async () => {
      // Deliberately one worker: each route starts Chrome and the publication
      // lock protects the last known-good cache from concurrent replacement.
      for (const route of routes) {
        try {
          await prerenderRouteAndWait(route);
          const html = await loadPrerendered(route);
          const metadata = await getPrerenderedMetadata(route);
          const issues = html ? inspectSnapshot(route, html, true) : ["HTML snapshot не опубликован"];
          if (!html || issues.length > 0 || !metadata.manifest) {
            throw new Error(!html ? "HTML snapshot не опубликован" : issues.length ? issues.join("; ") : "Manifest не опубликован");
          }
          cacheRepairJob.fixed += 1;
        } catch (err) {
          cacheRepairJob.failed += 1;
          cacheRepairJob.errors.push({ route, error: String(err) });
        } finally {
          cacheRepairJob.processed += 1;
        }
      }
      cacheRepairJob.status = cacheRepairJob.failed > 0 && cacheRepairJob.fixed === 0 ? "failed" : "completed";
      cacheRepairJob.completedAt = new Date().toISOString();
    })().catch((err) => {
      cacheRepairJob.status = "failed";
      cacheRepairJob.completedAt = new Date().toISOString();
      cacheRepairJob.errors.push({ route: "*", error: String(err) });
    });
    return res.status(202).json({ ok: true, total: routes.length, message: routes.length ? "Массовый прирендер запущен" : "Маршрутов для восстановления нет" });
  } catch (err) {
    logger.error({ err }, "[admin-seo] cache repair start failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/route-health/repair", async (req, res) => {
  const { route } = req.body as { route?: string };
  if (!route || !route.startsWith("/") || route.includes("..") || route.includes("//")) {
    return res.status(400).json({ ok: false, error: "Укажите безопасный URL, начинающийся с /" });
  }
  try {
    const healthItem = (await scanRouteHealth()).find((item) => item.route === route);
    if (!healthItem) {
      return res.status(404).json({ ok: false, error: "URL не найден в реестре или кэше" });
    }
    if (healthItem.status === "healthy") {
      return res.status(400).json({ ok: false, error: "Этот URL не требует восстановления кэша" });
    }
    if (healthItem.lifecycle === "gone") {
      await deletePrerendered(route);
      deletePrerenderCache(route);
      return res.json({ ok: true, route, action: "removed", message: "Orphan-кэш удалён; crawler получит 404" });
    }
    // Preserve the last known-good snapshot while Puppeteer validates the next
    // one. prerender.mjs atomically swaps the file and updates memory only on
    // successful publication, so a failed repair cannot create an SPA gap.
    spawnPrerenderRoute(route);
    return res.json({ ok: true, route, action: "prerendering", message: "Запущен безопасный прирендер; текущий кэш сохранён до успешной замены" });
  } catch (err) {
    logger.error({ err, route }, "[admin-seo] route health repair failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/generate-brand-descriptions", async (req, res) => {
  try {
    const { apply } = req.body as { apply?: boolean };
    const generated = await generateBrandMetaDescriptions();
    if (apply) {
      const { updated, skipped } = await applyBrandMetaDescriptions(generated);
      return res.json({ ok: true, data: { generated, applied: { updated, skipped } } });
    }
    return res.json({ ok: true, data: { generated } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
