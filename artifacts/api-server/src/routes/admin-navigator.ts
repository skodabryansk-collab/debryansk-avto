import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { syncCars } from "../services/car-sync";
import { clearNewCarsCache } from "../routes/new-cars";

const router: IRouter = Router();
router.use(requireAdmin);

/* ── GET /admin/navigator/chats ── list conversations with stats ── */
router.get("/chats", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        c.id,
        c.session_id,
        c.created_at,
        c.consented_at,
        COUNT(m.id)::int AS msg_count,
        COUNT(CASE WHEN m.role = 'assistant' AND m.rating IS NOT NULL THEN 1 END)::int AS rated_count,
        AVG(CASE WHEN m.role = 'assistant' AND m.rating IS NOT NULL THEN m.rating END) AS avg_rating
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 200
    `);
    return res.json({ ok: true, data: rows.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /admin/navigator/chats/export-jsonl ── download JSONL for fine-tuning ── */
router.get("/chats/export-jsonl", async (_req, res) => {
  try {
    const goodConvs = await db.execute(sql`
      SELECT DISTINCT m.conversation_id
      FROM messages m
      WHERE m.role = 'assistant' AND m.rating IS NOT NULL
      GROUP BY m.conversation_id
      HAVING
        COUNT(CASE WHEN m.rating = 1 THEN 1 END) = COUNT(CASE WHEN m.rating IS NOT NULL THEN 1 END)
        AND COUNT(CASE WHEN m.rating = 1 THEN 1 END) > 0
    `);

    const convIds = (goodConvs.rows as any[]).map(r => r.conversation_id);
    if (convIds.length === 0) {
      res.setHeader("Content-Type", "application/jsonl");
      res.setHeader("Content-Disposition", 'attachment; filename="navigator-finetune.jsonl"');
      return res.send("");
    }

    const SYSTEM_CONTENT =
      "Ты — «Навигатор», ИИ-консультант автодилерской группы «Дебрянск Авто». " +
      "Отвечай дружелюбно и профессионально на вопросы об автомобилях и услугах дилера. " +
      "Отвечай только на русском языке.";

    const lines: string[] = [];

    for (const convId of convIds) {
      const msgRows = await db.execute(sql`
        SELECT role, content FROM messages
        WHERE conversation_id = ${convId}
        ORDER BY created_at ASC
      `);
      const msgs = msgRows.rows as { role: string; content: string }[];
      if (msgs.length < 2) continue;

      const ftMsgs: { role: string; content: string }[] = [
        { role: "system", content: SYSTEM_CONTENT },
        ...msgs.map(m => ({ role: m.role, content: m.content })),
      ];
      lines.push(JSON.stringify({ messages: ftMsgs }));
    }

    res.setHeader("Content-Type", "application/jsonl");
    res.setHeader("Content-Disposition", 'attachment; filename="navigator-finetune.jsonl"');
    return res.send(lines.join("\n"));
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /admin/navigator/chats/:id ── conversation detail ── */
router.get("/chats/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "invalid id" });

    const [convRows, msgRows] = await Promise.all([
      db.execute(sql`SELECT * FROM conversations WHERE id = ${id}`),
      db.execute(sql`
        SELECT id, role, content, car_ids, rating, created_at
        FROM messages WHERE conversation_id = ${id} ORDER BY created_at ASC
      `),
    ]);

    const conv = convRows.rows[0];
    if (!conv) return res.status(404).json({ ok: false, error: "not found" });

    return res.json({ ok: true, data: { conversation: conv, messages: msgRows.rows } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── DELETE /admin/navigator/chats/:id ── remove conversation ── */
router.delete("/chats/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "invalid id" });
    await db.execute(sql`DELETE FROM conversations WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /admin/navigator/sync-cars ── trigger car sync ── */
router.post("/sync-cars", async (_req, res) => {
  try {
    const stats = await syncCars();
    return res.json({ ok: true, ...stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /admin/navigator/force-sync ── clear cache + re-sync immediately ── */
router.post("/force-sync", async (_req, res) => {
  try {
    clearNewCarsCache();
    const stats = await syncCars();
    return res.json({ ok: true, stats });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /admin/navigator/sync-status ── last sync info ── */
router.get("/sync-status", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS total,
             MAX(synced_at) AS last_synced
      FROM cars
    `).catch(() => ({ rows: [{ total: 0, last_synced: null }] }));
    const row = (result.rows[0] as any) ?? {};
    return res.json({ ok: true, total: row.total ?? 0, lastSynced: row.last_synced ?? null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
