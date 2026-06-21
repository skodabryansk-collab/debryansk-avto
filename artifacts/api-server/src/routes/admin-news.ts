import { Router, type IRouter } from "express";
import { db, newsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { pingIndexNow } from "../services/indexnow";

const SITE = "https://debryansk-auto.ru";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(newsTable).orderBy(newsTable.publishedAt);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const rows = await db.select().from(newsTable).where(eq(newsTable.id, id));
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, excerpt, content, category, image, slug, publishedAt, readTime, brandId } = req.body as Record<string, string>;
    const rows = await db
      .insert(newsTable)
      .values({ title, excerpt, content, category, image, slug, publishedAt: publishedAt ? new Date(publishedAt) : new Date(), readTime: readTime ? Number(readTime) : 3, brandId: brandId ? Number(brandId) : null })
      .returning();
    if (slug) {
      pingIndexNow([`${SITE}/news/${slug}`]).catch(() => {});
    }
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { title, excerpt, content, category, image, slug, publishedAt, readTime, brandId } = req.body as Record<string, string>;
    const rows = await db
      .update(newsTable)
      .set({ title, excerpt, content, category, image, slug, publishedAt: publishedAt ? new Date(publishedAt) : undefined, readTime: readTime ? Number(readTime) : undefined, brandId: brandId !== undefined ? (brandId ? Number(brandId) : null) : undefined, updatedAt: new Date() })
      .where(eq(newsTable.id, id))
      .returning();
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(newsTable).where(eq(newsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
