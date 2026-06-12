import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const result = await db.execute(sql`SELECT key, value FROM site_settings`);
    const data: Record<string, string> = {};
    for (const r of result.rows as { key: string; value: string }[]) {
      data[r.key] = r.value;
    }
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/:key", async (req, res) => {
  try {
    const { key } = req.params as { key: string };
    const { value } = req.body as { value: string };
    if (!key || value === undefined) {
      return res.status(400).json({ ok: false, error: "key and value required" });
    }
    await db.execute(sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
