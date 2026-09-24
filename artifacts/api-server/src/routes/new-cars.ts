import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { slugifyCarId } from "../lib/slugify";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { fetchCmBusinessStock } from "../services/tenet-plus-stock";

const router: IRouter = Router();
const TENET_PLUS_DEALER = "Tenet Plus";
const JELAND_DEALER = "Jeland";

const FEEDS = [
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/2c3eb21beb9caa23118a56e042a13187.xml", dealer: "Jaecoo" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/9a822bd39911d610b99ad1b477ec9356.xml", dealer: "Omoda" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/710fe0a03b5a1e47458161bfbfaa9355.xml", dealer: "Tenet" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/f8056db2c70dba547744e2e4aaa20556.xml", dealer: "Haval Pro" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/53fe918374eb87e8f6536b8c3bb21937.xml", dealer: "Haval City" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/913211584f8ad577ee76a703f2f13186.xml", dealer: "Jetour" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/86abbe9a79571a2757b583e323b27564.xml", dealer: "Soueast" },
];
const CM_BUSINESS_DEALERS = [TENET_PLUS_DEALER, JELAND_DEALER] as const;
const SOURCES: Array<{ dealer: string; url?: string }> = [
  ...FEEDS,
  ...CM_BUSINESS_DEALERS.map(dealer => ({ dealer })),
];

export interface NewCarRecord {
  id: string;
  mark: string;
  model: string;
  modification: string;
  complectation: string;
  year: number;
  price: number;
  color: string;
  bodyType: string;
  availability: string;
  url: string;
  images: string[];
  dealer: string;
  maxDiscount: number;
  creditDiscount: number;
  tradeinDiscount: number;
  extras: string;
  description: string;
  vin: string;
  doorsCount: number;
  wheel: string;
  armored: string;
  custom: string;
  phone: string;
  notRegisteredInRussia: boolean;
  acceptedAutoruExclusive: boolean;
  popularity_score: number;
  catalogSource?: "cm_business";
  cmStockId?: string | null;
  cmDmsCarId?: string | null;
  stockState?: string | null;
  sourceUpdatedAt?: string | null;
}

interface PublicEligibilityInput {
  dealer: string | null;
  model: string | null;
  modification: string | null;
  complectation: string | null;
  stockState?: string | null;
  images?: string[] | null;
  imageUrl?: string | null;
}

function hasUsablePhoto(url: string | null | undefined): boolean {
  return typeof url === "string" && /^https?:\/\/[^/\s]+/i.test(url.trim());
}

function hasSecurePhoto(url: string | null | undefined): boolean {
  return typeof url === "string" && /^https:\/\/[^/\s]+/i.test(url.trim());
}

export function isCmBusinessDealer(dealer?: string | null): boolean {
  const normalized = dealer?.trim().toLowerCase();
  return normalized === TENET_PLUS_DEALER.toLowerCase() || normalized === JELAND_DEALER.toLowerCase();
}

export function isPublicNewCarEligible(car: PublicEligibilityInput): boolean {
  if (!isCmBusinessDealer(car.dealer)) return true;
  const photoValidator = car.dealer?.trim().toLowerCase() === JELAND_DEALER.toLowerCase()
    ? hasSecurePhoto : hasUsablePhoto;
  const hasPhoto = (car.images?.some(photoValidator) ?? false) || photoValidator(car.imageUrl);
  return car.stockState?.toLowerCase() === "in"
    && hasPhoto
    && Boolean(car.model?.trim())
    && Boolean(car.complectation?.trim() || car.modification?.trim());
}

const CACHE_TTL = 30 * 60 * 1000;
const CM_RETRY_MS = 60 * 1000;
const PUBLIC_STOCK_MAX_AGE = 60 * 60 * 1000;

interface DealerCache {
  data: NewCarRecord[];
  ts: number;
  sourceTs?: number;
  stale?: boolean;
}

const dealerCache: Map<string, DealerCache> = new Map();
const refreshInFlight = new Map<string, Promise<void>>();
let tenetPlusFailureAt = 0;
let lastMergedAt = 0;
let mergedCache: NewCarRecord[] | null = null;

export function clearNewCarsCache() {
  dealerCache.clear();
  mergedCache = null;
  lastMergedAt = 0;
  tenetPlusFailureAt = 0;
}

export function getCmBusinessFeedState(dealer: string): { complete: boolean; cachedCount: number } {
  if (!isCmBusinessDealer(dealer)) return { complete: false, cachedCount: 0 };
  const canonicalDealer = dealer.trim().toLowerCase() === JELAND_DEALER.toLowerCase()
    ? JELAND_DEALER : TENET_PLUS_DEALER;
  const cached = dealerCache.get(canonicalDealer);
  return {
    complete: Boolean(cached && !cached.stale && Date.now() - (cached.sourceTs ?? cached.ts) < PUBLIC_STOCK_MAX_AGE),
    cachedCount: cached?.data.length ?? 0,
  };
}

export function getTenetPlusFeedState(): { complete: boolean; cachedCount: number } {
  return getCmBusinessFeedState(TENET_PLUS_DEALER);
}

/** Cross-check DB-backed public pages against the current complete CM snapshot. */
export function getCmBusinessPublicIdSet(dealer: string): Set<string> {
  if (!isCmBusinessDealer(dealer) || !getCmBusinessFeedState(dealer).complete) return new Set();
  const canonicalDealer = dealer.trim().toLowerCase() === JELAND_DEALER.toLowerCase()
    ? JELAND_DEALER : TENET_PLUS_DEALER;
  const cached = dealerCache.get(canonicalDealer);
  return new Set(cached?.data.filter(isPublicNewCarEligible).map(car => car.id) ?? []);
}

export function getTenetPlusPublicIdSet(): Set<string> {
  return getCmBusinessPublicIdSet(TENET_PLUS_DEALER);
}

function getField(xml: string, field: string): string {
  const m = xml.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`));
  return m ? m[1].trim() : "";
}

function getImages(xml: string): string[] {
  return [...xml.matchAll(/<image>([^<]+)<\/image>/g)].map((m) => m[1].trim());
}

const BRAND_CANONICAL: Record<string, string> = {
  "CHERY": "Chery",
  "TENET": "Tenet",
  "GREAT WALL": "Great Wall",
  "HAVAL": "Haval",
  "JAECOO": "Jaecoo",
  "JETOUR": "Jetour",
  "JELAND": "Jeland",
  "OMODA": "Omoda",
  "EXEED": "Exeed",
  "TANK": "Tank",
  "BYD": "BYD",
  "SOUEAST": "Soueast",
};

function normalizeBrand(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return BRAND_CANONICAL[upper] ?? raw.trim();
}

function parseFeed(text: string, dealer: string): NewCarRecord[] {
  const cars: NewCarRecord[] = [];
  const blocks = text.match(/<car>[\s\S]*?<\/car>/g) ?? [];
  for (const block of blocks) {
    const action = getField(block, "action");
    if (action !== "show") continue;
    cars.push({
      id: slugifyCarId(dealer, getField(block, "unique_id")),
      mark: normalizeBrand(getField(block, "mark_id")),
      model: getField(block, "folder_id"),
      modification: getField(block, "modification_id"),
      complectation: getField(block, "complectation_name"),
      year: parseInt(getField(block, "year")) || 0,
      price: parseInt(getField(block, "price")) || 0,
      color: getField(block, "color"),
      bodyType: getField(block, "body_type"),
      availability: getField(block, "availability"),
      url: getField(block, "url"),
      images: getImages(block),
      dealer,
      maxDiscount: parseInt(getField(block, "max_discount")) || 0,
      creditDiscount: parseInt(getField(block, "credit_discount")) || 0,
      tradeinDiscount: parseInt(getField(block, "tradein_discount")) || 0,
      extras: getField(block, "extras"),
      description: getField(block, "description"),
      vin: getField(block, "vin"),
      doorsCount: parseInt(getField(block, "doors_count")) || 0,
      wheel: getField(block, "wheel"),
      armored: getField(block, "armored"),
      custom: getField(block, "custom"),
      phone: getField(block, "phone"),
      notRegisteredInRussia: getField(block, "not_registered_in_russia") === "true",
      acceptedAutoruExclusive: getField(block, "accepted_autoru_exclusive") === "true",
      popularity_score: 0,
    });
  }
  return cars;
}

async function refreshDealer(feed: { url: string; dealer: string }): Promise<void> {
  const r = await fetch(feed.url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  const parsed = parseFeed(text, feed.dealer);
  logger.info({ dealer: feed.dealer, count: parsed.length }, "new-cars: feed fetched");
  dealerCache.set(feed.dealer, { data: parsed, ts: Date.now(), stale: false });
  mergedCache = null;
}

async function refreshCmBusinessDealer(dealer: typeof CM_BUSINESS_DEALERS[number]): Promise<void> {
  const { cars, fetchedAt, pagesFetched, rowsScanned } = await fetchCmBusinessStock(dealer);
  const parsed: NewCarRecord[] = cars.map(c => ({
    id: c.id,
    mark: dealer,
    model: c.model,
    modification: c.modification,
    complectation: c.complectation,
    year: c.year,
    price: c.price,
    color: c.color,
    bodyType: c.bodyType,
    availability: "В наличии",
    url: "",
    images: c.images,
    dealer,
    maxDiscount: 0,
    creditDiscount: 0,
    tradeinDiscount: 0,
    extras: dealer === JELAND_DEALER ? (c.options?.join(", ") ?? "") : "",
    description: "",
    vin: c.vin,
    doorsCount: 0,
    wheel: "",
    armored: "",
    custom: "",
    phone: "",
    notRegisteredInRussia: false,
    acceptedAutoruExclusive: false,
    popularity_score: 0,
    catalogSource: "cm_business",
    cmStockId: c.cmStockId,
    cmDmsCarId: c.cmDmsCarId,
    stockState: "in",
    sourceUpdatedAt: fetchedAt,
  }));
  dealerCache.set(dealer, { data: parsed, ts: Date.now(), sourceTs: Date.parse(fetchedAt), stale: false });
  if (dealer === TENET_PLUS_DEALER) tenetPlusFailureAt = 0;
  mergedCache = null;
  logger.info({ dealer, count: parsed.length, pagesFetched, rowsScanned }, "new-cars: CM Business stock fetched");
}

function refreshSource(source: { dealer: string; url?: string }): Promise<void> {
  const existing = refreshInFlight.get(source.dealer);
  if (existing) return existing;
  const work = (source.url
    ? refreshDealer({ dealer: source.dealer, url: source.url })
    : refreshCmBusinessDealer(source.dealer as typeof CM_BUSINESS_DEALERS[number]))
    .finally(() => refreshInFlight.delete(source.dealer));
  refreshInFlight.set(source.dealer, work);
  return work;
}

export async function getNewCars(): Promise<NewCarRecord[]> {
  const now = Date.now();
  const staleFeeds = SOURCES.filter(source => {
    const c = dealerCache.get(source.dealer);
    if (source.dealer === TENET_PLUS_DEALER && tenetPlusFailureAt && now - tenetPlusFailureAt < CM_RETRY_MS) return false;
    return !c || now - c.ts >= CACHE_TTL;
  });

  if (staleFeeds.length > 0) {
    const results = await Promise.allSettled(staleFeeds.map(refreshSource));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const feed = staleFeeds[i]!;
        const prev = dealerCache.get(feed.dealer);
        if (feed.dealer === TENET_PLUS_DEALER) tenetPlusFailureAt = now;
        if (prev) {
          logger.warn(
            { dealer: feed.dealer, err: String(r.reason), cachedCount: prev.data.length },
            "new-cars: feed FAILED — using previous cached data as fallback"
          );
          dealerCache.set(feed.dealer, {
            ...prev,
            ts: isCmBusinessDealer(feed.dealer) ? now - CACHE_TTL + CM_RETRY_MS : now,
            stale: true,
          });
        } else {
          logger.error(
            { dealer: feed.dealer, url: feed.url, err: String(r.reason) },
            "new-cars: feed FAILED — no previous cache, dealer will be missing"
          );
        }
        mergedCache = null;
      }
    });
  }

  if (!mergedCache) {
    const data: NewCarRecord[] = [];
    for (const feed of SOURCES) {
      const c = dealerCache.get(feed.dealer);
      if (c) data.push(...c.data);
    }
    mergedCache = data;
    lastMergedAt = now;
  }

  return mergedCache;
}

export function toPublicNewCar({
  catalogSource: _source, cmStockId: _stockId, cmDmsCarId: _dmsId,
  stockState: _stockState, sourceUpdatedAt: _sourceUpdatedAt, ...publicCar
}: NewCarRecord): NewCarRecord {
  return publicCar;
}

export async function getPublicNewCars(): Promise<NewCarRecord[]> {
  const allCars = await getNewCars();
  const publicIdsByDealer = new Map(
    CM_BUSINESS_DEALERS.map(dealer => [dealer, getCmBusinessPublicIdSet(dealer)] as const),
  );
  return allCars
    .filter(car => !isCmBusinessDealer(car.dealer) || publicIdsByDealer.get(car.dealer as typeof CM_BUSINESS_DEALERS[number])?.has(car.id))
    .filter(isPublicNewCarEligible)
    .map(toPublicNewCar);
}

/* ── Debug endpoint: проверить доступность фидов напрямую ── */
router.get("/debug/feeds", async (_req, res) => {
  const checks = await Promise.allSettled(
    SOURCES.map(async (feed) => {
      const start = Date.now();
      try {
        if (!feed.url) {
          const cached = dealerCache.get(feed.dealer);
          return {
            dealer: feed.dealer, source: "cm_business", status: cached && !cached.stale ? 200 : 503,
            cars: cached?.data.length ?? 0, ms: 0, ok: Boolean(cached && !cached.stale),
            cacheAge: cached ? Math.round((Date.now() - cached.ts) / 1000) + "s" : "no cache",
            stale: cached?.stale ?? true,
          };
        }
        const r = await fetch(feed.url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15_000),
        });
        const text = await r.text();
        const parsed = parseFeed(text, feed.dealer);
        const cached = dealerCache.get(feed.dealer);
        return {
          dealer: feed.dealer,
          status: r.status,
          cars: parsed.length,
          ms: Date.now() - start,
          ok: r.ok,
          cacheAge: cached ? Math.round((Date.now() - cached.ts) / 1000) + "s" : "no cache",
          stale: cached?.stale ?? false,
        };
      } catch (err) {
        const cached = dealerCache.get(feed.dealer);
        return {
          dealer: feed.dealer,
          status: 0,
          cars: 0,
          ms: Date.now() - start,
          ok: false,
          error: String(err),
          cacheAge: cached ? Math.round((Date.now() - cached.ts) / 1000) + "s" : "no cache",
          cachedFallback: cached?.data.length ?? 0,
          stale: cached?.stale ?? false,
        };
      }
    })
  );
  return res.json({
    ok: true,
    mergedAt: lastMergedAt ? new Date(lastMergedAt).toISOString() : null,
    results: checks.map((c, i) =>
      c.status === "fulfilled" ? c.value : { dealer: SOURCES[i]!.dealer, error: String((c as PromiseRejectedResult).reason) }
    ),
  });
});

router.get("/cars/new", async (req, res) => {
  try {
    let data = await getPublicNewCars();
    const hasDiscount = req.query.hasDiscount === "true";
    const sort = req.query.sort as string | undefined;
    const limit = parseInt(req.query.limit as string) || 0;

    if (hasDiscount) {
      data = data.filter(c => c.maxDiscount > 0);
    }

    const ids = data.map(c => c.id);
    const rows = ids.length
      ? await db.execute(sql`
          SELECT external_id, popularity_score, created_at, fuel_type,
                 engine_volume, engine_power, engine_source
          FROM cars
          WHERE external_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        `)
      : { rows: [] };
    const metaMap = new Map(
      (rows.rows as {
        external_id: string;
        popularity_score: number;
        created_at: string | null;
        fuel_type: string | null;
        engine_volume: number | null;
        engine_power: number | null;
        engine_source: string | null;
      }[]).map(r => [r.external_id, {
        score: r.popularity_score ?? 0,
        createdAt: r.created_at,
        fuelType: r.fuel_type,
        engineVolume: r.engine_volume,
        enginePower: r.engine_power,
        engineSource: r.engine_source,
      }])
    );

    let enriched = data.map(c => {
      const meta = metaMap.get(c.id) ?? {
        score: 0,
        createdAt: null,
        fuelType: null,
        engineVolume: null,
        enginePower: null,
        engineSource: null,
      };
      return {
        ...c,
        popularity_score: meta.score,
        created_at: meta.createdAt,
        fuelType: meta.fuelType,
        engineVolume: meta.engineVolume,
        enginePower: meta.enginePower,
        engineSource: meta.engineSource,
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

router.post("/cars/views/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE cars SET popularity_score = COALESCE(popularity_score, 0) + 1
      WHERE external_id = ${id}
    `);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
