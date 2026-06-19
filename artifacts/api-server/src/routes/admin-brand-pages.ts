import { Router, type IRouter } from "express";
import { db, brandsTable, brandPageContentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

/* ── PUT /api/admin/brand-pages/:brandId ─────────────────────── */
router.put("/:brandId", async (req, res) => {
  try {
    const brandId = Number(req.params["brandId"]);
    if (isNaN(brandId)) return res.status(400).json({ ok: false, error: "Invalid brand ID" });

    const { description, serviceText, promoText, metaTitle, metaDescription } = req.body as {
      description?: string;
      serviceText?: string;
      promoText?: string;
      metaTitle?: string;
      metaDescription?: string;
    };

    const values = {
      brandId,
      description: description ?? null,
      serviceText: serviceText ?? null,
      promoText: promoText ?? null,
      metaTitle: metaTitle ?? null,
      metaDescription: metaDescription ?? null,
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
