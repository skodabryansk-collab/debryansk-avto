import { Router, type IRouter } from "express";
import { db, brandsTable, brandPageContentTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

/* ── GET /api/admin/brand-pages/:brandId ─────────────────────── */
router.get("/:brandId", async (req, res) => {
  try {
    const brandId = Number(req.params["brandId"]);
    if (isNaN(brandId)) return res.status(400).json({ ok: false, error: "Invalid brand ID" });

    const brandRows = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brandRows.length) return res.status(404).json({ ok: false, error: "Brand not found" });

    const contentRows = await db
      .select()
      .from(brandPageContentTable)
      .where(eq(brandPageContentTable.brandId, brandId));

    return res.json({
      ok: true,
      data: {
        brand: brandRows[0],
        content: contentRows[0] ?? null,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/brand-pages/:brandId/catalog-models ──────── */
/* Returns unique dealer+model combos from the cars table for this brand */
router.get("/:brandId/catalog-models", async (req, res) => {
  try {
    const brandId = Number(req.params["brandId"]);
    if (isNaN(brandId)) return res.status(400).json({ ok: false, error: "Invalid brand ID" });

    const brandRows = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brandRows.length) return res.status(404).json({ ok: false, error: "Brand not found" });

    const brand = brandRows[0]!;

    const rows = await db.execute(sql`
      SELECT
        dealer,
        REGEXP_REPLACE(model, ',\s*[IVX]+.*$', '') AS model,
        MIN(price)::int AS min_price,
        COUNT(*)::int AS count
      FROM cars
      WHERE type = 'new'
        AND LOWER(dealer) = LOWER(${brand.name})
      GROUP BY dealer, REGEXP_REPLACE(model, ',\s*[IVX]+.*$', '')
      ORDER BY REGEXP_REPLACE(model, ',\s*[IVX]+.*$', '')
    `);

    return res.json({ ok: true, data: rows.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── PUT /api/admin/brand-pages/:brandId ─────────────────────── */
router.put("/:brandId", async (req, res) => {
  try {
    const brandId = Number(req.params["brandId"]);
    if (isNaN(brandId)) return res.status(400).json({ ok: false, error: "Invalid brand ID" });

    const {
      description, serviceText, promoText, metaTitle, metaDescription,
      advantages, features, faq, heroImageUrl, heroImageMobileUrl, promotions, models,
    } = req.body as {
      description?: string | null;
      serviceText?: string | null;
      promoText?: string | null;
      metaTitle?: string | null;
      metaDescription?: string | null;
      advantages?: { icon: string; text: string }[] | null;
      features?: string[] | null;
      faq?: { question: string; answer: string }[] | null;
      heroImageUrl?: string | null;
      heroImageMobileUrl?: string | null;
      promotions?: { title: string; description: string; image?: string; badge?: string; expiresAt?: string; buttonText?: string; buttonUrl?: string; isActive?: boolean }[] | null;
      models?: { id?: string; feedDealer: string; feedModel: string; displayName: string; image?: string; description?: string; badge?: string; isActive?: boolean; sort?: number }[] | null;
    };

    const values = {
      brandId,
      description: description ?? null,
      serviceText: serviceText ?? null,
      promoText: promoText ?? null,
      metaTitle: metaTitle ?? null,
      metaDescription: metaDescription ?? null,
      advantages: advantages ?? [],
      features: features ?? [],
      faq: faq ?? [],
      heroImageUrl: heroImageUrl ?? null,
      heroImageMobileUrl: heroImageMobileUrl ?? null,
      promotions: promotions ?? [],
      models: models ?? [],
      updatedAt: new Date(),
    };

    const rows = await db
      .insert(brandPageContentTable)
      .values(values)
      .onConflictDoUpdate({
        target: brandPageContentTable.brandId,
        set: {
          description: values.description,
          serviceText: values.serviceText,
          promoText: values.promoText,
          metaTitle: values.metaTitle,
          metaDescription: values.metaDescription,
          advantages: values.advantages,
          features: values.features,
          faq: values.faq,
          heroImageUrl: values.heroImageUrl,
          heroImageMobileUrl: values.heroImageMobileUrl,
          promotions: values.promotions,
          models: values.models,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
