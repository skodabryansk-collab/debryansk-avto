import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

export interface ToCatalogEntry {
  Brand: string;
  Model: string;
  Maintenance: string;
  Engine: string;
  WheelFormula: string;
  Power: number;
  Generation: string;
  TO: string;
  Mileage: number;
  _Month: number;
  SumServices: number;
  SumSpareParts: number;
  TotalSum: number;
}

const SEED_PATH = path.join(process.cwd(), "artifacts/api-server/src/data/to-catalog.json");

let _cache: ToCatalogEntry[] | null = null;
let _updatedAt: Date | null = null;

async function loadFromDb(): Promise<{ data: ToCatalogEntry[]; updatedAt: Date | null }> {
  const result = await db.execute(sql`SELECT data, updated_at FROM to_catalog_store WHERE id = 1 LIMIT 1`);
  const row = result.rows[0] as { data?: ToCatalogEntry[]; updated_at?: string } | undefined;
  if (!row) return { data: [], updatedAt: null };
  return {
    data: Array.isArray(row.data) ? row.data : [],
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function initCatalog(): Promise<void> {
  try {
    const { data, updatedAt } = await loadFromDb();
    if (data.length > 0) {
      _cache = normalize(data);
      _updatedAt = updatedAt;
      logger.info({ count: _cache.length }, "to-catalog: loaded from DB");
      return;
    }

    // DB is empty — seed from bundled JSON file
    logger.info("to-catalog: DB empty, seeding from JSON file");
    let seedData: ToCatalogEntry[] = [];
    try {
      const raw = readFileSync(SEED_PATH, "utf-8");
      seedData = JSON.parse(raw) as ToCatalogEntry[];
    } catch (err) {
      logger.warn({ err }, "to-catalog: could not read seed file");
      _cache = [];
      _updatedAt = null;
      return;
    }

    await db.execute(sql`
      INSERT INTO to_catalog_store (id, data, updated_at)
      VALUES (1, ${JSON.stringify(seedData)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `);
    _cache = normalize(seedData);
    _updatedAt = new Date();
    logger.info({ count: _cache.length }, "to-catalog: seeded into DB from JSON file");
  } catch (err) {
    logger.error({ err }, "to-catalog: initCatalog failed");
    _cache = _cache ?? [];
  }
}

/** Normalize entries so Maintenance is always non-empty.
 *  Some feeds (e.g. Haval City) leave Maintenance="" and put the
 *  service type in the TO field ("ТО-1", "ТО-2", …). */
function entryKey(e: ToCatalogEntry): string {
  return [
    e.Brand, e.Model, e.Maintenance, e.Engine, e.WheelFormula,
    e.Power, e.Generation, e.TO, e.Mileage, e._Month,
    e.SumServices, e.SumSpareParts, e.TotalSum,
  ].map(value => String(value ?? "").trim().toLowerCase()).join("\u001f");
}

function normalize(entries: ToCatalogEntry[]): ToCatalogEntry[] {
  const seen = new Set<string>();
  return entries
    .map(e => e.Maintenance ? e : { ...e, Maintenance: e.TO || "" })
    .filter(e => {
      const key = entryKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function load(): ToCatalogEntry[] {
  return _cache ?? [];
}

export function invalidateCache(): void {
  _cache = null;
  _updatedAt = null;
}

export async function reloadFromDb(): Promise<void> {
  try {
    const { data, updatedAt } = await loadFromDb();
    _cache = normalize(data);
    _updatedAt = updatedAt;
  } catch (err) {
    logger.warn({ err }, "to-catalog: reloadFromDb failed");
  }
}

export function getCatalogMeta() {
  const entries = load();
  const brands = [...new Set(entries.map(e => e.Brand))].sort();
  return {
    count: entries.length,
    brands,
    updatedAt: _updatedAt ? _updatedAt.toISOString() : null,
  };
}

export function getBrands(): string[] {
  return [...new Set(load().map(e => e.Brand))].sort();
}

export function getModels(brand: string): string[] {
  const entries = load().filter(e => e.Brand.toLowerCase() === brand.toLowerCase());
  return [...new Set(entries.map(e => e.Model))].sort();
}

export function getModifications(brand: string, model: string): string[] {
  const entries = load().filter(
    e => e.Brand.toLowerCase() === brand.toLowerCase() &&
         e.Model.toLowerCase() === model.toLowerCase()
  );
  return [...new Set(entries.map(e => e.Maintenance))].sort();
}

export function getEntries(brand: string, model: string, maintenance: string): ToCatalogEntry[] {
  return load()
    .filter(
      e =>
        e.Brand.toLowerCase() === brand.toLowerCase() &&
        e.Model.toLowerCase() === model.toLowerCase() &&
        e.Maintenance.toLowerCase() === maintenance.toLowerCase()
    )
    .sort((a, b) => a.Mileage - b.Mileage);
}

export function hasBrand(brand: string): boolean {
  return load().some(e => e.Brand.toLowerCase() === brand.toLowerCase());
}

export interface VinLookupResult {
  carInfo: {
    brand: string;
    model: string;
    year?: number;
    power?: number;
    engine?: string;
    raw: unknown;
  };
  catalogBrand: string | null;
  catalogModel: string | null;
  modifications: Array<{
    name: string;
    engine: string;
    power: number;
    entries: ToCatalogEntry[];
  }>;
}

function normStr(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
}

function brandMatch(autoruBrand: string, catalogBrand: string): boolean {
  const a = normStr(autoruBrand);
  const c = normStr(catalogBrand);
  const cBase = c.replace(/pro|plus|\+/gi, "");
  return c.includes(a) || a.includes(cBase) || cBase.includes(a);
}

function modelMatch(autoruModel: string, catalogModel: string, catalogBrand: string): boolean {
  const brandWords = catalogBrand.toLowerCase().split(/\s+/);
  let stripped = catalogModel;
  for (const w of brandWords) {
    const re = new RegExp("^" + w + "\\s*", "i");
    stripped = stripped.replace(re, "").trim();
  }
  const a = normStr(autoruModel);
  const m = normStr(stripped);
  if (a === m) return true;
  if (a.length > 1 && m.includes(a)) return true;
  if (m.length > 1 && a.includes(m)) return true;
  const aN = a.replace(/х/gi, "x").replace(/ё/gi, "e");
  const mN = m.replace(/х/gi, "x").replace(/ё/gi, "e");
  return aN === mN || mN.includes(aN) || aN.includes(mN);
}

export function findByVehicle(
  autoruBrand: string,
  autoruModel: string,
  power?: number,
): VinLookupResult["modifications"] {
  const brand = getBrands().find(b => brandMatch(autoruBrand, b)) ?? null;
  if (!brand) return [];
  const models = getModels(brand);
  const catalogModel = models.find(m => modelMatch(autoruModel, m, brand)) ?? null;
  if (!catalogModel) return [];
  const mods = getModifications(brand, catalogModel);
  return mods.map(mod => {
    const modEntries = getEntries(brand, catalogModel, mod);
    const sample = modEntries[0];
    return { name: mod, engine: sample?.Engine ?? "", power: sample?.Power ?? 0, entries: modEntries };
  }).filter(m => {
    if (!power || power <= 0) return true;
    return m.power === 0 || Math.abs(m.power - power) <= 15;
  });
}

/** Return all TO entries for a brand+model matching a given CM Expert modification.
 *  Filters by power ±5 hp and drive direction when the catalog has that data;
 *  falls back to all entries for that model when none can be matched (e.g. Power=0). */
export function getEntriesForMod(
  brand: string,
  model: string,
  power: number,
  drive: string,
): ToCatalogEntry[] {
  const allMods = getModifications(brand, model);
  if (!allMods.length) return [];

  const allEntries = allMods.flatMap(mod => getEntries(brand, model, mod));

  const driveNorm = drive.toLowerCase();
  const isFullReq  = driveNorm.includes("полн") || driveNorm.includes("4wd") || driveNorm.includes("awd");
  const isFrontReq = driveNorm.includes("передн") || driveNorm.includes("2wd") || driveNorm.includes("fwd");

  const filtered = power > 0
    ? allEntries.filter(e => {
        const ep = Number(e.Power ?? 0);
        if (ep === 0) return false; // no power data in catalog — cannot match
        if (Math.abs(ep - power) > 5) return false;
        if (driveNorm) {
          const ed = String(e.WheelFormula ?? "").toLowerCase();
          if (ed) {
            const isFullEntry  = ed.includes("полн") || ed.includes("4wd");
            const isFrontEntry = ed.includes("передн") || ed.includes("2wd") || ed.includes("fwd");
            if (isFullReq  && !isFullEntry)  return false;
            if (isFrontReq && !isFrontEntry) return false;
          }
        }
        return true;
      })
    : [];

  // Fallback: if nothing matched by power/drive, return everything for this model
  const result = filtered.length > 0 ? filtered : allEntries;

  // Deduplicate by TO field, sort by numeric TO number (ТО-1, ТО-2 … ТО-12)
  const toNum = (to: string) => Number(to.replace(/[^\d]/g, "") || "0");
  const seen = new Set<string>();
  return result
    .filter(e => { if (seen.has(e.TO)) return false; seen.add(e.TO); return true; })
    .sort((a, b) => toNum(a.TO) - toNum(b.TO));
}

export function findCatalogNames(autoruBrand: string, autoruModel: string): { brand: string | null; model: string | null } {
  const brands = getBrands();
  const brand = brands.find(b => brandMatch(autoruBrand, b)) ?? null;
  if (!brand) return { brand: null, model: null };
  const models = getModels(brand);
  const model = models.find(m => modelMatch(autoruModel, m, brand)) ?? null;
  return { brand, model };
}

export async function saveCatalog(data: ToCatalogEntry[]): Promise<void> {
  const normalized = normalize(data);
  await db.execute(sql`
    INSERT INTO to_catalog_store (id, data, updated_at)
    VALUES (1, ${JSON.stringify(normalized)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `);
  _cache = normalized;
  _updatedAt = new Date();
}
