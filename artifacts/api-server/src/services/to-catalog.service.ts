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
      _cache = data;
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
    _cache = seedData;
    _updatedAt = new Date();
    logger.info({ count: _cache.length }, "to-catalog: seeded into DB from JSON file");
  } catch (err) {
    logger.error({ err }, "to-catalog: initCatalog failed");
    _cache = _cache ?? [];
  }
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
    _cache = data;
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

export async function saveCatalog(data: ToCatalogEntry[]): Promise<void> {
  await db.execute(sql`
    INSERT INTO to_catalog_store (id, data, updated_at)
    VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `);
  _cache = data;
  _updatedAt = new Date();
}
