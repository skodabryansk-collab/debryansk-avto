import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

/* GET /api/promotions?type=service|sales  — public, active, non-expired */
router.get("/promotions", async (req, res) => {
  try {
    const type = (req.query["type"] as string) || null;

    const rows = await db.execute(sql`
      SELECT
        p.id, p.title, p.description, p.image, p.badge,
        p.expires_at, p.button_text, p.button_url, p.brand_ids, p.promotion_type,
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'name', b.name,
              'logoUrl', b.logo_url,
              'bgColor', b.bg_color
            )
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'
        ) AS brands
      FROM promotions p
      LEFT JOIN LATERAL UNNEST(p.brand_ids) AS bid(id) ON TRUE
      LEFT JOIN brands b ON b.id = bid.id
      WHERE p.is_active = TRUE
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        ${type ? sql`AND p.promotion_type = ${type}` : sql``}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    const data = (rows.rows as Record<string, unknown>[]).map(row => ({
      id: row["id"],
      title: row["title"],
      description: row["description"],
      image: row["image"] ?? null,
      badge: row["badge"] ?? null,
      expiresAt: row["expires_at"] ?? null,
      buttonText: row["button_text"] ?? null,
      buttonUrl: row["button_url"] ?? null,
      brandIds: row["brand_ids"] ?? [],
      promotionType: row["promotion_type"] ?? "sales",
      brands: row["brands"] ?? [],
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
