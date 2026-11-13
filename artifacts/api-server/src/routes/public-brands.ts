import { Router, type IRouter } from "express";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, brandsTable, brandPageContentTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  brandIdsSignature,
  parsePublicBrandsCache,
  sanitizeCachedBrandData,
  type BrandFeedState,
  type PublicBrandsCacheSnapshot,
} from "../lib/public-brands-cache";
import {
  getCmBusinessFeedState,
  getCmBusinessPublicIdSet,
  getPublicNewCars,
  getTenetPlusFeedState,
  getTenetPlusPublicIdSet,
} from "./new-cars";
import { getUsedCars } from "./cars";

const router: IRouter = Router();

const BRANDS_CACHE_TTL_MS = 5 * 60 * 1000;
const BRANDS_CACHE_FILE = process.env["PUBLIC_BRANDS_CACHE_FILE"]
  || path.join(
    process.env["LOCAL_PRERENDER_CACHE_DIR"] || path.join(process.cwd(), "prerender-cache"),
    "_internal",
    "public-brands-cache.json",
  );
const DB_BOOTSTRAP_TIMEOUT_MS = 4_000;
let _brandsCache: PublicBrandsCacheSnapshot | null = null;
let brandsCacheLoadPromise: Promise<void> | null = null;
let brandsBootstrapPromise: Promise<PublicBrandsCacheSnapshot> | null = null;
let brandsRefreshPromise: Promise<void> | null = null;

async function countPublicTenetPlusDbRows(publicIds: Set<string>): Promise<number> {
  if (publicIds.size === 0) return 0;
  const rows = await db.execute(sql`
    SELECT external_id
    FROM cars
    WHERE type = 'new'
      AND LOWER(BTRIM(dealer)) = 'tenet plus'
      AND catalog_source = 'cm_business'
      AND cm_stock_state = 'in'
      AND BTRIM(image_url) ~* '^https?://[^/[:space:]]+'
      AND NULLIF(BTRIM(model), '') IS NOT NULL
      AND (
        NULLIF(BTRIM(modification), '') IS NOT NULL
        OR NULLIF(BTRIM(complectation), '') IS NOT NULL
      )
  `);
  return new Set((rows.rows as { external_id: string }[])
    .map(row => row.external_id)
    .filter(id => publicIds.has(id))).size;
}

async function countPublicJelandDbRows(publicIds: Set<string>): Promise<number> {
  if (publicIds.size === 0) return 0;
  const rows = await db.execute(sql`
    SELECT external_id
    FROM cars
    WHERE type = 'new'
      AND LOWER(BTRIM(dealer)) = 'jeland'
      AND catalog_source = 'cm_business'
      AND cm_stock_state = 'in'
      AND BTRIM(image_url) ~* '^https?://[^/[:space:]]+'
      AND NULLIF(BTRIM(model), '') IS NOT NULL
      AND (
        NULLIF(BTRIM(modification), '') IS NOT NULL
        OR NULLIF(BTRIM(complectation), '') IS NOT NULL
      )
  `);
  return new Set((rows.rows as { external_id: string }[])
    .map(row => row.external_id)
    .filter(id => publicIds.has(id))).size;
}

function currentBrandFeedState(): BrandFeedState {
  const tenetPlusComplete = getTenetPlusFeedState().complete;
  const jelandComplete = getCmBusinessFeedState("Jeland").complete;
  return {
    tenetPlus: {
      complete: tenetPlusComplete,
      ids: tenetPlusComplete ? getTenetPlusPublicIdSet() : new Set<string>(),
    },
    jeland: {
      complete: jelandComplete,
      ids: jelandComplete ? getCmBusinessPublicIdSet("Jeland") : new Set<string>(),
    },
  };
}

async function loadPersistedBrandsCache(): Promise<void> {
  if (!brandsCacheLoadPromise) {
    brandsCacheLoadPromise = (async () => {
      try {
        const parsed = parsePublicBrandsCache(JSON.parse(await readFile(BRANDS_CACHE_FILE, "utf8")));
        if (parsed) {
          _brandsCache = parsed;
          logger.info({ cacheAgeMs: Date.now() - parsed.ts }, "public-brands: loaded persistent cache");
        } else {
          logger.warn("public-brands: persistent cache has an invalid shape");
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          logger.warn({ err }, "public-brands: failed to load persistent cache");
        }
      }
    })();
  }
  await brandsCacheLoadPromise;
}

async function persistBrandsCache(snapshot: PublicBrandsCacheSnapshot): Promise<void> {
  const tempPath = `${BRANDS_CACHE_FILE}.${process.pid}.${Date.now()}.tmp`;
  try {
    await mkdir(path.dirname(BRANDS_CACHE_FILE), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(snapshot)}\n`, "utf8");
    await rename(tempPath, BRANDS_CACHE_FILE);
  } catch (err) {
    logger.warn({ err }, "public-brands: failed to persist cache");
  }
}

function makeSnapshot(
  data: unknown[],
  feedState: BrandFeedState = currentBrandFeedState(),
): PublicBrandsCacheSnapshot {
  return {
    data: data as PublicBrandsCacheSnapshot["data"],
    ts: Date.now(),
    tenetPlusComplete: feedState.tenetPlus.complete,
    tenetPlusIds: brandIdsSignature(feedState.tenetPlus.ids),
    jelandComplete: feedState.jeland.complete,
    jelandIds: brandIdsSignature(feedState.jeland.ids),
  };
}

function safeBrandsFromCache(snapshot: PublicBrandsCacheSnapshot): unknown[] {
  return sanitizeCachedBrandData(snapshot, currentBrandFeedState());
}

async function loadDbCarCounts(): Promise<{ newCounts: Record<string, number>; usedCount: number }> {
  const rows = await db.execute(sql`
    SELECT LOWER(dealer) AS dealer_key, type, COUNT(*)::int AS cnt
    FROM cars
    WHERE type <> 'new'
       OR LOWER(BTRIM(dealer)) IS DISTINCT FROM 'tenet plus'
       AND LOWER(BTRIM(dealer)) IS DISTINCT FROM 'jeland'
    GROUP BY LOWER(dealer), type
  `);
  const newCounts: Record<string, number> = {};
  let usedCount = 0;
  for (const row of rows.rows as { dealer_key: string; type: string; cnt: number }[]) {
    if (row.type === "used") {
      usedCount += Number(row.cnt);
    } else {
      newCounts[row.dealer_key] = (newCounts[row.dealer_key] ?? 0) + Number(row.cnt);
    }
  }
  return { newCounts, usedCount };
}

function mapBrandCounts<T extends { name: string; isServiceOnly: boolean | null }>(
  rows: T[],
  newCounts: Record<string, number>,
  usedCount: number,
): Array<T & { carCount: number }> {
  return rows.map(brand => {
    if (brand.isServiceOnly) return { ...brand, carCount: 0 };
    if (brand.name.toLowerCase().includes("пробег")) return { ...brand, carCount: usedCount };
    return { ...brand, carCount: newCounts[brand.name.toLowerCase()] ?? 0 };
  });
}

async function buildDbFallbackCache(): Promise<PublicBrandsCacheSnapshot> {
  const [rows, counts] = await Promise.all([
    db.select().from(brandsTable).orderBy(asc(brandsTable.isServiceOnly), asc(brandsTable.name)),
    loadDbCarCounts(),
  ]);
  if (!rows.length) throw new Error("brands table is empty");

  // TENET Plus and Jeland stay hidden until a complete live feed confirms their inventory.
  counts.newCounts["tenet plus"] = 0;
  counts.newCounts["jeland"] = 0;
  const snapshot = makeSnapshot(mapBrandCounts(rows, counts.newCounts, counts.usedCount), {
    tenetPlus: { complete: false, ids: new Set() },
    jeland: { complete: false, ids: new Set() },
  });
  return snapshot;
}

async function buildFeedCache(): Promise<PublicBrandsCacheSnapshot> {
  const [rows, newCars, usedCars] = await Promise.all([
    db.select().from(brandsTable).orderBy(asc(brandsTable.isServiceOnly), asc(brandsTable.name)),
    getPublicNewCars(),
    getUsedCars(),
  ]);
  if (!rows.length) throw new Error("brands table is empty");

  let dbCounts: { newCounts: Record<string, number>; usedCount: number } | null = null;
  if (newCars.length === 0 || usedCars.length === 0) {
    try {
      dbCounts = await loadDbCarCounts();
    } catch (err) {
      logger.warn({ err }, "public-brands: database count fallback failed");
    }
  }

  const newCounts: Record<string, number> = {};
  for (const car of newCars) {
    const dealer = car.dealer.trim().toLowerCase();
    if (dealer === "tenet plus" || dealer === "jeland") continue;
    newCounts[dealer] = (newCounts[dealer] ?? 0) + 1;
  }
  if (newCars.length === 0 && dbCounts) Object.assign(newCounts, dbCounts.newCounts);

  const feedState = currentBrandFeedState();
  newCounts["tenet plus"] = feedState.tenetPlus.complete
    ? await countPublicTenetPlusDbRows(feedState.tenetPlus.ids)
    : 0;
  newCounts["jeland"] = feedState.jeland.complete
    ? await countPublicJelandDbRows(feedState.jeland.ids)
    : 0;

  const snapshot = makeSnapshot(
    mapBrandCounts(rows, newCounts, usedCars.length > 0 ? usedCars.length : dbCounts?.usedCount ?? 0),
    feedState,
  );
  // If either feed's complete snapshot changed during the refresh, suppress its count.
  snapshot.data = sanitizeCachedBrandData(snapshot, currentBrandFeedState());
  return snapshot;
}

function startBackgroundBrandsRefresh(): void {
  if (brandsRefreshPromise) return;
  brandsRefreshPromise = buildFeedCache()
    .then(async snapshot => {
      _brandsCache = snapshot;
      await persistBrandsCache(snapshot);
      logger.info({ count: snapshot.data.length }, "public-brands: cache refreshed");
    })
    .catch(err => {
      logger.warn({ err }, "public-brands: background refresh failed; keeping last good cache");
    })
    .finally(() => {
      brandsRefreshPromise = null;
    });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`database fallback timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function getDbBootstrapSnapshot(): Promise<PublicBrandsCacheSnapshot> {
  if (!brandsBootstrapPromise) {
    brandsBootstrapPromise = buildDbFallbackCache()
      .then(async snapshot => {
        if (!_brandsCache) {
          _brandsCache = snapshot;
          await persistBrandsCache(snapshot);
          startBackgroundBrandsRefresh();
        }
        return snapshot;
      })
      .finally(() => {
        brandsBootstrapPromise = null;
      });
  }
  return withTimeout(brandsBootstrapPromise, DB_BOOTSTRAP_TIMEOUT_MS);
}

/* ── GET /api/brands  — full brand list with car counts ────── */
router.get("/", async (_req, res) => {
  try {
    await loadPersistedBrandsCache();
    if (_brandsCache) {
      const stale = Date.now() - _brandsCache.ts >= BRANDS_CACHE_TTL_MS;
      if (stale) startBackgroundBrandsRefresh();
      return res.json({ ok: true, data: safeBrandsFromCache(_brandsCache) });
    }

    const snapshot = await getDbBootstrapSnapshot();
    if (_brandsCache) {
      return res.json({ ok: true, data: safeBrandsFromCache(_brandsCache) });
    }
    return res.json({ ok: true, data: safeBrandsFromCache(snapshot) });
  } catch (err) {
    if (_brandsCache) {
      logger.warn({ err }, "public-brands: serving stale cache after bootstrap failure");
      return res.json({ ok: true, data: safeBrandsFromCache(_brandsCache) });
    }
    logger.error({ err }, "public-brands: no cache available and database bootstrap failed");
    return res.status(503).json({ ok: false, error: "Данные брендов временно недоступны" });
  }
});

/* ── GET /api/brands/:slug — full brand page data ───────────── */
/* Numeric :slug falls back to ID lookup (basic brand row only). */
router.get("/:slug", async (req, res) => {
  try {
    const param = req.params["slug"]!;
    const numId = Number(param);
    const isNumeric = !isNaN(numId) && Number.isInteger(numId) && numId > 0;

    /* Numeric ID → simple brand row (used by admin panel / internal calls) */
    if (isNumeric) {
      const rows = await db.select().from(brandsTable).where(eq(brandsTable.id, numId));
      if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
      return res.json({ ok: true, data: rows[0] });
    }

    /* Slug → full brand page payload */
    const slug = param;

    const brandRows = await db
      .select()
      .from(brandsTable)
      .where(eq(brandsTable.slug, slug));

    if (!brandRows.length) {
      return res.status(404).json({ ok: false, error: "Brand not found" });
    }

    const brand = brandRows[0]!;

    // Content
    const contentRows = await db
      .select()
      .from(brandPageContentTable)
      .where(eq(brandPageContentTable.brandId, brand.id));
    const rawContent = contentRows[0] ?? null;
    const content = rawContent
      ? {
          ...rawContent,
          faq: (rawContent.faq ?? [])
            .filter((item: { is_published?: boolean }) => item.is_published !== false)
            .sort((a: { sort_order?: number }, b: { sort_order?: number }) => {
              if (a.sort_order == null && b.sort_order == null) return 0;
              if (a.sort_order == null) return 1;
              if (b.sort_order == null) return -1;
              return a.sort_order - b.sort_order;
            }),
        }
      : null;

    // Locations for this brand
    const locationRows = await db.execute(sql`
      SELECT l.id, l.title, l.address, l.phone, l.hours, l.map_x, l.map_y, lb.is_service
      FROM locations l
      JOIN location_brands lb ON lb.location_id = l.id
      WHERE lb.brand_id = ${brand.id}
      ORDER BY lb.sort_order, l.sort_order
    `);

    // New cars for this brand — from in-memory XML feed cache
    // Use car_mark as the authoritative dealer/mark identifier.
    // For a separately managed brand page without car_mark, use the exact
    // brand name. Never use fuzzy matching: Tenet and Tenet Plus are separate
    // brand pages and must not share inventory.
    const allNewCars = await getPublicNewCars();
    let brandCarsRaw: Awaited<typeof allNewCars> = [];
    const feedNames = new Set([
      (brand.carMark?.trim() || brand.name).toLowerCase(),
    ]);
    // Primary: exact dealer match (e.g. car_mark="Haval City" → dealer="Haval City")
    brandCarsRaw = allNewCars.filter(c => feedNames.has(c.dealer.toLowerCase()));
    // Fallback: exact mark match (for brands where dealer ≠ car_mark but mark matches)
    if (brandCarsRaw.length === 0) {
      brandCarsRaw = allNewCars.filter(c => feedNames.has(c.mark.toLowerCase()));
    }
    const isTenetPlusBrand = brand.name.trim().toLowerCase() === "tenet plus"
      || brand.carMark?.trim().toLowerCase() === "tenet plus";
    if (isTenetPlusBrand) {
      const publicTenetIds = getTenetPlusPublicIdSet();
      if (!getTenetPlusFeedState().complete || publicTenetIds.size === 0) {
        brandCarsRaw = [];
      } else {
        const eligibleRows = await db.execute(sql`
          SELECT external_id
          FROM cars
          WHERE type = 'new'
            AND LOWER(BTRIM(dealer)) = 'tenet plus'
            AND catalog_source = 'cm_business'
            AND cm_stock_state = 'in'
            AND BTRIM(image_url) ~* '^https?://[^/[:space:]]+'
            AND NULLIF(BTRIM(model), '') IS NOT NULL
            AND (
              NULLIF(BTRIM(modification), '') IS NOT NULL
              OR NULLIF(BTRIM(complectation), '') IS NOT NULL
            )
        `);
        const eligibleIds = new Set((eligibleRows.rows as { external_id: string }[])
          .map(row => row.external_id)
          .filter(id => publicTenetIds.has(id)));
        brandCarsRaw = brandCarsRaw.filter(car =>
          car.dealer.trim().toLowerCase() === "tenet plus" && eligibleIds.has(car.id),
        );
        const latestPublicIds = getTenetPlusPublicIdSet();
        if (!getTenetPlusFeedState().complete) {
          brandCarsRaw = [];
        } else {
          brandCarsRaw = brandCarsRaw.filter(car => latestPublicIds.has(car.id));
        }
      }
    }
    if (brand.slug === "jeland") {
      const publicJelandIds = getCmBusinessPublicIdSet("Jeland");
      if (!getCmBusinessFeedState("Jeland").complete || publicJelandIds.size === 0) {
        brandCarsRaw = [];
      } else {
        const eligibleRows = await db.execute(sql`
          SELECT external_id
          FROM cars
          WHERE type = 'new'
            AND LOWER(BTRIM(dealer)) = 'jeland'
            AND catalog_source = 'cm_business'
            AND cm_stock_state = 'in'
            AND BTRIM(image_url) ~* '^https?://[^/[:space:]]+'
            AND NULLIF(BTRIM(model), '') IS NOT NULL
            AND (
              NULLIF(BTRIM(modification), '') IS NOT NULL
              OR NULLIF(BTRIM(complectation), '') IS NOT NULL
            )
        `);
        const eligibleIds = new Set((eligibleRows.rows as { external_id: string }[])
          .map(row => row.external_id)
          .filter(id => publicJelandIds.has(id)));
        brandCarsRaw = brandCarsRaw.filter(car =>
          car.dealer.trim().toLowerCase() === "jeland" && eligibleIds.has(car.id),
        );
        const latestPublicIds = getCmBusinessPublicIdSet("Jeland");
        if (!getCmBusinessFeedState("Jeland").complete) {
          brandCarsRaw = [];
        } else {
          brandCarsRaw = brandCarsRaw.filter(car => latestPublicIds.has(car.id));
        }
      }
    }

    const brandCars = brandCarsRaw.sort((a, b) => a.price - b.price)
      // Normalize camelCase NewCarRecord → snake_case DTO expected by frontend
      .map(c => ({
        id: c.id,
        mark: c.mark,
        model: c.model,
        modification: c.modification,
        complectation: c.complectation,
        year: c.year,
        price: c.price,
        color: c.color,
        body_type: c.bodyType,
        availability: c.availability,
        url: c.url,
        images: c.images?.slice(0, 1) ?? [],
        dealer: c.dealer,
        max_discount: c.maxDiscount,
        credit_discount: c.creditDiscount,
        tradein_discount: c.tradeinDiscount,
      }));

    // For news/promo text search: strip sub-brand qualifiers from name
    const searchName = brand.name.toLowerCase().replace(/ (city|pro|plus|брянск)$/i, "").trim();

    // News: first by brand_ids array, then by name mention (deduplicated)
    const newsRows = await db.execute(sql`
      SELECT id, title, excerpt, category, image, published_at, slug
      FROM news
      WHERE ${brand.id} = ANY(brand_ids)
         OR LOWER(title) LIKE ${"%" + searchName + "%"}
         OR LOWER(excerpt) LIKE ${"%" + searchName + "%"}
      ORDER BY
        CASE WHEN ${brand.id} = ANY(brand_ids) THEN 0 ELSE 1 END,
        published_at DESC
      LIMIT 4
    `);

    // Global promotions: prefer over JSONB field in brand_page_content
    const promoRows = await db.execute(sql`
      SELECT id, slug, title, description, image, badge, expires_at, is_active, button_text, button_url
      FROM promotions
      WHERE ${brand.id} = ANY(brand_ids)
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
    `);

    type PromoRow = {
      id: number; slug: string; title: string; description: string; image: string | null;
      badge: string | null; expires_at: string | null; is_active: boolean;
      button_text: string | null; button_url: string | null;
    };

    const globalPromos = (promoRows.rows as PromoRow[]).map(p => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      image: p.image ?? undefined,
      badge: p.badge ?? undefined,
      expiresAt: p.expires_at ?? undefined,
      isActive: p.is_active,
      buttonText: p.button_text ?? undefined,
      buttonUrl: p.button_url ?? undefined,
    }));

    // Always use global promotions table; no JSONB fallback
    // Return promotions even when no brand_page_content row exists
    const finalContent = content
      ? { ...content, promotions: globalPromos }
      : globalPromos.length > 0 ? { promotions: globalPromos } : null;

    return res.json({
      ok: true,
      data: {
        brand,
        content: finalContent,
        locations: locationRows.rows,
        cars: brandCars,
        news: newsRows.rows,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
