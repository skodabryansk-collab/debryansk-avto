/**
 * SEO AI text generation helpers.
 * Wraps openai/gpt-4.1 calls with timeout, retry, cache, few-shot examples.
 * Every public function returns a fallback value on error — GAP analysis never breaks.
 *
 * Post-validation: after every AI response, regex patterns detect hallucinated
 * numbers (prices, rates, car counts). On first hallucination → retry once with
 * reinforced prohibition appended to the prompt. On second failure → caller receives
 * { generatedBy: "ai_hallucinated" } and can reject the seo_suggestions row.
 */
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

const SEO_AI_MODEL = "openai/gpt-4.1";  // gpt-4.1-mini not available on Timeweb gateway
const SEO_AI_TIMEOUT_MS = 15_000;

/* ── Hallucination detection ─────────────────────────────────────────── */

/**
 * Sentinel signal returned by aiClusterToFaqs (and propagated by preGenClusterFaqs
 * in seo-gap.ts) when both retry attempts produced hallucinated content.
 * The caller must mark the seo_suggestions row as rejected.
 */
export const AI_HALLUCINATION_SIGNAL = "__AI_HALLUCINATED__";

/**
 * Regex patterns that detect hallucinated concrete numbers in prohibited contexts.
 * Matches: price figures ("от X ₽", "X рублей"), credit rates ("X% годовых"),
 * and car-count claims ("X автомобилей в наличии").
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /\b\d[\d\s]*[₽]/,                                                          // "1 500 000 ₽"
  /\bот\s+\d[\d\s.,]*\s*(?:рублей|руб\.?)/i,                                 // "от X рублей"
  /\d+[.,]?\d*\s*%\s*(?:годовых|ставк|кредит|первонач)/i,                    // "X% годовых"
  /\d+\s*(?:автомобил\w*|авто\b|машин\w*)\s*(?:в\s*наличии|есть|имеется)/i, // "X авто в наличии"
];

/** Returns true if the text contains a hallucinated concrete figure. */
export function validateForHallucination(text: string): boolean {
  return HALLUCINATION_PATTERNS.some(re => re.test(text));
}

/** Reject transport/format artifacts that are not human-readable FAQ copy. */
function isValidFaqItem(value: unknown): value is { question: string; answer: string } {
  if (!value || typeof value !== "object") return false;
  const item = value as { question?: unknown; answer?: unknown };
  if (typeof item.question !== "string" || typeof item.answer !== "string") return false;
  const question = item.question.trim();
  const answer = item.answer.trim();
  if (question.length < 12 || answer.length < 20) return false;
  const artifact = /(?:\[\s*\{|\{\s*["']?(?:question|answer)|["']?(?:question|answer)["']?\s*:|```|<json>)/i;
  return !artifact.test(question) && !artifact.test(answer);
}

function isValidFaqArray(value: unknown): value is { question: string; answer: string }[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 5 &&
    value.every(isValidFaqItem);
}

/**
 * Extra prohibition appended to the prompt on the second (retry) attempt.
 * Mirrors and reinforces the rules already in SYSTEM_PROMPT, using stronger language.
 */
const HALLUCINATION_RETRY_SUFFIX = `

⚠️ КРИТИЧЕСКИ ВАЖНО: предыдущая попытка нарушила запрет на числа.
АБСОЛЮТНО ЗАПРЕЩЕНО писать:
- любые цены или суммы (не «от X ₽», не «X рублей», не «X тысяч»)
- любые процентные ставки (не «X%», не «X процентов»)
- количество автомобилей (не «X авто», не «X штук в наличии»)
Вместо цифр используй ТОЛЬКО: «уточните у менеджера», «актуальные условия», «обратитесь в салон».`;

/* ── System prompt ───────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `Ты SEO-копирайтер официального дилера «Дебрянск Авто» в Брянске.

ЗАПРЕЩЁННЫЕ ФРАЗЫ: «широкий выбор», «большой выбор», «большой ассортимент», «выгодные условия», «обращайтесь», «не упустите», «надёжное место», «для каждого клиента», «мы рады», «команда профессионалов».

НАПИСАНИЕ НАЗВАНИЙ МОДЕЛЕЙ:
- Кириллица с заглавной буквы: Джолион, Дарго, Дашинг (не ДЖОЛИОН, не джолион)
- Латиница точно как в базе данных: F7X, F7, M6, Dashing
- Haval City / Haval Pro → писать только «Haval» без суббренда. Пример: «Haval Джолион»
- В одном тексте — только ОДИН вариант написания модели (либо кириллица, либо латиница)

ИНТЕНТ ЗАПРОСОВ:
- «купить / в наличии» → пригласи на осмотр и тест-драйв
- «цена / стоимость» → пригласи уточнить цену у менеджера, цену не называй
- «кредит / рассрочка» → упомяни доступность программ, ставки не называй
- «характеристики / фото / отзывы» → предложи тест-драйв или осмотр в салоне
- «официальный дилер» → статус, гарантия производителя, сервис
- «трейд-ин» → схема оценки и зачёта, без конкретных сумм

ВАЖНО — в FAQ запрещено называть конкретные цифры:
- цены (даже «от X ₽»)
- процентные ставки по кредиту
- количество автомобилей в наличии
Все эти данные динамические — вместо цифр приглашай уточнить у менеджера.

ЗАПРЕЩЕНО писать об отсутствии авто: «нет в наличии», «временно отсутствует» и любые синонимы.
ЗАПРЕЩЕНО упоминать конкурентов по имени.
НЕ придумывать данные — только то, что передано в контексте.`;

/* ── Core AI caller with timeout + retry ────────────────────────────── */

/**
 * Low-level caller: tries up to 2 times on timeout/empty-response errors.
 * Does NOT validate for hallucinations — use callSeoAiValidated for that.
 * @param maxTokens default 400; pass 800 for FAQ/cluster/text_block content
 */
async function callSeoAi(
  userPrompt: string,
  jsonMode = false,
  maxTokens = 400,
): Promise<string | null> {
  const attemptCall = async (): Promise<string> => {
    const params = {
      model: SEO_AI_MODEL,
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: userPrompt },
      ],
      temperature: 0.75,
      max_tokens: maxTokens,
      stream: false as false,
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    };
    const completion = await openai.chat.completions.create(params);
    return completion.choices[0]?.message?.content ?? "";
  };

  const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`seo-ai timeout ${ms}ms`)), ms),
      ),
    ]);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const content = await withTimeout(attemptCall(), SEO_AI_TIMEOUT_MS);
      if (content) return content;
      logger.warn(`[seo-ai] Empty response attempt ${attempt}`);
    } catch (err) {
      logger.warn({ err }, `[seo-ai] Error attempt ${attempt}`);
      if (attempt === 2) return null;
    }
  }
  return null;
}

/**
 * Validated AI caller: runs callSeoAi, checks for hallucinated numbers,
 * retries once with reinforced prohibition if detected.
 * Returns { content, hallucinated } where hallucinated=true means both attempts
 * produced numbers in prohibited contexts — caller should reject the suggestion.
 */
async function callSeoAiValidated(
  userPrompt: string,
  jsonMode = false,
  maxTokens = 400,
): Promise<{ content: string | null; hallucinated: boolean }> {
  const content1 = await callSeoAi(userPrompt, jsonMode, maxTokens);
  if (!content1) return { content: null, hallucinated: false }; // timeout/error → not hallucination

  if (!validateForHallucination(content1)) {
    return { content: content1, hallucinated: false };
  }

  // First attempt hallucinated → retry with reinforced prohibition
  logger.warn({ snippet: content1.slice(0, 120) }, "[seo-ai] Hallucination detected — retrying with strict prompt");
  const strictPrompt = userPrompt + HALLUCINATION_RETRY_SUFFIX;
  const content2 = await callSeoAi(strictPrompt, jsonMode, maxTokens);

  if (content2 && !validateForHallucination(content2)) {
    return { content: content2, hallucinated: false };
  }

  logger.warn(
    { snippet: content2?.slice(0, 120) ?? "(empty)" },
    "[seo-ai] Second hallucination attempt also failed — marking as hallucinated",
  );
  return { content: null, hallucinated: true };
}

/* ── Cache helpers ───────────────────────────────────────────────────── */
function makeHash(parts: string[]): string {
  return crypto.createHash("md5").update(parts.join("|")).digest("hex").slice(0, 16);
}

async function getCache(pageSlug: string, hash: string, type: string): Promise<string | null> {
  try {
    const r = await db.execute(sql`
      SELECT content FROM seo_ai_cache
      WHERE page_slug = ${pageSlug} AND query_hash = ${hash} AND type = ${type}
      LIMIT 1
    `);
    return r.rows.length > 0 ? (r.rows[0] as { content: string }).content : null;
  } catch { return null; }
}

async function setCache(pageSlug: string, hash: string, type: string, content: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO seo_ai_cache (page_slug, query_hash, type, content)
      VALUES (${pageSlug}, ${hash}, ${type}, ${content})
      ON CONFLICT (page_slug, query_hash, type) DO NOTHING
    `);
  } catch { /* cache write failure is non-fatal */ }
}

/* ── Few-shot examples ───────────────────────────────────────────────── */
async function loadExamples(pageSlug: string, type: string): Promise<{ question: string; answer: string }[]> {
  try {
    const r = await db.execute(sql`
      SELECT question, answer FROM seo_ai_examples
      WHERE page_slug = ${pageSlug} AND type = ${type}
      ORDER BY created_at DESC LIMIT 3
    `);
    return r.rows as { question: string; answer: string }[];
  } catch { return []; }
}

/** Save an approved AI-generated FAQ as a few-shot example for next runs */
export async function saveAiExample(
  pageSlug: string,
  type: string,
  question: string,
  answer: string,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO seo_ai_examples (page_slug, type, question, answer)
      VALUES (${pageSlug}, ${type}, ${question}, ${answer})
    `);
  } catch (err) {
    logger.warn({ err }, "[seo-ai] saveAiExample failed");
  }
}

/* ── AI FAQ for brand cluster ────────────────────────────────────────── */
export async function aiQueryToFaq(
  query: string,
  brandName: string,
  pageSlug: string,
  models: string[],
  fallbackFn: (q: string, b: string) => { question: string; answer: string },
): Promise<{ question: string; answer: string; generatedBy: "ai" | "template" | "ai_hallucinated" }> {
  const hash = makeHash([query, brandName]);
  const cached = await getCache(pageSlug, hash, "faq_brand");
  if (cached) {
    try {
      const p = JSON.parse(cached);
      if (isValidFaqItem(p)) return { ...p, generatedBy: "ai" };
    } catch { /* bad cache */ }
  }

  const examples = await loadExamples(pageSlug, "faq_brand");
  const exBlock = examples.length > 0
    ? `\nПримеры одобренных ответов для этой страницы:\n${examples.map(e => `В: ${e.question}\nО: ${e.answer}`).join("\n\n")}\n`
    : "";

  const prompt =
    `Запрос: «${query}»\n` +
    `Бренд: ${brandName}\n` +
    `Модели в наличии: ${models.slice(0, 5).join(", ")}\n` +
    exBlock +
    `\nСоздай JSON {"question":"...","answer":"..."}.\n` +
    `Вопрос — живой, как задал бы реальный покупатель (не повторяй запрос дословно).\n` +
    `Ответ — 2–3 предложения. Без конкретных цен, ставок и количества авто.`;

  const { content: raw, hallucinated } = await callSeoAiValidated(prompt, true, 800);
  if (hallucinated) return { ...fallbackFn(query, brandName), generatedBy: "ai_hallucinated" };

  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (isValidFaqItem(p)) {
        await setCache(pageSlug, hash, "faq_brand", JSON.stringify({ question: p.question, answer: p.answer }));
        return { question: p.question, answer: p.answer, generatedBy: "ai" };
      }
    } catch { /* JSON parse failed */ }
  }

  return { ...fallbackFn(query, brandName), generatedBy: "template" };
}

/* ── AI FAQ for /cars cluster ────────────────────────────────────────── */
export async function aiQueryToFaqCars(
  query: string,
  fallbackFn: (q: string) => { question: string; answer: string },
): Promise<{ question: string; answer: string; generatedBy: "ai" | "template" | "ai_hallucinated" }> {
  const hash = makeHash([query, "cars"]);
  const cached = await getCache("cars", hash, "faq_cars");
  if (cached) {
    try {
      const p = JSON.parse(cached);
      if (isValidFaqItem(p)) return { ...p, generatedBy: "ai" };
    } catch { /* bad cache */ }
  }

  const prompt =
    `Запрос: «${query}»\n` +
    `Контекст: страница автомобилей с пробегом в Брянске, официальный дилер «Дебрянск Авто».\n` +
    `\nСоздай JSON {"question":"...","answer":"..."}.\n` +
    `Вопрос — живой, как задал бы покупатель авто с пробегом.\n` +
    `Ответ — 2–3 предложения. Без конкретных цен и ставок.`;

  const { content: raw, hallucinated } = await callSeoAiValidated(prompt, true, 800);
  if (hallucinated) return { ...fallbackFn(query), generatedBy: "ai_hallucinated" };

  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (isValidFaqItem(p)) {
        await setCache("cars", hash, "faq_cars", JSON.stringify({ question: p.question, answer: p.answer }));
        return { question: p.question, answer: p.answer, generatedBy: "ai" };
      }
    } catch { /* JSON parse failed */ }
  }

  return { ...fallbackFn(query), generatedBy: "template" };
}

/* ── AI FAQ for model (content_brand) ───────────────────────────────── */
/**
 * Returns null if carsCount === 0 (rule: no stock → no FAQ generated).
 * Returns array of FAQ items otherwise (typically 1 item from AI vs 2 from template).
 */
export async function aiQueryToFaqModel(
  topQuery: string,
  modelDisplay: string,
  brandName: string,
  pageSlug: string,
  carsCount: number,
  fallbackFn: (
    m: string,
    b: string,
    cars: { count: number; minPrice: number | null; maxDiscount: number | null },
  ) => { question: string; answer: string }[],
  fallbackCars: { count: number; minPrice: number | null; maxDiscount: number | null },
): Promise<{ question: string; answer: string; generatedBy: "ai" | "template" | "ai_hallucinated" }[] | null> {
  if (carsCount === 0) return null; // Rule: no stock → skip entirely

  const hash = makeHash([topQuery, modelDisplay, brandName]);
  const cached = await getCache(pageSlug, hash, "faq_model");
  if (cached) {
    try {
      const p = JSON.parse(cached) as { question: string; answer: string }[];
      if (Array.isArray(p) && p.length > 0) return p.map(i => ({ ...i, generatedBy: "ai" as const }));
    } catch { /* bad cache */ }
  }

  const examples = await loadExamples(pageSlug, "faq_model");
  const exBlock = examples.length > 0
    ? `\nПримеры одобренных FAQ для этой страницы:\n${examples.map(e => `В: ${e.question}\nО: ${e.answer}`).join("\n\n")}\n`
    : "";

  const prompt =
    `Запрос: «${topQuery}»\n` +
    `Модель: ${modelDisplay} (${brandName})\n` +
    `Авто есть в наличии.\n` +
    exBlock +
    `\nСоздай JSON {"question":"...","answer":"..."}.\n` +
    `Вопрос — живой, один, как задал бы реальный покупатель (не повторяй запрос дословно).\n` +
    `Ответ — 2–3 предложения. Без конкретных цен, ставок и количества авто.\n` +
    `Используй только ОДИН вариант написания модели: либо кириллица, либо латиница.`;

  const { content: raw, hallucinated } = await callSeoAiValidated(prompt, true, 800);
  if (hallucinated) {
    return fallbackFn(modelDisplay, brandName, fallbackCars).map(i => ({
      ...i,
      generatedBy: "ai_hallucinated" as const,
    }));
  }

  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p.question && p.answer) {
        const items = [{ question: p.question, answer: p.answer }];
        await setCache(pageSlug, hash, "faq_model", JSON.stringify(items));
        return items.map(i => ({ ...i, generatedBy: "ai" as const }));
      }
    } catch { /* JSON parse failed */ }
  }

  return fallbackFn(modelDisplay, brandName, fallbackCars).map(i => ({ ...i, generatedBy: "template" as const }));
}

/* ── AI landing page generator ───────────────────────────────────────── */
export async function aiGenerateLandingPage(
  title: string,
  description: string,
  keywords: string[],
): Promise<{ meta_title: string; meta_description: string; h1: string; paragraphs: string[]; faq: { q: string; a: string }[] } | null> {
  const keyStr = keywords.slice(0, 8).map(k => `«${k}»`).join(", ");
  const prompt =
    `Создай контент для SEO-лендинга официального дилера «Дебрянск Авто» в Брянске.\n\n` +
    `Тема страницы: ${title}\n` +
    `Целевые запросы (вплети органично): ${keyStr}\n\n` +
    `Верни ТОЛЬКО валидный JSON без markdown-обёртки в формате:\n` +
    `{\n` +
    `  "meta_title": "до 65 символов, содержит главный запрос",\n` +
    `  "meta_description": "130–155 символов, призыв к действию",\n` +
    `  "h1": "заголовок страницы (не повторяет meta_title дословно)",\n` +
    `  "paragraphs": ["абзац 1 (80-120 слов)", "абзац 2", "абзац 3"],\n` +
    `  "faq": [\n` +
    `    {"q": "вопрос 1", "a": "ответ 1 (2-3 предложения)"},\n` +
    `    {"q": "вопрос 2", "a": "ответ 2"},\n` +
    `    {"q": "вопрос 3", "a": "ответ 3"},\n` +
    `    {"q": "вопрос 4", "a": "ответ 4"}\n` +
    `  ]\n` +
    `}\n\n` +
    `Требования: живой язык, без штампов, без конкретных цен и ставок, ` +
    `упоминать Брянск и официальный дилер.`;

  const hash = makeHash([title, ...keywords.slice(0, 5)]);
  const cacheKey = `landing:${hash}`;

  const cached = await getCache(cacheKey, hash, "landing_page");
  if (cached) {
    try { return JSON.parse(cached); } catch { /* re-generate if parse fails */ }
  }

  const raw = await callSeoAi(prompt, true, 800);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw.trim());
    if (!parsed.h1 || !Array.isArray(parsed.paragraphs) || !Array.isArray(parsed.faq)) {
      logger.warn({ keys: Object.keys(parsed) }, "[seo-ai] aiGenerateLandingPage: unexpected shape");
      return null;
    }
    await setCache(cacheKey, hash, "landing_page", JSON.stringify(parsed));
    return parsed;
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 200) }, "[seo-ai] aiGenerateLandingPage: JSON parse error");
    return null;
  }
}

/* ── AI text_block ───────────────────────────────────────────────────── */
export async function aiTextBlock(
  brandName: string,
  models: string[],
  clusterQueries: string[],
  pageSlug: string,
  fallbackText: string,
): Promise<{ text: string; generatedBy: "ai" | "template" | "ai_hallucinated" }> {
  const hash = makeHash([brandName, ...clusterQueries.slice(0, 5)]);
  const cached = await getCache(pageSlug, hash, "text_block");
  if (cached) return { text: cached, generatedBy: "ai" };

  const modelsStr = models.slice(0, 6).join(", ");
  const queriesStr = clusterQueries.slice(0, 6).map(q => `«${q}»`).join(", ");

  const prompt =
    `Напиши SEO-абзац 80–110 слов для страницы дилера ${brandName} в Брянске.\n` +
    `Модели в наличии: ${modelsStr}.\n` +
    `Кластер поисковых запросов (вплети органично, не перечисляй механически): ${queriesStr}.\n` +
    `Без заголовка. Не начинай с «Официальный» и не с названия бренда.\n` +
    `Используй только один вариант написания каждой модели (либо кириллица, либо латиница).`;

  const { content: raw, hallucinated } = await callSeoAiValidated(prompt, false, 800);
  if (hallucinated) return { text: fallbackText, generatedBy: "ai_hallucinated" };
  if (!raw) return { text: fallbackText, generatedBy: "template" };

  const text = raw.trim();
  await setCache(pageSlug, hash, "text_block", text);
  return { text, generatedBy: "ai" };
}

/* ── AI meta description ─────────────────────────────────────────────── */
export async function aiMetaDescription(
  brandName: string,
  models: string[],
  minPrice: number | null,
  maxDiscount: number | null,
  topQuery: string,
  pageSlug: string,
  fallbackDesc: string,
): Promise<{ desc: string; generatedBy: "ai" | "template" | "ai_hallucinated" }> {
  const hash = makeHash([brandName, topQuery]);
  const cached = await getCache(pageSlug, hash, "meta_desc");
  if (cached) return { desc: cached, generatedBy: "ai" };

  const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
  const parts: string[] = [];
  if (minPrice) parts.push(`от ${fmt(minPrice)} ₽`);
  if (maxDiscount && maxDiscount > 0) parts.push(`выгода до ${fmt(maxDiscount)} ₽`);

  const prompt =
    `Напиши meta description (130–155 символов) для страницы дилера ${brandName} в Брянске.\n` +
    (parts.length > 0 ? `Данные: ${parts.join(", ")}.\n` : "") +
    `Модели: ${models.slice(0, 3).join(", ")}.\n` +
    `Топ-запрос: «${topQuery}».\n` +
    `Требования: живой язык, без шаблонных фраз, один призыв к действию. Верни только текст, без кавычек.`;

  // meta_description stays at 400 tokens (short output, 155 chars max)
  const { content: raw, hallucinated } = await callSeoAiValidated(prompt, false, 400);
  if (hallucinated) return { desc: fallbackDesc, generatedBy: "ai_hallucinated" };
  if (!raw) return { desc: fallbackDesc, generatedBy: "template" };

  const desc = raw.trim().slice(0, 160);
  await setCache(pageSlug, hash, "meta_desc", desc);
  return { desc, generatedBy: "ai" };
}

/* ── Batch cluster → 2–3 diverse FAQ pairs ───────────────────────────── */
/**
 * Takes a cluster of similar search queries and generates 2–3 DISTINCT FAQ
 * pairs covering different user intents found in the cluster.
 * Unlike aiQueryToFaq (one call per query → identical answers), this uses a
 * single AI call that explicitly avoids repetition across questions.
 *
 * Returns AI_HALLUCINATION_SIGNAL (string const) when both retry attempts
 * produced hallucinated content — caller must mark the suggestion as rejected.
 */
export async function aiClusterToFaqs(
  queries: string[],
  brandName: string,
  pageSlug: string,
  models: string[],
): Promise<{ question: string; answer: string }[] | typeof AI_HALLUCINATION_SIGNAL> {
  const hash = makeHash([brandName, ...queries.slice(0, 5)]);
  const cached = await getCache(pageSlug, hash, "cluster_faqs");
  if (cached) {
    if (cached === AI_HALLUCINATION_SIGNAL) return AI_HALLUCINATION_SIGNAL;
    try {
      const p = JSON.parse(cached);
      if (isValidFaqArray(p)) return p;
    } catch { /* bad cache */ }
  }

  const queryList = queries.slice(0, 8).map((q, i) => `${i + 1}. ${q}`).join("\n");
  const modelStr = models.slice(0, 5).join(", ") || brandName;

  const prompt =
    `Бренд: ${brandName}\n` +
    `Модели в наличии: ${modelStr}\n\n` +
    `Поисковые запросы пользователей (кластер):\n${queryList}\n\n` +
    `Задача: из этих запросов выдели 2–3 РАЗНЫЕ темы (интента) и напиши по одному FAQ на каждую тему.\n` +
    `Требования:\n` +
    `- Все вопросы должны быть про РАЗНОЕ (не три варианта "где купить")\n` +
    `- Вопрос — живой, как спросил бы реальный покупатель\n` +
    `- Ответ — 2–3 предложения, без конкретных цен и ставок\n` +
    `- Если запросы все об одном — добавь смежный полезный вопрос (кредит, трейд-ин, сервис)\n\n` +
    `Верни ТОЛЬКО JSON-массив: [{"question":"...","answer":"..."},...]`;

  const { content: raw, hallucinated } = await callSeoAiValidated(prompt, false, 800);

  if (hallucinated) {
    logger.warn({ brandName, pageSlug }, "[seo-ai] aiClusterToFaqs: hallucination on both retries");
    // Cache the sentinel so the same cluster doesn't waste API calls in the next GAP run
    await setCache(pageSlug, hash, "cluster_faqs", AI_HALLUCINATION_SIGNAL);
    return AI_HALLUCINATION_SIGNAL;
  }

  if (raw) {
    try {
      // Strip markdown code fences if present
      const clean = raw.replace(/```(?:json)?\n?/g, "").trim();
      const startIdx = clean.indexOf("[");
      const endIdx = clean.lastIndexOf("]");
      if (startIdx !== -1 && endIdx !== -1) {
        const parsed = JSON.parse(clean.slice(startIdx, endIdx + 1)) as { question: string; answer: string }[];
        if (isValidFaqArray(parsed)) {
          await setCache(pageSlug, hash, "cluster_faqs", JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch { /* JSON parse failed */ }
  }

  // Fallback: generate one FAQ per distinct intent using rule-based logic
  return detectIntents(queries, brandName);
}

/** Rule-based fallback: produce 2–3 diverse Q&A from query list */
function detectIntents(queries: string[], brandName: string): { question: string; answer: string }[] {
  const q = queries.map(s => s.toLowerCase()).join(" ");
  const faqs: { question: string; answer: string }[] = [];

  // Primary: buying intent (almost always present)
  faqs.push({
    question: `Где купить ${brandName} в Брянске у официального дилера?`,
    answer: `Официальный дилер ${brandName} в Брянске — Дебрянск Авто. Автомобили в наличии, возможны кредит и трейд-ин. Запишитесь на тест-драйв онлайн.`,
  });

  // Secondary: financing if relevant
  if (q.includes("кредит") || q.includes("лизинг") || !q.includes("сервис")) {
    faqs.push({
      question: `Можно ли купить ${brandName} в кредит в Брянске?`,
      answer: `Да, ${brandName} доступен в кредит у официального дилера Дебрянск Авто. Действуют программы кредитования с удобным сроком и первоначальным взносом. Уточните условия у менеджера.`,
    });
  }

  // Tertiary: service or trade-in
  if (q.includes("сервис") || q.includes("то ") || q.includes("обслуж")) {
    faqs.push({
      question: `Где пройти техническое обслуживание ${brandName} в Брянске?`,
      answer: `Официальный сервис ${brandName} в Брянске — Дебрянск Авто. Оригинальные запчасти, гарантийный и постгарантийный ремонт, онлайн-запись.`,
    });
  } else {
    faqs.push({
      question: `Принимают ли ${brandName} по программе трейд-ин?`,
      answer: `В Дебрянск Авто действует трейд-ин: привезите свой автомобиль на бесплатную оценку и зачтите его стоимость в счёт нового ${brandName}.`,
    });
  }

  return faqs;
}
