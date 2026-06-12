import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        l.id, l.title, l.address,
        l.map_x AS "mapX", l.map_y AS "mapY",
        l.phone, l.hours, l.sort_order AS "sortOrder",
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'brand_id', b.id,
              'name', b.name,
              'logoUrl', b.logo_url,
              'bgColor', b.bg_color,
              'isService', lb.is_service,
              'sortOrder', lb.sort_order
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
    return res.json({ ok: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
