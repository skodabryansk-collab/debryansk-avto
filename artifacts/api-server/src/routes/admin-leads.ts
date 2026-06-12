import { Router, type IRouter } from "express";
import { db, leadsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const type = req.query["type"] as string | undefined;
    const page = Math.max(1, Number(req.query["page"] || 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    let query = db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt)).limit(limit).offset(offset);
    if (type && type !== "all") {
      query = db.select().from(leadsTable).where(eq(leadsTable.type, type)).orderBy(desc(leadsTable.createdAt)).limit(limit).offset(offset);
    }

    const rows = await query;
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(leadsTable);
    return res.json({ ok: true, data: rows, total: Number(countResult[0]?.count ?? 0) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/export", async (req, res) => {
  try {
    const type = req.query["type"] as string | undefined;
    let rows;
    if (type && type !== "all") {
      rows = await db.select().from(leadsTable).where(eq(leadsTable.type, type)).orderBy(desc(leadsTable.createdAt));
    } else {
      rows = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
    }

    const headers = ["id", "Дата", "Тип", "Имя", "Телефон", "Email", "Сообщение", "Авто"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csvRows = [
      headers.join(";"),
      ...rows.map(r =>
        [r.id, r.createdAt ? new Date(r.createdAt).toLocaleString("ru-RU") : "", r.type, r.name, r.phone, r.email, r.message, r.car].map(escape).join(";")
      )
    ];
    const csv = "\uFEFF" + csvRows.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leads-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
