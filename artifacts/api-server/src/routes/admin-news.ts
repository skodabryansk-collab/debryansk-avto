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
    const { title, excerpt, content, category, image, imageMobile, slug, publishedAt, readTime, brandIds } =
      req.body as Record<string, unknown>;
    const parsedBrandIds = Array.isArray(brandIds) ? (brandIds as unknown[]).map(Number).filter(Boolean) : [];
    const rows = await db
      .insert(newsTable)
      .values({
        title: title as string,
        excerpt: excerpt as string | undefined,
        content: content as string | undefined,
        category: category as string | undefined,
        image: image as string | undefined,
        imageMobile: imageMobile as string | undefined,
        slug: slug as string,
        publishedAt: publishedAt ? new Date(publishedAt as string) : new Date(),
        readTime: readTime ? Number(readTime) : 3,
        brandIds: parsedBrandIds,
      })
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
    const { title, excerpt, content, category, image, imageMobile, slug, publishedAt, readTime, brandIds } =
      req.body as Record<string, unknown>;
    const parsedBrandIds = Array.isArray(brandIds) ? (brandIds as unknown[]).map(Number).filter(Boolean) : [];
    const rows = await db
      .update(newsTable)
      .set({
        ...(title !== undefined && { title: title as string }),
        ...(excerpt !== undefined && { excerpt: excerpt as string }),
        ...(content !== undefined && { content: content as string }),
        ...(category !== undefined && { category: category as string }),
        ...(image !== undefined && { image: image as string }),
        ...(imageMobile !== undefined && { imageMobile: imageMobile as string }),
        ...(slug !== undefined && { slug: slug as string }),
        ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt as string) }),
        ...(readTime !== undefined && { readTime: Number(readTime) }),
        brandIds: parsedBrandIds,
        updatedAt: new Date(),
      })
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
