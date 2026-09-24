import { cmBusinessGet } from "../lib/cm-expert-client";

const DEFAULT_DEALER_ID = "28263";
const PAGE_SIZE = 50;
const PAGE_CONCURRENCY = 10;
const DEFAULT_MAX_PAGES = 700;

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
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const source = row as TenetPlusSourceRow;
  const stockId = numericStockId(source.id);
  const dmsCarId = typeof source.dmsCarId === "string" && source.dmsCarId.trim()
    ? source.dmsCarId.trim()
    : null;

  if (!stockId && !dmsCarId) return null;

  return {
    id: stockId ? `tenet-plus-cme-${stockId}` : `tenet-plus-dms-${dmsCarId}`,
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
    throw new Error(`CM Expert Tenet Plus returned an unexpected payload on page ${page}`);
  }
  if (payload.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error(`CM Expert Tenet Plus returned a malformed row on page ${page}`);
  }
  if (payload.length > PAGE_SIZE) {
    throw new Error(`CM Expert Tenet Plus exceeded the expected page size on page ${page}`);
  }
  return payload;
}

interface PaginationOptions {
  dealerId?: string;
  maxPages?: number;
  concurrency?: number;
  now?: () => string;
}

/** Dependency-injected scanner for deterministic tests; production uses fetchTenetPlusStock. */
export async function fetchTenetPlusStockWith(
  get: BusinessGet,
  options: PaginationOptions = {},
): Promise<TenetPlusStockResult> {
  const dealerId = options.dealerId ?? process.env.CM_EXPERT_TENET_PLUS_DEALER_ID?.trim() ?? DEFAULT_DEALER_ID;
  const maxPages = options.maxPages ?? Math.max(
    DEFAULT_MAX_PAGES,
    Number.parseInt(process.env.CM_EXPERT_TENET_PLUS_MAX_PAGES ?? String(DEFAULT_MAX_PAGES), 10) || DEFAULT_MAX_PAGES,
  );
  const concurrency = Math.max(1, options.concurrency ?? PAGE_CONCURRENCY);
  const cars: TenetPlusStockCar[] = [];
  const seenIds = new Set<string>();
  let rowsScanned = 0;
  let pagesFetched = 0;
  let missingStableIdCount = 0;
  let dealerRowsScanned = 0;
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
            throw new Error(`CM Expert Tenet Plus request failed on page ${page}`);
          })
          .then(payload => ({ page, rows: extractPage(payload, page) }));
      }),
    );

    for (let offset = 0; offset < batch.length; offset++) {
      const result = batch[offset]!;
      if (result.status === "rejected") throw result.reason;
      const { page, rows } = result.value;
      if (page === 1 && rows.length === 0) {
        throw new Error("CM Expert Tenet Plus returned an empty first page");
      }
      pagesFetched++;
      rowsScanned += rows.length;

      if (shortPageCandidate !== null) {
        if (rows.length !== 0) {
          throw new Error(`CM Expert Tenet Plus short page ${shortPageCandidate} was followed by data on page ${page}`);
        }
        terminalPageFound = true;
        break;
      }

      for (const row of rows as TenetPlusSourceRow[]) {
        if (String(row.dealerId ?? "") !== dealerId) continue;
        dealerRowsScanned++;
        if (typeof row.stockState !== "string" || row.stockState.toLowerCase() !== "in") continue;

        const mapped = mapTenetPlusStockCar(row);
        if (!mapped) {
          missingStableIdCount++;
          continue;
        }
        if (seenIds.has(mapped.id)) continue;
        seenIds.add(mapped.id);
        cars.push(mapped);
      }

      // Confirm the next page is empty. A short page in the middle of a
      // shifting global result must never trigger stock reconciliation.
      if (rows.length < PAGE_SIZE) shortPageCandidate = page;
    }

    if (terminalPageFound) break;
  }

  if (!terminalPageFound) {
    throw new Error(`CM Expert Tenet Plus pagination reached the ${maxPages}-page limit without a terminal page`);
  }
  if (dealerRowsScanned === 0) {
    throw new Error("CM Expert Tenet Plus dealer was absent from the completed snapshot");
  }
  if (missingStableIdCount > 0) {
    throw new Error(`CM Expert Tenet Plus has ${missingStableIdCount} in-stock rows without a stable identifier`);
  }

  return {
    cars,
    fetchedAt: (options.now ?? (() => new Date().toISOString()))(),
    pagesFetched,
    rowsScanned,
  };
}

export async function fetchTenetPlusStock(): Promise<TenetPlusStockResult> {
  return fetchTenetPlusStockWith(cmBusinessGet);
}