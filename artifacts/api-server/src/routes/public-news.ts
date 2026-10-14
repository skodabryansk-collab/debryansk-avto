import { Router, type IRouter } from "express";
import { db, newsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function optimizeNewsImage(url: string | null, width: number): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://debryansk-auto.ru");
    if (!parsed.pathname.startsWith("/api/storage/objects/")) return url;
    parsed.searchParams.set("format", "webp");
    parsed.searchParams.set("width", String(width));
    return url.startsWith("/") ? `${parsed.pathname}${parsed.search}` : parsed.toString();
  } catch {
    return url;
  }
}

router.get("/", async (req, res) => {
  try {
    const section = req.query["section"] as string | undefined;
    if (section === "vacancies") {
      const rows = await db.select().from(newsTable)
        .where(eq(newsTable.sectionVacancies, true))
        .orderBy(desc(newsTable.publishedAt));
      return res.json({ ok: true, data: rows });
    }
    const rows = await db.select({
      id: newsTable.id,
      title: newsTable.title,
      excerpt: newsTable.excerpt,
      category: newsTable.category,
      image: newsTable.image,
      imageMobile: newsTable.imageMobile,
      publishedAt: newsTable.publishedAt,
      readTime: newsTable.readTime,
      slug: newsTable.slug,
    }).from(newsTable).orderBy(desc(newsTable.publishedAt));
    const data = rows.map(row => ({
      ...row,
      image: optimizeNewsImage(row.image, 1280) ?? "",
      imageMobile: optimizeNewsImage(row.imageMobile ?? row.image, 640),
    }));
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params["slug"];
    const rows = await db.select().from(newsTable).where(eq(newsTable.slug, slug));
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
