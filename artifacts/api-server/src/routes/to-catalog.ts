import { Router, type IRouter } from "express";
import { getBrands, getModels, getModifications, getEntries, hasBrand, findByVehicle, findCatalogNames } from "../services/to-catalog.service";
import { cmGet } from "../lib/cm-expert-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/models", (req, res) => {
  const brand = String(req.query.brand ?? "");
  if (!brand) return res.status(400).json({ ok: false, error: "brand is required" });
  const models = getModels(brand);
  return res.json({ ok: true, models });
});

router.get("/modifications", (req, res) => {
  const brand = String(req.query.brand ?? "");
  const model = String(req.query.model ?? "");
  if (!brand || !model) return res.status(400).json({ ok: false, error: "brand and model are required" });
  const modifications = getModifications(brand, model);
  return res.json({ ok: true, modifications });
});

router.get("/entries", (req, res) => {
  const brand = String(req.query.brand ?? "");
  const model = String(req.query.model ?? "");
  const maintenance = String(req.query.maintenance ?? "");
  if (!brand || !model || !maintenance) {
    return res.status(400).json({ ok: false, error: "brand, model and maintenance are required" });
  }
  const entries = getEntries(brand, model, maintenance);
  return res.json({ ok: true, entries });
});

router.get("/brands", (_req, res) => {
  return res.json({ ok: true, brands: getBrands() });
});

router.get("/has-brand", (req, res) => {
  const brand = String(req.query.brand ?? "");
  return res.json({ ok: true, has: hasBrand(brand) });
});

router.get("/lookup", async (req, res) => {
  const vin = String(req.query.vin ?? "").trim().toUpperCase();
  const grz = String(req.query.grz ?? "").trim().toUpperCase();
  if (!vin && !grz) {
    return res.status(400).json({ ok: false, error: "vin или grz обязателен" });
  }
  try {
    let raw: unknown;
    if (vin) {
      raw = await cmGet("/converting/vin/autoru", { vin });
    } else {
      raw = await cmGet("/converting/grz/autoru", { grz });
    }

    const r = raw as Record<string, unknown>;

    const autoruBrand = String(
      r["mark"] ?? r["mark_id"] ?? r["markId"] ?? ""
    ).trim();
    const autoruModel = String(
      r["model"] ?? r["model_id"] ?? r["modelId"] ?? ""
    ).trim();
    const year = typeof r["year"] === "number" ? r["year"] : undefined;

    const tp = (r["tech_param"] ?? r["techParam"] ?? r["tech_params"] ?? {}) as Record<string, unknown>;
    const power = typeof tp["power"] === "number" ? tp["power"] : undefined;
    const displacement = typeof tp["displacement"] === "number"
      ? (tp["displacement"] / 1000).toFixed(1)
      : undefined;
    const engineType = String(tp["engine_type"] ?? tp["engineType"] ?? "").toLowerCase();
    const engineLabel = displacement
      ? `${displacement} ${engineType.includes("diesel") || engineType.includes("дизел") ? "Дизель" : "Бензин"}`
      : undefined;

    if (!autoruBrand || !autoruModel) {
      logger.warn({ raw, vin, grz }, "to-catalog lookup: empty brand/model from CM Expert");
      return res.json({ ok: false, error: "Автомобиль не определён", raw });
    }

    const { brand: catalogBrand, model: catalogModel } = findCatalogNames(autoruBrand, autoruModel);
    const modifications = findByVehicle(autoruBrand, autoruModel, power);

    return res.json({
      ok: true,
      carInfo: { brand: autoruBrand, model: autoruModel, year, power, engine: engineLabel },
      catalogBrand,
      catalogModel,
      modifications,
    });
  } catch (err) {
    logger.error({ err, vin, grz }, "to-catalog lookup error");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
