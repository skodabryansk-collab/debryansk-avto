import { Router, type IRouter } from "express";
import { db, brandsTable, brandPageContentTable, locationsTable, locationBrandsTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { getNewCars } from "./new-cars";

const router: IRouter = Router();

/* ── GET /api/brands  — full brand list with car counts ────── */
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(brandsTable)
      .orderBy(asc(brandsTable.isServiceOnly), asc(brandsTable.name));

    const countRows = await db.execute(sql`
      SELECT LOWER(brand) AS brand_key, type, COUNT(*)::int AS cnt
      FROM cars
      GROUP BY LOWER(brand), type
    `);

    const newCounts: Record<string, number> = {};
    let usedCount = 0;
    for (const r of countRows.rows as { brand_key: string; type: string; cnt: number }[]) {
      if (r.type === "used") {
        usedCount += Number(r.cnt);
      } else {
        newCounts[r.brand_key] = (newCounts[r.brand_key] ?? 0) + Number(r.cnt);
      }
    }

    const data = rows.map(brand => {
      if (brand.isServiceOnly) return { ...brand, carCount: 0 };

      const nameLower = brand.name.toLowerCase();

      if (nameLower.includes("пробег")) {
        return { ...brand, carCount: usedCount };
      }

      let count = 0;
      for (const [markKey, cnt] of Object.entries(newCounts)) {
        if (nameLower.includes(markKey) || markKey.includes(nameLower)) {
          count += cnt;
        }
      }
      return { ...brand, carCount: count };
    });

    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/brands/page/:slug — full brand page data ──────── */
router.get("/page/:slug", async (req, res) => {
  try {
    const slug = req.params["slug"];

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
    const content = contentRows[0] ?? null;

    // Locations for this brand
    const locationRows = await db.execute(sql`
      SELECT l.id, l.title, l.address, l.phone, l.hours, l.map_x, l.map_y, lb.is_service
      FROM locations l
      JOIN location_brands lb ON lb.location_id = l.id
      WHERE lb.brand_id = ${brand.id}
      ORDER BY lb.sort_order, l.sort_order
    `);

    // New cars for this brand (first 6) — from in-memory XML feed cache
    const brandNameLower = brand.name.toLowerCase();
    // Build search key: strip city qualifiers for Haval City / Haval Pro
    const searchName = brandNameLower.replace(/ (city|pro|брянск)$/i, "").trim();

    const allNewCars = await getNewCars();
    const brandCars = allNewCars
      .filter(c => c.mark.toLowerCase().includes(searchName) || searchName.includes(c.mark.toLowerCase()))
      .sort((a, b) => a.price - b.price)
      .slice(0, 6);

    // News mentioning brand name
    const newsRows = await db.execute(sql`
      SELECT id, title, excerpt, category, image, published_at, slug
      FROM news
      WHERE LOWER(title) LIKE ${"%" + searchName + "%"}
         OR LOWER(excerpt) LIKE ${"%" + searchName + "%"}
      ORDER BY published_at DESC
      LIMIT 3
    `);

    return res.json({
      ok: true,
      data: {
        brand,
        content,
        locations: locationRows.rows,
        cars: brandCars,
        news: newsRows.rows,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/brands/:id — single brand by numeric ID or slug ─ */
router.get("/:id", async (req, res) => {
  try {
    const param = req.params["id"]!;
    const numId = Number(param);

    let rows;
    if (!isNaN(numId) && Number.isInteger(numId)) {
      rows = await db.select().from(brandsTable).where(eq(brandsTable.id, numId));
    } else {
      rows = await db.select().from(brandsTable).where(eq(brandsTable.slug, param));
    }

    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
