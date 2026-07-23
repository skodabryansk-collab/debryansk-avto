import { Router, type IRouter } from "express";
import { db, brandsTable, brandPageContentTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getNewCars } from "./new-cars";
import { getUsedCars } from "./cars";

const router: IRouter = Router();

const BRANDS_CACHE_TTL_MS = 5 * 60 * 1000;
let _brandsCache: { data: unknown[]; ts: number } | null = null;

/* ── GET /api/brands  — full brand list with car counts ────── */
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(brandsTable)
      .orderBy(asc(brandsTable.isServiceOnly), asc(brandsTable.name));

    // Compute counts from the SAME XML-feed caches that the catalog pages use,
    // so the home page and /new-cars / /cars always show identical numbers.
    let newCounts: Record<string, number> = {};
    let usedCount = 0;
    try {
      const [newCars, usedCars] = await Promise.all([
        getNewCars().catch((err) => {
          logger?.warn({ err }, "public-brands: getNewCars failed, falling back to DB counts");
          return [];
        }),
        getUsedCars().catch((err) => {
          logger?.warn({ err }, "public-brands: getUsedCars failed, falling back to DB counts");
          return [];
        }),
      ]);

      if (newCars.length > 0 || usedCars.length > 0) {
        for (const c of newCars) {
          const key = c.dealer.toLowerCase();
          newCounts[key] = (newCounts[key] ?? 0) + 1;
        }
        usedCount = usedCars.length;
      } else {
        throw new Error("feed caches empty");
      }
    } catch {
      // Fallback to DB counts if feeds are unavailable
      const countRows = await db.execute(sql`
        SELECT LOWER(dealer) AS dealer_key, type, COUNT(*)::int AS cnt
        FROM cars
        GROUP BY LOWER(dealer), type
      `);
      newCounts = {};
      usedCount = 0;
      for (const r of countRows.rows as { dealer_key: string; type: string; cnt: number }[]) {
        if (r.type === "used") {
          usedCount += Number(r.cnt);
        } else {
          newCounts[r.dealer_key] = (newCounts[r.dealer_key] ?? 0) + Number(r.cnt);
        }
      }
    }

    const data = rows.map(brand => {
      if (brand.isServiceOnly) return { ...brand, carCount: 0 };

      const nameLower = brand.name.toLowerCase();

      if (nameLower.includes("пробег")) {
        return { ...brand, carCount: usedCount };
      }

      const count = newCounts[nameLower] ?? 0;
      return { ...brand, carCount: count };
    });

    _brandsCache = { data, ts: Date.now() };
    return res.json({ ok: true, data });
  } catch (err) {
    if (_brandsCache && Date.now() - _brandsCache.ts < BRANDS_CACHE_TTL_MS) {
      return res.json({ ok: true, data: _brandsCache.data });
    }
    return res.status(500).json({ ok: false, error: String(err) });
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
    // When car_mark is empty (brand not yet launched), return no cars.
    // This prevents fuzzy-match cross-pollution between sub-brands
    // (e.g. "Tenet Plus" vs "Tenet": "tenet plus".includes("tenet") = true).
    const allNewCars = await getNewCars();
    let brandCarsRaw: Awaited<typeof allNewCars> = [];
    if (brand.carMark) {
      const carMarkLower = brand.carMark.toLowerCase();
      // Primary: exact dealer match (e.g. car_mark="Haval City" → dealer="Haval City")
      brandCarsRaw = allNewCars.filter(c => c.dealer.toLowerCase() === carMarkLower);
      // Fallback: exact mark match (for brands where dealer ≠ car_mark but mark matches)
      if (brandCarsRaw.length === 0) {
        brandCarsRaw = allNewCars.filter(c => c.mark.toLowerCase() === carMarkLower);
      }
    }
    // brand.carMark empty → [] (brand launching soon, no feed yet)

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
