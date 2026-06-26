import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/cars/:id/view", async (req, res) => {
  try {
    const carId = req.params.id;
    if (!carId) return res.status(400).json({ ok: false, error: "id required" });

    await db.execute(sql`
      INSERT INTO car_views (car_id, view_count, updated_at)
      VALUES (${carId}, 1, NOW())
      ON CONFLICT (car_id) DO UPDATE
        SET view_count = car_views.view_count + 1,
            updated_at = NOW()
    `);

    // Also update popularity_score in cars table if this car exists there (new cars synced by Navigator)
    await db.execute(sql`
      UPDATE cars
      SET popularity_score = (
        SELECT view_count FROM car_views WHERE car_id = ${carId}
      )
      WHERE external_id = ${carId}
    `);

    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err, carId: req.params.id }, "car-views: POST error");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export async function getViewCounts(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  try {
    const rows = await db.execute(sql`
      SELECT car_id, view_count FROM car_views
      WHERE car_id = ANY(${ids})
    `);
    const map: Record<string, number> = {};
    for (const row of rows.rows as { car_id: string; view_count: number }[]) {
      map[row.car_id] = row.view_count;
    }
    return map;
  } catch {
    return {};
  }
}

export default router;
