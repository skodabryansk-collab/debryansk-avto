import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const BRAND_CANONICAL: Record<string, string> = {
  "CHERY": "Chery",
  "OMODA": "Omoda",
  "JAECOO": "Jaecoo",
  "JETOUR": "Jetour",
  "JELAND": "Jeland",
  "HAVAL": "Haval",
  "EXEED": "Exeed",
  "SOUEAST": "Soueast",
  "TENET": "Tenet",
};

function normalizeBrand(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return BRAND_CANONICAL[upper] ?? raw.trim();
}

const router: IRouter = Router();

const XML_URL =
  "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/used/55c50e2b8b4277d96c5dde95c3c16421.xml";
const AVITO_XML_URL =
  "https://media.cm.expert/stock/export/cmexpert/avito.ru/all/all/3bc95b6dca38f0b5e5e757199fe16420.xml";

export interface CarRecord {
  id: string;
  mark: string;
  model: string;
  modification: string;
  year: number;
  price: number;
  run: number;
  color: string;
  bodyType: string;
  availability: string;
  url: string;
  images: string[];
  ownersNumber: string;
  driveType: string;
  state: string;
  extras: string;
  description: string;
  vin: string;
  complectation: string;
  custom: string;
  doorsCount: number;
  wheel: string;
  armored: string;
  phone: string;
  maxDiscount: number;
  creditDiscount: number;
  tradeinDiscount: number;
  popularity_score: number;
}

let cache: { data: CarRecord[]; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;
let _usedCarsFetchInFlight: Promise<CarRecord[]> | null = null;

interface AvitoMeta { driveType: string; owners: string; }
let avitoCache: { data: Map<string, AvitoMeta>; ts: number } | null = null;

function parseAvitoXml(text: string): Map<string, AvitoMeta> {
  const map = new Map<string, AvitoMeta>();
  const blocks = text.match(/<Ad>[\s\S]*?<\/Ad>/g) ?? [];
  for (const block of blocks) {
    const id = getField(block, "Id");
    if (id) map.set(id, { driveType: getField(block, "DriveType"), owners: getField(block, "Owners") });
  }
  return map;
}

export async function getAvitoMeta(): Promise<Map<string, AvitoMeta>> {
  if (avitoCache && Date.now() - avitoCache.ts < CACHE_TTL) return avitoCache.data;
  try {
    const r = await fetch(AVITO_XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return avitoCache?.data ?? new Map();
    const data = parseAvitoXml(await r.text());
    avitoCache = { data, ts: Date.now() };
    return data;
  } catch {
    return avitoCache?.data ?? new Map();
  }
}

function getField(xml: string, field: string): string {
  const m = xml.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`));
  return m ? m[1].trim() : "";
}

function getImages(xml: string): string[] {
  return [...xml.matchAll(/<image>([^<]+)<\/image>/g)].map((m) => m[1].trim());
}

function parseXml(text: string): CarRecord[] {
  const cars: CarRecord[] = [];
  const blocks = text.match(/<car>[\s\S]*?<\/car>/g) ?? [];
  for (const block of blocks) {
    const action = getField(block, "action");
    if (action !== "show") continue;
    cars.push({
      id: getField(block, "unique_id"),
      mark: normalizeBrand(getField(block, "mark_id")),
      model: getField(block, "folder_id"),
      modification: getField(block, "modification_id"),
      year: parseInt(getField(block, "year")) || 0,
      price: parseInt(getField(block, "price")) || 0,
      run: parseInt(getField(block, "run")) || 0,
      color: getField(block, "color"),
      bodyType: getField(block, "body_type"),
      availability: getField(block, "availability"),
      url: getField(block, "url"),
      images: getImages(block),
      ownersNumber: getField(block, "owners_number"),
      driveType: "",
      state: getField(block, "state"),
      extras: getField(block, "extras"),
      description: getField(block, "description"),
      vin: getField(block, "vin"),
      complectation: getField(block, "complectation_name"),
      custom: getField(block, "custom"),
      doorsCount: parseInt(getField(block, "doors_count")) || 0,
      wheel: getField(block, "wheel"),
      armored: getField(block, "armored"),
      phone: getField(block, "phone"),
      maxDiscount: parseInt(getField(block, "max_discount")) || 0,
      creditDiscount: parseInt(getField(block, "credit_discount")) || 0,
      tradeinDiscount: parseInt(getField(block, "tradein_discount")) || 0,
      popularity_score: 0,
    });
  }
  return cars;
}

export async function getUsedCars(): Promise<CarRecord[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  // Deduplicate concurrent fetches — prevents cache stampede when many Puppeteer
  // instances call /api/cars/used simultaneously after a batch prerender run.
  if (!_usedCarsFetchInFlight) {
    _usedCarsFetchInFlight = (async () => {
      const r = await fetch(XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`XML fetch failed: ${r.status}`);
      const text = await r.text();
      const data = parseXml(text);
      cache = { data, ts: Date.now() };
      return data;
    })().finally(() => { _usedCarsFetchInFlight = null; });
  }
  return _usedCarsFetchInFlight;
}

router.get("/cars/used", async (req, res) => {
  try {
    let data = await getUsedCars();
    const sort = req.query.sort as string | undefined;
    const limit = parseInt(req.query.limit as string) || 0;

    const ids = data.map(c => c.id);
    const rows = ids.length
      ? await db.execute(sql`SELECT external_id, popularity_score, created_at FROM cars WHERE external_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)}) AND type = 'used'`)
      : { rows: [] };
    const metaMap = new Map(
      (rows.rows as { external_id: string; popularity_score: number; created_at: string | null }[]).map(r => [r.external_id, { score: r.popularity_score ?? 0, createdAt: r.created_at }])
    );

    const avitoMap = await getAvitoMeta();

    let enriched = data.map(c => {
      const meta = metaMap.get(c.id) ?? { score: 0, createdAt: null };
      const avito = avitoMap.get(c.id);
      return {
        ...c,
        popularity_score: meta.score,
        created_at: meta.createdAt,
        driveType: avito?.driveType || "",
        ownersNumber: avito?.owners || c.ownersNumber,
      };
    });

    if (sort === "popularity") {
      enriched.sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0));
    } else if (sort === "newest") {
      enriched.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    }

    if (limit > 0) {
      enriched = enriched.slice(0, limit);
    }

    return res.json({ ok: true, data: enriched, total: enriched.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/cars/views/used/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE cars SET popularity_score = COALESCE(popularity_score, 0) + 1
      WHERE external_id = ${id} AND type = 'used'
    `);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Brands catalog from XML feed ──────────────────── */
router.get("/cars/brands", async (_req, res) => {
  try {
    if (!cache || Date.now() - cache.ts >= CACHE_TTL) {
      const r = await fetch(XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`XML fetch failed: ${r.status}`);
      const text = await r.text();
      const data = parseXml(text);
      cache = { data, ts: Date.now() };
    }
    const brands = [...new Set(cache!.data.map(c => c.mark))].filter(Boolean).sort();
    return res.json({ ok: true, brands });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Models for a brand ────────────────────────── */
router.get("/cars/models", async (req, res) => {
  try {
    const brand = req.query.brand as string;
    if (!brand) {
      return res.status(400).json({ ok: false, error: "brand parameter required" });
    }
    if (!cache || Date.now() - cache.ts >= CACHE_TTL) {
      const r = await fetch(XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`XML fetch failed: ${r.status}`);
      const text = await r.text();
      const data = parseXml(text);
      cache = { data, ts: Date.now() };
    }
    const models = [...new Set(
      cache!.data.filter(c => c.mark.toLowerCase() === brand.toLowerCase()).map(c => c.model)
    )].filter(Boolean).sort();
    return res.json({ ok: true, models });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Trade-in estimate based on XML feed ────────── */
router.get("/cars/estimate", async (req, res) => {
  try {
    const brand = req.query.brand as string;
    const model = req.query.model as string;
    const year = parseInt(req.query.year as string);
    const mileage = parseInt(req.query.mileage as string);
    const condition = req.query.condition as string;

    if (!brand || !model || !year || !mileage) {
      return res.status(400).json({ ok: false, error: "brand, model, year, mileage required" });
    }

    if (!cache || Date.now() - cache.ts >= CACHE_TTL) {
      const r = await fetch(XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`XML fetch failed: ${r.status}`);
      const text = await r.text();
      const data = parseXml(text);
      cache = { data, ts: Date.now() };
    }

    // Find similar cars (same brand and model)
    const similar = cache!.data.filter(c =>
      c.mark.toLowerCase() === brand.toLowerCase() &&
      c.model.toLowerCase() === model.toLowerCase()
    );

    if (similar.length === 0) {
      return res.json({ ok: true, estimate: null, message: "No similar cars found in catalog" });
    }

    // Calculate market average price
    const avgPrice = similar.reduce((sum, c) => sum + c.price, 0) / similar.length;

    // Apply depreciation
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    const ageDepreciation = Math.min(age * 0.07, 0.5); // 7% per year, max 50%
    const mileageDepreciation = Math.min((mileage / 100000) * 0.12, 0.3); // 12% per 100k km, max 30%

    // Condition multiplier
    const conditionMultipliers: Record<string, number> = {
      excellent: 1.0,
      good: 0.92,
      average: 0.82,
      "needs-repair": 0.65,
    };
    const conditionMultiplier = conditionMultipliers[condition || "good"] ?? 0.92;

    const estimate = Math.round(avgPrice * (1 - ageDepreciation - mileageDepreciation) * conditionMultiplier);
    const minPrice = Math.round(estimate * 0.85);
    const maxPrice = Math.round(estimate * 1.15);

    return res.json({
      ok: true,
      estimate,
      range: { min: minPrice, max: maxPrice },
      similarCount: similar.length,
      marketAverage: Math.round(avgPrice),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
