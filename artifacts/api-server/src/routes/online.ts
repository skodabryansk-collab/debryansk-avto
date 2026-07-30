import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

// sessionId → lastSeen timestamp (ms)
const sessions = new Map<string, number>();

// Clean up stale sessions every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - 90_000;
  for (const [id, ts] of sessions) {
    if (ts < cutoff) sessions.delete(id);
  }
}, 60_000).unref();

// Public — frontend pings every 30s
router.post("/online/ping", (req, res) => {
  const sessionId = req.body?.sessionId as string | undefined;
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
    return res.status(400).json({ ok: false, error: "Invalid sessionId" });
  }
  sessions.set(sessionId, Date.now());
  return res.json({ ok: true });
});

// Admin — count sessions seen in last 60 seconds
router.get("/admin/online/live", requireAdmin, (_req, res) => {
  const cutoff = Date.now() - 60_000;
  let count = 0;
  for (const ts of sessions.values()) {
    if (ts >= cutoff) count++;
  }
  return res.json({ ok: true, online: count });
});

export default router;
