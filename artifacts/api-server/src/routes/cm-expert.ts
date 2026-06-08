import { Router, type IRouter } from "express";

const router: IRouter = Router();

const TOKEN_URL = "https://lk.cm.expert/oauth/token";
const API_BASE = "https://appraisal.api.cm.expert/v1";

const CLIENT_ID = process.env["CM_EXPERT_CLIENT_ID"];
const CLIENT_SECRET = process.env["CM_EXPERT_CLIENT_SECRET"];

let tokenCache: {
  access_token: string;
  expires_at: number;
  scope: string;
} | null = null;

async function getToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("CM Expert credentials not configured");
    return null;
  }
  if (tokenCache && Date.now() < tokenCache.expires_at - 60000) {
    return tokenCache.access_token;
  }
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error("CM Expert token error:", text);
      return tokenCache?.access_token ?? null;
    }
    const data = await r.json() as { access_token: string; expires_in: number; scope: string };
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };
    return data.access_token;
  } catch (err) {
    console.error("CM Expert token fetch error:", err);
    return tokenCache?.access_token ?? null;
  }
}

async function apiGet(path: string, params?: URLSearchParams) {
  const token = await getToken();
  if (!token) throw new Error("Failed to get CM Expert token");
  const url = `${API_BASE}${path}${params ? "?" + params.toString() : ""}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`CM Expert API ${path}: ${r.status} ${text}`);
  }
  return r.json();
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
