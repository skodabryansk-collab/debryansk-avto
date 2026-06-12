import { Router, type IRouter } from "express";
import { db, locationsTable, locationBrandsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

async function fetchAllLocations() {
  const result = await db.execute(sql`
    SELECT
      l.id, l.title, l.address,
      l.map_x AS "mapX", l.map_y AS "mapY",
      l.phone, l.hours, l.sort_order AS "sortOrder",
      COALESCE(
        json_agg(
          json_build_object(
            'id', b.id, 'name', b.name,
            'logoUrl', b.logo_url, 'bgColor', b.bg_color,
            'isService', lb.is_service, 'sortOrder', lb.sort_order
          ) ORDER BY lb.sort_order
        ) FILTER (WHERE b.id IS NOT NULL),
        '[]'::json
      ) AS brands
    FROM locations l
    LEFT JOIN location_brands lb ON lb.location_id = l.id
    LEFT JOIN brands b ON b.id = lb.brand_id
    GROUP BY l.id
    ORDER BY l.sort_order, l.id
  `);
  return result.rows;
}

async function fetchOneLocation(id: number) {
  const result = await db.execute(sql`
    SELECT
      l.id, l.title, l.address,
      l.map_x AS "mapX", l.map_y AS "mapY",
      l.phone, l.hours, l.sort_order AS "sortOrder",
      COALESCE(
        json_agg(
          json_build_object(
            'id', b.id, 'name', b.name,
            'logoUrl', b.logo_url, 'bgColor', b.bg_color,
            'isService', lb.is_service, 'sortOrder', lb.sort_order
          ) ORDER BY lb.sort_order
        ) FILTER (WHERE b.id IS NOT NULL),
        '[]'::json
      ) AS brands
    FROM locations l
    LEFT JOIN location_brands lb ON lb.location_id = l.id
    LEFT JOIN brands b ON b.id = lb.brand_id
    WHERE l.id = ${id}
    GROUP BY l.id
  `);
  return result.rows[0] ?? null;
}

router.get("/", async (_req, res) => {
  try {
    return res.json({ ok: true, data: await fetchAllLocations() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const loc = await fetchOneLocation(Number(req.params["id"]));
    if (!loc) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: loc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, address, phone, hours, mapX, mapY, sortOrder } = req.body as {
      title: string; address: string; phone?: string; hours?: string;
      mapX?: number; mapY?: number; sortOrder?: number;
    };
    if (!title || !address) return res.status(400).json({ ok: false, error: "title and address are required" });
    const rows = await db.insert(locationsTable)
      .values({ title, address, phone, hours, mapX, mapY, sortOrder: sortOrder ?? 0 })
      .returning();
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { title, address, phone, hours, mapX, mapY, sortOrder } = req.body as {
      title?: string; address?: string; phone?: string; hours?: string;
      mapX?: number; mapY?: number; sortOrder?: number;
    };
    const rows = await db.update(locationsTable)
      .set({ title, address, phone, hours, mapX, mapY, sortOrder })
      .where(eq(locationsTable.id, id))
      .returning();
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const rows = await db.delete(locationsTable).where(eq(locationsTable.id, id)).returning();
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/:id/brands", async (req, res) => {
  try {
    const locationId = Number(req.params["id"]);
    const { brandId, isService, sortOrder } = req.body as {
      brandId: number; isService?: boolean; sortOrder?: number;
    };
    if (!brandId) return res.status(400).json({ ok: false, error: "brandId is required" });
    const rows = await db.insert(locationBrandsTable)
      .values({ locationId, brandId: Number(brandId), isService: !!isService, sortOrder: sortOrder ?? 0 })
      .returning();
    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.patch("/:id/brands/:brandId", async (req, res) => {
  try {
    const locationId = Number(req.params["id"]);
    const brandId = Number(req.params["brandId"]);
    const { isService } = req.body as { isService: boolean };
    const rows = await db.update(locationBrandsTable)
      .set({ isService: !!isService })
      .where(and(eq(locationBrandsTable.locationId, locationId), eq(locationBrandsTable.brandId, brandId)))
      .returning();
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.delete("/:id/brands/:brandId", async (req, res) => {
  try {
    const locationId = Number(req.params["id"]);
    const brandId = Number(req.params["brandId"]);
    await db.delete(locationBrandsTable)
      .where(and(eq(locationBrandsTable.locationId, locationId), eq(locationBrandsTable.brandId, brandId)));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
