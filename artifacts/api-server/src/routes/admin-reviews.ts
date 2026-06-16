import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { syncAllReviews, syncRecentReviews } from "../services/reviews-sync";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAdmin);

/* ── GET /api/admin/reviews ── paginated list ─────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = 50;
    const offset = (page - 1) * limit;

    const [rows, countResult, metaResult] = await Promise.all([
      db.execute(sql`
        SELECT id, external_id, author, rating, text, date::text AS date,
               source, source_url, synced_at
        FROM reviews
        ORDER BY date DESC NULLS LAST, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt,
               COALESCE(AVG(rating)::float, 5) AS avg
        FROM reviews
      `),
      db.execute(sql`
        SELECT overall_count, last_sync_at
        FROM reviews_meta WHERE id = 1
      `),
    ]);

    const total = Number((countResult.rows[0] as any)?.cnt ?? 0);
    const avg = Math.round(Number((countResult.rows[0] as any)?.avg ?? 5) * 10) / 10;
    const overallCount = Number((metaResult.rows[0] as any)?.overall_count ?? 0);
    const lastSyncAt = (metaResult.rows[0] as any)?.last_sync_at ?? null;

    return res.json({
      ok: true,
      data: rows.rows,
      total,
      avg,
      overallCount,
      lastSyncAt,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error({ err }, "[admin-reviews] list failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

/* ── POST /api/admin/reviews/sync ── trigger manual sync ─────────────── */
router.post("/sync", async (req, res) => {
  const type: "full" | "recent" = req.body?.type === "recent" ? "recent" : "full";
  try {
    const result =
      type === "full" ? await syncAllReviews() : await syncRecentReviews();
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, `[admin-reviews] manual ${type} sync failed`);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
