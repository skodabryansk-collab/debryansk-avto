import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

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

export default router;
