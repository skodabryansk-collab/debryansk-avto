import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

function mapRow(row: Record<string, unknown>) {
  return {
    id: row["id"],
    title: row["title"],
    description: row["description"],
    image: row["image"] ?? null,
    badge: row["badge"] ?? null,
    expiresAt: row["expires_at"] ?? null,
    isActive: row["is_active"],
    buttonText: row["button_text"] ?? null,
    buttonUrl: row["button_url"] ?? null,
    brandIds: row["brand_ids"] ?? [],
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

function parseBrandIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(id => {
    const n = parseInt(String(id), 10);
    if (isNaN(n) || n <= 0) throw Object.assign(new Error(`Invalid brand ID: ${id}`), { status: 400 });
    return n;
  });
}

function brandIdsLiteral(ids: number[]): string {
  if (ids.length === 0) return "'{}'::integer[]";
  return `ARRAY[${ids.join(",")}]::integer[]`;
}

/* ── GET /api/admin/promotions?brandId=X ────────────────────── */
router.get("/", async (req, res) => {
  try {
    const brandId = req.query["brandId"] ? Number(req.query["brandId"]) : null;

    let rows;
    if (brandId && !isNaN(brandId)) {
      rows = await db.execute(sql`
        SELECT * FROM promotions
        WHERE ${brandId} = ANY(brand_ids)
        ORDER BY created_at DESC
      `);
    } else {
      rows = await db.execute(sql`
        SELECT * FROM promotions
        ORDER BY created_at DESC
      `);
    }

    return res.json({ ok: true, data: (rows.rows as Record<string, unknown>[]).map(mapRow) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/promotions/:id ──────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

    const rows = await db.execute(sql`SELECT * FROM promotions WHERE id = ${id}`);
    if (!rows.rows.length) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true, data: mapRow(rows.rows[0] as Record<string, unknown>) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/promotions ─────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      title, description, image, badge, expiresAt, isActive,
      buttonText, buttonUrl, brandIds,
    } = req.body as {
      title: string;
      description?: string;
      image?: string | null;
      badge?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
      buttonText?: string | null;
      buttonUrl?: string | null;
      brandIds?: number[];
    };

    if (!title?.trim()) return res.status(400).json({ ok: false, error: "Title required" });

    const expires = expiresAt ? new Date(expiresAt) : null;
    const active = isActive !== false;
    const ids = parseBrandIds(brandIds);

    const rows = await db.execute(sql`
      INSERT INTO promotions
        (title, description, image, badge, expires_at, is_active, button_text, button_url, brand_ids, created_at, updated_at)
      VALUES
        (${title.trim()}, ${description ?? ""}, ${image ?? null}, ${badge ?? null},
         ${expires}, ${active}, ${buttonText ?? null}, ${buttonUrl ?? null},
         ${sql.raw(brandIdsLiteral(ids))},
         NOW(), NOW())
      RETURNING *
    `);

    return res.status(201).json({ ok: true, data: mapRow(rows.rows[0] as Record<string, unknown>) });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ ok: false, error: String(err) });
  }
});

/* ── PUT /api/admin/promotions/:id ──────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

    const {
      title, description, image, badge, expiresAt, isActive,
      buttonText, buttonUrl, brandIds,
    } = req.body as {
      title?: string;
      description?: string;
      image?: string | null;
      badge?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
      buttonText?: string | null;
      buttonUrl?: string | null;
      brandIds?: number[];
    };

    const expires = expiresAt ? new Date(expiresAt) : null;
    const ids = parseBrandIds(brandIds);

    const rows = await db.execute(sql`
      UPDATE promotions SET
        title = COALESCE(${title?.trim() ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        image = ${image ?? null},
        badge = ${badge ?? null},
        expires_at = ${expires},
        is_active = COALESCE(${isActive ?? null}, is_active),
        button_text = ${buttonText ?? null},
        button_url = ${buttonUrl ?? null},
        brand_ids = ${sql.raw(brandIdsLiteral(ids))},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);

    if (!rows.rows.length) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true, data: mapRow(rows.rows[0] as Record<string, unknown>) });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ ok: false, error: String(err) });
  }
});

/* ── DELETE /api/admin/promotions/:id ───────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

    await db.execute(sql`DELETE FROM promotions WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
