import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, locationsTable, brandsTable } from "@workspace/db";
import { asc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUsedCars, type CarRecord } from "./cars";
import { getNewCars, type NewCarRecord } from "./new-cars";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  car_ids?: string[];
}

export interface ChatCarItem {
  id: string;
  mark: string;
  model: string;
  year: number;
  price: number;
  minPrice?: number;
  discount?: number;
  color: string;
  image: string;
  path: string;
  run: number;
  isNew: boolean;
}

interface CachedContext {
  text: string;
  expiresAt: number;
}

interface FilterParams {
  brandTerms: string[];
  bodyTypeTerms: string[];
  priceMax: number | null;
  priceMin: number | null;
  typeFilter: "new" | "used" | null;
}

interface DbCar {
  external_id: string;
  type: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  price: number | null;
  mileage: number | null;
  body_type: string | null;
  complectation: string | null;
  modification: string | null;
  extras: string | null;
  image_url: string | null;
  dealer: string | null;
  owners_number: number | null;
  max_discount: number | null;
  credit_discount: number | null;
  tradein_discount: number | null;
}

let contextCache: CachedContext | null = null;

interface DbRowsCache {
  rows: DbCar[];
  expiresAt: number;
}
let dbRowsCache: DbRowsCache | null = null;

interface CatalogTextCache {
  text: string;
  map: Map<string, ChatCarItem>;
  total: number;
  expiresAt: number;
}
let catalogTextCache: CatalogTextCache | null = null;

async function buildContext(): Promise<string> {
  if (contextCache && contextCache.expiresAt > Date.now()) {
    return contextCache.text;
  }

  const [locations, brands, brandLocRows, settingsRows] = await Promise.all([
    db.select().from(locationsTable).orderBy(asc(locationsTable.sortOrder)),
    db.select().from(brandsTable),
    db.execute(sql`
      SELECT b.name AS brand, l.title AS loc_title, l.address, l.phone, lb.is_service
      FROM location_brands lb
      JOIN brands b ON b.id = lb.brand_id
      JOIN locations l ON l.id = lb.location_id
      ORDER BY b.name, l.sort_order
    `),
    db.execute(sql`SELECT key, value FROM site_settings WHERE key IN ('header_phone', 'promotions_text')`).catch(() => ({ rows: [] })),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows.rows as { key: string; value: string }[]) {
    settingsMap[r.key] = r.value;
  }
  const settingsPhone = settingsMap["header_phone"] ?? "+7 (4832) 77 77 70";
  const promotionsText = (settingsMap["promotions_text"] ?? "").trim();

  const locLines = locations.map(l =>
    `• ${l.title}: ${l.address} | Тел: ${l.phone ?? "+7 (4832) 63-10-00"} | ${l.hours ?? "Ежедневно 9:00–21:00"}`
  ).join("\n");

  const activeBrands = brands.filter(b => !b.isServiceOnly).map(b => b.name).join(", ");
  const serviceBrands = brands.filter(b => b.isServiceOnly).map(b => b.name).join(", ");

  const brandLocLines = (brandLocRows.rows as any[]).map(r =>
    `• ${r.brand}: ${r.address} | Тел: ${r.phone ?? "+7 (4832) 63-10-00"} | ${r.is_service ? "сервис" : "продажа + сервис"}`
  ).join("\n");

  const promotionsBlock = promotionsText
    ? `\n\nАКТУАЛЬНЫЕ АКЦИИ И СКИДКИ:\n${promotionsText}`
    : "";

  const text = `
ДИЛЕРСКИЕ ЦЕНТРЫ (4 локации в Брянске):
${locLines}

БРЕНДЫ И ИХ АДРЕСА:
${brandLocLines}

БРЕНДЫ — ПРОДАЖА НОВЫХ АВТОМОБИЛЕЙ:
${activeBrands}

БРЕНДЫ — ТОЛЬКО СЕРВИСНОЕ ОБСЛУЖИВАНИЕ (продажи нет):
${serviceBrands}

ОБЩИЙ ТЕЛЕФОН ГРУППЫ: ${settingsPhone}

УСЛУГИ ГРУППЫ КОМПАНИЙ:
- Продажа новых автомобилей (9 брендов)
- Автомобили с пробегом (проверенные, с историей)
- Трейд-ин (зачёт вашего автомобиля в счёт нового)
- Срочный выкуп автомобилей
- Сервисное обслуживание и ТО (все марки группы)
- Автокредитование и лизинг (через партнёров)
- Страхование ОСАГО/КАСКО

РАЗДЕЛЫ САЙТА:
- /new-cars — каталог новых автомобилей
- /cars — автомобили с пробегом
- /buyout — выкуп и трейд-ин
- /service — сервис и ТО
- /contacts — все контакты${promotionsBlock}
`.trim();

  contextCache = { text, expiresAt: Date.now() + 30 * 60 * 1000 };
  return text;
}

export async function warmContext(): Promise<void> {
  await buildContext().catch(() => {});
}

/* ─── Smart pre-filter by brand / price keywords ─────────── */

const BRAND_KEYWORDS: Record<string, string[]> = {
  // ── Haval ──────────────────────────────────────────────────
  haval:         ["haval"],
  хавал:         ["haval"],
  хэвал:         ["haval"],
  хавол:         ["haval"],   // typo
  хавел:         ["haval"],   // typo
  хавала:        ["haval"],   // genitive
  хавалу:        ["haval"],   // dative
  хавалом:       ["haval"],   // instrumental
  // ── Jolion ─────────────────────────────────────────────────
  jolion:        ["jolion"],
  джолион:       ["jolion"],
  жолион:        ["jolion"],  // typo (no д)
  джолиона:      ["jolion"],  // genitive
  // ── Haval models ───────────────────────────────────────────
  "h6":          ["h6"],
  "h9":          ["h9"],
  // ── Jetour ─────────────────────────────────────────────────
  jetour:        ["jetour"],
  джетур:        ["jetour"],
  жетур:         ["jetour"],  // typo
  джэтур:        ["jetour"],  // typo
  джетура:       ["jetour"],  // genitive
  // ── JAECOO ─────────────────────────────────────────────────
  jaecoo:        ["jaecoo"],
  джако:         ["jaecoo"],
  джэко:         ["jaecoo"],  // typo
  // ── OMODA ──────────────────────────────────────────────────
  omoda:         ["omoda"],
  омода:         ["omoda"],
  омоду:         ["omoda"],   // accusative
  омоды:         ["omoda"],   // genitive
  оможа:         ["omoda"],   // phonetic typo
  // ── Tenet ──────────────────────────────────────────────────
  tenet:         ["tenet"],
  тенет:         ["tenet"],
  тенета:        ["tenet"],   // genitive
  // ── KIA ────────────────────────────────────────────────────
  kia:           ["kia"],
  киа:           ["kia"],
  кию:           ["kia"],     // accusative "купить кию"
  кией:          ["kia"],     // instrumental
  киу:           ["kia"],     // typo
  // ── Hyundai ────────────────────────────────────────────────
  hyundai:       ["hyundai"],
  хюндай:        ["hyundai"],
  хундай:        ["hyundai"],
  хёндай:        ["hyundai"],
  хёндэй:        ["hyundai"],
  хендай:        ["hyundai"],
  хэндай:        ["hyundai"],
  // ── Toyota ─────────────────────────────────────────────────
  toyota:        ["toyota"],
  тойота:        ["toyota"],
  тайота:        ["toyota"],  // typo
  тойоту:        ["toyota"],  // accusative
  // ── Nissan ─────────────────────────────────────────────────
  nissan:        ["nissan"],
  ниссан:        ["nissan"],
  нисан:         ["nissan"],  // one с
  // ── Mazda ──────────────────────────────────────────────────
  mazda:         ["mazda"],
  мазда:         ["mazda"],
  мазду:         ["mazda"],   // accusative
  // ── Mitsubishi ─────────────────────────────────────────────
  mitsubishi:    ["mitsubishi"],
  мицубиси:      ["mitsubishi"],
  мицубиши:      ["mitsubishi"],
  // ── Lada ───────────────────────────────────────────────────
  lada:          ["lada"],
  лада:          ["lada"],
  ладу:          ["lada"],    // accusative
  // ── Ford ───────────────────────────────────────────────────
  ford:          ["ford"],
  форд:          ["ford"],
  форда:         ["ford"],    // genitive
  // ── Volkswagen ─────────────────────────────────────────────
  volkswagen:    ["volkswagen"],
  фольксваген:   ["volkswagen"],
  " vw ":        ["volkswagen"],
  фольц:         ["volkswagen"], // informal
  // ── BMW ────────────────────────────────────────────────────
  bmw:           ["bmw"],
  "бмв":         ["bmw"],
  бимер:         ["bmw"],     // slang
  // ── Mercedes ───────────────────────────────────────────────
  mercedes:      ["mercedes"],
  мерседес:      ["mercedes"],
  мерс:          ["mercedes"], // informal
  // ── Audi ───────────────────────────────────────────────────
  audi:          ["audi"],
  ауди:          ["audi"],
  // ── Skoda ──────────────────────────────────────────────────
  skoda:         ["skoda"],
  шкода:         ["skoda"],
  шкоду:         ["skoda"],   // accusative
  // ── Renault ────────────────────────────────────────────────
  renault:       ["renault"],
  рено:          ["renault"],
  // ── Chevrolet ──────────────────────────────────────────────
  chevrolet:     ["chevrolet"],
  шевроле:       ["chevrolet"],
  шеврале:       ["chevrolet"], // typo
  // ── Chery ──────────────────────────────────────────────────
  chery:         ["chery"],
  чери:          ["chery"],
  чэри:          ["chery"],   // typo
  черри:         ["chery"],   // double р
  // ── Geely ──────────────────────────────────────────────────
  geely:         ["geely"],
  джили:         ["geely"],
  гили:          ["geely"],   // without д
  // ── Exeed ──────────────────────────────────────────────────
  exeed:         ["exeed"],
  эксид:         ["exeed"],
  // ── Tank ───────────────────────────────────────────────────
  tank:          ["tank"],
  танк:          ["tank"],
  "great wall":  ["great wall"],
  // ── Lada models ────────────────────────────────────────────
  granta:        ["granta", "lada"],
  гранта:        ["granta", "lada"],
  гранту:        ["granta", "lada"],
  vesta:         ["vesta", "lada"],
  веста:         ["vesta", "lada"],
  весту:         ["vesta", "lada"],
};

/* ─── Body-type keyword → model substrings ───────────────────── */

// Maps Russian body-type keywords → substrings of the actual body_type DB column values.
// DB values: "Внедорожник 5 дв.", "Седан", "Универсал 5 дв.", "Хэтчбек 5 дв.",
//            "Лифтбек", "Внедорожник 3 дв.", "Пикап", "Минивэн"
const BODY_TYPE_KEYWORDS: Record<string, string[]> = {
  // SUV / crossover / 4x4
  кроссовер:       ["внедорожник"],
  кроссоверы:      ["внедорожник"],
  кроссоверов:     ["внедорожник"],
  кроссоверу:      ["внедорожник"],
  кроссовере:      ["внедорожник"],
  "внедорожник":   ["внедорожник"],
  "внедорожники":  ["внедорожник"],
  "внедорожника":  ["внедорожник"],
  "внедорожнике":  ["внедорожник"],
  suv:             ["внедорожник"],
  джип:            ["внедорожник"],
  // Sedan
  седан:           ["седан"],
  седане:          ["седан"],
  седана:          ["седан"],
  седаны:          ["седан"],
  седанов:         ["седан"],
  // Hatchback
  хэтчбек:         ["хэтчбек"],
  хэтчбеке:        ["хэтчбек"],
  хэтчбека:        ["хэтчбек"],
  хетчбек:         ["хэтчбек"],
  хэч:             ["хэтчбек"],
  // Wagon / Estate
  универсал:       ["универсал"],
  универсале:      ["универсал"],
  универсала:      ["универсал"],
  универсалу:      ["универсал"],
  // Liftback
  лифтбек:         ["лифтбек"],
  лифтбеке:        ["лифтбек"],
  лифтбека:        ["лифтбек"],
  // Pickup
  пикап:           ["пикап"],
  пикапе:          ["пикап"],
  пикапы:          ["пикап"],
  пикапов:         ["пикап"],
  // Minivan
  минивэн:         ["минивэн"],
  минивэне:        ["минивэн"],
  минивэны:        ["минивэн"],
  минивен:         ["минивэн"],
};

const MAX_CATALOG_CARS = 500;
const MAX_CATALOG_CHARS = 90_000;
// Full stock: 429 cars × ~130 chars (short format) ≈ 56k chars ≈ 15k tokens — fits in 128k context.
// Pinned cars use full format (with extras/complectation).
// Catalog goes in the user turn, not system prompt, to avoid Replit proxy quirks.

/* ─── Parse filter params from user message ────────────────── */

function parseMessageFilters(message: string): FilterParams {
  const msg = " " + message.toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ьъ]/g, "")
    + " ";

  const brandTerms: string[] = [];
  for (const [kw, terms] of Object.entries(BRAND_KEYWORDS)) {
    if (msg.includes(kw)) brandTerms.push(...terms);
  }

  const bodyTypeTerms: string[] = [];
  for (const [kw, terms] of Object.entries(BODY_TYPE_KEYWORDS)) {
    if (msg.includes(kw)) bodyTypeTerms.push(...terms);
  }

  let priceMax: number | null = null;
  let priceMin: number | null = null;

  const maxMln = msg.match(/до\s+(\d+(?:[.,]\d+)?)\s*млн/);
  if (maxMln) priceMax = parseFloat(maxMln[1].replace(",", ".")) * 1_000_000;

  const maxRaw = msg.match(/до\s+([\d\s]{6,10})\s*(?:руб|₽|р\.)/);
  if (maxRaw && !priceMax) {
    const n = parseInt(maxRaw[1].replace(/\s/g, ""));
    if (n >= 100_000) priceMax = n;
  }

  const minMln = msg.match(/от\s+(\d+(?:[.,]\d+)?)\s*млн/);
  if (minMln) priceMin = parseFloat(minMln[1].replace(",", ".")) * 1_000_000;

  // Detect car type filter — tokenize to avoid ASCII \b on Cyrillic
  const tokens = msg.split(/[\s,!?.;:()\[\]]+/).filter(Boolean);
  const hasNewKeyword = tokens.some(t =>
    /^нов(ый|ого|ому|ым|ом|ая|ой|ую|ые|ых|ыми)?$/.test(t) || t.startsWith("новинк")
  );
  const hasUsedKeyword =
    msg.includes("с пробегом") ||
    msg.includes("авто с пробег") ||
    tokens.some(t =>
      t === "б/у" || t === "бу" ||
      t.startsWith("подержанн") ||
      t.startsWith("поддержанн") ||
      t.startsWith("использованн")
    );
  let typeFilter: "new" | "used" | null = null;
  if (hasUsedKeyword) {
    typeFilter = "used";
  } else if (hasNewKeyword) {
    typeFilter = "new";
  }

  return {
    brandTerms: [...new Set(brandTerms)],
    bodyTypeTerms: [...new Set(bodyTypeTerms)],
    priceMax,
    priceMin,
    typeFilter,
  };
}

/* ─── Pre-filter for XML-based catalog ──────────────────────── */

function preFilter(
  used: CarRecord[],
  newCars: NewCarRecord[],
  message: string,
): { used: CarRecord[]; newCars: NewCarRecord[] } {
  // XML fallback: pass full stock, no slicing — AI must see every car.
  // typeFilter used only to sort matching type first, not to exclude.
  const { brandTerms, bodyTypeTerms, priceMax, priceMin, typeFilter } = parseMessageFilters(message);
  const hasFilter = brandTerms.length > 0 || bodyTypeTerms.length > 0 || priceMax !== null || priceMin !== null;

  const byPriceAsc = (a: { price: number }, b: { price: number }) => a.price - b.price;
  const byPriceDesc = (a: { price: number }, b: { price: number }) => b.price - a.price;
  const sortFn = priceMax !== null ? byPriceDesc : byPriceAsc;

  const matchXml = (mark: string, model: string, price: number, bodyType = "") => {
    const carStr = `${mark} ${model}`.toLowerCase().replace(/ё/g, "е");
    if (brandTerms.length > 0 && !brandTerms.some(b => carStr.includes(b))) return false;
    if (bodyTypeTerms.length > 0) {
      const bt = bodyType.toLowerCase().replace(/ё/g, "е");
      if (!bodyTypeTerms.some(t => bt.includes(t))) return false;
    }
    if (priceMax !== null && price > priceMax) return false;
    if (priceMin !== null && price < priceMin) return false;
    return true;
  };

  const sortAll = <T extends { price: number; mark: string; model: string; bodyType?: string }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => {
      if (hasFilter) {
        const aHit = matchXml(a.mark, a.model, a.price, a.bodyType ?? "") ? 0 : 1;
        const bHit = matchXml(b.mark, b.model, b.price, b.bodyType ?? "") ? 0 : 1;
        if (aHit !== bHit) return aHit - bHit;
      }
      return sortFn(a, b);
    });

  // Always return both types — typeFilter is a soft sort hint, not an exclusion.
  return { used: sortAll(used), newCars: sortAll(newCars) };
}

/* ─── Build catalog from DB (richer context) ──────────────── */

async function buildCarCatalogFromDB(
  message: string,
  pinnedIds: string[],
): Promise<{ lines: string; map: Map<string, ChatCarItem>; total: number }> {
  const map = new Map<string, ChatCarItem>();

  let allDbCars: DbCar[];
  if (dbRowsCache && dbRowsCache.expiresAt > Date.now()) {
    allDbCars = dbRowsCache.rows;
  } else {
    const result = await db.execute(sql`
      SELECT external_id, type, brand, model, year, color, price, mileage,
             body_type, complectation, modification, extras, image_url, dealer, owners_number,
             max_discount, credit_discount, tradein_discount
      FROM cars ORDER BY price ASC LIMIT 1000
    `);
    allDbCars = result.rows as DbCar[];
    dbRowsCache = { rows: allDbCars, expiresAt: Date.now() + 30 * 60 * 1000 };
    catalogTextCache = null; // invalidate text cache when rows refresh
  }

  // Early return from catalog text cache (no pinned = same text every time)
  if (pinnedIds.length === 0 && catalogTextCache && catalogTextCache.expiresAt > Date.now()) {
    return { lines: catalogTextCache.text, map: catalogTextCache.map, total: catalogTextCache.total };
  }

  // Compute minPrice per brand+model for new cars
  const newModelMinPrice = new Map<string, number>();
  for (const c of allDbCars) {
    if (c.type !== "new") continue;
    const key = `${(c.brand ?? "").toLowerCase()}|${(c.model ?? "").toLowerCase()}`;
    const cur = newModelMinPrice.get(key) ?? Infinity;
    if ((c.price ?? 0) < cur) newModelMinPrice.set(key, c.price ?? 0);
  }

  // Build complete map (for response car card lookups)
  for (const c of allDbCars) {
    const isNew = c.type === "new";
    const modelKey = `${(c.brand ?? "").toLowerCase()}|${(c.model ?? "").toLowerCase()}`;
    const item: ChatCarItem = {
      id: c.external_id,
      mark: c.brand ?? "",
      model: c.model ?? "",
      year: c.year ?? 0,
      price: c.price ?? 0,
      minPrice: isNew ? (newModelMinPrice.get(modelKey) ?? c.price ?? 0) : undefined,
      discount: (c.max_discount ?? 0) > 0 ? (c.max_discount ?? 0) : undefined,
      color: c.color ?? "",
      image: c.image_url ?? "",
      path: isNew
        ? `/new-cars/${encodeURIComponent(c.external_id)}`
        : `/cars/${encodeURIComponent(c.external_id)}`,
      run: c.mileage ?? 0,
      isNew,
    };
    map.set(c.external_id, item);
    if (isNew) {
      const dashIdx = c.external_id.indexOf("-");
      if (dashIdx !== -1) {
        const shortId = c.external_id.slice(dashIdx + 1);
        if (!map.has(shortId)) map.set(shortId, item);
      }
    }
  }

  // Short line: search fields only — used for the full catalog
  const buildShortLine = (c: DbCar): string => {
    const mod = c.modification?.trim() || "";
    const typeStr = c.type === "new" ? `новый/${c.dealer ?? ""}` : "б/у";
    // Shorten body_type: "Внедорожник 5 дв." → "Внедорожник", "Хэтчбек 5 дв." → "Хэтчбек"
    const bt = c.body_type?.replace(/\s*\d+\s*дв\.?/i, "").trim() || null;
    const discountParts = [
      (c.max_discount ?? 0) > 0 ? `скидка:${c.max_discount}₽` : null,
      (c.tradein_discount ?? 0) > 0 ? `трейдин:${c.tradein_discount}₽` : null,
      (c.credit_discount ?? 0) > 0 ? `кредит:${c.credit_discount}₽` : null,
    ].filter(Boolean);
    const parts = [
      c.year,
      mod || null,
      bt,
      c.color,
      c.type !== "new" ? `${c.mileage ?? 0}км` : null,
      `${c.price ?? 0}₽`,
      typeStr,
      c.type !== "new" && c.owners_number != null ? `владельцев:${c.owners_number}` : null,
      ...discountParts,
    ].filter(Boolean).join("|");
    return `[${c.external_id}] ${c.brand} ${c.model} ${parts}`;
  };

  // Full line: includes complectation + extras — used for pinned (already-selected) cars
  const buildFullLine = (c: DbCar): string => {
    const compl = c.complectation?.trim() || "";
    const mod = c.modification?.trim() || "";
    const extras = c.extras?.trim().slice(0, 120) || "";
    const typeStr = c.type === "new" ? `новый/${c.dealer ?? ""}` : "б/у";
    const bt = c.body_type?.replace(/\s*\d+\s*дв\.?/i, "").trim() || null;
    const discountParts = [
      (c.max_discount ?? 0) > 0 ? `скидка:${c.max_discount}₽` : null,
      (c.tradein_discount ?? 0) > 0 ? `трейдин:${c.tradein_discount}₽` : null,
      (c.credit_discount ?? 0) > 0 ? `кредит:${c.credit_discount}₽` : null,
    ].filter(Boolean);
    const parts = [
      c.year,
      mod || null,
      compl || null,
      bt,
      c.color,
      c.type !== "new" ? `${c.mileage ?? 0}км` : null,
      `${c.price ?? 0}₽`,
      typeStr,
      c.type !== "new" && c.owners_number != null ? `владельцев:${c.owners_number}` : null,
      extras ? `опции:${extras}` : null,
      ...discountParts,
    ].filter(Boolean).join("|");
    return `[${c.external_id}] ${c.brand} ${c.model} ${parts}`;
  };

  // Apply filter
  const { brandTerms, bodyTypeTerms, priceMax, priceMin, typeFilter } = parseMessageFilters(message);
  const hasFilter = brandTerms.length > 0 || bodyTypeTerms.length > 0 || priceMax !== null || priceMin !== null;

  // Sort: closest to budget first when priceMax is set, otherwise cheapest first
  const byPriceDesc = (a: DbCar, b: DbCar) => (b.price ?? 0) - (a.price ?? 0);
  const byPriceAsc = (a: DbCar, b: DbCar) => (a.price ?? 0) - (b.price ?? 0);
  const sortFn = priceMax !== null ? byPriceDesc : byPriceAsc;

  // Split by type (for stats header)
  const usedDbCars = allDbCars.filter(c => c.type !== "new");
  const newDbCars = allDbCars.filter(c => c.type === "new");
  const totalUsed = usedDbCars.length;
  const totalNew = newDbCars.length;

  const matchesBrandPrice = (c: DbCar): boolean => {
    const carStr = `${c.brand} ${c.model}`.toLowerCase().replace(/ё/g, "е");
    if (brandTerms.length && !brandTerms.some(b => carStr.includes(b))) return false;
    if (bodyTypeTerms.length) {
      const bt = (c.body_type ?? "").toLowerCase().replace(/ё/g, "е");
      if (!bodyTypeTerms.some(t => bt.includes(t))) return false;
    }
    if (priceMax !== null && (c.price ?? 0) > priceMax) return false;
    if (priceMin !== null && (c.price ?? 0) < priceMin) return false;
    return true;
  };

  // Always send the full stock — AI sees every car, no arbitrary cuts.
  // typeFilter used only for sort priority (matching type floated to top), not for exclusion.
  const candidates = [...allDbCars].sort((a, b) => {
    // Pinned cars already handled above; here sort by: type match first, then price
    const aMatch = typeFilter === null || a.type === typeFilter ? 0 : 1;
    const bMatch = typeFilter === null || b.type === typeFilter ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    // Brand/model match floated up when filter present
    if (hasFilter) {
      const aHit = matchesBrandPrice(a) ? 0 : 1;
      const bHit = matchesBrandPrice(b) ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
    }
    return sortFn(a, b);
  }).slice(0, MAX_CATALOG_CARS);

  const pinnedSet = new Set(pinnedIds);
  const stockHeader = `НАЛИЧИЕ В СТОКЕ: ${totalUsed} б/у, ${totalNew} новых (итого ${totalUsed + totalNew})\n`;
  const lines: string[] = [];
  let charCount = stockHeader.length;

  // Pinned cars first — use full format (with extras/complectation) for detail questions
  for (const pid of pinnedIds) {
    const car = allDbCars.find(c => c.external_id === pid);
    if (!car) continue;
    const line = buildFullLine(car);
    if (charCount + line.length + 1 <= MAX_CATALOG_CHARS) {
      lines.push(line);
      charCount += line.length + 1;
    }
  }

  // Rest of catalog — short format so full stock fits in context
  for (const c of candidates) {
    if (pinnedSet.has(c.external_id)) continue;
    const line = buildShortLine(c);
    if (charCount + line.length + 1 > MAX_CATALOG_CHARS) break;
    lines.push(line);
    charCount += line.length + 1;
  }

  const fullText = stockHeader + lines.join("\n");

  // Store in catalog text cache when no pinned cars (pinned vary per request)
  if (pinnedIds.length === 0) {
    catalogTextCache = { text: fullText, map, total: lines.length, expiresAt: Date.now() + 30 * 60 * 1000 };
  }

  return { lines: fullText, map, total: lines.length };
}

/* ─── Build catalog text + full lookup map ────────────────── */
async function buildCarCatalog(
  message: string,
  pinnedIds: string[] = [],
): Promise<{ lines: string; map: Map<string, ChatCarItem>; total: number }> {
  // Try DB first (Task #96)
  try {
    const countResult = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cars`);
    const dbCount = Number((countResult.rows[0] as any)?.cnt ?? 0);
    if (dbCount > 0) {
      return await buildCarCatalogFromDB(message, pinnedIds);
    }
  } catch { /* DB not ready yet — fall through to XML */ }

  // XML fallback
  const map = new Map<string, ChatCarItem>();
  let allUsed: CarRecord[] = [];
  let allNew: NewCarRecord[] = [];

  try {
    const [ur, nr] = await Promise.allSettled([getUsedCars(), getNewCars()]);
    if (ur.status === "fulfilled") allUsed = ur.value;
    if (nr.status === "fulfilled") allNew = nr.value;
  } catch { /* catalog unavailable — chat still works */ }

  for (const c of allUsed) {
    const item: ChatCarItem = {
      id: c.id, mark: c.mark, model: c.model, year: c.year,
      price: c.price, color: c.color, image: c.images[0] ?? "",
      path: `/cars/${encodeURIComponent(c.id)}`, run: c.run, isNew: false,
    };
    map.set(c.id, item);
  }
  for (const c of allNew) {
    const item: ChatCarItem = {
      id: c.id, mark: c.mark, model: c.model, year: c.year,
      price: c.price, color: c.color, image: c.images[0] ?? "",
      path: `/new-cars/${encodeURIComponent(c.id)}`, run: 0, isNew: true,
    };
    map.set(c.id, item);
    const dashIdx = c.id.indexOf("-");
    if (dashIdx !== -1) {
      const shortId = c.id.slice(dashIdx + 1);
      if (!map.has(shortId)) map.set(shortId, item);
    }
  }

  const { used: fu, newCars: fn } = preFilter(allUsed, allNew, message);

  const pinnedSet = new Set(pinnedIds);
  const lines: string[] = [];
  let charCount = 0;

  // Pinned cars first (dialog context — Task #95)
  for (const pid of pinnedIds) {
    const car = map.get(pid);
    if (!car) continue;
    const line = `[${car.id}] ${car.mark} ${car.model} ${car.year}|${car.color}|${car.run > 0 ? car.run + "км" : "новый"}|${car.price}₽`;
    if (charCount + line.length + 1 <= MAX_CATALOG_CHARS) {
      lines.push(line);
      charCount += line.length + 1;
    }
  }

  for (const c of fu) {
    if (pinnedSet.has(c.id)) continue;
    const mod = c.modification?.trim() || "";
    const owners = c.ownersNumber ? parseInt(c.ownersNumber, 10) : null;
    const parts = [
      c.year,
      mod || null,
      c.color,
      `${c.run}км`,
      `${c.price}₽`,
      "б/у",
      owners != null ? `владельцев:${owners}` : null,
    ].filter(Boolean).join("|");
    const line = `[${c.id}] ${c.mark} ${c.model} ${parts}`;
    if (charCount + line.length + 1 > MAX_CATALOG_CHARS) break;
    lines.push(line);
    charCount += line.length + 1;
  }
  for (const c of fn) {
    if (pinnedSet.has(c.id)) continue;
    const mod = c.modification?.trim() || "";
    const parts = [
      c.year,
      mod || null,
      c.color,
      "новый",
      `${c.price}₽`,
      c.dealer,
    ].filter(Boolean).join("|");
    const line = `[${c.id}] ${c.mark} ${c.model} ${parts}`;
    if (charCount + line.length + 1 > MAX_CATALOG_CHARS) break;
    lines.push(line);
    charCount += line.length + 1;
  }

  return { lines: lines.join("\n"), map, total: lines.length };
}

/* ─── System prompt (no catalog — catalog goes in user turn) ── */
const SYSTEM_PROMPT = (context: string) =>
  `Ты — «Навигатор», ИИ-консультант автодилерской группы «Дебрянск Авто» (Территория Автомобилей).

ФОРМАТ ОТВЕТА:
Пиши ответ напрямую — без JSON-обёртки и без markdown-блоков.
В самом конце ответа, на отдельных новых строках, добавляй теги если нужно:
[[CARS:id1,id2,id3]] — ID авто из каталога (max 3), только если рекомендуешь конкретные машины
[[ACTION:тип]] — один из четырёх типов (см. правила ниже), если нужно предложить действие
Теги ставь ТОЛЬКО если нужны. Для общих вопросов (адреса, услуги, цены в целом) — теги не нужны.

ПРАВИЛА — ОБЯЗАТЕЛЬНЫ:
1. Ответ всегда содержит осмысленный текст. Никогда не оставляй пустым.
2. Отвечай ТОЛЬКО на основе данных ниже. Не придумывай цены, адреса, характеристики.
3. Если данных нет — скажи: «Уточните у менеджера по телефону» и дай номер.
4. Обращайся на «Вы». Тон: дружелюбный эксперт, без канцелярита. Кратко и конкретно.
5. Не обсуждай конкурентов.
6. Скидки и акции: если в блоке «АКТУАЛЬНЫЕ АКЦИИ И СКИДКИ» ниже есть данные — рассказывай о них клиенту. Если такого блока нет — не обещай скидок и направляй к менеджеру.
7. [[ACTION:testdrive]] — ТОЛЬКО если клиент явно хочет тест-драйв (попробовать, посидеть, проехаться на авто).
7a. [[ACTION:service_form]] — если клиент хочет записаться на сервис, техническое обслуживание (ТО), ремонт, диагностику или любые сервисные работы.
8. [[ACTION:contact_form]] — если клиент готов оставить контакты для обратного звонка («да, перезвоните», «хочу чтобы связались», «оставлю номер»). Показывает мини-форму с полями Имя + Телефон прямо в чате — удобнее чем кнопка. Используй вместо callback.
9. [[ACTION:tradein_form]] — если клиент интересуется трейд-ин, выкупом или обменом своего авто. Показывает форму оценки (марка, модель, год, пробег, контакты) прямо в чате с предварительным расчётом стоимости.
10. [[ACTION:callback]] — ТОЛЬКО если явно просит перезвонить без намерения оставить форму (устаревший вариант, предпочитай contact_form).
11. [[CARS:...]] — только реально существующие ID из каталога, подходящие под запрос.
12. Отвечай ТОЛЬКО на русском языке.
13. Контекст диалога: используй всю историю переписки. Если клиент ссылается на ранее упомянутые авто («первый», «тот красный», «дешевле есть?») — отвечай именно по ним, не игнорируй историю.
14. Если в каталоге есть комплектация и список опций — используй их при ответе на вопросы о характеристиках.
15. КПП и привод: поле «модификация» содержит строку вида «2.0d AT 4WD (190 л.с.)». AT/AMT/CVT = автомат, MT = механика, AT 4WD/AWD = полный привод, FWD = передний, RWD = задний. Фильтруй авто по этим значениям когда клиент просит конкретный тип КПП или привода.
16. Пробег: поле пробег указано в км. При запросах «до X км» или «не более X км» — показывай только авто где пробег ≤ X. Числа сравнивай строго (100000 км = 100 000 км).
17. Владельцы: поле «владельцев:N» есть только у авто с пробегом. При запросе «1 владелец» или «один хозяин» — показывай только авто с владельцев:1.
18. НИКОГДА не упоминай технические ID (вида CME_7..., XXX-123... и любые коды из каталога) в тексте ответа. ID используются ТОЛЬКО в теге [[CARS:...]]. В тексте пиши только: марка, модель, год, цена, характеристики.
19. НЕ предлагай фотографии, изображения, скриншоты или визуальные материалы. У тебя нет возможности отправлять фото — если клиент просит «покажите», «пришлите фото» или «а можно фото», честно скажи: «У меня нет возможности отправлять фото, но вы можете посмотреть автомобиль на странице в каталоге» и дай ссылку на /new-cars или /cars.
20. ФОРМАТИРУЙ ответ для удобства чтения: разделяй смысловые части двойным переносом строки (\n\n). При перечислении нескольких вариантов используй маркеры «• » в начале каждого пункта. Выделяй ключевые характеристики жирным через **текст**. Не пиши длинные сплошные абзацы — разбивай на логичные части.
21. Каталог содержит ВЕСЬ сток без фильтров — все авто переданы тебе. Строка «НАЛИЧИЕ В СТОКЕ» в начале показывает точные числа — используй их для ответов «сколько у вас авто». Любая модель из каталога (Dargo, Shimo, Jolion, Tank, Jaecoo, Omoda и др.) есть в списке — просто найди её по марке и модели. Для вопросов об опциях — смотри поле «опции:» (есть у машин из истории диалога).
22. Если клиент не уточнил тип (новый или б/у) — ВСЕГДА предлагай варианты из ОБОИХ типов. Покажи лучшие новые И лучшие б/у под запрос — дай клиенту выбор. Не ограничивайся одним типом без явной просьбы.
23. Тип кузова: в каталоге каждая машина имеет поле кузова (Внедорожник, Седан, Хэтчбек, Универсал, Лифтбек, Пикап, Минивэн). При запросе «седан», «хэтчбек», «кроссовер», «внедорожник», «универсал», «пикап», «минивэн» — строго фильтруй авто по полю кузова, не по марке и модели.

ДАННЫЕ О КОМПАНИИ:
${context}`;

/* ─── Parse GPT response (tag format + JSON fallback) ────────── */
function parseRawResponse(raw: string): { reply: string; car_ids: string[]; action: string | null } {
  let text = raw;
  let car_ids: string[] = [];
  let action: string | null = null;

  // Primary: [[CARS:id1,id2,id3]] tag
  const carsMatch = text.match(/\[\[CARS:([^\]]*)\]\]/);
  if (carsMatch) {
    car_ids = carsMatch[1].split(",").map(s => s.trim()).filter(Boolean);
    text = text.replace(/\[\[CARS:[^\]]*\]\]/, "").trim();
  }

  // Primary: [[ACTION:...]] tag
  const actionMatch = text.match(/\[\[ACTION:(callback|testdrive|contact_form|tradein_form|service_form)\]\]/);
  if (actionMatch) {
    action = actionMatch[1];
    text = text.replace(/\[\[ACTION:[^\]]*\]\]/, "").trim();
  }

  // Fallback: old JSON format
  if (!car_ids.length && !action) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reply) {
          return {
            reply: parsed.reply.trim(),
            car_ids: Array.isArray(parsed.car_ids) ? parsed.car_ids : [],
            action: parsed.action ?? null,
          };
        }
      } catch { /* not JSON */ }
    }
  }

  // Fallback: old [ACTION:...] single-bracket tag
  if (!action) {
    const oldAction = text.match(/\[ACTION:(callback|testdrive)\]/);
    if (oldAction) {
      action = oldAction[1];
      text = text.replace(/\[ACTION:(callback|testdrive)\]\s*/, "").trim();
    }
  }

  return {
    reply: text || "Уточните вопрос или позвоните нам: +7 (4832) 77 77 70",
    car_ids,
    action,
  };
}

/* ─── Route: POST /chat ───────────────────────────────────────── */
router.post("/chat", async (req, res) => {
  try {
    const {
      message,
      history = [],
      session_id,
      consented_at,
    } = req.body as {
      message: string;
      history: ChatMessage[];
      session_id?: string;
      consented_at?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "message required" });
    }
    if (message.trim().length > 1000) {
      return res.status(400).json({ ok: false, error: "message too long" });
    }

    const trimmed = message.trim();

    // Extract car_ids from previous AI messages for dialog context (Task #95)
    const pinnedIds = history
      .filter(m => m.role === "assistant" && Array.isArray(m.car_ids) && (m.car_ids?.length ?? 0) > 0)
      .flatMap(m => m.car_ids ?? [])
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .slice(0, 10);

    // Start user message save in parallel with context+catalog build (non-blocking)
    const userSavePromise: Promise<number | null> =
      session_id && consented_at && session_id.length <= 128
        ? (async () => {
            try {
              await db.execute(sql`
                INSERT INTO conversations (session_id, consented_at, title)
                VALUES (${session_id}, ${new Date(consented_at)}, 'Чат')
                ON CONFLICT (session_id) DO NOTHING
              `);
              const convResult = await db.execute(sql`
                SELECT id FROM conversations WHERE session_id = ${session_id}
              `);
              const cid: number | null = (convResult.rows[0] as any)?.id ?? null;
              if (cid) {
                await db.execute(sql`
                  INSERT INTO messages (conversation_id, role, content)
                  VALUES (${cid}, 'user', ${trimmed})
                `);
              }
              return cid;
            } catch (saveErr) {
              logger.warn({ saveErr }, "Chat: failed to save user message");
              return null;
            }
          })()
        : Promise.resolve(null);

    const [context, { lines: carCatalog, map: carMap, total: catalogSize }] = await Promise.all([
      buildContext(),
      buildCarCatalog(trimmed, pinnedIds),
    ]);

    const catalogBlock = carCatalog
      ? `[КАТАЛОГ — ${catalogSize} авто в выборке (формат: [id] марка модель год|модификация(КПП/привод)|цвет|пробег|цена|тип|владельцев:N; у машин из истории диалога дополнительно: комплектация|опции)]\n${carCatalog}\n\n`
      : "";

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT(context) },
      ...history.slice(-8).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: `${catalogBlock}Вопрос клиента: ${trimmed}` },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4000,
      messages,
    });

    const raw = (completion.choices[0]?.message?.content ?? "").trim();
    const { reply, car_ids, action } = parseRawResponse(raw);

    const cars: ChatCarItem[] = car_ids
      .slice(0, 3)
      .map(id => carMap.get(id))
      .filter((c): c is ChatCarItem => c !== undefined);

    // Respond immediately — DB saves happen in background (fire-and-forget)
    res.json({ ok: true, reply, action, cars, message_id: null });

    // Background: await user save then insert AI message
    userSavePromise
      .then(convId => {
        if (!convId) return;
        return db.execute(sql`
          INSERT INTO messages (conversation_id, role, content, car_ids)
          VALUES (
            ${convId}, 'assistant', ${reply},
            ${car_ids.length > 0 ? JSON.stringify(car_ids) : null}
          )
        `);
      })
      .catch(err => logger.warn({ err }, "Chat: failed to save AI message"));
  } catch (err: any) {
    logger.error({ err }, "Chat error");
    return res.status(500).json({
      ok: false,
      error: "Не удалось получить ответ. Попробуйте ещё раз.",
    });
  }
});

/* ─── Route: POST /chat/stream (SSE streaming) ───────────────── */
router.post("/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvt = (data: object) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* closed */ }
  };

  try {
    const { message, history = [], session_id, consented_at } = req.body as {
      message: string;
      history: ChatMessage[];
      session_id?: string;
      consented_at?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      sendEvt({ t: "error", message: "Сообщение не может быть пустым." });
      return res.end();
    }
    if (message.trim().length > 1000) {
      sendEvt({ t: "error", message: "Сообщение слишком длинное." });
      return res.end();
    }

    const trimmed = message.trim();

    const pinnedIds = history
      .filter(m => m.role === "assistant" && Array.isArray(m.car_ids) && (m.car_ids?.length ?? 0) > 0)
      .flatMap(m => m.car_ids ?? [])
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .slice(0, 10);

    const userSavePromise: Promise<number | null> =
      session_id && consented_at && session_id.length <= 128
        ? (async () => {
            try {
              await db.execute(sql`
                INSERT INTO conversations (session_id, consented_at, title)
                VALUES (${session_id}, ${new Date(consented_at)}, 'Чат')
                ON CONFLICT (session_id) DO NOTHING
              `);
              const convResult = await db.execute(sql`SELECT id FROM conversations WHERE session_id = ${session_id}`);
              const cid: number | null = (convResult.rows[0] as any)?.id ?? null;
              if (cid) {
                await db.execute(sql`
                  INSERT INTO messages (conversation_id, role, content) VALUES (${cid}, 'user', ${trimmed})
                `);
              }
              return cid;
            } catch (saveErr) {
              logger.warn({ saveErr }, "Chat/stream: failed to save user message");
              return null;
            }
          })()
        : Promise.resolve(null);

    const [context, { lines: carCatalog, map: carMap, total: catalogSize }] = await Promise.all([
      buildContext(),
      buildCarCatalog(trimmed, pinnedIds),
    ]);

    const catalogBlock = carCatalog
      ? `[КАТАЛОГ — ${catalogSize} авто в выборке (формат: [id] марка модель год|модификация(КПП/привод)|цвет|пробег|цена|тип|владельцев:N; у машин из истории диалога дополнительно: комплектация|опции)]\n${carCatalog}\n\n`
      : "";

    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT(context) },
      ...history.slice(-8).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: `${catalogBlock}Вопрос клиента: ${trimmed}` },
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4000,
      messages: msgs,
      stream: true,
    });

    let accumulated = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        accumulated += delta;
        sendEvt({ t: "chunk", v: delta });
      }
    }

    const { reply, car_ids, action } = parseRawResponse(accumulated);
    const cars: ChatCarItem[] = car_ids
      .slice(0, 3)
      .map(id => carMap.get(id))
      .filter((c): c is ChatCarItem => c !== undefined);

    sendEvt({ t: "done", reply, cars, action, message_id: null });
    res.end();

    // Background DB save
    userSavePromise
      .then(convId => {
        if (!convId) return;
        return db.execute(sql`
          INSERT INTO messages (conversation_id, role, content, car_ids)
          VALUES (
            ${convId}, 'assistant', ${reply},
            ${car_ids.length > 0 ? JSON.stringify(car_ids) : null}
          )
        `);
      })
      .catch(err => logger.warn({ err }, "Chat/stream: failed to save AI message"));

  } catch (err: any) {
    logger.error({ err }, "Chat/stream error");
    try {
      sendEvt({ t: "error", message: "Не удалось получить ответ. Попробуйте ещё раз." });
      res.end();
    } catch { /* already closed */ }
  }
});

/* ─── Route: POST /chat/rate ─────────────────────────────────── */
router.post("/chat/rate", async (req, res) => {
  try {
    const { message_id, rating } = req.body as { message_id?: number; rating?: number };
    if (!message_id || (rating !== 1 && rating !== -1)) {
      return res.status(400).json({ ok: false, error: "message_id and rating (1 or -1) required" });
    }
    await db.execute(sql`
      UPDATE messages SET rating = ${rating}
      WHERE id = ${message_id} AND role = 'assistant'
    `);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
