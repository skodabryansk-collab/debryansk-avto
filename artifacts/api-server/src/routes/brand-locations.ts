import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/brand-locations", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT b.name AS brand_name, l.phone, l.title AS location_title
      FROM brands b
      JOIN location_brands lb ON lb.brand_id = b.id
      JOIN locations l ON l.id = lb.location_id
    `);

    const map: Record<string, { phone: string; locationTitle: string }> = {};
    for (const row of result.rows as { brand_name: string; phone: string; location_title: string }[]) {
      if (row.brand_name && row.phone) {
        map[row.brand_name.toLowerCase()] = {
          phone: row.phone,
          locationTitle: row.location_title,
        };
      }
    }

    return res.json({ ok: true, data: map });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
