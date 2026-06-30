import { Router, type IRouter } from "express";
import { db, brandsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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

// Must be before /:id to avoid conflict
router.get("/car-marks", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT brand AS mark FROM cars WHERE brand IS NOT NULL ORDER BY brand
    `);
    return res.json((result.rows as { mark: string }[]).map(r => r.mark));
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Distinct base model names for a given car_mark (stripped of generation suffix)
router.get("/car-models", async (req, res) => {
  try {
    const mark = req.query["mark"] as string | undefined;
    if (!mark) return res.json([]);
    const result = await db.execute(sql`
      SELECT DISTINCT TRIM(SPLIT_PART(model, ',', 1)) AS base_model
      FROM cars
      WHERE type = 'new' AND LOWER(brand) = LOWER(${mark})
        AND model IS NOT NULL
      ORDER BY base_model
    `);
    return res.json((result.rows as { base_model: string }[]).map(r => r.base_model));
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
    const { name, slug, websiteUrl, logoUrl, bgColor, subName, isServiceOnly, carMark } = req.body as { name: string; slug?: string; websiteUrl?: string; logoUrl?: string; bgColor?: string; subName?: string; isServiceOnly?: boolean; carMark?: string };
    const rows = await db.insert(brandsTable).values({ name, slug: slug || null, websiteUrl, logoUrl, bgColor, subName, isServiceOnly: isServiceOnly ?? false, carMark: carMark || null }).returning();
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { name, slug, websiteUrl, logoUrl, bgColor, subName, isServiceOnly, carMark } = req.body as { name?: string; slug?: string; websiteUrl?: string; logoUrl?: string; bgColor?: string; subName?: string; isServiceOnly?: boolean; carMark?: string | null };
    const rows = await db.update(brandsTable).set({
      name,
      slug: slug !== undefined ? (slug || null) : undefined,
      websiteUrl, logoUrl, bgColor, subName, isServiceOnly,
      ...(carMark !== undefined ? { carMark: carMark || null } : {}),
    }).where(eq(brandsTable.id, id)).returning();
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
