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

/* ── Ease factors by suggestion type ─────────────────────────────────── */
const EASE: Record<string, number> = {
  meta: 1.0,
  tech: 0.9,
  cluster: 0.6,
  content: 0.6,
  new_page: 0.3,
};

/* ── Page size thresholds for tech gap detection (bytes) ─────────────── */
const TECH_THRESHOLDS: Record<string, number> = {
  brand: 50_000,
  car: 30_000,
  default: 20_000,
};

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
}> {
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
      return { size: 0, isTechGap: true, isCacheAvailable: true, threshold };
    }
    const size = Buffer.byteLength(html, "utf-8");
    return { size, isTechGap: size < threshold, isCacheAvailable: true, threshold };
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

  const formatPrice = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);

  // Build proposed title with the top query keyword embedded
  const posTag = avgPosition > 10 ? "" : ` — позиция ${Math.round(avgPosition)}`;
  const dealerType = brand.is_service_only ? "официальный сервис" : "официальный дилер";

  const proposedTitle = `${brand.name} в Брянске — ${dealerType} | Дебрянск Авто`;

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

  void posTag; // used in reasoning only
  return { currentTitle, currentDesc, proposedTitle, proposedDesc };
}

let isGapRunning = false;
let currentRunId: number | null = null;

export function isGapRunning_(): boolean { return isGapRunning; }
export function currentGapRunId(): number | null { return currentRunId; }

/* ── Петля Карпаты: priority discount for pages with negative evaluations ─ */
function applyFeedbackDiscount(
  score: number,
  pageUrl: string,
  feedbackMap: Map<string, string>,
): number {
  return feedbackMap.has(pageUrl) ? score * 0.5 : score;
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

    // 0. Load Петля Карпаты feedback — pages with fell/falsified get 0.5× priority discount
    let feedbackMap = new Map<string, string>();
    try {
      const { getEvaluationFeedback } = await import("./seo-evaluator");
      feedbackMap = await getEvaluationFeedback();
      if (feedbackMap.size > 0) {
        logger.info({ discountedPages: feedbackMap.size }, "[seo-gap] Applying Karpathy Loop feedback discounts");
      }
    } catch (fbErr) {
      logger.warn({ fbErr }, "[seo-gap] Could not load evaluation feedback — proceeding without discounts");
    }

    // 1. Load latest Wordstat snapshot
    const wordstatRows = await db.execute(sql`
      SELECT query, shows_count, source, parent_query
      FROM wordstat_snapshots
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM wordstat_snapshots)
        AND shows_count > 0
      ORDER BY shows_count DESC
      LIMIT 1000
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

    // 2. Load latest Webmaster snapshot
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

    // 4. Track which (pageUrl, type) pairs we've already proposed in this run
    const seen = new Set<string>();

    // 5. Generate META suggestions from seed queries
    const seedQueries = wordstatData.filter(r => r.source === "seed");

    for (const ws of seedQueries.slice(0, 100)) {
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

      const priorityScore = applyFeedbackDiscount(
        ws.shows_count * positionFactor * EASE.meta, pageUrl, feedbackMap,
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

      await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status)
        VALUES
          ('meta', ${pageUrl},
           ${`title: ${proposal.currentTitle}\ndesc: ${proposal.currentDesc}`},
           ${`title: ${proposal.proposedTitle}\ndesc: ${proposal.proposedDesc}`},
           ${reasoning},
           ${priorityScore}, ${ws.shows_count}, ${positionFactor}, ${EASE.meta}, 'pending')
        ON CONFLICT (type, page_url) DO UPDATE SET
          current_value = EXCLUDED.current_value,
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          position_factor = EXCLUDED.position_factor,
          updated_at = NOW()
        WHERE seo_suggestions.status = 'pending'
      `);
      seen.add(key);
      generated++;
    }

    // 5.5 Generate "content" suggestions for model-level seed queries.
    //     The META loop above only creates one suggestion per brand page (deduped by seen).
    //     Model-level queries ("jaecoo j7 брянск", "хавал дарго брянск", etc.) are silently
    //     dropped after the brand-level suggestion fires.  We now collect them separately
    //     and propose content additions (model-specific sections) for the brand page.
    {
      await db.execute(sql`
        DELETE FROM seo_suggestions WHERE type = 'content'
          AND page_url LIKE '/brands/%' AND status = 'pending'
      `);

      // Accumulate: brand slug → list of {query, shows, modelTerm}
      const modelMap = new Map<string, {
        brand: BrandEntry;
        brandSlug: string;
        items: { query: string; shows: number; modelTerm: string }[];
      }>();

      for (const ws of seedQueries) {
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
        if (totalShows < 20) continue; // not enough demand

        // Deduplicate by model term, pick highest-shows entry per model
        const byModel = new Map<string, { query: string; shows: number }>();
        for (const item of items) {
          const existing = byModel.get(item.modelTerm);
          if (!existing || item.shows > existing.shows) {
            byModel.set(item.modelTerm, { query: item.query, shows: item.shows });
          }
        }

        const pageUrl = `/brands/${brandSlug}`;
        const sorted = [...byModel.entries()].sort((a, b) => b[1].shows - a[1].shows);

        const proposedValue = sorted
          .map(([model, { query, shows }]) =>
            `${model.toUpperCase()}: «${query}» — ${shows} показов/мес`)
          .join("\n");

        const modelList = sorted.map(([m]) => m.toUpperCase()).join(", ");
        const reasoning =
          `Wordstat выявил модельные запросы для ${brand.brandName}: ${sorted
            .map(([m, { query, shows }]) => `«${query}» (${shows} показов)`)
            .join("; ")}. ` +
          `Суммарный спрос: ${totalShows} показов/мес. Рекомендуется добавить отдельные секции ` +
          `для моделей ${modelList} на странице бренда с характеристиками, ценами и CTA.`;

        const avgPosition = 15; // models typically not indexed yet
        const positionFactor = Math.min((avgPosition - 1) / maxPosition, 1);
        const priorityScore = applyFeedbackDiscount(
          totalShows * positionFactor * EASE.content, pageUrl, feedbackMap,
        );

        await db.execute(sql`
          INSERT INTO seo_suggestions
            (type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease, status)
          VALUES
            ('content', ${pageUrl}, '', ${proposedValue}, ${reasoning},
             ${priorityScore}, ${totalShows}, ${positionFactor}, ${EASE.content}, 'pending')
          ON CONFLICT (type, page_url) DO UPDATE SET
            proposed_value = EXCLUDED.proposed_value,
            reasoning = EXCLUDED.reasoning,
            priority_score = EXCLUDED.priority_score,
            demand = EXCLUDED.demand,
            updated_at = NOW()
          WHERE seo_suggestions.status = 'pending'
        `);
        generated++;
        logger.info({ brand: brand.brandName, models: modelList, totalShows }, "[seo-gap] Model content suggestion created");
      }
    }

    // 6. Generate CLUSTER suggestions from Webmaster queries (seo_query_snapshots).
    //    Real positions + CTR from Яндекс Вебмастер — much more accurate than
    //    Wordstat "related" which contained geographic noise (news, hospitals, etc.)
    await db.execute(sql`
      DELETE FROM seo_suggestions WHERE type = 'cluster' AND status = 'pending'
    `);
    logger.info("[seo-gap] Building clusters from Webmaster data");

    // Load queries: positions 4–20 (room to grow), min 20 shows
    const wmClusterRows = await db.execute(sql`
      SELECT query_text, total_shows, total_clicks, avg_position
      FROM seo_query_snapshots
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM seo_query_snapshots)
        AND avg_position BETWEEN 4 AND 20
        AND total_shows >= 20
      ORDER BY total_shows DESC
    `);
    type WmClRow = { query_text: string; total_shows: number; total_clicks: number; avg_position: number };
    const wmClusterData = wmClusterRows.rows as WmClRow[];

    // Group by brand
    const brandClusterMap = new Map<string, { brand: BrandEntry & { slug: string; brandName: string }; rows: WmClRow[] }>();
    const genericClusterRows: WmClRow[] = [];

    for (const row of wmClusterData) {
      const brand = matchBrand(row.query_text);
      if (brand) {
        if (!brandClusterMap.has(brand.slug)) brandClusterMap.set(brand.slug, { brand, rows: [] });
        brandClusterMap.get(brand.slug)!.rows.push(row);
      } else if (isAutomotiveQuery(row.query_text, [])) {
        genericClusterRows.push(row);
      }
    }

    // ── Brand clusters → /brands/:slug ──────────────────────────────────
    for (const [, { brand, rows }] of brandClusterMap) {
      const brandSlug = brandSlugs.get(brand.brandName.toLowerCase()) ?? brand.slug;
      const pageUrl = `/brands/${brandSlug}`;
      const clusterKey = `cluster:${pageUrl}`;
      if (seen.has(clusterKey)) continue;

      const relevant = rows.filter(r => isAutomotiveQuery(r.query_text, brand.keywords));
      const totalDemand = relevant.reduce((s, r) => s + r.total_shows, 0);

      // Need at least 2 queries with combined demand ≥ 50
      if (relevant.length < 2 || totalDemand < 50) {
        logger.debug({ brand: brand.brandName, count: relevant.length, totalDemand },
          "[seo-gap] Cluster skipped — below threshold");
        continue;
      }

      const sorted = relevant.sort((a, b) => b.total_shows - a.total_shows);
      const avgPos = sorted.reduce((s, r) => s + r.avg_position, 0) / sorted.length;
      const positionFactor = Math.min((avgPos - 1) / maxPosition, 1);
      const priorityScore = applyFeedbackDiscount(
        totalDemand * positionFactor * EASE.cluster, pageUrl, feedbackMap,
      );

      const topPhrasesStr = sorted.slice(0, 5)
        .map(r => `«${r.query_text}» (поз. ${r.avg_position.toFixed(1)}, ${r.total_shows} показов)`)
        .join("; ");

      const ctr = sorted[0] ? (sorted[0].total_clicks / Math.max(sorted[0].total_shows, 1) * 100).toFixed(1) : "0";

      const reasoning =
        `Кластер запросов Яндекс Вебмастера для ${brand.brandName}: ${topPhrasesStr}. ` +
        `Суммарный спрос: ${totalDemand} показов/мес, средняя позиция: ${avgPos.toFixed(1)}, CTR топ-запроса: ${ctr}%. ` +
        `Рекомендуется добавить FAQ-блок или текст на страницу бренда, отвечающий на эти запросы.`;

      const proposed = sorted.slice(0, 5)
        .map(r => `${r.query_text} (позиция ${r.avg_position.toFixed(1)})`)
        .join("\n");

      await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status)
        VALUES
          ('cluster', ${pageUrl}, '', ${proposed}, ${reasoning},
           ${priorityScore}, ${totalDemand}, ${positionFactor}, ${EASE.cluster}, 'pending')
        ON CONFLICT (type, page_url) DO UPDATE SET
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          updated_at = NOW()
        WHERE seo_suggestions.status = 'pending'
      `);
      seen.add(clusterKey);
      generated++;
    }

    // ── Generic /cars cluster (б/у авто, купить авто и т.п.) ─────────────
    const genericDemand = genericClusterRows.reduce((s, r) => s + r.total_shows, 0);
    const genericKey = "cluster:/cars";
    if (!seen.has(genericKey) && genericClusterRows.length >= 3 && genericDemand >= 100) {
      const sorted = genericClusterRows.sort((a, b) => b.total_shows - a.total_shows);
      const avgPos = sorted.slice(0, 5).reduce((s, r) => s + r.avg_position, 0) / Math.min(sorted.length, 5);
      const positionFactor = Math.min((avgPos - 1) / maxPosition, 1);
      const priorityScore = applyFeedbackDiscount(
        genericDemand * positionFactor * EASE.cluster, "/cars", feedbackMap,
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

      await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status)
        VALUES
          ('cluster', '/cars', '', ${proposed}, ${reasoning},
           ${priorityScore}, ${genericDemand}, ${positionFactor}, ${EASE.cluster}, 'pending')
        ON CONFLICT (type, page_url) DO UPDATE SET
          proposed_value = EXCLUDED.proposed_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          demand = EXCLUDED.demand,
          updated_at = NOW()
        WHERE seo_suggestions.status = 'pending'
      `);
      seen.add(genericKey);
      generated++;
    }

    // 7. Tech gap check for top 8 brand pages by priority
    //    Clear stale pending tech suggestions first — they were generated via
    //    curl from Replit which can't reach the production domain and returned
    //    0 bytes, causing false positives.
    await db.execute(sql`
      DELETE FROM seo_suggestions WHERE type = 'tech' AND status = 'pending'
    `);
    logger.info("[seo-gap] Cleared stale pending tech suggestions");

    const topBrandPages = [...seen]
      .filter(k => k.startsWith("meta:"))
      .map(k => k.replace("meta:", ""))
      .slice(0, 8);

    for (const pageUrl of topBrandPages) {
      const techKey = `tech:${pageUrl}`;
      if (seen.has(techKey)) continue;

      const { size, isTechGap, isCacheAvailable, threshold } = await checkTechGap(pageUrl);
      // If cache infrastructure is not mounted (Replit/dev), skip TECH suggestions
      // entirely for this run — don't generate false positives.
      if (!isCacheAvailable) {
        logger.debug("[seo-gap] Prerender cache root unavailable — skipping TECH suggestions");
        break; // same result for all pages in this env
      }
      if (!isTechGap) continue;

      const demand = 100; // baseline demand for tech gaps
      const positionFactor = 0.8;
      const priorityScore = demand * positionFactor * EASE.tech;

      const sizeLabel = size === 0 ? "файл отсутствует в кэше" : `${size} байт`;
      const reasoning =
        `Страница ${pageUrl}: пририндер-кэш на диске — ${sizeLabel} (порог: ${threshold} байт). ` +
        `Вероятно, страница не пририндерена — бот получает SPA-оболочку без контента.`;

      await db.execute(sql`
        INSERT INTO seo_suggestions
          (type, page_url, current_value, proposed_value, reasoning,
           priority_score, demand, position_factor, ease, status)
        VALUES
          ('tech', ${pageUrl},
           ${`Размер кэша: ${sizeLabel} (порог: ${threshold})`},
           'Запустить пририндер страницы',
           ${reasoning},
           ${priorityScore}, ${demand}, ${positionFactor}, ${EASE.tech}, 'pending')
        ON CONFLICT (type, page_url) DO UPDATE SET
          current_value = EXCLUDED.current_value,
          reasoning = EXCLUDED.reasoning,
          priority_score = EXCLUDED.priority_score,
          updated_at = NOW()
        WHERE seo_suggestions.status = 'pending'
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
      generated++;
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
