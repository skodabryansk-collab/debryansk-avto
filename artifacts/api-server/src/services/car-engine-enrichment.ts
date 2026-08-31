import { cmGet } from "../lib/cm-expert-client";

export type EngineSource = "cm_vin" | "xml_fallback";

export interface EngineEnrichment {
  fuelType: string | null;
  engineVolume: number | null;
  enginePower: number | null;
  source: EngineSource;
}

export interface FeedCarForEnrichment {
  id: string;
  vin: string;
  modification: string;
}

export interface ExistingEngineData {
  vin: string | null;
  modification: string | null;
  fuelType: string | null;
  engineVolume: number | null;
  enginePower: number | null;
  engineSource: string | null;
  engineEnrichedAt: Date | string | null;
}

interface VinLookup {
  markId: string;
  modelId: string;
  techParamId: number;
  creationYear: number;
}

interface CatalogItem {
  id: number;
  name: string;
}

const ENRICHMENT_RETRY_MS = 24 * 60 * 60 * 1000;
const VALID_FUEL_TYPES = new Set(["Бензин", "Дизель", "Гибрид", "Электро"]);

let brandsCache: { items: CatalogItem[]; expiresAt: number } | null = null;
const modelsCache = new Map<number, { items: CatalogItem[]; expiresAt: number }>();
const modificationsCache = new Map<string, { items: any[]; expiresAt: number }>();
const vinCache = new Map<string, { result: EngineEnrichment | null; expiresAt: number }>();
const CATALOG_CACHE_MS = 24 * 60 * 60 * 1000;
const VIN_CACHE_MS = 24 * 60 * 60 * 1000;

function asList(raw: any, key: string): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.[key])) return raw[key];
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function itemId(item: any): number | null {
  const id = Number(item?.id ?? item?.code ?? item?.value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function itemName(item: any): string {
  return String(item?.text ?? item?.name ?? item?.label ?? "").trim();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[-_\s]+/g, " ");
}

function parseFuelType(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("электр") || /\bev\b|\bbev\b|\bev\b/.test(normalized)) return "Электро";
  if (normalized.includes("гибрид") || normalized.includes("hybrid") || /\bhev\b|\bphev\b/.test(normalized) || normalized.includes("hyb")) return "Гибрид";
  if (normalized.includes("дизел") || normalized.includes("diesel")) return "Дизель";
  if (normalized.includes("бенз") || normalized.includes("petrol") || normalized.includes("gasoline")) return "Бензин";
  return VALID_FUEL_TYPES.has(String(value).trim()) ? String(value).trim() : null;
}

export function parseXmlEngineData(modification: string): EngineEnrichment | null {
  const raw = modification.trim();
  if (!raw) return null;
  const fuelType = parseFuelType(raw) ??
    (/\d+(?:[.,]\d+)?\s*d\b/i.test(raw) ? "Дизель" : null);
  const volumeMatch = raw.match(/(\d+[.,]\d+)/);
  const powerMatch = raw.match(/(\d{2,4})\s*л\.?\s*с/i);
  const engineVolume = volumeMatch ? Number(volumeMatch[1].replace(",", ".")) : null;
  const enginePower = powerMatch ? Number(powerMatch[1]) : null;
  if (!fuelType && engineVolume == null && enginePower == null) return null;
  return { fuelType, engineVolume, enginePower, source: "xml_fallback" };
}

async function getBrands(): Promise<CatalogItem[]> {
  if (brandsCache && brandsCache.expiresAt > Date.now()) return brandsCache.items;
  const raw = await cmGet("/autocatalog/brands");
  const items = asList(raw, "brands").flatMap(item => {
    const id = itemId(item);
    return id == null ? [] : [{ id, name: itemName(item) }];
  });
  brandsCache = { items, expiresAt: Date.now() + CATALOG_CACHE_MS };
  return items;
}

async function resolveBrandId(markId: string): Promise<number | null> {
  const numeric = Number(markId);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  const normalized = normalizeName(markId);
  const brand = (await getBrands()).find(item =>
    normalizeName(item.name) === normalized || normalizeName(item.name).replace(/\s+/g, "") === normalized.replace(/\s+/g, ""),
  );
  return brand?.id ?? null;
}

async function getModels(brandId: number): Promise<CatalogItem[]> {
  const cached = modelsCache.get(brandId);
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  const raw = await cmGet("/autocatalog/models", { brand: String(brandId) });
  const items = asList(raw, "models").flatMap(item => {
    const id = itemId(item);
    return id == null ? [] : [{ id, name: itemName(item) }];
  });
  modelsCache.set(brandId, { items, expiresAt: Date.now() + CATALOG_CACHE_MS });
  return items;
}

async function resolveModelId(brandId: number, modelId: string): Promise<number | null> {
  const numeric = Number(modelId);
  const models = await getModels(brandId);
  if (Number.isInteger(numeric) && numeric > 0 && models.some(item => item.id === numeric)) return numeric;
  const normalized = normalizeName(modelId);
  return models.find(item => normalizeName(item.name) === normalized)?.id ?? null;
}

async function getModifications(brandId: number, modelId: number, year: number): Promise<any[]> {
  const key = `${brandId}:${modelId}:${year}`;
  const cached = modificationsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  const raw = await cmGet("/autocatalog/modifications", {
    brand: String(brandId),
    model: String(modelId),
    creationYear: String(year),
  });
  const items = asList(raw, "modifications");
  modificationsCache.set(key, { items, expiresAt: Date.now() + CATALOG_CACHE_MS });
  return items;
}

async function resolveFromVin(vin: string): Promise<EngineEnrichment | null> {
  const cached = vinCache.get(vin);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const raw = await cmGet("/converting/vin/autoru", { vin }) as Record<string, unknown>;
    const lookup: VinLookup = {
      markId: String(raw.markId ?? raw.mark ?? "").trim(),
      modelId: String(raw.modelId ?? raw.model ?? "").trim(),
      techParamId: Number(raw.techParamId ?? raw.tech_param_id ?? 0),
      creationYear: Number(raw.creationYear ?? raw.year ?? 0),
    };
    if (!lookup.markId || !lookup.modelId || !Number.isInteger(lookup.techParamId) || lookup.techParamId <= 0 || !lookup.creationYear) {
      vinCache.set(vin, { result: null, expiresAt: Date.now() + VIN_CACHE_MS });
      return null;
    }

    const brandId = await resolveBrandId(lookup.markId);
    if (brandId == null) return null;
    const modelId = await resolveModelId(brandId, lookup.modelId);
    if (modelId == null) return null;
    const modifications = await getModifications(brandId, modelId, lookup.creationYear);
    const modification = modifications.find(item => Number(item?.id ?? item?.code) === lookup.techParamId);
    if (!modification) return null;

    const fuelType = parseFuelType(modification?.engine?.text ?? modification?.engine?.name ?? modification?.engine);
    const engineVolume = Number(modification?.volume);
    const enginePower = Number(modification?.power);
    const result: EngineEnrichment = {
      fuelType,
      engineVolume: Number.isFinite(engineVolume) && engineVolume > 0 ? engineVolume : null,
      enginePower: Number.isFinite(enginePower) && enginePower > 0 ? enginePower : null,
      source: "cm_vin",
    };
    if (!result.fuelType && result.engineVolume == null && result.enginePower == null) return null;
    vinCache.set(vin, { result, expiresAt: Date.now() + VIN_CACHE_MS });
    return result;
  } catch {
    return null;
  }
}

function needsEnrichment(car: FeedCarForEnrichment, existing?: ExistingEngineData): boolean {
  if (!car.vin) return !existing?.fuelType && !existing?.engineVolume && !existing?.enginePower;
  if (!existing) return true;
  if (existing.vin !== car.vin || existing.modification !== car.modification) return true;
  if (existing.engineSource === "cm_vin") return false;
  if (existing.engineSource === "xml_pending") return true;
  if (existing.engineEnrichedAt) {
    const timestamp = new Date(existing.engineEnrichedAt).getTime();
    if (Number.isFinite(timestamp) && Date.now() - timestamp < ENRICHMENT_RETRY_MS) return false;
  }
  return true;
}

export async function enrichCars(
  cars: FeedCarForEnrichment[],
  existing: Map<string, ExistingEngineData>,
  onResult?: (externalId: string, enrichment: EngineEnrichment) => Promise<void>,
): Promise<Map<string, EngineEnrichment>> {
  const candidates = cars.filter(car => needsEnrichment(car, existing.get(car.id)));
  const result = new Map<string, EngineEnrichment>();
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const car = candidates[cursor++];
      let enriched = car.vin ? await resolveFromVin(car.vin) : null;
      enriched ??= parseXmlEngineData(car.modification);
      if (enriched) {
        result.set(car.id, enriched);
        await onResult?.(car.id, enriched);
      }
    }
  }

  await Promise.all([worker(), worker()]);
  return result;
}