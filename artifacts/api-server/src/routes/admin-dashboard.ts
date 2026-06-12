import { Router, type IRouter } from "express";
import { db, newsTable, leadsTable, brandsTable, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/stats", async (_req, res) => {
  try {
    const [newsCount] = await db.select({ count: sql<number>`count(*)` }).from(newsTable);
    const [brandsCount] = await db.select({ count: sql<number>`count(*)` }).from(brandsTable);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [leadsToday] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`created_at >= current_date`);
    const [leadsWeek] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`created_at >= current_date - interval '7 days'`);

    return res.json({
      ok: true,
      data: {
        newsCount: Number(newsCount?.count ?? 0),
        brandsCount: Number(brandsCount?.count ?? 0),
        usersCount: Number(usersCount?.count ?? 0),
        leadsToday: Number(leadsToday?.count ?? 0),
        leadsWeek: Number(leadsWeek?.count ?? 0),
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
