import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { slugifyCarId } from "../lib/slugify";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const FEEDS = [
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/2c3eb21beb9caa23118a56e042a13187.xml", dealer: "Jaecoo" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/9a822bd39911d610b99ad1b477ec9356.xml", dealer: "Omoda" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/710fe0a03b5a1e47458161bfbfaa9355.xml", dealer: "Tenet" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/f8056db2c70dba547744e2e4aaa20556.xml", dealer: "Haval Pro" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/53fe918374eb87e8f6536b8c3bb21937.xml", dealer: "Haval City" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/913211584f8ad577ee76a703f2f13186.xml", dealer: "Jetour" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/86abbe9a79571a2757b583e323b27564.xml", dealer: "Soueast" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/35c5c670c873d1d7bb686184b3f27398.xml", dealer: "Jeland" },
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
}

const CACHE_TTL = 30 * 60 * 1000;

interface DealerCache {
  data: NewCarRecord[];
  ts: number;
  stale?: boolean;
}

const dealerCache: Map<string, DealerCache> = new Map();
let lastMergedAt = 0;
let mergedCache: NewCarRecord[] | null = null;

export function clearNewCarsCache() {
  dealerCache.clear();
  mergedCache = null;
  lastMergedAt = 0;
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

export async function getNewCars(): Promise<NewCarRecord[]> {
  const now = Date.now();
  const staleFeeds = FEEDS.filter(f => {
    const c = dealerCache.get(f.dealer);
    return !c || now - c.ts >= CACHE_TTL;
  });

  if (staleFeeds.length > 0) {
    const results = await Promise.allSettled(staleFeeds.map(f => refreshDealer(f)));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const feed = staleFeeds[i];
        const prev = dealerCache.get(feed.dealer);
        if (prev) {
          logger.warn(
            { dealer: feed.dealer, err: String(r.reason), cachedCount: prev.data.length },
            "new-cars: feed FAILED — using previous cached data as fallback"
          );
          dealerCache.set(feed.dealer, { ...prev, ts: now, stale: true });
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
    for (const feed of FEEDS) {
      const c = dealerCache.get(feed.dealer);
      if (c) data.push(...c.data);
    }
    mergedCache = data;
    lastMergedAt = now;
  }

  return mergedCache;
}

/* ── Debug endpoint: проверить доступность фидов напрямую ── */
router.get("/debug/feeds", async (_req, res) => {
  const checks = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const start = Date.now();
      try {
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
      c.status === "fulfilled" ? c.value : { dealer: FEEDS[i].dealer, error: String((c as PromiseRejectedResult).reason) }
    ),
  });
});

router.get("/cars/new", async (req, res) => {
  try {
    let data = await getNewCars();
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
