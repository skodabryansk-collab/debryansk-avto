import { Router, type IRouter } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/admin";

const router: IRouter = Router();

/* ── Public ────────────────────────────────────────────── */

router.get("/disclaimers/price-from-used", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, title, content FROM disclaimers
      WHERE scope = 'price_from_used' AND is_active = TRUE
      LIMIT 1
    `);
    const row = result.rows[0] as { id: number; title: string; content: string } | undefined;
    if (!row) return res.json({ ok: true, data: null });
    return res.json({ ok: true, data: { id: row.id, title: row.title, content: row.content } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/disclaimers/price-from-new", async (req, res) => {
  try {
    const brandName = req.query["brandName"] as string | undefined;
    const model = req.query["model"] as string | undefined;
    const baseModel = model ? model.split(",")[0].trim() : undefined;

    // Resolve ALL brand IDs sharing this car_mark (e.g. "Haval" → [3,4])
    let brandIds: number[] = [];
    if (brandName) {
      const b = await pool.query(
        "SELECT id FROM brands WHERE LOWER(car_mark) = LOWER($1) OR LOWER(name) = LOWER($1) OR LOWER(slug) = LOWER($1)",
        [brandName]
      );
      brandIds = b.rows.map((r: any) => r.id);
    }

    if (brandIds.length > 0) {
      const idList = brandIds.join(",");

      if (baseModel) {
        const exact = await pool.query(
          `SELECT id, title, content FROM disclaimers
           WHERE scope = 'price_from_new'
             AND brand_id = ANY(ARRAY[${idList}]::int[])
             AND LOWER(SPLIT_PART(model, ',', 1)) = LOWER($1)
             AND is_active = TRUE
           ORDER BY brand_id, id LIMIT 1`,
          [baseModel]
        );
        const row = exact.rows[0];
        if (row) return res.json({ ok: true, data: { id: row.id, title: row.title, content: row.content } });
      }

      const brandOnly = await pool.query(
        `SELECT id, title, content FROM disclaimers
         WHERE scope = 'price_from_new'
           AND brand_id = ANY(ARRAY[${idList}]::int[])
           AND model IS NULL
           AND is_active = TRUE
         ORDER BY brand_id, id LIMIT 1`,
        []
      );
      const row = brandOnly.rows[0];
      if (row) return res.json({ ok: true, data: { id: row.id, title: row.title, content: row.content } });
    }
    return res.json({ ok: true, data: null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/disclaimers/promotion/:promotionId", async (req, res) => {
  try {
    const promotionId = Number(req.params["promotionId"]);
    const result = await db.execute(sql`
      SELECT d.id, d.title, d.content
      FROM disclaimers d
      JOIN promotion_disclaimers pd ON pd.disclaimer_id = d.id
      WHERE pd.promotion_id = ${promotionId} AND d.is_active = TRUE
      ORDER BY d.id
    `);
    const rows = result.rows as { id: number; title: string; content: string }[];
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Admin ──────────────────────────────────────────────────── */

router.get("/admin/disclaimers", requireAdmin, async (req, res) => {
  try {
    const scope = req.query["scope"] as string | undefined;
    const where = scope
      ? sql`WHERE scope = ${scope}`
      : sql``;
    const result = await db.execute(sql`
      SELECT id, scope, brand_id, model, title, content, is_active, created_at
      FROM disclaimers ${where}
      ORDER BY scope, brand_id NULLS LAST, model NULLS LAST, id
    `);
    return res.json({ ok: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/admin/disclaimers", requireAdmin, async (req, res) => {
  try {
    const { scope, brandId, model, title, content } = req.body as {
      scope: string; brandId?: number; model?: string; title: string; content: string;
    };
    if (!scope || !title || !content) {
      return res.status(400).json({ ok: false, error: "scope, title, content required" });
    }
    const result = await db.execute(sql`
      INSERT INTO disclaimers (scope, brand_id, model, title, content, is_active)
      VALUES (${scope}, ${brandId ?? null}, ${model ?? null}, ${title}, ${content}, TRUE)
      RETURNING id
    `);
    const id = (result.rows[0] as { id: number }).id;
    return res.json({ ok: true, id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/admin/disclaimers/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { brandId, model, title, content, isActive } = req.body as {
      brandId?: number; model?: string; title?: string; content?: string; isActive?: boolean;
    };

    // Save current content to versions table before updating
    if (content !== undefined) {
      const current = await db.execute(sql`SELECT content FROM disclaimers WHERE id = ${id} LIMIT 1`);
      const currentRow = current.rows[0] as { content: string } | undefined;
      if (currentRow && currentRow.content !== content) {
        const maxVN = await db.execute(sql`
          SELECT COALESCE(MAX(version_number), 0) + 1 AS vn
          FROM disclaimer_versions WHERE disclaimer_id = ${id}
        `);
        const vn = (maxVN.rows[0] as { vn: number }).vn;
        await db.execute(sql`
          INSERT INTO disclaimer_versions (disclaimer_id, content, version_number)
          VALUES (${id}, ${currentRow.content}, ${vn})
        `);
      }
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let p = 1;
    if (brandId !== undefined) { setParts.push(`brand_id = $${p++}`); params.push(brandId); }
    if (model !== undefined) { setParts.push(`model = $${p++}`); params.push(model); }
    if (title !== undefined) { setParts.push(`title = $${p++}`); params.push(title); }
    if (content !== undefined) { setParts.push(`content = $${p++}`); params.push(content); }
    if (isActive !== undefined) { setParts.push(`is_active = $${p++}`); params.push(isActive); }
    if (setParts.length === 0) return res.status(400).json({ ok: false, error: "no fields to update" });
    setParts.push(`updated_at = NOW()`);
    params.push(id);

    const q = `UPDATE disclaimers SET ${setParts.join(", ")} WHERE id = $${p}`;
    await pool.query(q, params);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.delete("/admin/disclaimers/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const scopeCheck = await db.execute(sql`SELECT scope FROM disclaimers WHERE id = ${id} LIMIT 1`);
    const row = scopeCheck.rows[0] as { scope: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, error: "not found" });
    if (row.scope === "price_from_used") {
      return res.status(403).json({ ok: false, error: "Cannot delete system price_from_used disclaimer" });
    }
    await db.execute(sql`DELETE FROM disclaimers WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/admin/disclaimers/:id/versions", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const result = await db.execute(sql`
      SELECT id, version_number, content, changed_at
      FROM disclaimer_versions WHERE disclaimer_id = ${id}
      ORDER BY version_number DESC
    `);
    return res.json({ ok: true, data: result.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/admin/promotions/:id/disclaimers", requireAdmin, async (req, res) => {
  try {
    const promotionId = Number(req.params["id"]);
    const { disclaimerIds } = req.body as { disclaimerIds: number[] };
    // Delete old, insert new (transactional via sequential SQL)
    await db.execute(sql`DELETE FROM promotion_disclaimers WHERE promotion_id = ${promotionId}`);
    for (const did of disclaimerIds) {
      await db.execute(sql`
        INSERT INTO promotion_disclaimers (promotion_id, disclaimer_id)
        VALUES (${promotionId}, ${did})
        ON CONFLICT DO NOTHING
      `);
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
