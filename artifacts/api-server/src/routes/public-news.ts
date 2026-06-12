import { Router, type IRouter } from "express";
import { db, newsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(newsTable).orderBy(desc(newsTable.publishedAt));
    return res.json({ ok: true, data: rows });
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
