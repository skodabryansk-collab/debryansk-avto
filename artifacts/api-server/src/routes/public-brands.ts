import { Router, type IRouter } from "express";
import { db, brandsTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(brandsTable)
      .orderBy(asc(brandsTable.isServiceOnly), asc(brandsTable.name));

    /* ── Car counts per brand ──────────────────────────────────────── */
    const countRows = await db.execute(sql`
      SELECT LOWER(brand) AS brand_key, type, COUNT(*)::int AS cnt
      FROM cars
      GROUP BY LOWER(brand), type
    `);

    const newCounts: Record<string, number> = {};
    let usedCount = 0;
    for (const r of countRows.rows as { brand_key: string; type: string; cnt: number }[]) {
      if (r.type === "used") {
        usedCount += Number(r.cnt);
      } else {
        newCounts[r.brand_key] = (newCounts[r.brand_key] ?? 0) + Number(r.cnt);
      }
    }

    const data = rows.map(brand => {
      if (brand.isServiceOnly) return { ...brand, carCount: 0 };

      const nameLower = brand.name.toLowerCase();

      if (nameLower.includes("пробег")) {
        return { ...brand, carCount: usedCount };
      }

      const firstWord = nameLower.split(/[\s-]+/)[0];
      let count = 0;
      for (const [markKey, cnt] of Object.entries(newCounts)) {
        if (markKey.includes(firstWord) || firstWord.includes(markKey)) {
          count += cnt;
        }
      }
      return { ...brand, carCount: count };
    });

    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const rows = await db.select().from(brandsTable).where(eq(brandsTable.id, id));
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
