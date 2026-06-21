import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/* ── GET /api/reviews ──────────────────────────────────────────────────────
   Reads from the `reviews` table (populated by reviews-sync service).
   No live calls to GetLoyalty on the hot path.
   ─────────────────────────────────────────────────────────────────────────── */
/* ── GET /api/reviews/aggregate ─────────────────────────────────────────── */
router.get("/aggregate", async (_req, res) => {
  try {
    const [statsResult, metaResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS total, COALESCE(AVG(rating)::float, 5) AS avg
        FROM reviews
      `),
      db.execute(sql`SELECT overall_count FROM reviews_meta WHERE id = 1`),
    ]);
    const avg = Math.round(Number((statsResult.rows[0] as any)?.avg ?? 5) * 10) / 10;
    const total = Number((statsResult.rows[0] as any)?.total ?? 0);
    const overallCount = Number((metaResult.rows[0] as any)?.overall_count ?? total);
    return res.json({ ok: true, avg, total, overallCount });
  } catch {
    return res.json({ ok: true, avg: 4.9, total: 0, overallCount: 0 });
  }
});

/* ── GET /api/reviews ──────────────────────────────────────────────────────
   Reads from the `reviews` table (populated by reviews-sync service).
   No live calls to GetLoyalty on the hot path.
   ─────────────────────────────────────────────────────────────────────────── */
router.get("/", async (_req, res) => {
  try {
    const [reviewsResult, metaResult, statsResult] = await Promise.all([
      db.execute(sql`
        SELECT id, author, rating, text, date::text AS date, source, source_url
        FROM reviews
        ORDER BY date DESC NULLS LAST, id DESC
      `),
      db.execute(sql`
        SELECT overall_count, last_sync_at
        FROM reviews_meta
        WHERE id = 1
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt,
               COALESCE(AVG(rating)::float, 5) AS avg
        FROM reviews
      `),
    ]);

    const data = reviewsResult.rows.map((r: any) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      text: r.text,
      date: r.date,
      source: r.source,
      sourceUrl: r.source_url ?? undefined,
    }));

    const overallCount = Number((metaResult.rows[0] as any)?.overall_count ?? 0);
    const rawAvg = Number((statsResult.rows[0] as any)?.avg ?? 5);
    const avg = Math.round(rawAvg * 10) / 10;
    const total = Number((statsResult.rows[0] as any)?.cnt ?? 0);

    return res.json({ ok: true, data, avg, total, overallCount });
  } catch (err) {
    logger.error({ err }, "[reviews] GET /api/reviews failed");
    return res.json({ ok: true, data: [], avg: 5, total: 0, overallCount: 0 });
  }
});

export default router;
