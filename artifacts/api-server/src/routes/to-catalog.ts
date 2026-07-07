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
    let brand = "";
    let model = "";
    let year: number | undefined;
    let power: number | undefined;
    let engineLabel: string | undefined;

    if (vin) {
      // 1. Try /converting/vin/autoru (returns auto.ru catalog IDs + tech params)
      try {
        const raw = await cmGet("/converting/vin/autoru", { vin }) as Record<string, unknown>;
        brand = String(raw["mark"] ?? raw["mark_id"] ?? raw["markId"] ?? "").trim();
        model = String(raw["model"] ?? raw["model_id"] ?? raw["modelId"] ?? "").trim();
        year = typeof raw["year"] === "number" ? raw["year"] : undefined;
        const tp = (raw["tech_param"] ?? raw["techParam"] ?? raw["tech_params"] ?? {}) as Record<string, unknown>;
        power = typeof tp["power"] === "number" ? tp["power"] : undefined;
        const disp = typeof tp["displacement"] === "number" ? (tp["displacement"] / 1000).toFixed(1) : undefined;
        const et = String(tp["engine_type"] ?? tp["engineType"] ?? "").toLowerCase();
        if (disp) engineLabel = `${disp} ${et.includes("diesel") || et.includes("дизел") ? "Дизель" : "Бензин"}`;
      } catch {
        // fall through to predict endpoint
      }
    }

    // 2. Fallback for VIN not in converting DB, or primary for GRZ:
    //    /predict_by_vin_or_lp — accepts VIN or ГРЗ via carIdentifier,
    //    returns human-readable brand.text/model.text in Russian
    if (!brand || !model) {
      const identifier = vin || grz;
      let predictRaw: Record<string, unknown> | null = null;
      try {
        predictRaw = await cmGet("/predict_by_vin_or_lp", {
          carIdentifier: identifier,
          mileage: "50000",
          regionId: "1",
          sellerType: "private",
        }) as Record<string, unknown>;
      } catch {
        predictRaw = null;
      }

      if (predictRaw) {
        const bObj = predictRaw["brand"] as Record<string, unknown> | undefined;
        const mObj = predictRaw["model"] as Record<string, unknown> | undefined;
        const eObj = predictRaw["engine"] as Record<string, unknown> | undefined;
        brand = String(bObj?.["text"] ?? "").trim();
        model = String(mObj?.["text"] ?? "").trim();
        year = typeof predictRaw["creationYear"] === "number" ? predictRaw["creationYear"] : year;
        power = typeof predictRaw["power"] === "number" ? predictRaw["power"] : power;
        const vol = typeof predictRaw["volume"] === "number" ? predictRaw["volume"].toFixed(1) : undefined;
        const et = String(eObj?.["text"] ?? "").toLowerCase();
        if (vol) engineLabel = `${vol} ${et.includes("дизел") ? "Дизель" : "Бензин"}`;
      }
    }

    if (!brand || !model) {
      const isGrz = !vin && !!grz;
      const msg = isGrz
        ? "Автомобиль по ГРЗ не найден. CM Expert пока не поддерживает поиск по госномеру — попробуйте ввести VIN."
        : "Автомобиль не найден в базе данных. Возможно, это автомобиль китайского рынка или VIN ещё не проиндексирован.";
      logger.warn({ vin, grz }, "to-catalog lookup: brand/model not resolved");
      return res.json({ ok: false, error: msg });
    }

    const { brand: catalogBrand, model: catalogModel } = findCatalogNames(brand, model);
    const modifications = findByVehicle(brand, model, power);

    return res.json({
      ok: true,
      carInfo: { brand, model, year, power, engine: engineLabel },
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
