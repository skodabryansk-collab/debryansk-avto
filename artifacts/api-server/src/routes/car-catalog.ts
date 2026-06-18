import { Router } from "express";

const router = Router();

/* ── Auto.ru catalog (brands / models) ─────────────────────────── */

const AUTORU_BASE = "https://apiauto.ru/1.0";
const getAutoruKey = () => process.env.AUTORU_API_KEY ?? "";

interface CacheEntry { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>();

async function fetchAutoru(path: string, ttlMs: number): Promise<unknown> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(`${AUTORU_BASE}${path}`, {
    headers: {
      "x-authorization": getAutoruKey(),
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Auto.ru API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  cache.set(path, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

router.get("/brands", async (_req, res) => {
  try {
    const data = await fetchAutoru("/search/cars/breadcrumbs", 24 * 60 * 60 * 1000) as any;
    const entities: any[] = data.breadcrumbs?.[0]?.entities ?? [];
    const brands = entities.map(e => ({
      id: e.id as string,
      name: e.name as string,
      cyrillicName: (e.mark?.cyrillic_name as string | undefined) ?? (e.name as string),
      isPopular: (e.is_popular as boolean | undefined) ?? false,
    }));
    res.json({ ok: true, data: brands });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/models", async (req, res) => {
  const brandId = (req.query.brandId as string | undefined) ?? "";
  if (!brandId) {
    res.status(400).json({ ok: false, error: "brandId required" });
    return;
  }
  try {
    const data = await fetchAutoru(
      `/search/cars/breadcrumbs?bc_lookup=${encodeURIComponent(brandId)}`,
      60 * 60 * 1000,
    ) as any;
    const entities: any[] = data.breadcrumbs?.[0]?.entities ?? [];
    const models = entities.map(e => ({
      id: e.id as string,
      name: e.name as string,
    }));
    res.json({ ok: true, data: models });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── CM Expert OAuth2 token management ──────────────────────────── */

const CM_TOKEN_URL  = () => process.env.CM_EXPERT_TOKEN_URL  ?? "https://lk.cm.expert/oauth/token";
const CM_API_BASE   = () => process.env.CM_EXPERT_API_URL    ?? "https://appraisal.api.cm.expert/v1";
const CM_CLIENT_ID  = () => process.env.CM_EXPERT_CLIENT_ID  ?? "";
const CM_CLIENT_SEC = () => process.env.CM_EXPERT_CLIENT_SECRET ?? "";

let cmToken: string | null = null;
let cmTokenExpiresAt = 0;

async function getCmToken(): Promise<string> {
  if (cmToken && cmTokenExpiresAt > Date.now()) return cmToken;

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     CM_CLIENT_ID(),
    client_secret: CM_CLIENT_SEC(),
  });

  const res = await fetch(CM_TOKEN_URL(), {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CM Expert token error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json: any = await res.json();
  cmToken = json.access_token as string;
  const expiresIn = (json.expires_in as number) ?? 3600;
  cmTokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
  return cmToken;
}

async function fetchCm(path: string, ttlMs: number): Promise<unknown> {
  const cacheKey = `cm:${path}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const token = await getCmToken();
  const res = await fetch(`${CM_API_BASE()}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CM Expert API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

const CM_CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 hours

/* ── CM Expert catalog endpoints ────────────────────────────────── */

function normalizeCmItems(data: any, key: string): Array<{ id: string; name: string }> {
  const raw: any[] = Array.isArray(data)
    ? data
    : (Array.isArray(data?.[key]) ? data[key] : (data?.data ?? []));
  return raw.map(item => ({
    id:   String(item.id   ?? item.code  ?? item.value ?? ""),
    name: String(item.text ?? item.name  ?? item.label ?? item.id ?? ""),
  }));
}

router.get("/cm-brands", async (_req, res) => {
  try {
    const data = await fetchCm("/autocatalog/brands", CM_CATALOG_TTL);
    res.json({ ok: true, data: normalizeCmItems(data, "brands") });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/cm-models", async (req, res) => {
  const brand = (req.query.brand as string | undefined) ?? "";
  if (!brand) { res.status(400).json({ ok: false, error: "brand required" }); return; }
  try {
    const data = await fetchCm(
      `/autocatalog/models?brand=${encodeURIComponent(brand)}`,
      CM_CATALOG_TTL,
    );
    res.json({ ok: true, data: normalizeCmItems(data, "models") });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/cm-generations", async (req, res) => {
  const { brand, model, creationYear } = req.query as Record<string, string | undefined>;
  if (!brand || !model) {
    res.status(400).json({ ok: false, error: "brand and model required" });
    return;
  }
  try {
    const qs = new URLSearchParams({ brand, model });
    if (creationYear) qs.append("creationYear", creationYear);
    const data = await fetchCm(`/autocatalog/generations?${qs}`, CM_CATALOG_TTL);
    res.json({ ok: true, data: normalizeCmItems(data, "generations") });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/cm-bodies", async (req, res) => {
  const { brand, model } = req.query as Record<string, string | undefined>;
  if (!brand || !model) {
    res.status(400).json({ ok: false, error: "brand and model required" });
    return;
  }
  try {
    const qs = new URLSearchParams({ brand, model });
    const data = await fetchCm(`/autocatalog/bodies?${qs}`, CM_CATALOG_TTL);
    res.json({ ok: true, data: normalizeCmItems(data, "bodies") });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/cm-years", async (req, res) => {
  const { brand, model } = req.query as Record<string, string | undefined>;
  if (!brand || !model) {
    res.status(400).json({ ok: false, error: "brand and model required" });
    return;
  }
  try {
    const qs = new URLSearchParams({ brand, model });
    const data = await fetchCm(`/autocatalog/generations?${qs}`, CM_CATALOG_TTL) as any;
    const gens: any[] = Array.isArray(data)
      ? data
      : (data?.generations ?? data?.data ?? []);

    const currentYear = new Date().getFullYear();
    const yearSet = new Set<number>();

    for (const g of gens) {
      const from = Number(g.yearFrom ?? g.year_from ?? g.creationYear ?? 0);
      const rawTo = g.yearTo ?? g.year_to ?? null;
      const to = rawTo ? Math.min(Number(rawTo), currentYear) : currentYear;
      if (from >= 1990 && from <= currentYear) {
        for (let y = from; y <= to; y++) yearSet.add(y);
      }
    }

    const years: number[] = yearSet.size > 0
      ? Array.from(yearSet).sort((a, b) => b - a)
      : Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i);

    res.json({ ok: true, data: years });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── CM Expert modifications options (drive / volume / complectation) ── */

router.get("/cm-modifications-options", async (req, res) => {
  const { brand, model, year } = req.query as Record<string, string | undefined>;
  if (!brand || !model || !year) {
    res.status(400).json({ ok: false, error: "brand, model, year required" });
    return;
  }
  try {
    const qs = new URLSearchParams({ brand, model, creationYear: year });
    const cacheKey = `cm:/autocatalog/modifications?${qs}`;

    let data: any;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      data = cached.data;
    } else {
      const token = await getCmToken();
      const r = await fetch(`${CM_API_BASE()}/autocatalog/modifications?${qs}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!r.ok) {
        res.json({ ok: true, driveTypes: [], engineVolumes: [], complectations: [] });
        return;
      }
      data = await r.json();
      cache.set(cacheKey, { data, expiresAt: Date.now() + CM_CATALOG_TTL });
    }

    const mods: any[] = Array.isArray(data) ? data : (data?.modifications ?? data?.data ?? []);

    const driveMap   = new Map<string, string>();
    const volumeMap  = new Map<string, string>();
    const complMap   = new Map<string, string>();

    for (const m of mods) {
      if (m.drive?.id) {
        driveMap.set(String(m.drive.id), String(m.drive.text ?? m.drive.name ?? m.drive.id));
      }
      if (m.volume != null && m.volume !== "") {
        const v = parseFloat(m.volume);
        if (!isNaN(v) && v > 0) {
          const key = String(v);
          volumeMap.set(key, `${v.toFixed(1)} л`);
        }
      }
      const cmpl = m.complectation ?? m.complectationName ?? m.complectation_name;
      if (cmpl) {
        const name = typeof cmpl === "object" ? (cmpl.text ?? cmpl.name ?? String(cmpl.id ?? "")) : String(cmpl);
        const id   = typeof cmpl === "object" ? String(cmpl.id ?? name) : name;
        if (id && name) complMap.set(id, name);
      }
    }

    res.json({
      ok: true,
      driveTypes:    [...driveMap.entries()].map(([id, name]) => ({ id, name })),
      engineVolumes: [...volumeMap.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([id, name]) => ({ id, name })),
      complectations: [...complMap.entries()].map(([id, name]) => ({ id, name })),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── CM Expert predict endpoint ─────────────────────────────────── */

const BRYANSK_REGION_ID = "1751832";

/**
 * Fetches the first available modification for the given brand/model/generation/body
 * to supply the required technical params (doors, engine, volume, power, gear, drive, wheel)
 * that CM Expert /predict requires but the user doesn't choose manually.
 */
async function getModificationParams(
  token: string,
  brand: string, model: string, year: string, generationId?: string, bodyId?: string,
): Promise<Record<string, string> | null> {
  const qs = new URLSearchParams({ brand, model, creationYear: year });
  if (generationId) qs.append("generation", generationId);
  if (bodyId)       qs.append("body", bodyId);

  const res = await fetch(`${CM_API_BASE()}/autocatalog/modifications?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) return null;

  const json: any = await res.json();
  const mods: any[] = Array.isArray(json) ? json : (json.modifications ?? []);
  if (!mods.length) return null;

  // Prefer modification matching chosen body, then just pick first
  const mod = bodyId
    ? (mods.find((m: any) => String(m.body?.id) === bodyId) ?? mods[0])
    : mods[0];

  return {
    generation: String(mod.generation?.id ?? ""),
    body:       String(mod.body?.id       ?? ""),
    doors:      String(mod.doors          ?? ""),
    engine:     String(mod.engine?.id     ?? ""),
    volume:     String(mod.volume         ?? ""),
    power:      String(mod.power          ?? ""),
    gear:       String(mod.gear?.id       ?? ""),
    drive:      String(mod.drive?.id      ?? ""),
    wheel:      String(mod.wheel?.id      ?? ""),
  };
}

router.get("/cm-expert-predict", async (req, res) => {
  const { brandId, modelId, year, mileage, bodyId, generationId } =
    req.query as Record<string, string | undefined>;

  if (!brandId || !modelId || !year || !mileage) {
    res.status(400).json({ ok: false, error: "brandId, modelId, year, mileage required" });
    return;
  }

  try {
    const token = await getCmToken();

    // Fetch modification to get required technical params
    const modParams = await getModificationParams(token, brandId, modelId, year, generationId, bodyId);
    if (!modParams) {
      res.json({ ok: false });
      return;
    }

    // modParams contains generation, body, doors, engine, volume, power, gear, drive, wheel
    // from the closest matching modification. User-provided ids override mod defaults.
    const qs = new URLSearchParams({
      regionId:     BRYANSK_REGION_ID,
      brand:        brandId,
      model:        modelId,
      creationYear: year,
      mileage:      mileage,
      ...modParams,
      ...(generationId ? { generation: generationId } : {}),
      ...(bodyId       ? { body:       bodyId       } : {}),
    });

    const res2 = await fetch(`${CM_API_BASE()}/predict?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (!res2.ok) {
      res.json({ ok: false });
      return;
    }

    const json: any = await res2.json();

    const minSellingPrice      = json.minSellingPrice      ?? json.min_selling_price;
    const expectedSellingPrice = json.expectedSellingPrice ?? json.expected_selling_price;

    if (!minSellingPrice || !expectedSellingPrice) {
      res.json({ ok: false });
      return;
    }

    res.json({
      ok: true,
      buyoutMin: Math.round(minSellingPrice      * 0.90),
      buyoutMax: Math.round(expectedSellingPrice * 0.90),
    });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

export default router;
