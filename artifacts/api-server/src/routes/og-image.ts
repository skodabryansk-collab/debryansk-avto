import { Router } from "express";
import { mkdir, stat, writeFile, readdir, unlink } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { buildBrandHtml, buildCarHtml, buildCatalogHtml, buildCorporateHtml, buildServiceHtml, buildStaticPageHtml, generateOgImage } from "../services/og-generator";
import { requireAdmin } from "../middlewares/requireAdmin";
import type { Response } from "express";
import {
  getCmBusinessFeedState,
  getCmBusinessPublicIdSet,
  getTenetPlusFeedState,
  getTenetPlusPublicIdSet,
} from "./new-cars";

const OG_CACHE_DIR = process.env.OG_CACHE_DIR || "/opt/debryansk/og-cache";
const OG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_OG_REDIRECT = "/opengraph.jpg";

const router = Router();

mkdir(OG_CACHE_DIR, { recursive: true }).catch(() => {});

async function isCacheValid(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return Date.now() - s.mtimeMs < OG_TTL_MS;
  } catch {
    return false;
  }
}

function sendCachedFile(res: Response, filePath: string): void {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
  createReadStream(filePath).pipe(res);
}

async function generateAndSave(html: string, cachePath: string, acquireTimeoutMs = 1500): Promise<Buffer> {
  const buf = await generateOgImage(html, acquireTimeoutMs);
  await writeFile(cachePath, buf).catch(() => {});
  return buf;
}

const pendingBgGen = new Set<string>();

function scheduleBackgroundGen(html: string, cachePath: string, logCtx: Record<string, unknown>): void {
  if (pendingBgGen.has(cachePath)) return;
  pendingBgGen.add(cachePath);
  generateAndSave(html, cachePath, 30_000)
    .then(() => logger.info(logCtx, "[og] bg generation complete"))
    .catch(err => logger.warn({ ...logCtx, err }, "[og] bg generation failed"))
    .finally(() => pendingBgGen.delete(cachePath));
}

function sendPngBuffer(res: Response, buf: Buffer, cacheControl?: string): void {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", cacheControl ?? "public, max-age=86400, stale-while-revalidate=3600");
  res.send(buf);
}

router.get("/og-image/brand/:slug", async (req, res) => {
  const slug = req.params.slug!.replace(/\.png$/, "");
  const cachePath = path.join(OG_CACHE_DIR, `brand-${slug.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`);

  const isTenetPlusBrand = slug.toLowerCase() === "tenet-plus";
  const isJelandBrand = slug === "jeland";
  if (isJelandBrand) res.setHeader("Cache-Control", "no-store");
  const tenetPlusSourceComplete = getTenetPlusFeedState().complete;
  const jelandSourceComplete = getCmBusinessFeedState("Jeland").complete;
  if (!isTenetPlusBrand && !isJelandBrand && await isCacheValid(cachePath) && tenetPlusSourceComplete) {
    sendCachedFile(res, cachePath);
    return;
  }

  let html: string;
  try {
    const tenetPlusPublicIds = [...getTenetPlusPublicIdSet()];
    const tenetPlusPublicIdsSql = tenetPlusPublicIds.length
      ? sql`ARRAY[${sql.join(tenetPlusPublicIds.map(id => sql`${id}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;
    const jelandPublicIds = [...getCmBusinessPublicIdSet("Jeland")];
    const jelandPublicIdsSql = jelandPublicIds.length
      ? sql`ARRAY[${sql.join(jelandPublicIds.map(id => sql`${id}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;
    const result = await db.execute(
      sql`SELECT b.name, b.logo_url, b.is_service_only,
                 COUNT(c.id)::int AS car_count
          FROM brands b
          LEFT JOIN cars c ON c.brand ILIKE b.name AND c.type = 'new'
            AND (
              (
                LOWER(BTRIM(c.dealer)) IS DISTINCT FROM 'tenet plus'
                AND LOWER(BTRIM(c.dealer)) IS DISTINCT FROM 'jeland'
              )
              OR (
                ${tenetPlusSourceComplete}
                AND c.external_id = ANY(${tenetPlusPublicIdsSql})
                AND c.cm_stock_state = 'in'
                AND NULLIF(BTRIM(c.model), '') IS NOT NULL
                AND NULLIF(BTRIM(c.image_url), '') ~* '^https?://[^/[:space:]]+'
                AND (
                  NULLIF(BTRIM(c.modification), '') IS NOT NULL
                  OR NULLIF(BTRIM(c.complectation), '') IS NOT NULL
                )
              )
              OR (
                LOWER(BTRIM(c.dealer)) = 'jeland'
                AND ${jelandSourceComplete}
                AND c.catalog_source = 'cm_business'
                AND c.external_id = ANY(${jelandPublicIdsSql})
                AND c.cm_stock_state = 'in'
                AND NULLIF(BTRIM(c.model), '') IS NOT NULL
                AND NULLIF(BTRIM(c.image_url), '') ~* '^https?://[^/[:space:]]+'
                AND (
                  NULLIF(BTRIM(c.modification), '') IS NOT NULL
                  OR NULLIF(BTRIM(c.complectation), '') IS NOT NULL
                )
              )
            )
          WHERE b.slug = ${slug}
          GROUP BY b.name, b.logo_url, b.is_service_only
          LIMIT 1`
    );
    const row = result.rows[0] as {
      name: string;
      logo_url: string | null;
      is_service_only: boolean;
      car_count: number;
    } | undefined;

    if (!row) {
      res.redirect(302, DEFAULT_OG_REDIRECT);
      return;
    }

    let logoSvg: string | undefined;
    let logoDataUrl: string | undefined;
    if (row.logo_url) {
      try {
        const port = process.env["PORT"] ?? "8080";
        const resp = await fetch(`http://127.0.0.1:${port}${row.logo_url}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const ct = (resp.headers.get("content-type") || "").split(";")[0]!.trim();
          if (ct === "image/svg+xml" || row.logo_url.endsWith(".svg")) {
            logoSvg = buf.toString("utf8");
          } else {
            logoDataUrl = `data:${ct};base64,${buf.toString("base64")}`;
          }
        }
      } catch (err) {
        logger.warn({ err, slug }, "[og] brand logo fetch failed");
      }
    }

    html = buildBrandHtml({
      brandName: row.name,
      logoSvg,
      logoDataUrl,
      carCount: row.car_count,
      isServiceOnly: row.is_service_only,
    });
  } catch (err) {
    logger.warn({ err, slug }, "[og] brand DB query failed");
    res.redirect(302, DEFAULT_OG_REDIRECT);
    return;
  }

  const genPromise = generateAndSave(html, cachePath);
  const race = await Promise.race([
    genPromise.then(buf => ({ ok: true as const, buf })).catch(() => ({ ok: false as const })),
    new Promise<{ ok: false }>(r => setTimeout(() => r({ ok: false }), 1500)),
  ]);

  if (!race.ok) {
    res.redirect(302, DEFAULT_OG_REDIRECT);
    scheduleBackgroundGen(html, cachePath, { slug });
    return;
  }

  sendPngBuffer(res, race.buf, isJelandBrand ? "no-store" : undefined);
});

router.get("/og-image/car/:type/:id", async (req, res) => {
  const carType = req.params.type === "new" ? "new" : "used";
  const id = req.params.id!.replace(/\.png$/, "");
  const safeId = id.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const cachePath = path.join(OG_CACHE_DIR, `car-${carType}-${safeId}.png`);

  let html: string;
  let isJeland = false;
  try {
    const result = await db.execute(
      sql`SELECT brand, model, year, price, max_discount, image_url, dealer, cm_stock_state, modification, complectation, catalog_source
          FROM cars WHERE external_id = ${id} AND type = ${carType} LIMIT 1`
    );
    const row = result.rows[0] as {
      brand: string;
      model: string;
      year: number;
      price: number;
      max_discount: number | null;
      image_url: string | null;
      dealer: string | null;
      cm_stock_state: string | null;
      modification: string | null;
      complectation: string | null;
      catalog_source: string | null;
    } | undefined;

    if (!row) {
      res.redirect(302, DEFAULT_OG_REDIRECT);
      return;
    }

    const isTenetPlus = row.dealer?.trim().toLowerCase() === "tenet plus";
    if (carType === "new" && isTenetPlus) {
      const tenetPlusPublicIds = getTenetPlusPublicIdSet();
      const usableImage = typeof row.image_url === "string"
        && /^https?:\/\/[^/\s]+/i.test(row.image_url.trim());
      const publicStockReady = getTenetPlusFeedState().complete
        && tenetPlusPublicIds.has(id)
        && row.cm_stock_state === "in"
        && Boolean(row.model?.trim())
        && usableImage
        && Boolean(row.modification?.trim() || row.complectation?.trim());
      if (!publicStockReady) {
        res.redirect(302, DEFAULT_OG_REDIRECT);
        return;
      }
    }
    isJeland = row.dealer?.trim().toLowerCase() === "jeland";
    if (carType === "new" && isJeland) {
      res.setHeader("Cache-Control", "no-store");
      const jelandPublicIds = getCmBusinessPublicIdSet("Jeland");
      const usableImage = typeof row.image_url === "string"
        && /^https?:\/\/[^/\s]+/i.test(row.image_url.trim());
      const publicStockReady = getCmBusinessFeedState("Jeland").complete
        && jelandPublicIds.has(id)
        && row.catalog_source === "cm_business"
        && row.cm_stock_state === "in"
        && Boolean(row.model?.trim())
        && usableImage
        && Boolean(row.modification?.trim() || row.complectation?.trim());
      if (!publicStockReady) {
        res.redirect(302, DEFAULT_OG_REDIRECT);
        return;
      }
    }

    // Revalidate the DB-backed eligibility before serving even a cached card:
    // a formerly public Tenet Plus vehicle may have become stale or incomplete.
    if (!isJeland && await isCacheValid(cachePath)) {
      sendCachedFile(res, cachePath);
      return;
    }

    // Pass the URL directly — Chrome fetches it during rendering (~1s),
    // which is much faster than the Node.js pre-fetch (3-5s).
    const imageUrl: string | undefined = row.image_url ?? undefined;

    html = buildCarHtml({
      brand: row.brand,
      model: row.model,
      year: row.year,
      price: Number(row.price),
      maxDiscount: row.max_discount ? Number(row.max_discount) : undefined,
      imageUrl,
      type: carType,
    });
  } catch (err) {
    logger.warn({ err, id, carType }, "[og] car DB query failed");
    res.redirect(302, DEFAULT_OG_REDIRECT);
    return;
  }

  const genPromise = generateAndSave(html, cachePath);
  const race = await Promise.race([
    genPromise.then(buf => ({ ok: true as const, buf })).catch(() => ({ ok: false as const })),
    new Promise<{ ok: false }>(r => setTimeout(() => r({ ok: false }), 1500)),
  ]);

  if (!race.ok) {
    res.redirect(302, DEFAULT_OG_REDIRECT);
    scheduleBackgroundGen(html, cachePath, { id, carType });
    return;
  }

  sendPngBuffer(res, race.buf, carType === "new" && isJeland ? "no-store" : undefined);
});

router.get("/og-image/service.png", async (_req, res) => {
  const cachePath = path.join(OG_CACHE_DIR, "service.png");

  if (await isCacheValid(cachePath)) {
    sendCachedFile(res, cachePath);
    return;
  }

  const html = buildServiceHtml();
  const genPromise = generateAndSave(html, cachePath);
  const race = await Promise.race([
    genPromise.then(buf => ({ ok: true as const, buf })).catch(() => ({ ok: false as const })),
    new Promise<{ ok: false }>(r => setTimeout(() => r({ ok: false }), 1500)),
  ]);

  if (!race.ok) {
    res.redirect(302, DEFAULT_OG_REDIRECT);
    scheduleBackgroundGen(html, cachePath, { route: "service" });
    return;
  }

  sendPngBuffer(res, race.buf);
});

const CATALOG_OG_TTL_MS = 24 * 60 * 60 * 1000; // 24h — catalog changes daily

async function isCatalogCacheValid(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return Date.now() - s.mtimeMs < CATALOG_OG_TTL_MS;
  } catch {
    return false;
  }
}

for (const type of ["new", "used"] as const) {
  const file = `catalog-${type}.png`;
  const carType = type === "new" ? "new" : "used";

  router.get(`/og-image/catalog/${type}.png`, async (_req, res) => {
    const cachePath = path.join(OG_CACHE_DIR, file);
    const tenetPlusSourceComplete = type !== "new" || getTenetPlusFeedState().complete;
    const tenetPlusPublicIds = type === "new" ? [...getTenetPlusPublicIdSet()] : [];
    const tenetPlusPublicIdsSql = tenetPlusPublicIds.length
      ? sql`ARRAY[${sql.join(tenetPlusPublicIds.map(id => sql`${id}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;
    const jelandSourceComplete = type !== "new" || getCmBusinessFeedState("Jeland").complete;
    const jelandPublicIds = type === "new" ? [...getCmBusinessPublicIdSet("Jeland")] : [];
    const jelandPublicIdsSql = jelandPublicIds.length
      ? sql`ARRAY[${sql.join(jelandPublicIds.map(id => sql`${id}`), sql`, `)}]::text[]`
      : sql`ARRAY[]::text[]`;
    if (type !== "new" && await isCatalogCacheValid(cachePath)) {
      sendCachedFile(res, cachePath);
      return;
    }

    let count = 0;
    let minPrice = 0;
    let brands: string[] = [];
    let includesJeland = false;
    try {
      const result = await db.execute(
        sql`SELECT COUNT(*)::int AS count, MIN(price)::int AS min_price,
                   BOOL_OR(LOWER(BTRIM(dealer)) = 'jeland') AS includes_jeland,
                   array_agg(DISTINCT brand ORDER BY brand) FILTER (WHERE brand IS NOT NULL) AS brands
            FROM cars
            WHERE type = ${carType}
              AND (
                (
                  LOWER(BTRIM(dealer)) IS DISTINCT FROM 'tenet plus'
                  AND LOWER(BTRIM(dealer)) IS DISTINCT FROM 'jeland'
                )
                OR (
                  ${tenetPlusSourceComplete}
                  AND external_id = ANY(${tenetPlusPublicIdsSql})
                  AND cm_stock_state = 'in'
                  AND NULLIF(BTRIM(model), '') IS NOT NULL
                  AND NULLIF(BTRIM(image_url), '') ~* '^https?://[^/[:space:]]+'
                  AND (
                    NULLIF(BTRIM(modification), '') IS NOT NULL
                    OR NULLIF(BTRIM(complectation), '') IS NOT NULL
                  )
                )
                OR (
                  LOWER(BTRIM(dealer)) = 'jeland'
                  AND ${jelandSourceComplete}
                  AND catalog_source = 'cm_business'
                  AND external_id = ANY(${jelandPublicIdsSql})
                  AND cm_stock_state = 'in'
                  AND NULLIF(BTRIM(model), '') IS NOT NULL
                  AND NULLIF(BTRIM(image_url), '') ~* '^https?://[^/[:space:]]+'
                  AND (
                    NULLIF(BTRIM(modification), '') IS NOT NULL
                    OR NULLIF(BTRIM(complectation), '') IS NOT NULL
                  )
                )
              )`
      );
      const row = result.rows[0] as { count: number; min_price: number; includes_jeland: boolean | null; brands: string[] | null } | undefined;
      count = row?.count ?? 0;
      minPrice = Number(row?.min_price ?? 0);
      includesJeland = row?.includes_jeland ?? false;
      brands = (row?.brands ?? []).filter(Boolean).slice(0, 7);
    } catch (err) {
      logger.warn({ err }, `[og] catalog-${type} DB query failed, using defaults`);
    }

    if (brands.length === 0) {
      brands = type === "new"
        ? ["Haval", "Jetour", "OMODA", "JAECOO", "Volkswagen", "SKODA"]
        : ["Volkswagen", "SKODA", "Renault", "Kia", "Hyundai", "Toyota"];
    }

    const html = buildCatalogHtml({ type, count, minPrice, brands });
    const genPromise = generateAndSave(html, cachePath);
    const race = await Promise.race([
      genPromise.then(buf => ({ ok: true as const, buf })).catch(() => ({ ok: false as const })),
      new Promise<{ ok: false }>(r => setTimeout(() => r({ ok: false }), 1500)),
    ]);
    if (!race.ok) {
      res.redirect(302, DEFAULT_OG_REDIRECT);
      scheduleBackgroundGen(html, cachePath, { file });
      return;
    }
    sendPngBuffer(res, race.buf, includesJeland ? "no-store" : undefined);
  });
}

router.get("/og-image/corporate.png", async (_req, res) => {
  const cachePath = path.join(OG_CACHE_DIR, "corporate.png");

  if (await isCacheValid(cachePath)) {
    sendCachedFile(res, cachePath);
    return;
  }

  let salesManagerName: string | null = null;
  let serviceManagerName: string | null = null;
  try {
    const result = await db.execute(
      sql`SELECT sales_manager_name, service_manager_name
          FROM corporate_page LIMIT 1`
    );
    const row = result.rows[0] as {
      sales_manager_name: string | null;
      service_manager_name: string | null;
    } | undefined;
    salesManagerName = row?.sales_manager_name ?? null;
    serviceManagerName = row?.service_manager_name ?? null;
  } catch (err) {
    logger.warn({ err }, "[og] corporate DB query failed, using defaults");
  }

  const html = buildCorporateHtml({ salesManagerName, serviceManagerName });
  const genPromise = generateAndSave(html, cachePath);
  const race = await Promise.race([
    genPromise.then(buf => ({ ok: true as const, buf })).catch(() => ({ ok: false as const })),
    new Promise<{ ok: false }>(r => setTimeout(() => r({ ok: false }), 1500)),
  ]);

  if (!race.ok) {
    res.redirect(302, DEFAULT_OG_REDIRECT);
    scheduleBackgroundGen(html, cachePath, { route: "corporate" });
    return;
  }

  sendPngBuffer(res, race.buf);
});

const STATIC_PAGES: Record<string, () => string> = {
  "vacancies.png": () => buildStaticPageHtml({
    label: "Карьера · Брянск",
    title: "Работа в\nДебрянск Авто",
    sub: "Официальный мультибрендовый дилер · 4 центра в Брянске",
    pills: ["Менеджеры", "Механики", "Администраторы", "Детейлеры", "Обучение и рост"],
    accentColor: "#0070b8",
  }),
  "buyout.png": () => buildStaticPageHtml({
    label: "Выкуп и комиссия · Брянск",
    title: "Выкуп авто\nза 30 минут",
    sub: "Или комиссионная продажа по максимальной цене",
    pills: ["Оценка бесплатно", "Оплата в день сделки", "Официальный дилер"],
    accentColor: "#3f9a6b",
  }),
  "bonus.png": () => buildStaticPageHtml({
    label: "Бонусная программа",
    title: "Копите и\nтратьте бонусы",
    sub: "10% от суммы заказ-наряда — на следующие визиты",
    pills: ["10% начисление", "До 10% скидка", "Накопительные уровни"],
    accentColor: "#87b63c",
  }),
};

for (const [file, buildHtml] of Object.entries(STATIC_PAGES)) {
  router.get(`/og-image/${file}`, async (_req, res) => {
    const cachePath = path.join(OG_CACHE_DIR, file);
    if (await isCacheValid(cachePath)) {
      sendCachedFile(res, cachePath);
      return;
    }
    const html = buildHtml();
    const genPromise = generateAndSave(html, cachePath);
    const race = await Promise.race([
      genPromise.then(buf => ({ ok: true as const, buf })).catch(() => ({ ok: false as const })),
      new Promise<{ ok: false }>(r => setTimeout(() => r({ ok: false }), 1500)),
    ]);
    if (!race.ok) {
      res.redirect(302, DEFAULT_OG_REDIRECT);
      scheduleBackgroundGen(html, cachePath, { file });
      return;
    }
    sendPngBuffer(res, race.buf);
  });
}

router.post("/admin/og-image/flush", requireAdmin, async (_req, res) => {
  try {
    const files = await readdir(OG_CACHE_DIR).catch(() => [] as string[]);
    let count = 0;
    for (const f of files) {
      if (f.endsWith(".png")) {
        await unlink(path.join(OG_CACHE_DIR, f)).catch(() => {});
        count++;
      }
    }
    logger.info({ count }, "[og] cache flushed");
    res.json({ ok: true, deleted: count });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
