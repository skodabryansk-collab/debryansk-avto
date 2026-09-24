import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  getCmStockAdminState,
  getCmStockIntegrations,
  saveCmStockIntervalMinutes,
  startCmStockIntegrationSync,
} from "../services/cm-stock-integrations";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    return res.json({ ok: true, data: await getCmStockAdminState() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Не удалось загрузить статус склада CM" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const intervalMinutes = Number(req.body?.intervalMinutes);
    const saved = await saveCmStockIntervalMinutes(intervalMinutes);
    return res.json({ ok: true, intervalMinutes: saved });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Не удалось сохранить настройки" });
  }
});

router.post("/integrations", async (req, res) => {
  const dealerId = String(req.body?.dealerId ?? "").trim();
  const dealerName = String(req.body?.dealerName ?? "").trim();
  const mode = req.body?.mode === "options_only" ? "options_only" : req.body?.mode === "catalog" ? "catalog" : null;
  if (!/^\d{3,16}$/.test(dealerId)) {
    return res.status(400).json({ ok: false, error: "ID салона CM должен содержать от 3 до 16 цифр" });
  }
  if (dealerName.length < 2 || dealerName.length > 80) {
    return res.status(400).json({ ok: false, error: "Укажите название салона длиной от 2 до 80 символов" });
  }
  if (!mode) return res.status(400).json({ ok: false, error: "Выберите режим каталога" });
  try {
    const result = await db.execute(sql`
      INSERT INTO cm_stock_integrations (dealer_id, dealer_name, mode, enabled)
      VALUES (${dealerId}, ${dealerName}, ${mode}, TRUE)
      ON CONFLICT DO NOTHING
      RETURNING dealer_id
    `);
    if (!result.rows.length) {
      return res.status(409).json({ ok: false, error: "Такой ID или салон уже добавлен" });
    }
    await getCmStockIntegrations();
    return res.status(201).json({ ok: true, dealerId, dealerName, mode, enabled: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Не удалось добавить салон" });
  }
});

router.patch("/integrations/:dealerId", async (req, res) => {
  const dealerId = String(req.params.dealerId ?? "").trim();
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(400).json({ ok: false, error: "Передайте enabled: true или false" });
  }
  try {
    const result = await db.execute(sql`
      UPDATE cm_stock_integrations
      SET enabled = ${req.body.enabled}, updated_at = NOW()
      WHERE dealer_id = ${dealerId}
      RETURNING dealer_name, mode, enabled
    `);
    const row = result.rows[0] as { dealer_name: string; mode: string; enabled: boolean } | undefined;
    if (!row) return res.status(404).json({ ok: false, error: "Интеграция не найдена" });
    if (!row.enabled && row.mode === "options_only") {
      await db.execute(sql`
        UPDATE cars
        SET cm_verified_extras = NULL, cm_dms_car_id = NULL, cm_stock_id = NULL
        WHERE type = 'new' AND LOWER(BTRIM(dealer)) = ${row.dealer_name.trim().toLowerCase()}
      `);
    }
    return res.json({ ok: true, dealerId, ...row });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Не удалось изменить интеграцию" });
  }
});

router.post("/sync", async (_req, res) => {
  try {
    const result = await startCmStockIntegrationSync("manual", true);
    return res.status(result.started ? 202 : 409).json({
      ok: result.started,
      ...result,
      message: result.started ? "Сканирование CM Expert запущено" : "Синхронизация уже выполняется или нет активных салонов",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Не удалось запустить синхронизацию" });
  }
});

export default router;