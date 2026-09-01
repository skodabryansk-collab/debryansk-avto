import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { cmBusinessGet } from "../lib/cm-expert-client";

type FuelType = "Бензин" | "Дизель" | "Гибрид" | "Электро" | "ГБО";
const ASP_DEALER_ID = process.env.CM_EXPERT_ASP_DEALER_ID?.trim() || "2430";
const DMS_PAGE_SIZE = 20;
const MAX_DMS_PAGES = Math.max(
  1,
  Number.parseInt(process.env.CM_EXPERT_ASP_MAX_PAGES ?? "300", 10) || 300,
);
const DMS_PAGE_CONCURRENCY = 10;

interface CmDealerCar {
  id?: number | string;
  dmsCarId?: string | null;
  dealerId?: number | string | null;
  vin?: string | null;
  engine?: string | null;
  stockState?: string | null;
  saleStatus?: string | null;
  brand?: string | null;
  model?: string | null;
  volume?: number | string | null;
  power?: number | string | null;
}

export interface CmDealerFuelSyncResult {
  carsFetched: number;
  pagesFetched: number;
  totalRowsScanned: number;
  carsWithVin: number;
  carsWithFuel: number;
  carsWithEngineDetails: number;
  matchedCars: number;
  updatedCars: number;
  skippedCars: number;
  stockStateCounts: Record<string, number>;
  dealerId: string;
  dealerName: string | null;
  paginationTruncated: boolean;
  source: "cm_cabinet";
}

export interface CmDealerFuelSyncStatus {
  running: boolean;
  startedAt: string | null;
  completedAt: string | null;
  lastResult: CmDealerFuelSyncResult | null;
}

let syncInFlight: Promise<CmDealerFuelSyncResult> | null = null;
let syncStartedAt: string | null = null;
let syncCompletedAt: string | null = null;
let lastSyncResult: CmDealerFuelSyncResult | null = null;

function normalizeVin(value: unknown): string | null {
  const vin = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return vin.length >= 11 ? vin : null;
}

function parseFuel(value: unknown): FuelType | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("petrol") || normalized.includes("gasoline") || normalized.includes("бензин")) {
    return "Бензин";
  }
  if (normalized.includes("diesel") || normalized.includes("дизел")) return "Дизель";
  if (normalized.includes("hybrid") || normalized.includes("гибрид")) return "Гибрид";
  if (normalized.includes("electric") || normalized.includes("electro") || normalized.includes("электро")) {
    return "Электро";
  }
  if (normalized.includes("lpg") || normalized.includes("газ") || normalized.includes("гбо")) return "ГБО";
  return null;
}

function parsePositiveNumber(value: unknown): number | null {
  const number = Number(String(value ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseEngineDetails(car: CmDealerCar): {
  fuelType: FuelType | null;
  engineVolume: number | null;
  enginePower: number | null;
} {
  const engine = String(car.engine ?? "");
  const volumeMatch = engine.match(/(\d+(?:[.,]\d+)?)\s*(?:л|литр)/i);
  const powerMatch = engine.match(/(\d{2,4})\s*(?:л\.?\s*с\.?|лс|hp)/i);
  return {
    fuelType: parseFuel(engine),
    engineVolume: parsePositiveNumber(car.volume) ??
      (volumeMatch ? parsePositiveNumber(volumeMatch[1]) : null),
    enginePower: parsePositiveNumber(car.power) ??
      (powerMatch ? parsePositiveNumber(powerMatch[1]) : null),
  };
}

function extractCars(payload: unknown): CmDealerCar[] {
  if (Array.isArray(payload)) return payload as CmDealerCar[];
  if (!payload || typeof payload !== "object") return [];
  const body = payload as {
    cars?: unknown;
    data?: unknown;
    items?: unknown;
  };
  const list = body.cars ?? body.data ?? body.items;
  return Array.isArray(list) ? list as CmDealerCar[] : [];
}

async function fetchDealerStock(): Promise<{
  cars: CmDealerCar[];
  pagesFetched: number;
  totalRowsScanned: number;
  paginationTruncated: boolean;
  dealerName: string | null;
}> {
  const dealerInfo = await cmBusinessGet(`/dealers/${ASP_DEALER_ID}`) as {
    name?: string | null;
  };
  const cars: CmDealerCar[] = [];
  const seenRows = new Set<string>();
  let pagesFetched = 0;
  let totalRowsScanned = 0;
  let paginationTruncated = true;

  for (let startPage = 1; startPage <= MAX_DMS_PAGES; startPage += DMS_PAGE_CONCURRENCY) {
    const pageResults = await Promise.all(
      Array.from(
        { length: Math.min(DMS_PAGE_CONCURRENCY, MAX_DMS_PAGES - startPage + 1) },
        (_, offset) => cmBusinessGet("/dealers/dms/cars", { page: String(startPage + offset) }),
      ),
    );

    for (const payload of pageResults) {
      const pageCars = extractCars(payload);
      pagesFetched++;
      totalRowsScanned += pageCars.length;
      for (const car of pageCars) {
        if (String(car.dealerId ?? "") !== ASP_DEALER_ID) continue;
        if (String(car.stockState ?? "").toLowerCase() !== "in") continue;
        const rowKey = String(car.id ?? car.dmsCarId ?? normalizeVin(car.vin) ?? "");
        if (!rowKey || seenRows.has(rowKey)) continue;
        seenRows.add(rowKey);
        cars.push(car);
      }

      if (pageCars.length < DMS_PAGE_SIZE) {
        paginationTruncated = false;
      }
    }
    if (!paginationTruncated) break;
  }

  return {
    cars,
    pagesFetched,
    totalRowsScanned,
    paginationTruncated,
    dealerName: dealerInfo?.name ? String(dealerInfo.name) : null,
  };
}

async function performCmDealerFuelSync(): Promise<CmDealerFuelSyncResult> {
  const fetched = await fetchDealerStock();
  const dealerCars = fetched.cars;
  const stockStateCounts: Record<string, number> = {};

  for (const car of dealerCars) {
    const state = String(car.stockState ?? "unknown");
    stockStateCounts[state] = (stockStateCounts[state] ?? 0) + 1;
  }

  const rows = await db.execute(sql`
    SELECT id, external_id, vin, cm_dms_car_id
    FROM cars
    WHERE type = 'used'
  `);
  const carsByVin = new Map<string, { id: number; externalId: string }>();
  const carsByDmsId = new Map<string, { id: number; externalId: string }>();
  for (const row of rows.rows as {
    id: number;
    external_id: string;
    vin: string | null;
    cm_dms_car_id: string | null;
  }[]) {
    const vin = normalizeVin(row.vin);
    if (vin) carsByVin.set(vin, { id: row.id, externalId: row.external_id });
    if (row.cm_dms_car_id) {
      carsByDmsId.set(String(row.cm_dms_car_id), { id: row.id, externalId: row.external_id });
    }
  }

  let carsWithVin = 0;
  let carsWithFuel = 0;
  let carsWithEngineDetails = 0;
  let matchedCars = 0;
  let updatedCars = 0;
  let skippedCars = 0;
  const updatedIds = new Set<string>();

  for (const dealerCar of dealerCars) {
    const vin = normalizeVin(dealerCar.vin);
    if (vin) carsWithVin++;
    const dmsCarId = String(dealerCar.dmsCarId ?? "").trim() || null;
    const car = (vin ? carsByVin.get(vin) : undefined) ??
      (dmsCarId ? carsByDmsId.get(dmsCarId) : undefined);
    if (!car) {
      skippedCars++;
      continue;
    }

    const details = parseEngineDetails(dealerCar);
    if (details.fuelType) carsWithFuel++;
    if (details.engineVolume != null || details.enginePower != null) carsWithEngineDetails++;
    if (!details.fuelType && details.engineVolume == null && details.enginePower == null) {
      skippedCars++;
      continue;
    }

    matchedCars++;
    await db.execute(sql`
      UPDATE cars
      SET fuel_type = COALESCE(${details.fuelType}, fuel_type),
          engine_volume = COALESCE(${details.engineVolume}, engine_volume),
          engine_power = COALESCE(${details.enginePower}, engine_power),
          cm_dms_car_id = COALESCE(${dmsCarId}, cm_dms_car_id),
          engine_source = 'cm_cabinet',
          engine_enriched_at = NOW()
      WHERE id = ${car.id} AND type = 'used'
    `);
    if (!updatedIds.has(car.externalId)) {
      updatedIds.add(car.externalId);
      updatedCars++;
    }
  }

  const result: CmDealerFuelSyncResult = {
    carsFetched: dealerCars.length,
    pagesFetched: fetched.pagesFetched,
    totalRowsScanned: fetched.totalRowsScanned,
    carsWithVin,
    carsWithFuel,
    carsWithEngineDetails,
    matchedCars,
    updatedCars,
    skippedCars,
    stockStateCounts,
    dealerId: ASP_DEALER_ID,
    dealerName: fetched.dealerName,
    paginationTruncated: fetched.paginationTruncated,
    source: "cm_cabinet",
  };
  logger.info(result, "CM Expert dealer stock fuel sync complete");
  return result;
}

export function syncFuelFromCmDealerStock(): Promise<CmDealerFuelSyncResult> {
  if (!syncInFlight) {
    syncStartedAt = new Date().toISOString();
    syncCompletedAt = null;
    syncInFlight = performCmDealerFuelSync()
      .then(result => {
        lastSyncResult = result;
        syncCompletedAt = new Date().toISOString();
        return result;
      })
      .finally(() => {
        syncInFlight = null;
      });
  }
  return syncInFlight;
}

export function scheduleCmDealerFuelSync(reason: string): void {
  if (syncInFlight) {
    logger.info({ reason }, "CM Expert ASP sync already running — skipping duplicate start");
    return;
  }
  syncFuelFromCmDealerStock()
    .then(result => logger.info({ reason, ...result }, "CM Expert ASP scheduled sync complete"))
    .catch(err => logger.warn({ err, reason }, "CM Expert ASP scheduled sync failed"));
}

export function getCmDealerFuelSyncStatus(): CmDealerFuelSyncStatus {
  return {
    running: Boolean(syncInFlight),
    startedAt: syncStartedAt,
    completedAt: syncCompletedAt,
    lastResult: lastSyncResult,
  };
}