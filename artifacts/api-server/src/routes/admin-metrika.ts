import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { sendMetrikaReport, previewMetrikaReport } from "../services/metrika-report";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAdmin);

/* POST /api/admin/metrika/send-report — отправить отчёт сейчас */
router.post("/send-report", async (_req, res) => {
  try {
    await sendMetrikaReport();
    res.json({ ok: true, message: "Отчёт успешно отправлен на sales@debryansk-auto.ru" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] Manual report send failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* GET /api/admin/metrika/preview — вернуть HTML письма без отправки */
router.get("/preview", async (_req, res) => {
  try {
    const { subject, html } = await previewMetrikaReport();
    res.json({ ok: true, subject, html });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
