import { cmBusinessGet } from "../lib/cm-expert-client";
import { slugifyCarId } from "../lib/slugify";

const DEFAULT_TENET_PLUS_DEALER_ID = "28263";
const DEFAULT_JELAND_DEALER_ID = "27398";
const DEFAULT_HAVAL_PRO_DEALER_ID = "20556";
const DEFAULT_HAVAL_CITY_DEALER_ID = "21937";
const PAGE_SIZE = 50;
const PAGE_CONCURRENCY = 10;
const DEFAULT_MAX_PAGES = 700;
const SNAPSHOT_CACHE_TTL = 25 * 60 * 1000;

interface TenetPlusSourceRow {
  id?: unknown;
  dmsCarId?: unknown;
  dealerId?: unknown;
  brand?: unknown;
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
  options?: unknown;
}

export interface TenetPlusStockCar {
  id: string;
  cmStockId: string | null;
  cmDmsCarId: string | null;
  brand?: string;
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
  options?: string[];
}

export type CmBusinessStockCar = TenetPlusStockCar;

export interface TenetPlusStockResult {
  cars: TenetPlusStockCar[];
  fetchedAt: string;
  pagesFetched: number;
  rowsScanned: number;
}

export interface CmBusinessStockResult extends Omit<TenetPlusStockResult, "cars"> {
  cars: CmBusinessStockCar[];
}

type BusinessGet = (path: string, params?: Record<string, string>) => Promise<unknown>;

type CmBusinessSourceRow = TenetPlusSourceRow;

export interface CmBusinessSnapshot {
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

export function mapCmBusinessDealerStockCar(
  row: unknown,
  dealerName: string,
): CmBusinessStockCar | null {
  const prefix = dealerName.trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "");
  if (!prefix) return null;
  return mapCmBusinessStockCar(row, prefix);
}

const CM_BOOLEAN_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["hasOnBoardComputer", "Бортовой компьютер"],
  ["hasCruiseControl", "Круиз-контроль"],
  ["hasAdaptiveCruiseControls", "Адаптивный круиз-контроль"],
  ["hasTirePressureSensor", "Датчик давления в шинах"],
  ["hasRemoteStartEngine", "Дистанционный запуск двигателя"],
  ["hasStartEngineButton", "Запуск двигателя кнопкой"],
  ["hasCamera360", "Камера кругового обзора 360°"],
  ["hasCameraRear", "Камера заднего вида"],
  ["hasParkSensorRear", "Задние парктроники"],
  ["hasParkSensorFront", "Передние парктроники"],
  ["hasKeylessAccess", "Бесключевой доступ"],
  ["hasElectricTrunk", "Электропривод багажника"],
  ["hasAbs", "ABS"],
  ["hasEsp", "ESP"],
  ["hasIsofix", "Крепления ISOFIX"],
  ["hasRearDoorsLocking", "Блокировка задних дверей"],
  ["hasAirbagFront", "Фронтальные подушки безопасности"],
  ["hasAirbagPassengerFront", "Передняя подушка безопасности пассажира"],
  ["hasAirbagSide", "Боковые подушки безопасности"],
  ["hasAirbagWindow", "Шторки безопасности"],
  ["hasLaneControlSystem", "Система контроля полосы"],
  ["hasBlindAreaControlSystem", "Контроль слепых зон"],
  ["hasHillStartAssist", "Помощь при старте на подъёме"],
  ["hasCollisionAvoidanceSystem", "Система предотвращения столкновений"],
  ["hasRainSensor", "Датчик дождя"],
  ["hasLightSensor", "Датчик света"],
  ["hasHeatesMirrors", "Обогрев зеркал"],
  ["hasFogLights", "Противотуманные фары"],
  ["hasHeatedWindscreen", "Обогрев лобового стекла"],
  ["hasHeatedWiperSprayers", "Обогрев форсунок стеклоомывателя"],
  ["hasElectricMirrors", "Электрорегулировка зеркал"],
  ["hasAutoMirrorsFold", "Складывание зеркал"],
  ["hasOemImmobiliser", "Штатный иммобилайзер"],
  ["hasFrontSeatsVentilation", "Вентиляция передних сидений"],
  ["hasPanoramicRoof", "Панорамная крыша"],
  ["hasSteeringWheelHeater", "Обогрев рулевого колеса"],
  ["hasFoldingRearSeats", "Складывание задних сидений"],
  ["hasAudioSystem", "Аудиосистема"],
  ["hasWirelessCharging", "Беспроводная зарядка"],
  ["hasSocket12V", "Розетка 12 В"],
  ["hasAndroidAuto", "Android Auto"],
  ["hasBluetooth", "Bluetooth"],
  ["hasAppleCarPlay", "Apple CarPlay"],
  ["hasUSB", "USB"],
  ["hasDriverSeatUpdown", "Регулировка водительского сиденья по высоте"],
  ["hasEasyTrunkOpening", "Открытие багажника без помощи рук"],
  ["hasGlonass", "ГЛОНАСС"],
  ["hasBAS", "Система экстренного торможения BAS"],
  ["hasHighBeamAssist", "Ассистент дальнего света"],
  ["hasSpareMini", "Запасное колесо-докатка"],
];

const CM_ENUM_OPTIONS: ReadonlyArray<{
  field: string;
  values: Readonly<Record<string, string>>;
}> = [
  { field: "climate", values: { cc2zones: "Двухзонный климат-контроль" } },
  { field: "wheelAdjusting", values: { heightandlength: "Регулировка руля по высоте и вылету" } },
  { field: "seatsHeat", values: {
    front: "Обогрев передних сидений",
    all: "Обогрев всех сидений",
  } },
  { field: "driverSeatAdjusting", values: { electro: "Электрорегулировка водительского сиденья" } },
  { field: "passengerSeatAdjusting", values: { electro: "Электрорегулировка пассажирского сиденья" } },
  { field: "headLightType", values: { led: "Светодиодные фары" } },
  { field: "wheelRimType", values: { alloy: "Легкосплавные диски" } },
  { field: "wheelRimDiameter", values: { "18": "Колёсные диски 18 дюймов" } },
  { field: "salon", values: { leather: "Кожаный салон" } },
];

const CM_KNOWN_OPTION_LABELS = new Set([
  ...CM_BOOLEAN_OPTIONS.map(([, label]) => label),
  ...CM_ENUM_OPTIONS.flatMap(({ values }) => Object.values(values)),
]);

function extractCmBusinessOptions(source: Record<string, unknown>): string[] {
  const options = new Set<string>();
  for (const [field, label] of CM_BOOLEAN_OPTIONS) {
    if (source[field] === true) options.add(label);
  }
  for (const { field, values } of CM_ENUM_OPTIONS) {
    const value = source[field];
    const enumValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
    if (values[enumValue]) options.add(values[enumValue]!);
  }
  // Snapshot rows already contain only labels. Accept those labels when
  // mapping the projected row, but never trust arbitrary option strings.
  if (Array.isArray(source.options)) {
    for (const label of source.options) {
      if (typeof label === "string" && CM_KNOWN_OPTION_LABELS.has(label)) options.add(label);
    }
  }
  return [...options];
}

function mapCmBusinessStockCar(row: unknown, idPrefix: string): CmBusinessStockCar | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const source = row as TenetPlusSourceRow;
  const stockId = numericStockId(source.id);
  const dmsCarId = typeof source.dmsCarId === "string" && source.dmsCarId.trim()
    ? source.dmsCarId.trim()
    : null;

  if (!stockId && !dmsCarId) return null;

  const mapped: TenetPlusStockCar = {
    id: slugifyCarId(idPrefix, stockId ? `cme-${stockId}` : `dms-${dmsCarId}`),
    cmStockId: stockId,
    cmDmsCarId: dmsCarId,
    ...(stringValue(source.brand).trim() ? { brand: stringValue(source.brand).trim() } : {}),
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
  const options = extractCmBusinessOptions(source as Record<string, unknown>);
  return options.length > 0 ? { ...mapped, options } : mapped;
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

  const projected: CmBusinessSourceRow = {
    id: row.id,
    dmsCarId: row.dmsCarId,
    dealerId: row.dealerId,
    ...(typeof row.brand === "string" && row.brand.trim() ? { brand: row.brand.trim() } : {}),
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
  const options = extractCmBusinessOptions(row);
  if (options.length > 0) projected.options = options;
  return projected;
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
  return [
    ...Object.values(dealerConfigs).map(config => config.dealerId()),
    process.env.CM_EXPERT_HAVAL_PRO_DEALER_ID?.trim() || DEFAULT_HAVAL_PRO_DEALER_ID,
    process.env.CM_EXPERT_HAVAL_CITY_DEALER_ID?.trim() || DEFAULT_HAVAL_CITY_DEALER_ID,
  ];
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
let productionSnapshotDealerIds = new Set<string>();
let productionSnapshotInFlightDealerIds = new Set<string>();

export async function fetchCmBusinessIntegrationSnapshot(
  dealerIds: string[],
  options: { forceRefresh?: boolean } = {},
): Promise<CmBusinessSnapshot> {
  const requiredDealerIds = new Set([...configuredDealerIds(), ...dealerIds.map(id => id.trim()).filter(Boolean)]);
  if (
    !options.forceRefresh &&
    productionSnapshot &&
    Date.now() - productionSnapshotAt < SNAPSHOT_CACHE_TTL &&
    [...requiredDealerIds].every(id => productionSnapshotDealerIds.has(id))
  ) return productionSnapshot;
  if (productionSnapshotInFlight) {
    if ([...requiredDealerIds].every(id => productionSnapshotInFlightDealerIds.has(id))) {
      return productionSnapshotInFlight;
    }
    await productionSnapshotInFlight.catch(() => undefined);
    return fetchCmBusinessIntegrationSnapshot([...requiredDealerIds], options);
  }
  const work = scanCmBusinessSnapshotWith(cmBusinessGet, {}, requiredDealerIds)
    .then(snapshot => {
      productionSnapshot = snapshot;
      productionSnapshotAt = Date.now();
      productionSnapshotDealerIds = requiredDealerIds;
      return snapshot;
    })
    .finally(() => {
      productionSnapshotInFlight = null;
      productionSnapshotInFlightDealerIds = new Set();
    });
  productionSnapshotInFlight = work;
  productionSnapshotInFlightDealerIds = requiredDealerIds;
  return work;
}

export function mapCmBusinessIntegrationDealerStocksFromSnapshot(
  snapshot: CmBusinessSnapshot,
  dealers: Array<{ dealerId: string; dealerName: string }>,
): Map<string, PromiseSettledResult<CmBusinessStockResult>> {
  const results = new Map<string, PromiseSettledResult<CmBusinessStockResult>>();

  for (const dealer of dealers) {
    const dealerId = dealer.dealerId.trim();
    try {
      if (!snapshot.presentDealerIds.has(dealerId)) {
        throw new Error(`CM Expert ${dealer.dealerName} dealer was absent from the completed snapshot`);
      }
      const cars: CmBusinessStockCar[] = [];
      const seenIds = new Set<string>();
      let missingStableIdCount = 0;
      for (const row of snapshot.rows) {
        if (String(row.dealerId ?? "") !== dealerId) continue;
        const mapped = mapCmBusinessDealerStockCar(row, dealer.dealerName);
        if (!mapped) {
          missingStableIdCount++;
          continue;
        }
        if (seenIds.has(mapped.id)) continue;
        seenIds.add(mapped.id);
        cars.push(mapped);
      }
      if (missingStableIdCount > 0) {
        throw new Error(
          `CM Expert ${dealer.dealerName} has ${missingStableIdCount} in-stock rows without a stable identifier`,
        );
      }
      results.set(dealerId, {
        status: "fulfilled",
        value: {
          cars,
          fetchedAt: snapshot.fetchedAt,
          pagesFetched: snapshot.pagesFetched,
          rowsScanned: snapshot.rowsScanned,
        },
      });
    } catch (reason) {
      results.set(dealerId, { status: "rejected", reason });
    }
  }

  return results;
}

async function getProductionSnapshot(): Promise<CmBusinessSnapshot> {
  return fetchCmBusinessIntegrationSnapshot(configuredDealerIds());
}

export async function fetchCmBusinessIntegrationDealerStock(
  dealerId: string,
  dealerName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<CmBusinessStockResult> {
  const expectedDealerId = dealerId.trim();
  const snapshot = await fetchCmBusinessIntegrationSnapshot([expectedDealerId], options);
  const result = mapCmBusinessIntegrationDealerStocksFromSnapshot(
    snapshot,
    [{ dealerId: expectedDealerId, dealerName }],
  ).get(expectedDealerId);
  if (!result) throw new Error(`CM Expert ${dealerName} dealer result was not produced`);
  if (result.status === "rejected") throw result.reason;
  return result.value;
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