import { cmBusinessGet } from "../lib/cm-expert-client";

const DEFAULT_TENET_PLUS_DEALER_ID = "28263";
const DEFAULT_JELAND_DEALER_ID = "27398";
const PAGE_SIZE = 50;
const PAGE_CONCURRENCY = 10;
const DEFAULT_MAX_PAGES = 700;
const SNAPSHOT_CACHE_TTL = 25 * 60 * 1000;

interface TenetPlusSourceRow {
  id?: unknown;
  dmsCarId?: unknown;
  dealerId?: unknown;
  stockState?: unknown;
  model?: unknown;
  modificationName?: unknown;
  equipmentName?: unknown;
  year?: unknown;
  sellingPrice?: unknown;
  color?: unknown;
  body?: unknown;
  vin?: unknown;
  photosUrls?: unknown;
  photos?: unknown;
  updatedAt?: unknown;
  sourceUpdatedAt?: unknown;
}

export interface TenetPlusStockCar {
  id: string;
  cmStockId: string | null;
  cmDmsCarId: string | null;
  model: string;
  modification: string;
  complectation: string;
  year: number;
  price: number;
  color: string;
  bodyType: string;
  images: string[];
  vin: string;
  sourceUpdatedAt: string;
}

export interface TenetPlusStockResult {
  cars: TenetPlusStockCar[];
  fetchedAt: string;
  pagesFetched: number;
  rowsScanned: number;
}

type BusinessGet = (path: string, params?: Record<string, string>) => Promise<unknown>;
export type CmBusinessStockCar = TenetPlusStockCar;
export type CmBusinessStockResult = TenetPlusStockResult;

type CmBusinessSourceRow = TenetPlusSourceRow;

interface CmBusinessSnapshot {
  rows: CmBusinessSourceRow[];
  presentDealerIds: Set<string>;
  fetchedAt: string;
  pagesFetched: number;
  rowsScanned: number;
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function finiteNumber(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numericStockId(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const candidate = String(value).trim();
  return /^\d+$/.test(candidate) ? candidate : null;
}

function validPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string =>
    typeof url === "string" && /^https:\/\/[^/\s]+/i.test(url.trim()),
  ).map(url => url.trim());
}

function securePhotoUrls(source: TenetPlusSourceRow): string[] {
  // photosUrls may contain plain HTTP source URLs. CM also supplies its own
  // HTTPS image in photos[].cmeUrl; use only that safe, browser-loadable URL.
  const cmPhotos = Array.isArray(source.photos)
    ? source.photos.flatMap(photo => {
        const url = photo && typeof photo === "object" && !Array.isArray(photo)
          ? (photo as { cmeUrl?: unknown }).cmeUrl
          : null;
        return typeof url === "string" ? [url] : [];
      })
    : [];
  const secureCmPhotos = validPhotos(cmPhotos);
  return secureCmPhotos.length > 0 ? secureCmPhotos : validPhotos(source.photosUrls);
}

/** Strictly map an API row into the public-field allowlist. */
export function mapTenetPlusStockCar(row: unknown): TenetPlusStockCar | null {
  return mapCmBusinessStockCar(row, "tenet-plus");
}

export function mapJelandStockCar(row: unknown): CmBusinessStockCar | null {
  return mapCmBusinessStockCar(row, "jeland");
}

function mapCmBusinessStockCar(row: unknown, idPrefix: "tenet-plus" | "jeland"): CmBusinessStockCar | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const source = row as TenetPlusSourceRow;
  const stockId = numericStockId(source.id);
  const dmsCarId = typeof source.dmsCarId === "string" && source.dmsCarId.trim()
    ? source.dmsCarId.trim()
    : null;

  if (!stockId && !dmsCarId) return null;

  return {
    id: stockId ? `${idPrefix}-cme-${stockId}` : `${idPrefix}-dms-${dmsCarId}`,
    cmStockId: stockId,
    cmDmsCarId: dmsCarId,
    model: stringValue(source.model),
    modification: stringValue(source.modificationName),
    complectation: stringValue(source.equipmentName),
    year: finiteNumber(source.year),
    price: finiteNumber(source.sellingPrice),
    color: stringValue(source.color),
    bodyType: stringValue(source.body),
    images: securePhotoUrls(source),
    vin: stringValue(source.vin),
    sourceUpdatedAt: stringValue(source.sourceUpdatedAt ?? source.updatedAt),
  };
}

function extractPage(payload: unknown, page: number): unknown[] {
  if (!Array.isArray(payload)) {
    throw new Error(`CM Expert Business returned an unexpected payload on page ${page}`);
  }
  if (payload.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error(`CM Expert Business returned a malformed row on page ${page}`);
  }
  if (payload.length > PAGE_SIZE) {
    throw new Error(`CM Expert Business exceeded the expected page size on page ${page}`);
  }
  return payload;
}

function projectSourceRow(row: Record<string, unknown>): CmBusinessSourceRow {
  const cmePhotoUrls = Array.isArray(row.photos)
    ? row.photos.flatMap(photo => {
        if (!photo || typeof photo !== "object" || Array.isArray(photo)) return [];
        const cmeUrl = (photo as { cmeUrl?: unknown }).cmeUrl;
        return typeof cmeUrl === "string" ? [{ cmeUrl }] : [];
      })
    : [];
  const photos = validPhotos(cmePhotoUrls.map(photo => photo.cmeUrl)).map(cmeUrl => ({ cmeUrl }));

  return {
    id: row.id,
    dmsCarId: row.dmsCarId,
    dealerId: row.dealerId,
    stockState: row.stockState,
    model: row.model,
    modificationName: row.modificationName,
    equipmentName: row.equipmentName,
    year: row.year,
    sellingPrice: row.sellingPrice,
    color: row.color,
    body: row.body,
    vin: row.vin,
    photosUrls: validPhotos(row.photosUrls),
    photos,
    updatedAt: row.updatedAt,
    sourceUpdatedAt: row.sourceUpdatedAt,
  };
}

interface PaginationOptions {
  maxPages?: number;
  concurrency?: number;
  now?: () => string;
}

export async function scanCmBusinessSnapshotWith(
  get: BusinessGet,
  options: PaginationOptions = {},
  retainedDealerIds: Iterable<string> = configuredDealerIds(),
): Promise<CmBusinessSnapshot> {
  const maxPages = options.maxPages ?? Math.max(
    DEFAULT_MAX_PAGES,
    Number.parseInt(process.env.CM_EXPERT_TENET_PLUS_MAX_PAGES ?? String(DEFAULT_MAX_PAGES), 10) || DEFAULT_MAX_PAGES,
  );
  const concurrency = Math.max(1, options.concurrency ?? PAGE_CONCURRENCY);
  const retainedIds = new Set(retainedDealerIds);
  const snapshotRows: CmBusinessSourceRow[] = [];
  const presentDealerIds = new Set<string>();
  let rowsScanned = 0;
  let pagesFetched = 0;
  let terminalPageFound = false;
  let shortPageCandidate: number | null = null;

  for (let firstPage = 1; firstPage <= maxPages; firstPage += concurrency) {
    const batchSize = Math.min(concurrency, maxPages - firstPage + 1);
    const batch = await Promise.allSettled(
      Array.from({ length: batchSize }, (_, offset) => {
        const page = firstPage + offset;
        return get("/dealers/dms/cars", { page: String(page), perPage: String(PAGE_SIZE) })
          .catch(() => {
            // The shared client includes response bodies in errors. Never log
            // or forward a global dealer-list response from this stock adapter.
            throw new Error(`CM Expert Business request failed on page ${page}`);
          })
          .then(payload => ({ page, rows: extractPage(payload, page) }));
      }),
    );

    for (let offset = 0; offset < batch.length; offset++) {
      const result = batch[offset]!;
      if (result.status === "rejected") throw result.reason;
      const { page, rows: pageRows } = result.value;
      if (page === 1 && pageRows.length === 0) {
        throw new Error("CM Expert Business returned an empty first page");
      }
      pagesFetched++;
      rowsScanned += pageRows.length;

      if (shortPageCandidate !== null) {
        if (pageRows.length !== 0) {
          throw new Error(`CM Expert Business short page ${shortPageCandidate} was followed by data on page ${page}`);
        }
        terminalPageFound = true;
        break;
      }

      // The API is global. Keep unrelated dealer payloads confined to this
      // page batch and persist only the two target dealers' mapped source fields.
      for (const row of pageRows as Record<string, unknown>[]) {
        const dealerId = String(row.dealerId ?? "");
        if (!retainedIds.has(dealerId)) continue;
        presentDealerIds.add(dealerId);
        if (typeof row.stockState !== "string" || row.stockState.toLowerCase() !== "in") continue;
        snapshotRows.push(projectSourceRow(row));
      }

      // Confirm the next page is empty. A short page in the middle of a
      // shifting global result must never trigger stock reconciliation.
      if (pageRows.length < PAGE_SIZE) shortPageCandidate = page;
    }

    if (terminalPageFound) break;
  }

  if (!terminalPageFound) {
    throw new Error(`CM Expert Business pagination reached the ${maxPages}-page limit without a terminal page`);
  }

  return {
    rows: snapshotRows,
    presentDealerIds,
    fetchedAt: (options.now ?? (() => new Date().toISOString()))(),
    pagesFetched,
    rowsScanned,
  };
}

const dealerConfigs = {
  "Tenet Plus": {
    dealerId: () => process.env.CM_EXPERT_TENET_PLUS_DEALER_ID?.trim() || DEFAULT_TENET_PLUS_DEALER_ID,
    label: "Tenet Plus",
    map: mapTenetPlusStockCar,
  },
  Jeland: {
    dealerId: () => process.env.CM_EXPERT_JELAND_DEALER_ID?.trim() || DEFAULT_JELAND_DEALER_ID,
    label: "Jeland",
    map: mapJelandStockCar,
  },
};

function configuredDealerIds(): string[] {
  return Object.values(dealerConfigs).map(config => config.dealerId());
}

function carsForDealer(
  snapshot: CmBusinessSnapshot,
  dealer: keyof typeof dealerConfigs,
  expectedDealerId = dealerConfigs[dealer].dealerId(),
): CmBusinessStockResult {
  const config = dealerConfigs[dealer];
  if (!snapshot.presentDealerIds.has(expectedDealerId)) {
    throw new Error(`CM Expert ${config.label} dealer was absent from the completed snapshot`);
  }

  const cars: CmBusinessStockCar[] = [];
  const seenIds = new Set<string>();
  let missingStableIdCount = 0;
  for (const row of snapshot.rows) {
    if (String(row.dealerId ?? "") !== expectedDealerId) continue;
    const mapped = config.map(row);
    if (!mapped) {
      missingStableIdCount++;
      continue;
    }
    if (seenIds.has(mapped.id)) continue;
    seenIds.add(mapped.id);
    cars.push(mapped);
  }
  if (missingStableIdCount > 0) {
    throw new Error(`CM Expert ${config.label} has ${missingStableIdCount} in-stock rows without a stable identifier`);
  }
  return { cars, fetchedAt: snapshot.fetchedAt, pagesFetched: snapshot.pagesFetched, rowsScanned: snapshot.rowsScanned };
}

/** Dependency-injected Tenet scanner retained for existing callers and tests. */
export async function fetchTenetPlusStockWith(
  get: BusinessGet,
  options: PaginationOptions & { dealerId?: string } = {},
): Promise<TenetPlusStockResult> {
  const dealerId = options.dealerId ?? dealerConfigs["Tenet Plus"].dealerId();
  const retainedDealerIds = new Set([...configuredDealerIds(), dealerId]);
  const snapshot = await scanCmBusinessSnapshotWith(get, options, retainedDealerIds);
  return carsForDealer(snapshot, "Tenet Plus", dealerId);
}

/** Scan one complete global Business snapshot, then validate dealers independently. */
export async function fetchCmBusinessStocksWith(
  get: BusinessGet,
  options: PaginationOptions = {},
): Promise<Record<keyof typeof dealerConfigs, PromiseSettledResult<CmBusinessStockResult>>> {
  const snapshot = await scanCmBusinessSnapshotWith(get, options);
  const validate = (dealer: keyof typeof dealerConfigs): PromiseSettledResult<CmBusinessStockResult> => {
    try {
      return { status: "fulfilled", value: carsForDealer(snapshot, dealer) };
    } catch (reason) {
      return { status: "rejected", reason };
    }
  };
  return { "Tenet Plus": validate("Tenet Plus"), Jeland: validate("Jeland") };
}

let productionSnapshot: CmBusinessSnapshot | null = null;
let productionSnapshotAt = 0;
let productionSnapshotInFlight: Promise<CmBusinessSnapshot> | null = null;

async function getProductionSnapshot(): Promise<CmBusinessSnapshot> {
  if (productionSnapshot && Date.now() - productionSnapshotAt < SNAPSHOT_CACHE_TTL) return productionSnapshot;
  if (productionSnapshotInFlight) return productionSnapshotInFlight;
  const work = scanCmBusinessSnapshotWith(cmBusinessGet)
    .then(snapshot => {
      productionSnapshot = snapshot;
      productionSnapshotAt = Date.now();
      return snapshot;
    })
    .finally(() => { productionSnapshotInFlight = null; });
  productionSnapshotInFlight = work;
  return work;
}

export async function fetchCmBusinessStock(dealer: "Tenet Plus" | "Jeland"): Promise<CmBusinessStockResult> {
  return carsForDealer(await getProductionSnapshot(), dealer);
}

export async function fetchTenetPlusStock(): Promise<TenetPlusStockResult> {
  return fetchCmBusinessStock("Tenet Plus");
}

export async function fetchJelandStock(): Promise<CmBusinessStockResult> {
  return fetchCmBusinessStock("Jeland");
}