import { Router, type IRouter } from "express";
import { db, brandsTable, brandPageContentTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

function promoToDb(p: { title: string; description?: string; image?: string; badge?: string; expiresAt?: string; buttonText?: string; buttonUrl?: string; isActive?: boolean }) {
  return {
    title: p.title,
    description: p.description ?? "",
    image: p.image ?? null,
    badge: p.badge ?? null,
    expires_at: p.expiresAt ? new Date(p.expiresAt) : null,
    is_active: p.isActive !== false,
    button_text: p.buttonText ?? null,
    button_url: p.buttonUrl ?? null,
  };
}

function promoFromDb(row: Record<string, unknown>) {
  return {
    id: row["id"] as number,
    title: row["title"] as string,
    description: row["description"] as string,
    image: row["image"] as string | null,
    badge: row["badge"] as string | null,
    expiresAt: row["expires_at"] as string | null,
    isActive: row["is_active"] as boolean,
    buttonText: row["button_text"] as string | null,
    buttonUrl: row["button_url"] as string | null,
  };
}

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

    // Inject global promotions for this brand into the content object
    const promoRows = await db.execute(sql`
      SELECT id, title, description, image, badge, expires_at, is_active, button_text, button_url
      FROM promotions
      WHERE ${brandId} = ANY(brand_ids)
      ORDER BY created_at DESC
    `);
    const globalPromos = (promoRows.rows as Record<string, unknown>[]).map(promoFromDb);

    const rawContent = contentRows[0] ?? null;
    const content = rawContent
      ? { ...rawContent, promotions: globalPromos }
      : globalPromos.length > 0 ? { promotions: globalPromos } : null;

    return res.json({
      ok: true,
      data: {
        brand: brandRows[0],
        content,
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
      advantages, features, faq, heroImageUrl, heroImageMobileUrl, promotions, models, services,
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
      services?: { id?: string; icon: string; title: string; description?: string; sort?: number }[] | null;
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
      services: services ?? [],
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
          services: values.services,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    // Bidirectional sync: ID-based upsert for promotions exclusively owned by this brand
    if (promotions !== undefined) {
      // Fetch IDs of promotions exclusively owned by this brand
      const existingRows = await db.execute(sql`
        SELECT id FROM promotions WHERE brand_ids = ARRAY[${brandId}]::integer[]
      `);
      const existingIds = new Set((existingRows.rows as { id: number }[]).map(r => r.id));

      const keepIds = new Set<number>();

      for (const p of (promotions ?? [])) {
        const dbp = promoToDb(p);
        const pid = (p as { id?: number }).id;

        if (pid && existingIds.has(pid)) {
          // Update existing exclusively-owned row
          await db.execute(sql`
            UPDATE promotions SET
              title = ${dbp.title}, description = ${dbp.description},
              image = ${dbp.image}, badge = ${dbp.badge},
              expires_at = ${dbp.expires_at}, is_active = ${dbp.is_active},
              button_text = ${dbp.button_text}, button_url = ${dbp.button_url},
              updated_at = NOW()
            WHERE id = ${pid}
          `);
          keepIds.add(pid);
        } else {
          // New promotion — insert as exclusively owned by this brand
          await db.execute(sql`
            INSERT INTO promotions
              (title, description, image, badge, expires_at, is_active, button_text, button_url, brand_ids, created_at, updated_at)
            VALUES
              (${dbp.title}, ${dbp.description}, ${dbp.image}, ${dbp.badge},
               ${dbp.expires_at}, ${dbp.is_active}, ${dbp.button_text}, ${dbp.button_url},
               ARRAY[${brandId}]::integer[], NOW(), NOW())
          `);
        }
      }

      // Delete exclusively-owned rows that are no longer present
      for (const eid of existingIds) {
        if (!keepIds.has(eid)) {
          await db.execute(sql`DELETE FROM promotions WHERE id = ${eid}`);
        }
      }
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
