import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FEEDS = [
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/2c3eb21beb9caa23118a56e042a13187.xml", dealer: "Jaecoo" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/9a822bd39911d610b99ad1b477ec9356.xml", dealer: "Omoda" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/710fe0a03b5a1e47458161bfbfaa9355.xml", dealer: "Tenet" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/f8056db2c70dba547744e2e4aaa20556.xml", dealer: "Haval Pro" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/53fe918374eb87e8f6536b8c3bb21937.xml", dealer: "Haval City" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/913211584f8ad577ee76a703f2f13186.xml", dealer: "Jetour" },
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
}

let cache: { data: NewCarRecord[]; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

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
  "OMODA": "Omoda",
  "EXEED": "Exeed",
  "TANK": "Tank",
  "BYD": "BYD",
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
      id: `${dealer}-${getField(block, "unique_id")}`,
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
    });
  }
  return cars;
}

export async function getNewCars(): Promise<NewCarRecord[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const r = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`${feed.dealer}: HTTP ${r.status}`);
      const text = await r.text();
      const parsed = parseFeed(text, feed.dealer);
      logger.info({ dealer: feed.dealer, count: parsed.length }, "new-cars: feed fetched");
      return parsed;
    })
  );
  const data: NewCarRecord[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      data.push(...result.value);
    } else {
      logger.error({ dealer: FEEDS[i].dealer, url: FEEDS[i].url, err: String(result.reason) }, "new-cars: feed fetch FAILED");
    }
  }
  if (data.length === 0) {
    logger.warn({ feedCount: FEEDS.length }, "new-cars: ALL feeds returned 0 cars — NOT caching empty result");
    return data; // don't cache empty — retry on next call
  }
  cache = { data, ts: Date.now() };
  return data;
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
        return { dealer: feed.dealer, status: r.status, cars: parsed.length, ms: Date.now() - start, ok: r.ok };
      } catch (err) {
        return { dealer: feed.dealer, status: 0, cars: 0, ms: Date.now() - start, ok: false, error: String(err) };
      }
    })
  );
  return res.json({
    ok: true,
    results: checks.map((c, i) => c.status === "fulfilled" ? c.value : { dealer: FEEDS[i].dealer, error: String((c as PromiseRejectedResult).reason) }),
  });
});

router.get("/cars/new", async (_req, res) => {
  try {
    const data = await getNewCars();
    return res.json({ ok: true, data, total: data.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
