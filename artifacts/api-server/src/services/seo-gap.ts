/**
 * SEO GAP Analysis Engine.
 * Joins Wordstat × Webmaster × page URLs to identify three types of gaps:
 *   1. meta  — high-demand query, position > 3, low CTR → propose title/description update
 *   2. cluster — related НЧ phrases with combined demand → propose FAQ/text addition
 *   3. tech  — prerender cache missing or too small → page not prerendered
 *
 * priority_score = demand × position_factor × ease
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { loadPrerendered } from "../lib/prerenderStorage";
import { inspectSnapshot, requiresPrerenderSnapshot } from "../lib/routeHealth";
import { aiClusterToFaqs, AI_HALLUCINATION_SIGNAL } from "../lib/seo-ai";
import { webmasterGet } from "./yandex-oauth";
import { getSitemapLocs } from "../routes/sitemap";
import {
  getGeoPageSignals,
  readGeoCitationReport,
} from "../lib/geoCitationReport";

/**
 * Pre-generate 2–3 DIVERSE FAQ pairs for a cluster suggestion using a single
 * batch AI call. Unlike per-query generation, this avoids 5 identical answers
 * by letting the model identify distinct intents across the whole query set.
 *
 * Returns AI_HALLUCINATION_SIGNAL when both AI retry attempts produced hallucinated
 * content — the caller should insert the suggestion with status='rejected'.
 */
async function preGenClusterFaqs(
  queries: string[],
  brandName: string,
  brandSlug: string,
  brandModels: string[],
): Promise<string | typeof AI_HALLUCINATION_SIGNAL> {
  try {
    const result = await aiClusterToFaqs(queries, brandName, "brands/" + brandSlug, brandModels);
    if (result === AI_HALLUCINATION_SIGNAL) {
      logger.warn({ brandName, brandSlug }, "[seo-gap] preGenClusterFaqs: hallucination on both retries → suggestion will be rejected");
      return AI_HALLUCINATION_SIGNAL;
    }
    return JSON.stringify(result);
  } catch (err) {
    logger.warn({ err, brandName }, "[seo-gap] preGenClusterFaqs: batch AI error, using empty");
    return JSON.stringify([]);
  }
}

/* ── Ease factors by suggestion type ─────────────────────────────────── */
const EASE: Record<string, number> = {
  meta: 1.0,
  tech: 0.9,
  sitemap: 0.85, // sitemap/index coverage gaps — easy wins, high impact
  service: 0.7,  // service/corporate page suggestions — lower than meta, higher than text_block
  cluster: 0.6,
  content: 0.6,
  text_block: 0.5,
  new_page: 0.3,
  geo: 0.65,
};

/* ── Page size thresholds for tech gap detection (bytes) ─────────────── */
const TECH_THRESHOLDS: Record<string, number> = {
  brand: 35_000,  // was 50k — /brands/s-probegom has no new-car catalog so weighs ~49KB (real content)
  car: 30_000,
  default: 20_000,
};

/* ── Cluster quality thresholds — tuned for regional low-traffic site ─── */
/** Min Webmaster shows for a query to count in cluster analysis          */
const CLUSTER_MIN_SHOWS             = 5;   // was 10 — expanded to catch 5–9 show queries
/** Min shows for related Wordstat queries to feed model-content step     */
const RELATED_MIN_SHOWS             = 15;  // was 30
/** Min total demand (sum of shows) for a brand cluster to be proposed   */
const CLUSTER_MIN_DEMAND            = 15;  // was 30
/** Min total demand for generic (non-brand) /cars cluster               */
const GENERIC_CLUSTER_MIN_DEMAND    = 50;  // was 100
/** Min Wordstat total demand for seed-fallback brand clusters           */
const SEED_CLUSTER_MIN_DEMAND       = 20;  // was 40
/** Total demand above which only 1 query is needed for a cluster        */
const CLUSTER_HIGH_DEMAND_THRESHOLD = 50;  // was 100
/** Min total model-level shows for a content suggestion                 */
const CONTENT_MIN_SHOWS             = 5;   // was 10 — expanded to catch low-traffic model queries
/** Karpathy positive evaluation priority boost                          */
const KARPATHY_POSITIVE_BOOST       = 1.2;
/** Karpathy negative evaluation priority discount                       */
const KARPATHY_NEGATIVE_DISCOUNT    = 0.5;

/* ── Automotive relevance filter ──────────────────────────────────────── */

/**
 * Queries matching any of these patterns are always rejected, even if they
 * contain an automotive-looking substring (e.g. "диагностический центр" hits
 * "диагностик", "официальный сайт администрации" hits "официальн").
 */
const BLACKLIST_PATTERNS: readonly string[] = [
  // медицина
  "диагностический центр", "клинико", "поликлиник", "больниц", "госпиталь",
  "стоматолог", "аптек", "медицин", "санатори", "хирург",
  // власть и госорганы
  "администрация", "правительство", "прокуратур", "полици", "мчс",
  "министерств", "департамент", "инспекци", "фсб", "росгвардия",
  // суды, законодательство
  " суд", "судьб", "прокурор", "адвокат", "юрист", "нотариус",
  // образование
  "университет", "институт", "академия", "школа", "колледж", "детский сад",
  "курсы", "репетитор",
  // торговля (не авто)
  "супермаркет", "гипермаркет", "торговый центр", "рынок", "магазин продукт",
  "оби", "леруа", "икеа", "ашан",
  // новости, события, погода
  "новости", "погода", "афиша", "концерт", "выставк",
  // занятость
  "вакансии", "работа в", "резюме",
  // недвижимость (не авто)
  "квартир", "недвижимост", "риэлтор", "ипотека на квартир",
  // питание
  "вкусно и точка", "мак", "пиццерия", "ресторан", "кафе",
];

/**
 * Automotive terms whitelist (partial match / stem-like).
 * Deliberately excludes terms that are too generic on their own
 * ("официальн" → "официальный сайт администрации"; "диагностик" → мед. центр).
 */
const AUTOMOTIVE_TERMS: readonly string[] = [
  // покупка
  "купит", "куплю", "продаж", "цен", "стоимост", "прайс",
  // авто
  "авто", "автомобил", "машин", "легков",
  // дилер / точка продаж
  "дилер", "автосалон", "автоцентр",
  // финансирование
  "кредит", "трейд-ин", "trade-in", "рассрочк", "лизинг",
  "ежемесячн", "первоначальн взнос",
  // сервис (специфичные для авто)
  "автосервис", "техобслуживан", "замена масл", "замена резин",
  "кузовной ремонт", "автозапчаст", "запчаст для авто",
  "гарантийный ремонт", "постгарантийный",
  // характеристики
  "комплектаци", "модификаци", "кузов авто", "двигател",
  "привод", "расход топлив", "мощност", "клиренс",
  // тип кузова
  "седан", "внедорожник", "кроссовер", "хэтчбек", "минивэн",
  "паркетник", "пикап", "универсал",
];

/**
 * Returns true if a query is automotive-relevant.
 * Priority:
 *   1. If query matches a blacklist pattern → always reject.
 *   2. If query contains a brand keyword → accept (brand-specific query).
 *   3. If query contains an automotive term → accept.
 *   Otherwise → reject.
 */
function isAutomotiveQuery(query: string, brandKeywords: string[]): boolean {
  const q = query.toLowerCase();

  // 1. Hard reject non-automotive topics regardless of other signals
  if (BLACKLIST_PATTERNS.some(p => q.includes(p.toLowerCase()))) return false;

  // 2. Brand keyword → highly likely automotive
  if (brandKeywords.some(kw => q.includes(kw.toLowerCase()))) return true;

  // 3. Automotive vocabulary
  if (AUTOMOTIVE_TERMS.some(term => q.includes(term.toLowerCase()))) return true;

  return false;
}

/* ── Brand → slug mapping ─────────────────────────────────────────────── */
/* ── Model canonical map: Latin ↔ Cyrillic equivalent pairs ─────────── */
// key: canonical lookup key (lowercase, no spaces)
// display: preferred display form for Russian FAQ text
// variants: all forms that should resolve to this canonical (lowercase, no spaces)
const MODEL_CANONICAL_MAP: { key: string; display: string; variants: string[] }[] = [
  // Haval
  { key: "jolion",  display: "ДЖОЛИОН", variants: ["jolion", "джолион"] },
  { key: "dargo",   display: "ДАРГО",   variants: ["dargo", "дарго"] },
  { key: "f7x",     display: "F7X",     variants: ["f7x", "ф7х"] },
  { key: "f7",      display: "F7",      variants: ["f7", "ф7"] },
  { key: "m6",      display: "M6",      variants: ["m6", "м6"] },
  // Jetour
  { key: "dashing", display: "Dashing", variants: ["dashing", "дашинг"] },
  // OMODA
  { key: "omoda-c5", display: "OMODA C5", variants: ["omoda c5", "омода с5", "омода c5", "омодас5"] },
  { key: "omoda-c7", display: "OMODA C7", variants: ["omoda c7", "омода с7", "омода c7", "омодас7"] },
  { key: "omoda-s5", display: "OMODA S5", variants: ["omoda s5", "омода s5", "омодаs5"] },
  // JAECOO
  { key: "jaecoo-j6", display: "JAECOO J6", variants: ["jaecoo j6", "джаеку j6", "джейку j6"] },
  { key: "jaecoo-j7", display: "JAECOO J7", variants: ["jaecoo j7", "джаеку j7", "джейку j7"] },
  { key: "jaecoo-j8", display: "JAECOO J8", variants: ["jaecoo j8", "джаеку j8", "джейку j8"] },
  // Tenet
  { key: "tenet-arrizo", display: "Arrizo", variants: ["arrizo", "арризо"] },
  { key: "tenet-t4l",    display: "T4L",    variants: ["t4l"] },
  { key: "tenet-t7",     display: "T7",     variants: ["tenet t7"] },
  { key: "tenet-t8",     display: "T8",     variants: ["tenet t8"] },
];

// Flat lookup: normalised variant → { key, display }
const _canonicalLookup = new Map<string, { key: string; display: string }>();
for (const entry of MODEL_CANONICAL_MAP) {
  for (const v of entry.variants) {
    _canonicalLookup.set(v.replace(/\s+/g, ""), { key: entry.key, display: entry.display });
  }
}

function _normVariant(term: string): string {
  return term.toLowerCase().replace(/\s+/g, "");
}

/** Returns a stable dedup key (e.g. "jolion" for both "JOLION" and "ДЖОЛИОН"). */
function canonicalModelKey(term: string): string {
  return _canonicalLookup.get(_normVariant(term))?.key ?? _normVariant(term);
}

/** Returns preferred display string (Cyrillic/conventional) for FAQ text. */
function canonicalModelDisplay(term: string): string {
  return _canonicalLookup.get(_normVariant(term))?.display ?? term.toUpperCase();
}

interface BrandEntry { keywords: string[]; modelKeywords: string[]; slug: string; brandName: string }

const BRAND_KEYWORDS: BrandEntry[] = [
  {
    keywords: ["haval", "хавал", "jolion", "джолион", "f7", "ф7", "h9", "m6", "м6", "dargo", "дарго", "f7x", "ф7х"],
    modelKeywords: ["jolion", "джолион", "дарго", "dargo", "f7x", "ф7х", "f7 ", "ф7 ", "h9", "m6", "м6"],
    slug: "haval-city", brandName: "Haval City",
  },
  {
    keywords: ["omoda", "омода", "c5", "c7", "s5"],
    modelKeywords: ["c5", "c7", "s5"],
    slug: "omoda", brandName: "OMODA",
  },
  {
    keywords: ["jaecoo", "джаеку", "джейку", "j6", "j7", "j8"],
    modelKeywords: ["j6", "j7", "j8"],
    slug: "jaecoo", brandName: "JAECOO",
  },
  {
    keywords: ["jetour", "джетур", "x70", "x90", "dashing", "дашинг", "t1", "t2"],
    modelKeywords: ["x70", "x90", "dashing", "дашинг", "t1", "t2"],
    slug: "jetour", brandName: "Jetour",
  },
  {
    keywords: ["tenet", "тенет", "arrizo", "t4l", "t4 ", "t7", "t8"],
    modelKeywords: ["arrizo", "t4l", "t4 ", "t7", "t8"],
    slug: "tenet", brandName: "Tenet",
  },
  {
    keywords: ["soueast", "соуист"],
    modelKeywords: [],
    slug: "soueast", brandName: "Soueast",
  },
  {
    keywords: ["mercedes", "мерседес", "mb", "мб"],
    modelKeywords: [],
    slug: "mercedes-benz", brandName: "Mercedes-Benz",
  },
  {
    keywords: ["volkswagen", "фольксваген", "vw", "фв"],
    modelKeywords: [],
    slug: "volkswagen", brandName: "Volkswagen",
  },
  {
    keywords: ["skoda", "шкода"],
    modelKeywords: [],
    slug: "skoda", brandName: "SKODA",
  },
  {
    keywords: ["exeed", "эксид"],
    modelKeywords: [],
    slug: "exeed", brandName: "Exeed",
  },
];

function matchBrand(query: string): (BrandEntry & { slug: string; brandName: string }) | null {
  const q = query.toLowerCase();
  for (const entry of BRAND_KEYWORDS) {
    if (entry.keywords.some((kw: string) => q.includes(kw))) {
      return entry;
    }
  }
  return null;
}

function detectPageType(url: string): string {
  if (url.startsWith("/brands/")) return "brand";
  if (url.startsWith("/new-cars/") || url.startsWith("/cars/")) return "car";
  return "default";
}

/* ── Check prerender cache via disk (VPS-safe, no curl) ──────────────── */
/**
 * Three-state result:
 *   isCacheAvailable=false → cache root doesn't exist (Replit / dev env) → skip TECH suggestions entirely
 *   isCacheAvailable=true, isTechGap=false → page is cached and large enough → no problem
 *   isCacheAvailable=true, isTechGap=true  → cache root exists but this page is missing/undersized → real gap
 */
async function checkTechGap(url: string): Promise<{
  size: number;
  isTechGap: boolean;
  isCacheAvailable: boolean;
  threshold: number;
  reason?: string;
}> {
  // seoMeta/SSG routes deliberately have no Puppeteer cache. Treating that as a
  // gap creates permanent false positives for news, promotions and static pages.
  if (!requiresPrerenderSnapshot(url)) {
    return { size: 0, isTechGap: false, isCacheAvailable: false, threshold: 0 };
  }
  const pageType = detectPageType(url);
  const threshold = TECH_THRESHOLDS[pageType] ?? TECH_THRESHOLDS.default;

  // First confirm the cache infrastructure itself is reachable.
  // listPrerenderedRoutes() does a readdir on the cache root; if it returns
  // an empty list AND the root didn't throw, the dir exists but is empty.
  // If the root doesn't exist it returns [] without throwing (see prerenderStorage.ts).
  // So we use a direct existsSync check on the cache root instead.
  let cacheRootExists = false;
  try {
    const { existsSync } = await import("fs");
    const path = await import("path");
    // Resolve the same cache dir that loadPrerendered uses
    const cacheDir =
      process.env.LOCAL_PRERENDER_CACHE_DIR ||
      path.resolve(__dirname, "../prerender-cache");
    cacheRootExists = existsSync(cacheDir);
  } catch {
    // Can't even check — treat as unavailable
      return { size: 0, isTechGap: false, isCacheAvailable: false, threshold };
  }

  if (!cacheRootExists) {
    // Running on Replit or another env without the VPS cache mount — skip TECH checks.
    return { size: 0, isTechGap: false, isCacheAvailable: false, threshold };
  }

  // Cache root is present: now check the specific page.
  try {
    const html = await loadPrerendered(url);
    if (!html) {
      // Root exists but this page has no cached file → real gap.
      return { size: 0, isTechGap: true, isCacheAvailable: true, threshold, reason: "файл отсутствует в кэше" };
    }
    const size = Buffer.byteLength(html, "utf-8");
    if (url.startsWith("/brands/")) {
      const issues = inspectSnapshot(url, html, true);
      if (issues.length > 0) {
        return { size, isTechGap: true, isCacheAvailable: true, threshold, reason: issues.join("; ") };
      }
    }
    return { size, isTechGap: size < threshold, isCacheAvailable: true, threshold, reason: size < threshold ? "кэш слишком мал" : undefined };
  } catch {
    // Unexpected read error — don't guess, treat as no gap.
    return { size: 0, isTechGap: false, isCacheAvailable: true, threshold };
  }
}

/* ── Meta proposal generator (deterministic, no LLM) ─────────────────── */
async function buildMetaProposal(
  pageUrl: string,
  topQuery: string,
  avgPosition: number,
): Promise<{ currentTitle: string; currentDesc: string; proposedTitle: string; proposedDesc: string } | null> {
  const formatPrice = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);

  // ── /cars — авто с пробегом ──────────────────────────────────────────
  if (pageUrl === "/cars") {
    const usedData = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt,
             MIN(price)::int AS min_price
      FROM cars WHERE type = 'used'
    `);
    const ud = usedData.rows[0] as { cnt: number; min_price: number | null } | undefined;
    const cnt = ud?.cnt ?? 0;
    const pricePart = ud?.min_price && ud.min_price > 0 ? ` от ${formatPrice(ud.min_price)} ₽` : "";
    const currentTitle = "Авто с пробегом в Брянске | Дебрянск Авто";
    const currentDesc = "";
    // Try to extract body type from topQuery for a more specific title
    const USED_BODY_TYPES: [string, string][] = [
      ["кроссовер", "Кроссоверы с пробегом"],
      ["внедорожник", "Внедорожники с пробегом"],
      ["седан", "Седаны с пробегом"],
      ["хэтчбек", "Хэтчбеки с пробегом"],
      ["минивэн", "Минивэны с пробегом"],
      ["пикап", "Пикапы с пробегом"],
      ["купе", "Купе с пробегом"],
    ];
    const qLowerCars = topQuery.toLowerCase();
    const usedBodyPrefix = USED_BODY_TYPES.find(([kw]) => qLowerCars.includes(kw))?.[1];
    const proposedTitle = usedBodyPrefix
      ? `${usedBodyPrefix} в Брянске | Дебрянск Авто`
      : cnt > 0
        ? `Авто с пробегом в Брянске — ${cnt}+ авто${pricePart} | Дебрянск Авто`
        : `Авто с пробегом в Брянске — официальный дилер | Дебрянск Авто`;
    let proposedDesc = `Купить проверенное авто с пробегом в Брянске${pricePart}. Юридически чистые автомобили с гарантией. Трейд-ин, кредит, быстрое оформление.`;
    if (proposedDesc.length > 160) proposedDesc = proposedDesc.slice(0, 157) + "...";
    return { currentTitle, currentDesc, proposedTitle, proposedDesc };
  }

  // ── /new-cars — новые автомобили ─────────────────────────────────────
  if (pageUrl === "/new-cars") {
    const newData = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt,
             MIN(price)::int AS min_price,
             ARRAY_AGG(DISTINCT INITCAP(LOWER(TRIM(dealer)))) FILTER (WHERE dealer IS NOT NULL) AS brands
      FROM cars WHERE type = 'new'
    `);
    const nd = newData.rows[0] as { cnt: number; min_price: number | null; brands: string[] | null } | undefined;
    const cnt = nd?.cnt ?? 0;
    const pricePart = nd?.min_price && nd.min_price > 0 ? ` от ${formatPrice(nd.min_price)} ₽` : "";
    const topBrands = ((nd?.brands ?? []) as string[]).slice(0, 4).join(", ");
    const currentTitle = "Новые автомобили в Брянске | Дебрянск Авто";
    const currentDesc = "";
    // Try to extract body type from topQuery for a more specific title
    const NEW_BODY_TYPES: [string, string][] = [
      ["кроссовер", "Новые кроссоверы"],
      ["внедорожник", "Новые внедорожники"],
      ["седан", "Новые седаны"],
      ["хэтчбек", "Новые хэтчбеки"],
      ["минивэн", "Новые минивэны"],
    ];
    const qLowerNew = topQuery.toLowerCase();
    const newBodyPrefix = NEW_BODY_TYPES.find(([kw]) => qLowerNew.includes(kw))?.[1];
    const proposedTitle = newBodyPrefix
      ? `${newBodyPrefix} в Брянске — официальный дилер | Дебрянск Авто`
      : "Новые автомобили в Брянске — официальный дилер | Дебрянск Авто";
    let proposedDesc = `Купить новый автомобиль в Брянске${pricePart}. Официальный дилер${topBrands ? `: ${topBrands}` : ""}. Кредит, трейд-ин, гарантия производителя.`;
    if (proposedDesc.length > 160) proposedDesc = proposedDesc.slice(0, 157) + "...";
    return { currentTitle, currentDesc, proposedTitle, proposedDesc };
  }

  if (!pageUrl.startsWith("/brands/")) return null;

  const slug = pageUrl.replace("/brands/", "");
  const brandRow = await db.execute(sql`
    SELECT b.id, b.name, b.is_service_only,
           bpc.meta_title, bpc.meta_description
    FROM brands b
    LEFT JOIN brand_page_content bpc ON bpc.brand_id = b.id
    WHERE b.slug = ${slug}
    LIMIT 1
  `);

  const brand = brandRow.rows[0] as {
    id: number;
    name: string;
    is_service_only: boolean;
    meta_title: string | null;
    meta_description: string | null;
  } | undefined;

  if (!brand) return null;

  const currentTitle = brand.meta_title || `${brand.name} в Брянске | Дебрянск Авто`;
  const currentDesc = brand.meta_description || "";

  // Pull car data
  const carData = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt,
           MIN(price)::int AS min_price,
           MAX(max_discount)::int AS max_discount,
           ARRAY_AGG(DISTINCT TRIM(SPLIT_PART(model, ',', 1))) FILTER (WHERE model IS NOT NULL) AS models
    FROM cars WHERE type = 'new' AND LOWER(dealer) = LOWER(${brand.name})
  `);
  const cd = carData.rows[0] as {
    cnt: number; min_price: number | null; max_discount: number | null; models: string[] | null;
  } | undefined;

  const dealerType = brand.is_service_only ? "официальный сервис" : "официальный дилер";

  // Try to find a model name from topQuery using actual inventory models
  let modelSegment = "";
  if (topQuery && !brand.is_service_only && cd) {
    const qLower = topQuery.toLowerCase();
    const rawModels = (cd.models ?? []) as string[];
    for (const model of rawModels) {
      if (!model) continue;
      const parts = model.toLowerCase().split(/[\s\-]/);
      if (parts.some(p => p.length > 2 && qLower.includes(p))) {
        modelSegment = ` ${model}`;
        break;
      }
    }
  }
  const titleWithModel = `${brand.name}${modelSegment} в Брянске — ${dealerType} | Дебрянск Авто`;
  // Fall back to brand-only if the combined title exceeds 65 chars
  const proposedTitle = titleWithModel.length <= 65
    ? titleWithModel
    : `${brand.name} в Брянске — ${dealerType} | Дебрянск Авто`;

  let proposedDesc = "";
  if (brand.is_service_only) {
    proposedDesc = `Официальное гарантийное и постгарантийное обслуживание ${brand.name} в Брянске. Диагностика, ремонт, оригинальные запчасти.`;
  } else if (cd && cd.cnt > 0) {
    const pricePart = cd.min_price ? ` от ${formatPrice(cd.min_price)} ₽` : "";
    const discPart = cd.max_discount && cd.max_discount > 0 ? `, выгода до ${formatPrice(cd.max_discount)} ₽` : "";
    const models = (cd.models ?? []).slice(0, 3).join(", ");
    const modelPart = models ? `. Модели в наличии: ${models}` : "";
    proposedDesc = `Купить ${brand.name} в Брянске у официального дилера${pricePart}${discPart}${modelPart}. Кредит, трейд-ин, гарантия.`;
  } else {
    proposedDesc = `Официальный дилер ${brand.name} в Брянске. Покупка нового автомобиля в кредит, трейд-ин, гарантийный сервис.`;
  }

  if (proposedDesc.length > 160) proposedDesc = proposedDesc.slice(0, 157) + "...";

  return { currentTitle, currentDesc, proposedTitle, proposedDesc };
}

let isGapRunning = false;
let currentRunId: number | null = null;

export function isGapRunning_(): boolean { return isGapRunning; }
export function currentGapRunId(): number | null { return currentRunId; }

/* ── Петля Карпаты: priority discount for pages with negative evaluations ─ */
/**
 * Applies Karpathy Loop priority multipliers:
 *  • "fell" or "falsified" evaluation → ×KARPATHY_NEGATIVE_DISCOUNT (0.5)
 *  • "improved" evaluation           → ×KARPATHY_POSITIVE_BOOST    (1.2)
 * Key format: `${pageUrl}:${type}` so that a bad "meta" result on /brands/haval-city
 * does NOT penalise the separate "cluster" suggestion for the same page.
 */
function applyFeedbackDiscount(
  score: number,
  pageUrl: string,
  type: string,
  feedbackMap: Map<string, string>,
  positiveSet: Set<string> = new Set(),
): number {
  const key = `${pageUrl}:${type}`;
  if (feedbackMap.has(key)) return score * KARPATHY_NEGATIVE_DISCOUNT;
  if (positiveSet.has(key))  return score * KARPATHY_POSITIVE_BOOST;
  return score;
}

/**
 * GEO is intentionally a separate signal. It has no Wordstat demand and no
 * Yandex position, so legacy demand/position columns stay zero for backwards
 * compatibility while priority_score uses only observed AI responses.
 */
async function runGeoGapStep(): Promise<number> {
  let report;
  try {
    report = await readGeoCitationReport();
  } catch (err) {
    logger.warn({ err }, "[seo-gap] GEO report read failed — skipping GEO step");
    return 0;
  }

  let indexablePaths: Set<string>;
  try {
    indexablePaths = await getSitemapLocs();
  } catch (err) {
    logger.warn({ err }, "[seo-gap] Could not load sitemap paths — skipping GEO step");
    return 0;
  }

  const result = getGeoPageSignals(report, indexablePaths);
  if (result.status !== "ready") {
    logger.info(
      { reportStatus: report.status, geoStatus: result.status, reason: result.reason },
      "[seo-gap] GEO step skipped",
    );
    return 0;
  }

  const activeRows = await db.execute(sql`
    SELECT page_url, type, status
    FROM seo_suggestions
    WHERE status = 'pending'
       OR status = 'manual'
       OR (status = 'applied' AND evaluated_at IS NULL)
  `);
  const activeByPage = new Map<string, { type: string; status: string }[]>();
  for (const row of activeRows.rows as { page_url: string; type: string; status: string }[]) {
    const list = activeByPage.get(row.page_url) ?? [];
    list.push(row);
    activeByPage.set(row.page_url, list);
  }

  const geoFeedbackRows = await db.execute(sql`
    SELECT page_url
    FROM seo_suggestions
    WHERE type = 'geo'
      AND geo_evaluation_result IN ('fell', 'falsified')
      AND geo_evaluated_at >= NOW() - INTERVAL '90 days'
  `).catch(err => {
    logger.warn({ err }, "[seo-gap] Could not load GEO evaluation feedback");
    return { rows: [] };
  });
  const negativeFeedback = new Set(
    (geoFeedbackRows.rows as { page_url: string }[]).map(row => row.page_url),
  );

  let generated = 0;
  for (const signal of result.signals) {
    const active = activeByPage.get(signal.pageUrl) ?? [];
    const hasActiveGeo = active.some(row => row.type === "geo");
    if (hasActiveGeo) continue;

    const competing = active.filter(row => row.type !== "geo");
    if (competing.length > 0) {
      logger.info(
        { pageUrl: signal.pageUrl, competingTypes: competing.map(row => row.type) },
        "[seo-gap] GEO opportunity deferred because another active hypothesis owns the page",
      );
      continue;
    }

    if (signal.citationRatePct > 25 || signal.noCitationRatePct < 50) continue;

    const noCitationRate = signal.noCitationRatePct / 100;
    const mentionRate = signal.mentionRatePct / 100;
    const coverageFactor = Math.min(signal.responses / 12, 1);
    const providerFactor = Math.min(signal.providerCount / 2, 1);
    const feedbackFactor = negativeFeedback.has(signal.pageUrl) ? 0.5 : 1;
    const priorityScore = Math.round(
      100 * noCitationRate * (0.5 + mentionRate * 0.5) *
      coverageFactor * providerFactor * EASE.geo * feedbackFactor * 10,
    ) / 10;

    const evidence = {
      pageUrl: signal.pageUrl,
      reportWeek: signal.reportWeek,
      reportUpdatedAt: signal.reportUpdatedAt,
      responses: signal.responses,
      mentions: signal.mentions,
      citations: signal.citations,
      mentionRatePct: signal.mentionRatePct,
      citationRatePct: signal.citationRatePct,
      noCitationRatePct: signal.noCitationRatePct,
      coveragePct: signal.coveragePct,
      providers: signal.providers,
      queryIds: signal.queryIds,
      queries: signal.queries,
      observedCitedPages: signal.citedPages,
      targetPageMissingFromObservedCitations: true,
    };
    const proposedValue = [
      "Ручное ТЗ по GEO:",
      `1. Добавить на страницу ${signal.pageUrl} прямой ответ на интент: ${signal.queries.slice(0, 3).join("; ")}.`,
      "2. Связать ответ с релевантными разделами сайта внутренними ссылками.",
      "3. Проверить FAQ и структурированные данные, не добавляя неподтверждённые факты.",
      "Измерение повторить после публикации отдельным GEO-замером.",
    ].join("\n");
    const reasoning =
      `GEO-наблюдение за ${signal.reportWeek}: ${signal.responses} фактических ответов ` +
      `от ${signal.providerCount} провайд. Упоминание страницы/бренда — ${signal.mentionRatePct}%, ` +
      `цитирование целевого URL — ${signal.citationRatePct}%. ` +
      `В ${signal.citations === 0 ? "ответах не наблюдалась" : `${signal.responses - signal.citations} из ${signal.responses} ответов не наблюдалась`} ` +
      `ссылка на ${signal.pageUrl}. Это отсутствие наблюдаемой ссылки, а не список несуществующих URL.`;

    const insert = await db.execute(sql`
      INSERT INTO seo_suggestions
        (type, page_url, current_value, proposed_value, reasoning,
         priority_score, demand, position_factor, ease, status,
         geo_evidence, geo_action)
      VALUES
        ('geo', ${signal.pageUrl},
         ${JSON.stringify(evidence)},
         ${proposedValue},
         ${reasoning},
         ${priorityScore}, 0, 0, ${EASE.geo}, 'pending',
         ${JSON.stringify(evidence)}::jsonb, 'manual_brief')
      ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
        current_value = EXCLUDED.current_value,
        proposed_value = EXCLUDED.proposed_value,
        reasoning = EXCLUDED.reasoning,
        priority_score = EXCLUDED.priority_score,
        demand = 0,
        position_factor = 0,
        ease = EXCLUDED.ease,
        geo_evidence = EXCLUDED.geo_evidence,
        geo_action = EXCLUDED.geo_action,
        status = CASE WHEN seo_suggestions.status IN ('pending', 'manual') THEN seo_suggestions.status ELSE 'pending' END,
        updated_at = NOW()
      RETURNING id
    `);
    generated += insert.rows.length;
    activeByPage.set(signal.pageUrl, [{ type: "geo", status: "pending" }]);
    logger.info(
      { pageUrl: signal.pageUrl, responses: signal.responses, citationRatePct: signal.citationRatePct },
      "[seo-gap] GEO suggestion created",
    );
  }

  return generated;
}

/* ── Main GAP analysis function ───────────────────────────────────────── */
export async function runGapAnalysis(triggeredBy: "manual" | "auto" = "manual"): Promise<{ generated: number; skipped: boolean }> {
  if (isGapRunning) {
    logger.warn("[seo-gap] Already running");
    return { generated: 0, skipped: true };
  }

  isGapRunning = true;
  let generated = 0;
  const startedAt = Date.now();

  // Insert run log record
  const runRow = await db.execute(sql`
    INSERT INTO gap_runs (status, triggered_by, started_at)
    VALUES ('running', ${triggeredBy}, NOW())
    RETURNING id
  `);
  const runId = (runRow.rows[0] as { id: number }).id;
  currentRunId = runId;

  try {
    logger.info("[seo-gap] Starting GAP analysis");

    // 0-pre. Clean up stale new_page suggestions for pages that already exist on the site.
    // Real new_page suggestions are only ever for /p/* landing pages. Any new_page for a
    // site route (/, /news, /contacts, /about, /brands/*, etc.) was created by the old
    // buggy SITE_WIDE COVERAGE logic and must be removed before each run.
    const staleCleanup = await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'rejected',
          reject_reason = 'Страница уже существует на сайте — автоматически отклонено GAP',
          updated_at = NOW()
      WHERE type = 'new_page'
        AND page_url NOT LIKE '/p/%'
        AND status = 'pending'
      RETURNING id
    `);
    if (staleCleanup.rows.length > 0) {
      logger.info(
        { count: staleCleanup.rows.length },
        "[seo-gap] Cleaned up stale new_page suggestions for existing pages",
      );
    }

    // A pending card for a page/type becomes stale as soon as an equivalent
    // change has been applied and is waiting for Karpathy evaluation. Old GAP
    // runs could leave these rows behind after the applied row stopped taking
    // part in the active unique index, which made the same finding reappear.
    const supersededCleanup = await db.execute(sql`
      UPDATE seo_suggestions pending
      SET status = 'rejected',
          reject_reason = 'Аналогичная находка уже применена и ожидает оценку Петли Карпаты',
          updated_at = NOW()
      WHERE pending.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM seo_suggestions applied
          WHERE applied.type = pending.type
            AND applied.page_url = pending.page_url
            AND applied.status = 'applied'
            AND applied.evaluated_at IS NULL
        )
      RETURNING pending.id
    `);
    if (supersededCleanup.rows.length > 0) {
      logger.info(
        { count: supersededCleanup.rows.length },
        "[seo-gap] Rejected pending suggestions superseded by unevaluated applied changes",
      );
    }

    // 0. Load Петля Карпаты feedback
    //    • fell / falsified → 0.5× priority discount
    //    • improved         → 1.2× priority boost (positive reinforcement)
    let feedbackMap = new Map<string, string>();
    let positivePageSet = new Set<string>();
    try {
      const { getEvaluationFeedback } = await import("./seo-evaluator");
      feedbackMap = await getEvaluationFeedback();
      if (feedbackMap.size > 0) {
        logger.info({ discountedPages: feedbackMap.size }, "[seo-gap] Applying Karpathy Loop negative discounts");
      }
    } catch (fbErr) {
      logger.warn({ fbErr }, "[seo-gap] Could not load evaluation feedback — proceeding without discounts");
    }
    try {
      const posRows = await db.execute(sql`
        SELECT page_url, type FROM seo_suggestions
        WHERE evaluation_result = 'improved'
      `);
      for (const r of posRows.rows as { page_url: string; type: string }[]) {
        positivePageSet.add(`${r.page_url}:${r.type}`);
      }
      if (positivePageSet.size > 0) {
        logger.info({ boostedPages: positivePageSet.size }, "[seo-gap] Applying Karpathy Loop positive boosts (×1.2)");
      }
    } catch (posErr) {
      logger.warn({ posErr }, "[seo-gap] Could not load positive Karpathy feedback — proceeding without boost");
    }

    // 0.6. Load active anchor queries with unmet targets
    //      • used to apply ×1.5 priority boost to pages with active anchors below target
    //      • also used in step 6.5 to force meta recommendations for pages not in standard sources
    let anchorPageUrls = new Set<string>();
    const anchorPageQueries = new Map<string, string[]>(); // page_url → [query_text, ...]
    try {
      const anchorRows = await db.execute(sql`
        SELECT a.page_url, a.query_text
        FROM seo_anchor_queries a
        LEFT JOIN LATERAL (
          SELECT avg_position
          FROM seo_query_snapshots
          WHERE query_text ILIKE a.query_text
          ORDER BY snapshot_date DESC
          LIMIT 1
        ) s ON true
        WHERE a.is_active = true
          AND (s.avg_position IS NULL OR s.avg_position > a.target_position)
        ORDER BY a.page_url, a.query_text
      `);
      for (const r of anchorRows.rows as { page_url: string; query_text: string }[]) {
        anchorPageUrls.add(r.page_url);
        if (!anchorPageQueries.has(r.page_url)) anchorPageQueries.set(r.page_url, []);
        anchorPageQueries.get(r.page_url)!.push(r.query_text);
      }
      if (anchorPageUrls.size > 0) {
        logger.info({ count: anchorPageUrls.size, urls: [...anchorPageUrls] }, "[seo-gap] Anchor pages loaded for priority boost + forced coverage");
      }
    } catch (anchorErr) {
      logger.warn({ anchorErr }, "[seo-gap] Could not load anchor queries — proceeding without boost");
    }

    // 0.5. Reset rejected suggestions older than 30 days so GAP can re-propose them.
    // Exclude new_page suggestions for pages that already exist on the site (non-/p/* routes)
    // — those are permanently invalid and must never be re-proposed regardless of age.
    const expiredReset = await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'pending', updated_at = NOW()
      WHERE status = 'rejected'
        AND updated_at < NOW() - INTERVAL '30 days'
        AND NOT (type = 'new_page' AND page_url NOT LIKE '/p/%')
      RETURNING id
    `);
    if (expiredReset.rows.length > 0) {
      logger.info({ resetCount: expiredReset.rows.length }, "[seo-gap] Reset expired rejected suggestions → pending");
    }

    // 1. Freshness guard — check age of both data sources before doing any work
    const STALE_DAYS = 12;
    const freshnessRow = await db.execute(sql`
      SELECT
        (SELECT MAX(snapshot_date) FROM wordstat_snapshots)   AS wordstat_date,
        (SELECT MAX(snapshot_date) FROM seo_query_snapshots)  AS webmaster_date
    `);
    const freshness = freshnessRow.rows[0] as { wordstat_date: string | null; webmaster_date: string | null };
    const daysSince = (d: string | null) => {
      if (!d) return Infinity;
      return (Date.now() - new Date(d).getTime()) / 86_400_000;
    };
    const wordstatAge  = daysSince(freshness.wordstat_date);
    const webmasterAge = daysSince(freshness.webmaster_date);

    if (wordstatAge > STALE_DAYS && webmasterAge > STALE_DAYS) {
      const msg = `Данные устарели: Wordstat=${freshness.wordstat_date ?? "нет"} (${Math.round(wordstatAge)}д), Webmaster=${freshness.webmaster_date ?? "нет"} (${Math.round(webmasterAge)}д). Порог: ${STALE_DAYS} дней.`;
      logger.warn({ wordstatAge, webmasterAge, staleDays: STALE_DAYS }, `[seo-gap] ${msg}`);
      const geoGenerated = await runGeoGapStep();
      await db.execute(sql`
        UPDATE gap_runs SET status='completed', completed_at=NOW(),
          duration_ms=${Date.now() - startedAt}, suggestions_created=${geoGenerated},
          wordstat_rows=0, webmaster_rows=0,
          error_message=${msg}
        WHERE id=${runId}
      `);
      return { generated: geoGenerated, skipped: false };
    }

    // 2. Load latest Wordstat snapshot (seeds + related, no cap)
    const wordstatRows = await db.execute(sql`
      SELECT query, shows_count, source, parent_query
      FROM wordstat_snapshots
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM wordstat_snapshots)
        AND shows_count > 0
      ORDER BY shows_count DESC
      LIMIT 2000
    `);
    type WsRow = { query: string; shows_count: number; source: string; parent_query: string | null };
    const wordstatData = wordstatRows.rows as WsRow[];

    if (wordstatData.length === 0) {
      logger.warn("[seo-gap] No Wordstat data — run wordstat fetch first");
      await db.execute(sql`
        UPDATE gap_runs SET status='completed', completed_at=NOW(),
          duration_ms=${Date.now() - startedAt}, suggestions_created=0,
          wordstat_rows=0, webmaster_rows=0,
          error_message='Нет данных Wordstat — сначала запустите обновление'
        WHERE id=${runId}
      `);
      return { generated: 0, skipped: false };
    }

    // Check if the Wordstat snapshot is partial (some seeds failed during collection)
    try {
      const partialRow = await db.execute(sql`
        SELECT bool_or(is_partial) AS is_partial
        FROM wordstat_snapshots
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM wordstat_snapshots)
      `);
      const isPartial = (partialRow.rows[0] as { is_partial: boolean | null })?.is_partial ?? false;
      if (isPartial) {
        logger.warn(
          { wordstatDate: freshness.wordstat_date, totalRows: wordstatData.length },
          "[seo-gap] Running on PARTIAL Wordstat snapshot — some seed queries failed during collection; recommendations may be incomplete",
        );
      }
    } catch (partialErr) {
      logger.warn({ partialErr }, "[seo-gap] Could not check Wordstat snapshot completeness");
    }

    // 3. Load latest Webmaster snapshot
    const webmasterRows = await db.execute(sql`
      SELECT query_text, total_shows, total_clicks, avg_position
      FROM seo_query_snapshots
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM seo_query_snapshots)
    `);
    type WmRow = { query_text: string; total_shows: number; total_clicks: number; avg_position: number };
    const webmasterData = webmasterRows.rows as WmRow[];
    const wbMap = new Map<string, WmRow>();
    for (const row of webmasterData) wbMap.set(row.query_text.toLowerCase(), row);

    // Max position for normalization
    const maxPosition = Math.max(...webmasterData.map(r => r.avg_position), 20);

    // 3. Get all brand slugs for page mapping
    const brandsResult = await db.execute(sql`SELECT name, slug FROM brands WHERE slug IS NOT NULL`);
    const brandSlugs = new Map<string, string>(
      (brandsResult.rows as { name: string; slug: string }[]).map(r => [r.name.toLowerCase(), r.slug])
    );

    // 4. Track which (pageUrl, type) pairs are already occupied by an
    // unreviewed hypothesis or an applied change awaiting Karpathy evaluation.
    // GAP must not rediscover an applied change before its result is known.
    const seen = new Set<string>();
    const pendingPairs = await db.execute(sql`
      SELECT type, page_url
      FROM seo_suggestions
      WHERE status = 'pending'
         OR (status = 'applied' AND evaluated_at IS NULL)
    `);
    for (const row of pendingPairs.rows as { type: string; page_url: string }[]) {
      seen.add(`${row.type}:${row.page_url}`);
    }
    // Track priority scores for meta pages so TECH step can sort by importance
    const pagePriority = new Map<string, number>();

    // 5. Generate META suggestions from seed queries
    const seedQueries = wordstatData.filter(r => r.source === "seed");
    // Related queries are used later for model content enrichment and supplemental clusters
    const relatedQueries = wordstatData.filter(r => r.source === "related");

    for (const ws of seedQueries) {
      const brand = matchBrand(ws.query);
      if (!brand) continue;

      // Verify brand exists in our DB
      const brandSlug = brandSlugs.get(brand.brandName.toLowerCase()) ?? brand.slug;
      const pageUrl = `/brands/${brandSlug}`;
      const key = `meta:${pageUrl}`;
      if (seen.has(key)) continue;

      // Find best matching Webmaster query for this brand
      let wmRow: WmRow | undefined;
      let bestScore = -1;
      for (const [wmQuery, row] of wbMap) {
        if (brand.keywords?.some(kw => wmQuery.includes(kw)) || wmQuery.includes(brand.brandName.toLowerCase())) {
          if (row.total_shows > bestScore) {
            bestScore = row.total_shows;
            wmRow = row;
          }
        }
      }

      // position_factor: higher position number = worse ranking = higher factor
      const avgPosition = wmRow?.avg_position ?? 15; // assume bad position if no Webmaster data
      const positionFactor = Math.min((avgPosition - 1) / maxPosition, 1);

      // Only suggest if position is worth improving (> 3)
      if (avgPosition <= 3 && wmRow) continue;

      const isAnchorBoostedMeta = anchorPageUrls.has(pageUrl);
      const priorityScore = applyFeedbackDiscount(
        ws.shows_count * positionFactor * EASE.meta * (isAnchorBoostedMeta ? 1.5 : 1),
        pageUrl, "meta", feedbackMap, positivePageSet,
      );

      // Generate meta proposal
      const proposal = await buildMetaProposal(pageUrl, ws.query, avgPosition);
      if (!proposal) continue;

      // Check if current meta is already good (contains key brand term)
      const currentCombined = `${proposal.currentTitle} ${proposal.currentDesc}`.toLowerCase();
      const brandMentioned = brand.keywords?.some(kw => currentCombined.includes(kw));
      if (brandMentioned && avgPosition <= 5 && wmRow) continue;

      const reasoning = wmRow
        ? `Запрос «${ws.query}» имеет спрос ${ws.shows_count} показов/мес. Позиция в Вебмастере: ${Math.round(avgPosition)}. ` +
          `CTR: ${wmRow.total_clicks && wmRow.total_shows ? ((wmRow.total_clicks / wmRow.total_shows) * 100).toFixed(1) : "0"}%. Обновление мета-тегов может улучшить позицию и CTR.`
        : `Запрос «${ws.query}» имеет спрос ${ws.shows_count} показов/мес. Страница отсутствует в Вебмастере — возможно, не индексируется.`;

      const metaRes = await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status, is_anchor_boosted)
        VALUES
          ('meta', ${pageUrl},
           ${`title: ${proposal.currentTitle}\ndesc: ${proposal.currentDesc}`},
           ${`title: ${proposal.proposedTitle}\ndesc: ${proposal.proposedDesc}`},
           ${reasoning},
           ${priorityScore}, ${ws.shows_count}, ${positionFactor}, ${EASE.meta}, 'pending',
           ${isAnchorBoostedMeta})
        ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
          current_value = EXCLUDED.current_value,
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          position_factor = EXCLUDED.position_factor,
          is_anchor_boosted = EXCLUDED.is_anchor_boosted,
          status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
          reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
          updated_at = NOW()
        RETURNING id
      `);
      seen.add(key);
      pagePriority.set(pageUrl, priorityScore);
      generated += metaRes.rows.length;
    }

    // 5.1 META suggestions for generic pages: /cars and /new-cars
    {
      const genericMetaPages: { url: string; terms: string[]; fallbackQuery: string }[] = [
        {
          url: "/cars",
          terms: ["пробег", "б/у", "подержан"],
          fallbackQuery: "авто с пробегом брянск",
        },
        {
          url: "/new-cars",
          terms: ["новый авто", "новые авто", "купить автомобил", "новых автомобил"],
          fallbackQuery: "купить новый автомобиль брянск",
        },
      ];

      for (const gp of genericMetaPages) {
        const key = `meta:${gp.url}`;
        if (seen.has(key)) continue;

        // Find best matching Webmaster query for this generic page
        let bestWmRow: WmRow | undefined;
        let bestScore = -1;
        for (const [wmQuery, row] of wbMap) {
          if (gp.terms.some(t => wmQuery.includes(t)) && !matchBrand(wmQuery)) {
            if (row.total_shows > bestScore) {
              bestScore = row.total_shows;
              bestWmRow = row;
            }
          }
        }

        const avgPosition = bestWmRow?.avg_position ?? 15;
        if (avgPosition <= 3 && bestWmRow) continue;

        const topQuery = bestWmRow?.query_text ?? gp.fallbackQuery;
        const proposal = await buildMetaProposal(gp.url, topQuery, avgPosition);
        if (!proposal) continue;

        const positionFactor = Math.min((avgPosition - 1) / maxPosition, 1);
        const demand = bestWmRow?.total_shows ?? 50;
        const isAnchorBoostedGenMeta = anchorPageUrls.has(gp.url);
        const priorityScore = applyFeedbackDiscount(
          demand * positionFactor * EASE.meta * (isAnchorBoostedGenMeta ? 1.5 : 1),
          gp.url, "meta", feedbackMap, positivePageSet,
        );

        const reasoning = bestWmRow
          ? `Запрос «${topQuery}» — ${bestWmRow.total_shows} показов/мес, позиция ${Math.round(avgPosition)}. Мета-теги страницы ${gp.url} стоит обновить.`
          : `Страница ${gp.url} не имеет настроенных мета-тегов под ключевые запросы. Рекомендуется добавить оптимизированные title/description.`;

        const genMetaRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status, is_anchor_boosted)
          VALUES
            ('meta', ${gp.url},
             ${`title: ${proposal.currentTitle}\ndesc: ${proposal.currentDesc}`},
             ${`title: ${proposal.proposedTitle}\ndesc: ${proposal.proposedDesc}`},
             ${reasoning},
             ${priorityScore}, ${demand}, ${positionFactor}, ${EASE.meta}, 'pending',
             ${isAnchorBoostedGenMeta})
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            current_value = EXCLUDED.current_value,
            proposed_value = EXCLUDED.proposed_value,
            reasoning = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            demand = EXCLUDED.demand,
            position_factor = EXCLUDED.position_factor,
            is_anchor_boosted = EXCLUDED.is_anchor_boosted,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add(key);
        pagePriority.set(gp.url, priorityScore);
        generated += genMetaRes.rows.length;
        logger.info({ url: gp.url }, "[seo-gap] Generic page META suggestion created");
      }
    }

    // 5.2 — SITE_WIDE COVERAGE: enumerate ALL active brand pages from DB and key
    //        static pages. Create suggestions for pages with no Webmaster data or
    //        position > 20 — currently invisible to the META (brand-keyword match
    //        required) and CLUSTER (positions 4–20 only) steps.
    {
      type DbBrandRow = { name: string; slug: string; is_service_only: boolean };
      const allBrandResult = await db.execute(sql`
        SELECT name, slug, is_service_only FROM brands
        WHERE slug IS NOT NULL
        ORDER BY name
      `);
      const allBrands = allBrandResult.rows as DbBrandRow[];

      // Static pages always monitored regardless of Wordstat/Webmaster data
      const STATIC_MONITORED: {
        url: string; label: string; keywords: string[];
        fallbackDemand: number; proposed: string;
        ease?: number; // override ease factor; defaults to EASE.meta (1.0)
      }[] = [
        {
          url: "/",
          label: "Главная страница",
          keywords: ["дебрянск авто", "автосалон брянск", "автодилер брянск",
                     "официальный дилер брянск", "купить авто брянск"],
          fallbackDemand: 100,
          proposed:
            "title: Официальный автодилер в Брянске — Дебрянск Авто\n" +
            "desc: Купить новый или подержанный автомобиль в Брянске у официального дилера. " +
            "Haval, OMODA, JAECOO, Jetour, Tenet. Кредит, трейд-ин, гарантия производителя.",
        },
        {
          url: "/contacts",
          label: "Контакты",
          keywords: ["контакт", "адрес автосалон", "телефон дилер",
                     "как проехать", "дебрянск авто адрес"],
          fallbackDemand: 30,
          proposed:
            "title: Контакты — Дебрянск Авто | Адрес, телефон, режим работы\n" +
            "desc: Адрес и телефон официального дилера Дебрянск Авто в Брянске. " +
            "Часы работы шоурума и сервиса. Запись на тест-драйв и ТО онлайн.",
        },
        {
          url: "/about",
          label: "О компании",
          keywords: ["о компании дебрянск", "дебрянск авто история", "официальный дилер о нас"],
          fallbackDemand: 20,
          proposed:
            "title: О компании Дебрянск Авто | Официальный дилер в Брянске\n" +
            "desc: Дебрянск Авто — официальный дилер ведущих брендов в Брянске. " +
            "История, команда и преимущества сотрудничества с нами.",
        },
        {
          url: "/news",
          label: "Новости и статьи",
          keywords: ["новости авто брянск", "блог автосалон", "новости дебрянск"],
          fallbackDemand: 25,
          proposed:
            "title: Новости и статьи — Дебрянск Авто\n" +
            "desc: Новости автомобильного рынка, обзоры моделей, акции от официального дилера " +
            "Дебрянск Авто в Брянске.",
        },
        {
          url: "/promotions",
          label: "Акции и спецпредложения",
          keywords: ["акция автосалон брянск", "скидка авто брянск",
                     "спецпредложение авто", "акции дебрянск"],
          fallbackDemand: 40,
          proposed:
            "title: Акции и спецпредложения — Дебрянск Авто | Брянск\n" +
            "desc: Актуальные акции на покупку автомобилей от официального дилера " +
            "Дебрянск Авто. Скидки, выгодный кредит, трейд-ин бонусы.",
        },
        // ── Service pages (ease = EASE.service = 0.7) ────────────────────
        {
          url: "/service",
          label: "Сервис и техобслуживание",
          keywords: [
            "сервис брянск", "автосервис брянск", "то авто брянск",
            "техническое обслуживание", "ремонт авто брянск",
            "запись на то", "официальный сервис брянск", "то официальный",
          ],
          fallbackDemand: 60,
          proposed:
            "title: Сервис и техническое обслуживание — Дебрянск Авто | Брянск\n" +
            "desc: Официальный сервис Haval, OMODA, JAECOO, Jetour, Tenet в Брянске. " +
            "ТО по регламенту, диагностика, оригинальные запчасти. Запись онлайн.",
          ease: EASE.service,
        },
        {
          url: "/service/bonus",
          label: "Бонусная программа",
          keywords: [
            "бонусная программа авто", "бонусы дебрянск", "карта лояльности авто брянск",
            "кэшбэк автосалон", "накопительная программа дилер",
          ],
          fallbackDemand: 20,
          proposed:
            "title: Бонусная программа — Дебрянск Авто | Брянск\n" +
            "desc: Накапливайте бонусы за покупку и обслуживание автомобиля в Дебрянск Авто. " +
            "Оплачивайте до 20% стоимости услуг бонусами. Карта лояльности — бесплатно.",
          ease: EASE.service,
        },
        {
          url: "/corporate",
          label: "Корпоративным клиентам",
          keywords: [
            "корпоративный автомобиль", "авто для бизнеса брянск", "корпоративные клиенты дилер",
            "флот авто", "для юридических лиц", "корпоративные продажи авто",
          ],
          fallbackDemand: 25,
          proposed:
            "title: Корпоративным клиентам — Дебрянск Авто | Брянск\n" +
            "desc: Поставка автомобилей для бизнеса от официального дилера в Брянске. " +
            "Специальные условия для корпоративных клиентов, флотные программы, лизинг.",
          ease: EASE.service,
        },
      ];

      // Combine static pages + brand pages not already covered by the main META loop
      type CoveragePage = {
        url: string; label: string; keywords: string[];
        fallbackDemand: number; proposed: string;
        ease?: number; // override ease factor; defaults to EASE.meta (1.0)
      };
      const coveragePages: CoveragePage[] = [...STATIC_MONITORED];

      for (const brand of allBrands) {
        const pageUrl = `/brands/${brand.slug}`;
        // Skip if main META loop already produced a suggestion for this page
        if (seen.has(`meta:${pageUrl}`)) continue;

        const proposed = brand.is_service_only
          ? `title: ${brand.name} в Брянске — официальный сервис | Дебрянск Авто\n` +
            `desc: Официальное гарантийное и постгарантийное обслуживание ${brand.name} в Брянске. ` +
            `Диагностика, ремонт, оригинальные запчасти.`
          : `title: ${brand.name} в Брянске — официальный дилер | Дебрянск Авто\n` +
            `desc: Купить ${brand.name} у официального дилера в Брянске. ` +
            `Автомобили в наличии, кредит, трейд-ин, гарантия производителя.`;

        coveragePages.push({
          url: pageUrl,
          label: `Страница бренда ${brand.name}`,
          keywords: [brand.name.toLowerCase()],
          fallbackDemand: 30,
          proposed,
        });
      }

      // Process each page
      for (const page of coveragePages) {
        // Only one suggestion type per page from this step
        const alreadyCovered = seen.has(`meta:${page.url}`) ||
                               seen.has(`new_page:${page.url}`);
        if (alreadyCovered) continue;

        // Find best matching Webmaster query for this page
        let bestWmRow: WmRow | undefined;
        let bestScore = -1;
        for (const [wmQuery, row] of wbMap) {
          if (page.keywords.some(kw => wmQuery.includes(kw))) {
            if (row.total_shows > bestScore) {
              bestScore = row.total_shows;
              bestWmRow = row;
            }
          }
        }

        const avgPosition = bestWmRow?.avg_position ?? 50;
        // Skip if already well-ranked
        if (avgPosition <= 3 && bestWmRow) continue;

        const demand = bestWmRow?.total_shows ?? page.fallbackDemand;
        // Use a wide maxPosition denominator so even position=50 gets a useful factor
        const posMax = Math.max(maxPosition, 50);
        const positionFactor = Math.min((avgPosition - 1) / posMax, 1);

        // All SITE_WIDE COVERAGE pages already exist on the site — always "meta",
        // never "new_page". Zero Webmaster data means an indexing/meta problem, not
        // a missing page. True new_page suggestions come from a separate cluster pass.
        // Service/corporate pages use EASE.service (0.7); all others default to EASE.meta (1.0).
        const suggType = "meta";
        const ease = page.ease ?? EASE.meta;
        const pageKey = `${suggType}:${page.url}`;
        if (seen.has(pageKey)) continue;

        const isAnchorBoosted = anchorPageUrls.has(page.url);
        const priorityScore = applyFeedbackDiscount(
          demand * positionFactor * ease * (isAnchorBoosted ? 1.5 : 1),
          page.url, suggType, feedbackMap, positivePageSet,
        );

        const currentValue = bestWmRow
          ? `Позиция: ${Math.round(avgPosition)}, показов: ${demand}`
          : "Нет данных в Яндекс Вебмастере";

        const reasoning = bestWmRow
          ? `${page.label} (${page.url}): позиция в Вебмастере — ${Math.round(avgPosition)}, ` +
            `${demand} показов/мес. Страница видна поисковику, но находится ниже ТОП. ` +
            `Оптимизация мета-тегов и контента может улучшить позицию.`
          : `${page.label} (${page.url}): отсутствует в данных Яндекс Вебмастера — ` +
            `страница не получает показов по целевым запросам или не индексируется. ` +
            `Рекомендуется проверить индексацию и оптимизировать мета-теги.`;

        const coverageRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status, is_anchor_boosted)
          VALUES
            (${suggType}, ${page.url}, ${currentValue}, ${page.proposed}, ${reasoning},
             ${priorityScore}, ${demand}, ${positionFactor}, ${ease}, 'pending',
             ${isAnchorBoosted})
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            current_value    = EXCLUDED.current_value,
            proposed_value   = EXCLUDED.proposed_value,
            reasoning        = EXCLUDED.reasoning,
            priority_score   = EXCLUDED.priority_score,
            demand           = EXCLUDED.demand,
            position_factor  = EXCLUDED.position_factor,
            is_anchor_boosted = EXCLUDED.is_anchor_boosted,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at       = NOW()
          RETURNING id
        `);
        seen.add(pageKey);
        pagePriority.set(page.url, priorityScore);
        generated += coverageRes.rows.length;
        logger.info(
          { url: page.url, type: suggType, position: Math.round(avgPosition) },
          "[seo-gap] Site-wide coverage suggestion created",
        );
      }
    }

    // 5.5 Generate "content" suggestions for model-level seed queries.
    //     The META loop above only creates one suggestion per brand page (deduped by seen).
    //     Model-level queries ("jaecoo j7 брянск", "хавал дарго брянск", etc.) are silently
    //     dropped after the brand-level suggestion fires.  We now collect them separately
    //     and propose content additions (model-specific sections) for the brand page.
    {
      // No DELETE: pending suggestions are preserved so manager edits in content_draft
      // are not lost on re-runs. The ON CONFLICT...WHERE status='pending' handles dedup,
      // and content_draft is NOT in the UPDATE SET, so it survives re-generation.

      // Accumulate: brand slug → list of {query, shows, modelTerm}
      const modelMap = new Map<string, {
        brand: BrandEntry;
        brandSlug: string;
        items: { query: string; shows: number; modelTerm: string }[];
      }>();

      // Also feed related queries (≥RELATED_MIN_SHOWS) to catch long-tail model terms
      const allModelQueries = [
        ...seedQueries,
        ...relatedQueries.filter(r => r.shows_count >= RELATED_MIN_SHOWS),
      ];

      for (const ws of allModelQueries) {
        const brand = matchBrand(ws.query);
        if (!brand || brand.modelKeywords.length === 0) continue;
        const q = ws.query.toLowerCase();
        const matchedModel = brand.modelKeywords.find(kw => q.includes(kw.toLowerCase()));
        if (!matchedModel) continue; // generic brand query — skip

        const brandSlug = brandSlugs.get(brand.brandName.toLowerCase()) ?? brand.slug;
        if (!modelMap.has(brandSlug)) {
          modelMap.set(brandSlug, { brand, brandSlug, items: [] });
        }
        modelMap.get(brandSlug)!.items.push({
          query: ws.query,
          shows: ws.shows_count,
          modelTerm: matchedModel.trim(),
        });
      }

      for (const [, { brand, brandSlug, items }] of modelMap) {
        if (items.length === 0) continue;
        const totalShows = items.reduce((s, i) => s + i.shows, 0);
        if (totalShows < CONTENT_MIN_SHOWS) continue; // not enough demand

        // Deduplicate by canonical model key (e.g. "jolion"≡"джолион"), pick highest-shows entry per model
        const byModel = new Map<string, { query: string; shows: number; display: string }>();
        for (const item of items) {
          const key = canonicalModelKey(item.modelTerm);
          const existing = byModel.get(key);
          if (!existing || item.shows > existing.shows) {
            byModel.set(key, {
              query: item.query,
              shows: item.shows,
              display: canonicalModelDisplay(item.modelTerm),
            });
          }
        }

        const pageUrl = `/brands/${brandSlug}`;
        const contentKey = `content:${pageUrl}`;
        if (seen.has(contentKey)) continue;
        const sorted = [...byModel.entries()].sort((a, b) => b[1].shows - a[1].shows);

        const proposedValue = sorted
          .map(([, { display, query, shows }]) =>
            `${display}: «${query}» — ${shows} показов/мес`)
          .join("\n");

        const modelList = sorted.map(([, { display }]) => display).join(", ");
        const reasoning =
          `Wordstat выявил модельные запросы для ${brand.brandName}: ${sorted
            .map(([, { display, query, shows }]) => `${display} «${query}» (${shows} показов)`)
            .join("; ")}. ` +
          `Суммарный спрос: ${totalShows} показов/мес. Рекомендуется добавить отдельные секции ` +
          `для моделей ${modelList} на странице бренда с характеристиками, ценами и CTA.`;

        const avgPosition = 15; // models typically not indexed yet
        const positionFactor = Math.min((avgPosition - 1) / maxPosition, 1);
        const isAnchorBoostedContent = anchorPageUrls.has(pageUrl);
        const priorityScore = applyFeedbackDiscount(
          totalShows * positionFactor * EASE.content * (isAnchorBoostedContent ? 1.5 : 1),
          pageUrl, "content", feedbackMap, positivePageSet,
        );

        const contentRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status, is_anchor_boosted)
          VALUES
            ('content', ${pageUrl}, '', ${proposedValue}, ${reasoning},
             ${priorityScore}, ${totalShows}, ${positionFactor}, ${EASE.content}, 'pending',
             ${isAnchorBoostedContent})
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            proposed_value = EXCLUDED.proposed_value,
            reasoning = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            demand = EXCLUDED.demand,
            is_anchor_boosted = EXCLUDED.is_anchor_boosted,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add(contentKey);
        generated += contentRes.rows.length;
        logger.info({ brand: brand.brandName, models: modelList, totalShows }, "[seo-gap] Model content suggestion created");
      }
    }

    // 5.6 Negative feedback must produce a fresh hypothesis even when the
    // normal Wordstat/model source did not emit a candidate this run.
    // Applied rows are history; the partial unique index allows a new pending
    // row for the same page/type to coexist with them.
    {
      const failedRows = await db.execute(sql`
        SELECT failed.id, failed.type, failed.page_url, failed.proposed_value,
               failed.reasoning, failed.priority_score, failed.evaluation_result
        FROM seo_suggestions failed
        WHERE failed.status = 'applied'
          AND failed.evaluation_result IN ('fell', 'falsified')
          AND failed.evaluated_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM seo_suggestions active
            WHERE active.type = failed.type
              AND active.page_url = failed.page_url
              AND active.status = 'pending'
          )
        ORDER BY failed.evaluated_at ASC
        LIMIT 50
      `);

      for (const failed of failedRows.rows as {
        id: number;
        type: string;
        page_url: string;
        proposed_value: string;
        reasoning: string | null;
        priority_score: number;
        evaluation_result: "fell" | "falsified";
      }[]) {
        let proposedValue = failed.proposed_value;
        let retryReason = `Предыдущая гипотеза (КП №${failed.id}) получила результат «${failed.evaluation_result}». ` +
          `Сформировать новую гипотезу и проверить её отдельно.`;

        // Content suggestions are applied as FAQ JSON or model-query lines.
        // Ask the same validated AI path for a genuinely different FAQ set.
        if (failed.type === "content" && failed.page_url.startsWith("/brands/")) {
          const slug = failed.page_url.replace("/brands/", "");
          const queries = [...failed.proposed_value.matchAll(/«([^»]+)»/g)].map(m => m[1]!);
          const models = failed.proposed_value
            .split("\n")
            .map(line => line.split(":")[0]?.trim())
            .filter(Boolean);
          const brandRow = await db.execute(sql`
            SELECT name FROM brands WHERE slug = ${slug} LIMIT 1
          `);
          const brandName = (brandRow.rows[0] as { name?: string } | undefined)?.name ?? slug;
          if (queries.length > 0) {
            const freshFaqs = await preGenClusterFaqs(queries, brandName, slug, models);
            if (freshFaqs !== AI_HALLUCINATION_SIGNAL && freshFaqs !== "[]") {
              proposedValue = freshFaqs;
              retryReason += " AI подготовил новый набор FAQ с учётом неудачи предыдущей гипотезы.";
            } else {
              const modelText = models.length > 0 ? models.join(", ") : brandName;
              proposedValue = JSON.stringify([{
                question: `Как выбрать автомобиль ${brandName} для поездок по Брянску?`,
                answer: `На странице ${brandName} представлены модели ${modelText}. Сравните их комплектации и запишитесь на консультацию у официального дилера в Брянске.`,
              }]);
              retryReason += " Создан резервный FAQ-вариант с новым пользовательским интентом.";
            }
          }
        }

        const retryRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status)
          VALUES
            (${failed.type}, ${failed.page_url}, ${failed.proposed_value},
             ${proposedValue}, ${retryReason},
             ${Math.max(1, Number(failed.priority_score) || 1) * KARPATHY_NEGATIVE_DISCOUNT},
             0, 0, ${EASE[failed.type] ?? 0.5}, 'pending')
          ON CONFLICT DO NOTHING
          RETURNING id
        `);
        const retryId = (retryRes.rows[0] as { id?: number } | undefined)?.id ?? null;
        if (retryId) {
          generated += 1;
          logger.info(
            { previousId: failed.id, retryId, type: failed.type, pageUrl: failed.page_url },
            "[seo-gap] Fresh retry suggestion created after negative Karpathy evaluation",
          );
        }
      }
    }

    // 6. Generate CLUSTER suggestions from Webmaster queries (seo_query_snapshots).
    //    Real positions + CTR from Яндекс Вебмастер — much more accurate than
    //    Wordstat "related" which contained geographic noise (news, hospitals, etc.)
    // No DELETE for cluster: preserve pending suggestions so manager edits survive re-runs.
    logger.info("[seo-gap] Building clusters from Webmaster data");

    // Load queries: positions 4–20 (room to grow), min 20 shows
    const wmClusterRows = await db.execute(sql`
      SELECT query_text, total_shows, total_clicks, avg_position
      FROM seo_query_snapshots
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM seo_query_snapshots)
        AND avg_position BETWEEN 4 AND 20
        AND total_shows >= ${CLUSTER_MIN_SHOWS}
      ORDER BY total_shows DESC
    `);
    type WmClRow = { query_text: string; total_shows: number; total_clicks: number; avg_position: number };
    const wmClusterData = wmClusterRows.rows as WmClRow[];

    // Group by brand
    const brandClusterMap = new Map<string, { brand: BrandEntry & { slug: string; brandName: string }; rows: WmClRow[] }>();

    // Intent-classified generic rows
    const USED_CAR_TERMS = ["б/у", "с пробегом", "бу ", "подержан", "авито"];
    const NEW_CAR_TERMS  = ["новый", "новые", "new", "дилер", "2025", "2026", "официальный"];
    const usedCarRows:  WmClRow[] = [];
    const newCarRows:   WmClRow[] = [];
    const ambiguousRows: WmClRow[] = []; // без явного интента → goes to /cars

    for (const row of wmClusterData) {
      const brand = matchBrand(row.query_text);
      if (brand) {
        if (!brandClusterMap.has(brand.slug)) brandClusterMap.set(brand.slug, { brand, rows: [] });
        brandClusterMap.get(brand.slug)!.rows.push(row);
      } else if (isAutomotiveQuery(row.query_text, [])) {
        const q = row.query_text.toLowerCase();
        if (USED_CAR_TERMS.some(t => q.includes(t)))      usedCarRows.push(row);
        else if (NEW_CAR_TERMS.some(t => q.includes(t))) newCarRows.push(row);
        else                                               ambiguousRows.push(row);
      }
    }
    // Ambiguous queries (e.g. "купить авто брянск") go to /cars — б/у is the default for mixed traffic
    usedCarRows.push(...ambiguousRows);

    // ── Brand clusters → /brands/:slug ──────────────────────────────────
    // No DELETE for text_block: preserve pending suggestions so manager edits survive re-runs.

    for (const [, { brand, rows }] of brandClusterMap) {
      const brandSlug = brandSlugs.get(brand.brandName.toLowerCase()) ?? brand.slug;
      const pageUrl = `/brands/${brandSlug}`;
      const clusterKey = `cluster:${pageUrl}`;
      if (seen.has(clusterKey)) continue;

      const relevant = rows.filter(r => isAutomotiveQuery(r.query_text, brand.keywords));
      const totalDemand = relevant.reduce((s, r) => s + r.total_shows, 0);

      // Need at least 1 query for high-demand brands, otherwise 2
      const minClusterQueries = totalDemand >= CLUSTER_HIGH_DEMAND_THRESHOLD ? 1 : 2;
      if (relevant.length < minClusterQueries || totalDemand < CLUSTER_MIN_DEMAND) {
        logger.debug({ brand: brand.brandName, count: relevant.length, totalDemand },
          "[seo-gap] Cluster skipped — below threshold");
        continue;
      }

      const sorted = relevant.sort((a, b) => b.total_shows - a.total_shows);
      const avgPos = sorted.reduce((s, r) => s + r.avg_position, 0) / sorted.length;
      const positionFactor = Math.min((avgPos - 1) / maxPosition, 1);

      const topPhrasesStr = sorted.slice(0, 5)
        .map(r => `«${r.query_text}» (поз. ${r.avg_position.toFixed(1)}, ${r.total_shows} показов)`)
        .join("; ");

      const ctr = sorted[0] ? (sorted[0].total_clicks / Math.max(sorted[0].total_shows, 1) * 100).toFixed(1) : "0";

      // Check existing FAQ count for this brand page
      const faqCountRow = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM faqs WHERE page_slug = ${'brands/' + brandSlug}
      `);
      const existingFaqCount = (faqCountRow.rows[0] as { cnt: number }).cnt ?? 0;

      // If brand already has ≥2 FAQ entries, suggest a text_block instead of another FAQ cluster
      if (existingFaqCount >= 2) {
        const textBlockKey = `text_block:${pageUrl}`;
        if (seen.has(textBlockKey)) continue;
        const models = brand.modelKeywords?.slice(0, 4).join(", ") ?? brand.brandName;
        const textBlockContent =
          `${brand.brandName} — официальный дилер в Брянске. ` +
          `В наличии модели: ${models}. ` +
          `Покупка в кредит на выгодных условиях, трейд-ин по рыночной оценке, гарантийное и постгарантийное обслуживание. ` +
          `Запишитесь на тест-драйв онлайн — менеджер свяжется в ближайшее время.`;

        const reasoning =
          `Страница бренда ${brand.brandName} уже содержит ${existingFaqCount} FAQ-записей. ` +
          `Кластер запросов: ${topPhrasesStr}. ` +
          `Суммарный спрос: ${totalDemand} показов/мес, средняя позиция: ${avgPos.toFixed(1)}, CTR: ${ctr}%. ` +
          `Рекомендуется добавить SEO-текстовый блок (не FAQ) для усиления релевантности страницы.`;

        const isAnchorBoostedTb = anchorPageUrls.has(pageUrl);
        const priorityScore = applyFeedbackDiscount(
          totalDemand * positionFactor * EASE.text_block * (isAnchorBoostedTb ? 1.5 : 1),
          pageUrl, "text_block", feedbackMap, positivePageSet,
        );

        const tbRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status, is_anchor_boosted)
          VALUES
            ('text_block', ${pageUrl}, '', ${textBlockContent}, ${reasoning},
             ${priorityScore}, ${totalDemand}, ${positionFactor}, ${EASE.text_block}, 'pending',
             ${isAnchorBoostedTb})
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            proposed_value = EXCLUDED.proposed_value,
            reasoning = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            demand = EXCLUDED.demand,
            is_anchor_boosted = EXCLUDED.is_anchor_boosted,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add(textBlockKey);
        generated += tbRes.rows.length;
        logger.info({ brand: brand.brandName, existingFaqCount }, "[seo-gap] text_block suggestion created (FAQ already present)");
      } else {
        const isAnchorBoostedCluster = anchorPageUrls.has(pageUrl);
        const priorityScore = applyFeedbackDiscount(
          totalDemand * positionFactor * EASE.cluster * (isAnchorBoostedCluster ? 1.5 : 1),
          pageUrl, "cluster", feedbackMap, positivePageSet,
        );

        // Pre-generate FAQ Q&A so managers see real questions before applying
        const brandModelsRow = await db.execute(sql`
          SELECT DISTINCT TRIM(SPLIT_PART(model, ',', 1)) AS m
          FROM cars WHERE type = 'new' AND LOWER(dealer) = LOWER(${brand.brandName}) LIMIT 6
        `);
        const brandModels = brandModelsRow.rows.map(r => (r as { m: string }).m).filter(Boolean);
        const rawQueries = sorted.slice(0, 5).map(r => r.query_text);
        const proposed = await preGenClusterFaqs(rawQueries, brand.brandName, brandSlug, brandModels);
        const clusterStatus = proposed === AI_HALLUCINATION_SIGNAL ? "rejected" : "pending";
        const clusterRejectReason = proposed === AI_HALLUCINATION_SIGNAL ? "ai_hallucination" : null;
        const clusterProposedValue = proposed === AI_HALLUCINATION_SIGNAL ? "[]" : proposed;

        const reasoning =
          `Кластер запросов Яндекс Вебмастера для ${brand.brandName}: ${topPhrasesStr}. ` +
          `Суммарный спрос: ${totalDemand} показов/мес, средняя позиция: ${avgPos.toFixed(1)}, CTR топ-запроса: ${ctr}%. ` +
          `Рекомендуется добавить FAQ-блок или текст на страницу бренда, отвечающий на эти запросы.`;

        const clusterRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status, reject_reason, is_anchor_boosted)
          VALUES
            ('cluster', ${pageUrl}, '', ${clusterProposedValue}, ${reasoning},
             ${priorityScore}, ${totalDemand}, ${positionFactor}, ${EASE.cluster}, ${clusterStatus},
             ${clusterRejectReason}, ${isAnchorBoostedCluster})
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            proposed_value = EXCLUDED.proposed_value,
            reasoning = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            demand = EXCLUDED.demand,
            is_anchor_boosted = EXCLUDED.is_anchor_boosted,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE EXCLUDED.status END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE EXCLUDED.reject_reason END,
            updated_at = NOW()
          RETURNING id
        `);
        generated += clusterRes.rows.length;
      }
      seen.add(clusterKey);
    }

    // ── Generic /cars cluster (б/у авто + ambiguous запросы) ─────────────
    const genericDemand = usedCarRows.reduce((s, r) => s + r.total_shows, 0);
    const genericKey = "cluster:/cars";
    if (!seen.has(genericKey) && usedCarRows.length >= 2 && genericDemand >= GENERIC_CLUSTER_MIN_DEMAND) {
      const sorted = usedCarRows.sort((a, b) => b.total_shows - a.total_shows);
      const avgPos = sorted.slice(0, 5).reduce((s, r) => s + r.avg_position, 0) / Math.min(sorted.length, 5);
      const positionFactor = Math.min((avgPos - 1) / maxPosition, 1);
      const isAnchorBoostedCars = anchorPageUrls.has("/cars");
      const priorityScore = applyFeedbackDiscount(
        genericDemand * positionFactor * EASE.cluster * (isAnchorBoostedCars ? 1.5 : 1),
        "/cars", "cluster", feedbackMap, positivePageSet,
      );

      const topPhrasesStr = sorted.slice(0, 5)
        .map(r => `«${r.query_text}» (поз. ${r.avg_position.toFixed(1)}, ${r.total_shows} показов)`)
        .join("; ");

      const reasoning =
        `Кластер общих запросов на покупку авто: ${topPhrasesStr}. ` +
        `Суммарный спрос: ${genericDemand} показов/мес, средняя позиция: ${avgPos.toFixed(1)}. ` +
        `Рекомендуется усилить раздел б/у авто — заголовки, фильтры, SEO-описание.`;

      const proposed = sorted.slice(0, 5)
        .map(r => `${r.query_text} (позиция ${r.avg_position.toFixed(1)})`)
        .join("\n");

      const carsClusterRes = await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status, is_anchor_boosted)
        VALUES
          ('cluster', '/cars', '', ${proposed}, ${reasoning},
           ${priorityScore}, ${genericDemand}, ${positionFactor}, ${EASE.cluster}, 'pending',
           ${isAnchorBoostedCars})
        ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          is_anchor_boosted = EXCLUDED.is_anchor_boosted,
          status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
          reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
          updated_at = NOW()
        RETURNING id
      `);
      seen.add(genericKey);
      generated += carsClusterRes.rows.length;
    }

    // ── Generic /new-cars cluster (новые авто, официальный дилер и т.п.) ──
    const newCarDemand = newCarRows.reduce((s, r) => s + r.total_shows, 0);
    const newCarKey = "cluster:/new-cars";
    if (!seen.has(newCarKey) && newCarRows.length >= 2 && newCarDemand >= GENERIC_CLUSTER_MIN_DEMAND) {
      const sortedNew = newCarRows.sort((a, b) => b.total_shows - a.total_shows);
      const avgPosNew = sortedNew.slice(0, 5).reduce((s, r) => s + r.avg_position, 0) / Math.min(sortedNew.length, 5);
      const positionFactorNew = Math.min((avgPosNew - 1) / maxPosition, 1);
      const isAnchorBoostedNewCars = anchorPageUrls.has("/new-cars");
      const priorityScoreNew = applyFeedbackDiscount(
        newCarDemand * positionFactorNew * EASE.cluster * (isAnchorBoostedNewCars ? 1.5 : 1),
        "/new-cars", "cluster", feedbackMap, positivePageSet,
      );

      const topPhrasesNew = sortedNew.slice(0, 5)
        .map(r => `«${r.query_text}» (поз. ${r.avg_position.toFixed(1)}, ${r.total_shows} показов)`)
        .join("; ");

      const proposedNew = sortedNew.slice(0, 5)
        .map(r => `${r.query_text} (позиция ${r.avg_position.toFixed(1)})`)
        .join("\n");

      const reasoningNew =
        `Кластер запросов на новые авто: ${topPhrasesNew}. ` +
        `Суммарный спрос: ${newCarDemand} показов/мес, средняя позиция: ${avgPosNew.toFixed(1)}. ` +
        `Рекомендуется усилить раздел новых авто — заголовки, фильтры, SEO-описание, FAQ.`;

      const newCarsClusterRes = await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status, is_anchor_boosted)
        VALUES
          ('cluster', '/new-cars', '', ${proposedNew}, ${reasoningNew},
           ${priorityScoreNew}, ${newCarDemand}, ${positionFactorNew}, ${EASE.cluster}, 'pending',
           ${isAnchorBoostedNewCars})
        ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          is_anchor_boosted = EXCLUDED.is_anchor_boosted,
          status = CASE WHEN seo_suggestions.status NOT IN ('applied', 'rejected') THEN 'pending' ELSE seo_suggestions.status END,
          reject_reason = CASE WHEN seo_suggestions.status NOT IN ('applied', 'rejected') THEN NULL ELSE seo_suggestions.reject_reason END,
          updated_at = NOW()
        RETURNING id
      `);
      seen.add(newCarKey);
      generated += newCarsClusterRes.rows.length;
      logger.info({ newCarDemand, queries: newCarRows.length }, "[seo-gap] /new-cars generic cluster suggestion created");
    }

    // ── Fallback: Wordstat seed clusters for brands with low Webmaster coverage ──
    // Runs only for brands that didn't get a cluster from Webmaster data above.
    logger.info("[seo-gap] Checking Wordstat seed fallback clusters for low-coverage brands");

    type SeedBrandEntry = { brand: ReturnType<typeof matchBrand> & { slug: string; brandName: string }; totalDemand: number; queries: string[] };
    const seedClusterMap = new Map<string, SeedBrandEntry>();

    for (const ws of seedQueries) {
      const brand = matchBrand(ws.query);
      if (!brand) continue;
      const brandSlug = brandSlugs.get(brand.brandName.toLowerCase()) ?? brand.slug;
      const clusterKey = `cluster:/brands/${brandSlug}`;
      if (seen.has(clusterKey)) continue; // already handled via Webmaster path

      if (!seedClusterMap.has(brandSlug)) {
        seedClusterMap.set(brandSlug, { brand: brand as SeedBrandEntry["brand"], totalDemand: 0, queries: [] });
      }
      const entry = seedClusterMap.get(brandSlug)!;
      entry.totalDemand += ws.shows_count;
      entry.queries.push(`${ws.query} (${ws.shows_count} показов/мес)`);
    }

    for (const [brandSlug, { brand, totalDemand, queries }] of seedClusterMap) {
      if (totalDemand < SEED_CLUSTER_MIN_DEMAND) continue; // minimum Wordstat demand to bother

      const pageUrl = `/brands/${brandSlug}`;
      const clusterKey = `cluster:${pageUrl}`;
      if (seen.has(clusterKey)) continue;

      // Assume poor organic coverage — page not appearing for these Wordstat queries
      const positionFactor = 0.85;
      const isAnchorBoosted = anchorPageUrls.has(pageUrl);

      // Check existing FAQ count to decide cluster vs text_block
      const faqCountRow2 = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM faqs WHERE page_slug = ${"brands/" + brandSlug}
      `);
      const faqCount2 = (faqCountRow2.rows[0] as { cnt: number }).cnt ?? 0;
      const suggType2 = faqCount2 >= 2 ? "text_block" : "cluster";
      const suggEase2 = faqCount2 >= 2 ? EASE.text_block : EASE.cluster;
      const suggestionKey2 = `${suggType2}:${pageUrl}`;
      if (seen.has(suggestionKey2)) continue;

      const priorityScore2 = applyFeedbackDiscount(
        totalDemand * positionFactor * suggEase2 * (isAnchorBoosted ? 1.5 : 1),
        pageUrl, suggType2, feedbackMap, positivePageSet,
      );

      const topQueriesStr = queries.slice(0, 5).join("; ");

      // cluster → pre-generate FAQ JSON; text_block → generate real copy
      const brandModelKeywords = (brand as { modelKeywords?: string[] }).modelKeywords ?? [];
      const proposed2 = suggType2 === "text_block"
        ? (() => {
            const models = brandModelKeywords.slice(0, 4).join(", ") || brand.brandName;
            return (
              `${brand.brandName} — официальный дилер в Брянске. ` +
              `В наличии модели: ${models}. ` +
              `Покупка в кредит на выгодных условиях, трейд-ин по рыночной оценке, ` +
              `гарантийное и постгарантийное обслуживание. ` +
              `Запишитесь на тест-драйв онлайн — менеджер свяжется в ближайшее время.`
            );
          })()
        : await preGenClusterFaqs(
            // strip "(X показов/мес)" suffix added when building entry.queries
            queries.slice(0, 5).map(q => q.replace(/\s*\(\d+\s*показов\/мес\)\s*$/, "").trim()),
            brand.brandName,
            brandSlug,
            brandModelKeywords,
          );

      const seedIsHallucinated = proposed2 === AI_HALLUCINATION_SIGNAL;
      const seedStatus = seedIsHallucinated ? "rejected" : "pending";
      const seedRejectReason = seedIsHallucinated ? "ai_hallucination" : null;
      const seedProposedValue = seedIsHallucinated ? "[]" : proposed2;

      const reasoning2 =
        `Wordstat фиксирует спрос по ${brand.brandName}: ${topQueriesStr}. ` +
        `Суммарный спрос: ${totalDemand} показов/мес. ` +
        `Страница слабо представлена в органике по этим запросам (данных Вебмастера недостаточно). ` +
        (faqCount2 >= 2
          ? `На странице уже ${faqCount2} FAQ — рекомендуется добавить SEO-текстовый блок для усиления релевантности.`
          : `Рекомендуется добавить FAQ-блок, отвечающий на эти запросы.`);

      const seedRes = await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status, reject_reason, is_anchor_boosted)
        VALUES
          (${suggType2}, ${pageUrl}, '', ${seedProposedValue}, ${reasoning2},
           ${priorityScore2}, ${totalDemand}, ${positionFactor}, ${suggEase2}, ${seedStatus},
           ${seedRejectReason}, ${isAnchorBoosted})
        ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          is_anchor_boosted = EXCLUDED.is_anchor_boosted,
          status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE EXCLUDED.status END,
          reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE EXCLUDED.reject_reason END,
          updated_at = NOW()
        RETURNING id
      `);
      seen.add(suggestionKey2);
      generated += seedRes.rows.length;
      seen.add(clusterKey);
      logger.info(
        { brand: brand.brandName, totalDemand, type: suggType2 },
        "[seo-gap] Wordstat fallback cluster created",
      );
    }

    // 6.5. Anchor page coverage — force meta recommendations for anchor pages not yet
    //      covered by any standard source (META brand loop, generic pages, site-wide).
    //      These pages have active anchor queries below target — they MUST be in GAP.
    for (const [anchorUrl, queries] of anchorPageQueries) {
      const metaKey = `meta:${anchorUrl}`;
      if (seen.has(metaKey)) continue; // already covered by a standard step

      const primaryQuery = queries[0];
      const proposal = await buildMetaProposal(anchorUrl, primaryQuery, 20);
      if (!proposal) continue;

      const wmRow = wbMap.get(primaryQuery.toLowerCase());
      const avgPosition = wmRow?.avg_position ?? 20;
      const demand = wmRow?.total_shows ?? 50;
      const positionFactor = Math.min((avgPosition - 1) / maxPosition, 1);
      // Always anchor-boosted ×1.5, then apply Karpathy multiplier
      const priorityScore = applyFeedbackDiscount(
        demand * positionFactor * EASE.meta * 1.5,
        anchorUrl, "meta", feedbackMap, positivePageSet,
      );

      const otherQueries = queries.slice(1).join(", ");
      const reasoning =
        `Анкорный запрос «${primaryQuery}» для страницы ${anchorUrl} не достиг целевой позиции. ` +
        (otherQueries ? `Дополнительные анкоры: ${otherQueries}. ` : "") +
        (wmRow
          ? `Текущая позиция: ${Math.round(avgPosition)}, ${demand} показов/мес. `
          : `Страница не найдена в Вебмастере — возможно, не индексируется. `) +
        `Рекомендуется оптимизировать мета-теги под этот запрос.`;

      const anchorRes = await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status, is_anchor_boosted)
        VALUES
          ('meta', ${anchorUrl},
           ${`title: ${proposal.currentTitle}\ndesc: ${proposal.currentDesc}`},
           ${`title: ${proposal.proposedTitle}\ndesc: ${proposal.proposedDesc}`},
           ${reasoning},
           ${priorityScore}, ${demand}, ${positionFactor}, ${EASE.meta}, 'pending', true)
        ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
          current_value   = EXCLUDED.current_value,
          proposed_value  = EXCLUDED.proposed_value,
          reasoning       = EXCLUDED.reasoning,
          priority_score  = EXCLUDED.priority_score,
          is_anchor_boosted = true,
          status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
          reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
          updated_at      = NOW()
        RETURNING id
      `);
      seen.add(metaKey);
      pagePriority.set(anchorUrl, priorityScore);
      generated += anchorRes.rows.length;
      logger.info(
        { url: anchorUrl, query: primaryQuery, totalQueries: queries.length },
        "[seo-gap] Anchor page forced meta suggestion created",
      );
    }

    // 7. Tech gap check for top 8 brand pages by priority
    //    Clear stale pending tech suggestions first — they were generated via
    //    curl from Replit which can't reach the production domain and returned
    //    0 bytes, causing false positives.
    // No DELETE for tech: preserve pending suggestions across runs.

    const topBrandPages = [...seen]
      .filter(k => k.startsWith("meta:"))
      .map(k => k.replace("meta:", ""))
      .sort((a, b) => (pagePriority.get(b) ?? 0) - (pagePriority.get(a) ?? 0))
      .slice(0, 8);

    for (const pageUrl of topBrandPages) {
      const techKey = `tech:${pageUrl}`;
      if (seen.has(techKey)) continue;

      const { size, isTechGap, isCacheAvailable, threshold, reason } = await checkTechGap(pageUrl);
      // If cache infrastructure is not mounted (Replit/dev), skip TECH suggestions
      // entirely for this run — don't generate false positives.
      if (!isCacheAvailable) {
        logger.warn("[seo-gap] Prerender cache root unavailable — skipping TECH suggestions for this run");
        break; // same result for all pages in this env — no point checking further
      }
      if (!isTechGap) continue;

      const demand = 100; // baseline demand for tech gaps
      const positionFactor = 0.8;
      const priorityScore = demand * positionFactor * EASE.tech;

      const sizeLabel = size === 0 ? "файл отсутствует в кэше" : `${size} байт`;
      const reasoning =
        `Страница ${pageUrl}: пририндер-кэш на диске — ${reason ?? sizeLabel} (размер: ${sizeLabel}, порог: ${threshold} байт). ` +
        `Вероятно, страница не пририндерена — бот получает SPA-оболочку без контента.`;

      const techRes = await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status)
        VALUES
          ('tech', ${pageUrl},
           ${`Техническая проверка: ${reason ?? sizeLabel} (порог: ${threshold})`},
           'Запустить пририндер страницы',
           ${reasoning},
           ${priorityScore}, ${demand}, ${positionFactor}, ${EASE.tech}, 'pending')
        ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
          current_value = EXCLUDED.current_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
          reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
          updated_at = NOW()
        RETURNING id
      `);

      // Mark related meta suggestions as blocked by tech
      await db.execute(sql`
        UPDATE seo_suggestions
        SET blocked_by_tech = true, updated_at = NOW()
        WHERE page_url = ${pageUrl}
          AND type = 'meta'
          AND status = 'pending'
      `);

      seen.add(techKey);
      generated += techRes.rows.length;
    }

    // 8. Unblock META suggestions that no longer have a real TECH gap
    //    (handles the case where a false-positive tech suggestion previously
    //    set blocked_by_tech = true on a perfectly fine page)
    await db.execute(sql`
      UPDATE seo_suggestions
      SET blocked_by_tech = false, updated_at = NOW()
      WHERE type = 'meta'
        AND status = 'pending'
        AND blocked_by_tech = true
        AND page_url NOT IN (
          SELECT page_url FROM seo_suggestions
          WHERE type = 'tech' AND status = 'pending'
        )
    `);

    // 9. Sitemap coverage gaps
    //    Pages in the app that are missing from sitemap.xml — Yandex won't crawl them proactively.
    //    Also checks Webmaster crawl errors (4xx) via API.
    {
      const WEBMASTER_HOST = "https%3Adebryansk-auto.ru%3A443";

      // Load all paths currently in sitemap (static + extra DB table + brand pages).
      // Used to skip suggestions for URLs that are already indexed.
      const currentSitemapPaths = await getSitemapLocs();
      logger.debug({ count: currentSitemapPaths.size }, "[seo-gap] Loaded current sitemap paths");

      // Auto-close pending "missing from sitemap" suggestions for URLs now present in sitemap.
      // These arise when a suggestion was applied (URL added) but the status wasn't updated,
      // or when STATIC_PAGES was manually extended to include the URL.
      const sitemapLocsArray = Array.from(currentSitemapPaths);
      if (sitemapLocsArray.length > 0) {
        const staleClose = await db.execute(sql`
          UPDATE seo_suggestions
          SET status = 'applied',
              applied_at = COALESCE(applied_at, NOW()),
              verification_log = 'URL уже присутствует в sitemap.xml — закрыто автоматически при следующем прогоне GAP',
              updated_at = NOW()
          WHERE type = 'sitemap'
            AND status = 'pending'
            AND current_value = 'Отсутствует в sitemap.xml'
            AND page_url IN (${sql.join(sitemapLocsArray.map(l => sql`${l}`), sql`, `)})
          RETURNING id
        `);
        if ((staleClose.rows.length ?? 0) > 0) {
          logger.info({ count: staleClose.rows.length }, "[seo-gap] Auto-closed stale sitemap suggestions for URLs now in sitemap");
        }
      }

      // 9.1 Hardcoded important routes missing from sitemap.ts STATIC_PAGES
      const SITEMAP_GAPS = [
        {
          url: "/service/bonus",
          label: "Бонусная программа",
          changefreq: "weekly",
          priority: "0.7",
          reason: "Страница программы лояльности имеет коммерческий потенциал. Клиенты ищут «бонусная программа автосалон Брянск».",
        },
        {
          url: "/promotions",
          label: "Каталог акций",
          changefreq: "daily",
          priority: "0.8",
          reason: "Каталог акций часто обновляется и привлекает транзакционный трафик. Высокий приоритет для краулера.",
        },
        {
          url: "/corporate",
          label: "Корпоративным клиентам",
          changefreq: "monthly",
          priority: "0.6",
          reason: "B2B-страница. Корпоративные запросы (авто для юрлиц, лизинг) не находят страницу без sitemap.",
        },
      ];

      for (const gap of SITEMAP_GAPS) {
        const sitemapKey = `sitemap:${gap.url}`;
        if (seen.has(sitemapKey)) continue;

        // Skip if URL is already in sitemap (static page, extra DB page, or brand page)
        if (currentSitemapPaths.has(gap.url)) {
          seen.add(sitemapKey);
          logger.debug({ url: gap.url }, "[seo-gap] Sitemap gap skipped — URL already in sitemap");
          continue;
        }

        const demand = 25;
        const priorityScore = applyFeedbackDiscount(
          demand * 0.5 * EASE.sitemap,
          gap.url, "sitemap", feedbackMap, positivePageSet,
        );
        const reasoning =
          `${gap.label} (${gap.url}) отсутствует в sitemap.xml. ` +
          gap.reason +
          ` Добавьте URL в массив STATIC_PAGES в файле routes/sitemap.ts.`;
        const proposed =
          `  <url>\n` +
          `    <loc>https://debryansk-auto.ru${gap.url}</loc>\n` +
          `    <changefreq>${gap.changefreq}</changefreq>\n` +
          `    <priority>${gap.priority}</priority>\n` +
          `  </url>`;

        const sitemapRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status)
          VALUES
            ('sitemap', ${gap.url}, 'Отсутствует в sitemap.xml', ${proposed},
             ${reasoning}, ${priorityScore}, ${demand}, 0.5, ${EASE.sitemap}, 'pending')
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            reasoning      = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add(sitemapKey);
        generated += sitemapRes.rows.length;
        logger.info({ url: gap.url }, "[seo-gap] Sitemap gap suggestion created");
      }

      // 9.2 Webmaster crawl errors — pages Yandex crawled and got 4xx/5xx
      try {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
        type CrawlSample = { url?: string; http_response_code?: number; httpCode?: number };
        type CrawlResp = { samples?: CrawlSample[]; url_items?: CrawlSample[] };
        const crawlData = await webmasterGet<CrawlResp>(
          `/hosts/${WEBMASTER_HOST}/crawling/samples?date_from=${weekAgo}&date_to=${today}&limit=100`,
        );
        const rawSamples = crawlData.samples ?? crawlData.url_items ?? [];
        const errors4xx = rawSamples.filter(s => {
          const code = s.http_response_code ?? s.httpCode ?? 0;
          return code >= 400 && code < 600;
        });

        for (const sample of errors4xx.slice(0, 20)) {
          const rawUrl = sample.url ?? "";
          const path = rawUrl
            .replace("https://debryansk-auto.ru", "")
            .replace("http://debryansk-auto.ru", "")
            .split("?")[0];
          if (!path || path === "/" || path.startsWith("/api/") || path.startsWith("/admin/")) continue;

          const crawlKey = `tech-crawl:${path}`;
          if (seen.has(crawlKey)) continue;

          const code = sample.http_response_code ?? sample.httpCode ?? 0;
          const reasoning =
            `Яндекс пытается обойти ${rawUrl} и получает ${code}. ` +
            `Если страница удалена — добавьте 301-редирект на ближайшую актуальную страницу ` +
            `или верните её в эфир. Битые URL снижают краулинговый бюджет.`;

          const crawlRes = await db.execute(sql`
            INSERT INTO seo_suggestions
              (type, page_url, current_value, proposed_value, reasoning,
               priority_score, demand, position_factor, ease, status)
            VALUES
              ('tech', ${path},
               ${'HTTP ' + code + ' при обходе Яндексом'},
               'Добавить 301-редирект или восстановить страницу',
               ${reasoning}, 60, 20, 0.7, ${EASE.tech}, 'pending')
            ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
              current_value  = EXCLUDED.current_value,
              reasoning      = EXCLUDED.reasoning,
              priority_score = EXCLUDED.priority_score,
              status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
              reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
              updated_at = NOW()
            RETURNING id
          `);
          seen.add(crawlKey);
          generated += crawlRes.rows.length;
          logger.info({ path, code }, "[seo-gap] Webmaster crawl error → tech suggestion");
        }
        if (errors4xx.length > 0) {
          logger.info({ count: errors4xx.length }, "[seo-gap] Webmaster crawl errors processed");
        }
      } catch (err) {
        logger.warn({ err: String(err) }, "[seo-gap] Webmaster crawl samples unavailable — skipping");
      }
    }

    // 10. Index coverage — brand pages with zero Webmaster impressions
    //     If a brand page has no queries in the last 90 days → likely not indexed.
    {
      // Build set of brand slugs that DO appear in Webmaster query data
      const visibleBrands = new Set<string>();
      for (const [queryText] of wbMap) {
        const qLower = queryText.toLowerCase();
        for (const [brandName, slug] of brandSlugs) {
          if (
            qLower.includes(brandName.toLowerCase()) ||
            qLower.includes(slug.replace(/-/g, " "))
          ) {
            visibleBrands.add(slug);
          }
        }
      }

      for (const [brandName, slug] of brandSlugs) {
        if (visibleBrands.has(slug)) continue; // has impressions — OK
        const brandUrl = `/brands/${slug}`;
        const coverageKey = `sitemap:coverage:${brandUrl}`;
        // Skip if already covered by a meta suggestion in this run
        if (seen.has(coverageKey) || seen.has(`meta:${brandUrl}`)) continue;

        const reasoning =
          `Страница бренда ${brandName} (${brandUrl}) не встречается в данных Яндекс Вебмастера. ` +
          `Возможные причины: страница не проиндексирована, нет входящих ссылок с других страниц, ` +
          `или мета-теги не соответствуют поисковым запросам. ` +
          `Рекомендуется: 1) Проверить в Вебмастере → Индексирование → Страницы. ` +
          `2) Убедиться, что страница есть в sitemap.xml. ` +
          `3) Добавить ссылки на страницу с главной и /new-cars.`;

        const coverRes = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status)
          VALUES
            ('sitemap', ${brandUrl},
             'Страница не видна в Яндекс Вебмастере (0 показов за 90 дней)',
             'Проверить индексацию в Вебмастере → убедиться в sitemap → добавить внутренние ссылки с /new-cars и главной',
             ${reasoning}, 40, 15, 0.8, ${EASE.sitemap}, 'pending')
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            reasoning      = EXCLUDED.reasoning,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add(coverageKey);
        generated += coverRes.rows.length;
        logger.info({ brand: brandName, url: brandUrl }, "[seo-gap] Zero-impression brand page → coverage suggestion");
      }
    }

    // 11. robots.txt audit — fetch live file and check for common SEO issues
    try {
      const robotsResp = await fetch("https://debryansk-auto.ru/robots.txt", {
        signal: AbortSignal.timeout(8_000),
      });
      if (!robotsResp.ok) throw new Error(`HTTP ${robotsResp.status}`);
      const robotsTxt = await robotsResp.text();
      const robotsLines = robotsTxt.split("\n").map(l => l.trim()).filter(Boolean);

      // Issue A: no Sitemap: directive
      const hasSitemapDirective = robotsLines.some(l => l.toLowerCase().startsWith("sitemap:"));
      if (!hasSitemapDirective && !seen.has("tech:robots-no-sitemap")) {
        const res = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status)
          VALUES
            ('tech', '/robots.txt',
             'Директива Sitemap: отсутствует в robots.txt',
             'Добавить строку: Sitemap: https://debryansk-auto.ru/sitemap.xml',
             'robots.txt не содержит директиву Sitemap:. Без неё Яндекс и Google находят sitemap.xml только через Search Console/Вебмастер, но не автоматически при первом обходе. Добавление Sitemap: ускоряет индексацию новых страниц.',
             55, 20, 0.9, ${EASE.tech}, 'pending')
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add("tech:robots-no-sitemap");
        generated += res.rows.length;
        logger.info("[seo-gap] robots.txt: Sitemap directive missing → tech suggestion");
      }

      // Issue B: Disallow: / for major bots (accidental full block)
      let currentAgent = "*";
      const blocked: string[] = [];
      for (const line of robotsLines) {
        const ll = line.toLowerCase();
        if (ll.startsWith("user-agent:")) currentAgent = line.slice(11).trim();
        else if (ll.startsWith("disallow:")) {
          const dPath = line.slice(9).trim();
          if (
            dPath === "/" &&
            (currentAgent === "*" ||
              currentAgent.toLowerCase().includes("yandex") ||
              currentAgent.toLowerCase().includes("google"))
          ) {
            blocked.push(`${currentAgent}: Disallow: /`);
          }
        }
      }
      if (blocked.length > 0 && !seen.has("tech:robots-full-block")) {
        const res = await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status)
          VALUES
            ('tech', '/robots.txt',
             ${blocked.join("; ")},
             'Убрать Disallow: / — полная блокировка краулеров',
             ${"КРИТИЧНО: robots.txt блокирует краулеров (" + blocked.join(", ") + "). " +
               "Весь сайт закрыт от индексации поисковиков. Немедленно уберите Disallow: / для * / Yandex / Google."},
             200, 100, 1.0, ${EASE.tech}, 'pending')
          ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
            current_value  = EXCLUDED.current_value,
            reasoning      = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
            reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
            updated_at = NOW()
          RETURNING id
        `);
        seen.add("tech:robots-full-block");
        generated += res.rows.length;
        logger.warn({ blocked }, "[seo-gap] robots.txt: full crawl block detected → tech suggestion");
      }

      logger.info({ hasSitemapDirective, blockedCount: blocked.length }, "[seo-gap] robots.txt audit done");
    } catch (err) {
      logger.warn({ err: String(err) }, "[seo-gap] robots.txt fetch failed — skipping audit");
    }

    // 12. JSON-LD coverage — check prerendered brand pages for structured data (VPS only)
    {
      const { existsSync } = await import("fs");
      const nodePath = await import("path");
      const cacheDir =
        process.env.LOCAL_PRERENDER_CACHE_DIR ||
        nodePath.resolve(__dirname, "../prerender-cache");

      if (existsSync(cacheDir)) {
        for (const [brandName, slug] of brandSlugs) {
          const brandUrl = `/brands/${slug}`;
          const jsonldKey = `tech:jsonld:${brandUrl}`;
          if (seen.has(jsonldKey)) continue;

          const html = await loadPrerendered(brandUrl);
          if (!html || html.length < 5_000) {
            // Not cached or only SPA shell — already flagged by the tech-gap step; skip here
            seen.add(jsonldKey);
            continue;
          }

          const hasJsonLd = html.includes('"application/ld+json"');
          const hasAutoDealer =
            html.includes('"AutoDealer"') || html.includes('"LocalBusiness"');

          if (!hasJsonLd) {
            // No structured data at all → likely stale prerender
            const res = await db.execute(sql`
              INSERT INTO seo_suggestions
                (type, page_url, current_value, proposed_value, reasoning,
                 priority_score, demand, position_factor, ease, status)
              VALUES
                ('tech', ${brandUrl},
                 'JSON-LD отсутствует в prerender-кэше страницы бренда',
                 'Очистить и пересобрать prerender: /api/admin/prerender/rebuild',
                 ${"Страница " + brandUrl + " (" + brandName + ") не содержит JSON-LD в кэше. " +
                   "Без schema.org AutoDealer/LocalBusiness поисковики не показывают расширенные сниппеты (рейтинг, адрес, телефон). " +
                   "Обычная причина — устаревший prerender-кэш, в котором ещё нет новых мета-тегов. Пересоберите страницу."},
                 70, 25, 0.85, ${EASE.tech}, 'pending')
              ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
                current_value  = EXCLUDED.current_value,
                reasoning      = EXCLUDED.reasoning,
                status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
                reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
                updated_at = NOW()
              RETURNING id
            `);
            seen.add(jsonldKey);
            generated += res.rows.length;
            logger.info({ url: brandUrl }, "[seo-gap] JSON-LD missing → tech suggestion");
          } else if (!hasAutoDealer) {
            // JSON-LD present but AutoDealer/LocalBusiness type missing
            const res = await db.execute(sql`
              INSERT INTO seo_suggestions
                (type, page_url, current_value, proposed_value, reasoning,
                 priority_score, demand, position_factor, ease, status)
              VALUES
                ('tech', ${brandUrl},
                 'JSON-LD есть, тип AutoDealer/LocalBusiness отсутствует',
                 'Добавить @type: ["AutoDealer","LocalBusiness"] в JSON-LD страницы бренда в seoMeta.ts',
                 ${"Страница " + brandUrl + " имеет JSON-LD, но тип AutoDealer/LocalBusiness не задан. " +
                   "Именно этот тип даёт расширенные сниппеты в Яндексе и Google для дилерских страниц. " +
                   "Проверьте seoMeta.ts: ld+json блок должен содержать @type: [\"AutoDealer\",\"LocalBusiness\"]."},
                 55, 20, 0.8, ${EASE.tech}, 'pending')
              ON CONFLICT (type, page_url) WHERE status <> 'applied' DO UPDATE SET
                current_value  = EXCLUDED.current_value,
                reasoning      = EXCLUDED.reasoning,
                status = CASE WHEN seo_suggestions.status = 'applied' THEN 'applied' ELSE 'pending' END,
                reject_reason = CASE WHEN seo_suggestions.status = 'applied' THEN seo_suggestions.reject_reason ELSE NULL END,
                updated_at = NOW()
              RETURNING id
            `);
            seen.add(jsonldKey);
            generated += res.rows.length;
            logger.info({ url: brandUrl }, "[seo-gap] JSON-LD wrong type → tech suggestion");
          } else {
            seen.add(jsonldKey); // OK — mark as checked
          }
        }
      } else {
        logger.debug("[seo-gap] Prerender cache not available — skipping JSON-LD coverage check");
      }
    }

    // 13. GEO citation opportunity. This is deliberately last so a regular
    // SEO hypothesis generated during this run owns the page first.
    generated += await runGeoGapStep();

    logger.info({ generated }, "[seo-gap] GAP analysis complete");

    await db.execute(sql`
      UPDATE gap_runs SET status='completed', completed_at=NOW(),
        duration_ms=${Date.now() - startedAt},
        suggestions_created=${generated},
        wordstat_rows=${wordstatData.length},
        webmaster_rows=${webmasterData.length}
      WHERE id=${runId}
    `);

    return { generated, skipped: false };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.execute(sql`
      UPDATE gap_runs SET status='error', completed_at=NOW(),
        duration_ms=${Date.now() - startedAt},
        error_message=${msg.slice(0, 1000)}
      WHERE id=${runId}
    `).catch(() => {});
    throw err;

  } finally {
    isGapRunning = false;
    currentRunId = null;
  }
}
