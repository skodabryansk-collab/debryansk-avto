import { Router, type IRouter } from "express";
import { db, brandsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select().from(brandsTable).orderBy(brandsTable.name);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const rows = await db.select().from(brandsTable).where(eq(brandsTable.id, id));
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, slug, websiteUrl, logoUrl, bgColor, subName, isServiceOnly } = req.body as { name: string; slug?: string; websiteUrl?: string; logoUrl?: string; bgColor?: string; subName?: string; isServiceOnly?: boolean };
    const rows = await db.insert(brandsTable).values({ name, slug: slug || null, websiteUrl, logoUrl, bgColor, subName, isServiceOnly: isServiceOnly ?? false }).returning();
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { name, slug, websiteUrl, logoUrl, bgColor, subName, isServiceOnly } = req.body as { name?: string; slug?: string; websiteUrl?: string; logoUrl?: string; bgColor?: string; subName?: string; isServiceOnly?: boolean };
    const rows = await db.update(brandsTable).set({ name, slug: slug !== undefined ? (slug || null) : undefined, websiteUrl, logoUrl, bgColor, subName, isServiceOnly }).where(eq(brandsTable.id, id)).returning();
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(brandsTable).where(eq(brandsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
