/**
 * SEO Anchor Queries API — CRUD + suggest from Webmaster data.
 * All endpoints require admin auth.
 *
 * GET  /api/admin/seo-anchor            — list
 * POST /api/admin/seo-anchor            — create
 * PUT  /api/admin/seo-anchor/:id        — update
 * DELETE /api/admin/seo-anchor/:id      — delete
 * GET  /api/admin/seo-anchor/suggest    — suggest anchor queries from latest snapshot
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

/* ── GET /api/admin/seo-anchor ─────────────────────────────────────────── */
router.get("/", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        a.id, a.query_text, a.page_url, a.target_position,
        a.is_active, a.notes, a.created_at, a.updated_at,
        s.avg_position AS current_position,
        s.total_clicks,
        s.snapshot_date AS last_checked_at
      FROM seo_anchor_queries a
      LEFT JOIN LATERAL (
        SELECT avg_position, total_clicks, snapshot_date
        FROM seo_query_snapshots
        WHERE query_text ILIKE a.query_text
        ORDER BY snapshot_date DESC
        LIMIT 1
      ) s ON true
      ORDER BY a.is_active DESC, a.query_text
    `);
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/seo-anchor/suggest ─────────────────────────────────── */
router.get("/suggest", async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10));
    // Top commercial queries not yet in anchor list, position 5–30
    const rows = await db.execute(sql`
      SELECT s.query_text,
             s.avg_position,
             s.total_shows,
             s.total_clicks,
             s.snapshot_date
      FROM seo_query_snapshots s
      WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM seo_query_snapshots)
        AND s.avg_position BETWEEN 5 AND 30
        AND s.total_shows >= 30
        AND s.query_text NOT ILIKE '%дебрянск%'
        AND NOT EXISTS (
          SELECT 1 FROM seo_anchor_queries a
          WHERE a.query_text ILIKE s.query_text
        )
      ORDER BY s.total_shows DESC
      LIMIT ${limit}
    `);
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/seo-anchor ────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const { query_text, page_url, target_position, notes } = req.body as {
    query_text?: string; page_url?: string; target_position?: number; notes?: string;
  };
  if (!query_text?.trim() || !page_url?.trim()) {
    return res.status(400).json({ ok: false, error: "query_text и page_url обязательны" });
  }
  try {
    const result = await db.execute(sql`
      INSERT INTO seo_anchor_queries (query_text, page_url, target_position, notes)
      VALUES (
        ${query_text.trim()},
        ${page_url.trim()},
        ${target_position ?? 10},
        ${notes ?? null}
      )
      ON CONFLICT (query_text) DO UPDATE SET
        page_url        = EXCLUDED.page_url,
        target_position = EXCLUDED.target_position,
        notes           = EXCLUDED.notes,
        updated_at      = NOW()
      RETURNING id, query_text, page_url, target_position, is_active, notes, created_at
    `);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── PUT /api/admin/seo-anchor/:id ─────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params["id"], 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const { query_text, page_url, target_position, is_active, notes } = req.body as {
    query_text?: string; page_url?: string; target_position?: number; is_active?: boolean; notes?: string;
  };
  try {
    await db.execute(sql`
      UPDATE seo_anchor_queries SET
        query_text      = COALESCE(${query_text?.trim() ?? null}, query_text),
        page_url        = COALESCE(${page_url?.trim() ?? null}, page_url),
        target_position = COALESCE(${target_position ?? null}, target_position),
        is_active       = COALESCE(${is_active ?? null}, is_active),
        notes           = COALESCE(${notes ?? null}, notes),
        updated_at      = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── DELETE /api/admin/seo-anchor/:id ──────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params["id"], 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
  try {
    await db.execute(sql`DELETE FROM seo_anchor_queries WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
