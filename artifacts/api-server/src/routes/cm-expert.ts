import { Router, type IRouter } from "express";
import { cmGet } from "../lib/cm-expert-client";

const router: IRouter = Router();

async function apiGet(path: string, params?: URLSearchParams) {
  const paramObj = params ? Object.fromEntries(params.entries()) : undefined;
  return cmGet(path, paramObj);
}

/* ── Autocatalog: brands ──────────────────────────── */
router.get("/cm-expert/brands", async (_req, res) => {
  try {
    const data = await apiGet("/autocatalog/brands");
    return res.json({ ok: true, brands: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Autocatalog: models ──────────────────────────── */
router.get("/cm-expert/models", async (req, res) => {
  try {
    const brand = req.query.brand as string;
    if (!brand) {
      return res.status(400).json({ ok: false, error: "brand parameter required" });
    }
    const data = await apiGet("/autocatalog/models", new URLSearchParams({ brand }));
    return res.json({ ok: true, models: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Autocatalog: creation years ────────────────────── */
router.get("/cm-expert/years", async (req, res) => {
  try {
    const brand = req.query.brand as string;
    const model = req.query.model as string;
    if (!brand || !model) {
      return res.status(400).json({ ok: false, error: "brand and model parameters required" });
    }
    const data = await apiGet("/autocatalog/creationYears", new URLSearchParams({ brand, model }));
    return res.json({ ok: true, years: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Appraisal: simple ──────────────────────────── */
router.get("/cm-expert/appraisal", async (req, res) => {
  try {
    const modification = req.query.modification as string;
    const mileage = req.query.mileage as string;
    const regionId = (req.query.regionId as string) || "1";

    if (!modification || !mileage) {
      return res.status(400).json({ ok: false, error: "modification and mileage required" });
    }

    const params = new URLSearchParams({
      modification,
      mileage,
      regionId,
      similarThreshold: "10",
    });

    const data = await apiGet("/appraisal/similar/simple", params);
    return res.json({ ok: true, appraisal: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
