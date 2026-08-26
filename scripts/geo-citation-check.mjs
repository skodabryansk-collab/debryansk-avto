#!/usr/bin/env node

/**
 * GEO citation monitor.
 *
 * This is deliberately separate from geo-seo-check.mjs: the latter is a
 * deterministic technical regression check, while this script analyzes
 * answers captured from AI search products. Google AI Overviews, Bing
 * Copilot, Perplexity, and ChatGPT with web search do not share one stable
 * public response API, so this tool accepts an export in a small common
 * JSON format rather than scraping or inventing an answer.
 *
 * Usage:
 *   pnpm run geo:citations -- --list-queries
 *   pnpm run geo:citations -- --list-sources
 *   pnpm run geo:citations -- --input ./geo-citation-responses.json
 *   pnpm run geo:citations:weekly
 *   pnpm run geo:citations -- --summary
 *
 * Input format:
 *   {
 *     "checkedAt": "2026-08-26T09:00:00Z",
 *     "responses": [
 *       {
 *         "provider": "perplexity",
 *         "queryId": "new-dealer",
 *         "answerText": "…",
 *         "citations": [{ "url": "https://example.com/page", "title": "…" }]
 *       }
 *     ]
 *   }
 *
 * A response may use query instead of queryId, text/answer instead of
 * answerText, and citations/sources/references as its citation list. The
 * normalized report contains no fabricated "no" result for a query that was
 * not captured: missing rows are reported as not-run.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SITE_NAME = "Дебрянск Авто";
const SITE_DOMAIN = (process.env.GEO_CITATION_DOMAIN || "debryansk-auto.ru")
  .replace(/^https?:\/\//i, "")
  .replace(/^www\./i, "")
  .replace(/\/+$/, "")
  .toLowerCase();
const REPORT_PATH = process.env.GEO_CITATION_REPORT || ".local/geo-seo-citations.json";
const DEFAULT_INPUT_PATH = process.env.GEO_CITATION_INPUT || "";
const REQUEST_TIMEOUT_MS = Number(process.env.GEO_CITATION_TIMEOUT_MS || 30_000);
const RETRIES = Math.max(1, Number(process.env.GEO_CITATION_RETRIES || 2));

const PROVIDERS = [
  { id: "google-ai-overviews", label: "Google AI Overviews" },
  { id: "bing-copilot", label: "Bing Copilot" },
  { id: "perplexity", label: "Perplexity" },
  { id: "chatgpt-web", label: "ChatGPT с веб-поиском" },
];

const PROVIDER_ALIASES = new Map([
  ["google", "google-ai-overviews"],
  ["google-ai", "google-ai-overviews"],
  ["google-ai-overviews", "google-ai-overviews"],
  ["ai-overviews", "google-ai-overviews"],
  ["bing", "bing-copilot"],
  ["copilot", "bing-copilot"],
  ["bing-copilot", "bing-copilot"],
  ["perplexity", "perplexity"],
  ["chatgpt", "chatgpt-web"],
  ["chatgpt-web", "chatgpt-web"],
  ["openai", "chatgpt-web"],
]);

// Queries are intentionally neutral. They ask where/how to find a service
// rather than asserting prices, discounts, stock, or "best" status.
const QUERIES = [
  { id: "new-dealer", intent: "new-cars", query: "Где купить новый автомобиль у официального дилера в Брянске?", targetPaths: ["/new-cars"] },
  { id: "new-catalog", intent: "new-cars", query: "Какие новые автомобили можно посмотреть в автосалонах Брянска?", targetPaths: ["/new-cars", "/brands"] },
  { id: "dealer-group", intent: "dealer", query: "Какие официальные дилерские центры автомобилей есть в Брянске?", targetPaths: ["/brands", "/contacts"] },
  { id: "haval-dealer", intent: "brand", query: "Где находится официальный дилер Haval City в Брянске?", targetPaths: ["/brands/haval-city", "/contacts"] },
  { id: "jetour-dealer", intent: "brand", query: "Где купить автомобиль Jetour у официального дилера в Брянске?", targetPaths: ["/brands/jetour", "/new-cars"] },
  { id: "new-car-visit", intent: "new-cars", query: "Куда обратиться в Брянске, чтобы выбрать новый автомобиль и записаться на визит?", targetPaths: ["/new-cars", "/contacts"] },
  { id: "used-cars", intent: "used-cars", query: "Где посмотреть автомобили с пробегом в Брянске?", targetPaths: ["/cars"] },
  { id: "used-dealer", intent: "used-cars", query: "Где посмотреть автомобили с пробегом в автосалоне в Брянске?", targetPaths: ["/cars", "/contacts"] },
  { id: "trade-in", intent: "trade-in", query: "Где оформить трейд-ин автомобиля в Брянске?", targetPaths: ["/cars", "/new-cars"] },
  { id: "car-financing", intent: "new-cars", query: "Куда обратиться в Брянске по вопросу покупки нового автомобиля в кредит?", targetPaths: ["/new-cars", "/contacts"] },
  { id: "service", intent: "service", query: "Где пройти техническое обслуживание автомобиля в Брянске?", targetPaths: ["/service"] },
  { id: "service-booking", intent: "service", query: "Как записаться на сервис автомобиля в Брянске?", targetPaths: ["/service", "/contacts"] },
  { id: "tire-service", intent: "service", query: "Где в Брянске есть шиномонтаж и хранение шин для автомобиля?", targetPaths: ["/service"] },
  { id: "body-repair", intent: "service", query: "Где сделать кузовной ремонт автомобиля в Брянске?", targetPaths: ["/service"] },
  { id: "diagnostics", intent: "service", query: "Где пройти компьютерную диагностику автомобиля в Брянске?", targetPaths: ["/service"] },
  { id: "buyout", intent: "buyout", query: "Где продать автомобиль с выкупом в Брянске?", targetPaths: ["/buyout"] },
  { id: "commission-sale", intent: "buyout", query: "Где оформить комиссионную продажу автомобиля в Брянске?", targetPaths: ["/buyout"] },
  { id: "buyout-evaluation", intent: "buyout", query: "Как получить оценку автомобиля для выкупа в Брянске?", targetPaths: ["/buyout"] },
  { id: "dealer-address", intent: "contacts", query: "Какой адрес автодилерского центра Дебрянск Авто в Брянске?", targetPaths: ["/contacts"] },
  { id: "dealer-hours", intent: "contacts", query: "Какой режим работы автосалонов Дебрянск Авто в Брянске?", targetPaths: ["/contacts"] },
];

const QUERY_BY_ID = new Map(QUERIES.map((query) => [query.id, query]));
const PROVIDER_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT_PATH,
    report: REPORT_PATH,
    summary: false,
    weekly: false,
    listQueries: false,
    listSources: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--list-queries") options.listQueries = true;
    else if (arg === "--list-sources") options.listSources = true;
    else if (arg === "--weekly" || arg === "--run-weekly") options.weekly = true;
    else if (arg === "--summary") options.summary = true;
    else if (arg === "--input") options.input = argv[++index] || "";
    else if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    else if (arg === "--report") options.report = argv[++index] || REPORT_PATH;
    else if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Неизвестный аргумент: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`GEO citation monitor

Команды:
  --list-queries             вывести набор из ${QUERIES.length} запросов для ручной проверки
  --list-sources             показать источник и статус каждого провайдера
  --input <file>             разобрать JSON-экспорт ответов и добавить его в историю
  --weekly                   выполнить полный замер ${QUERIES.length} запросов (для планировщика)
  --summary                  показать недельное сравнение из сохранённой истории
  --report <file>            изменить путь истории (по умолчанию ${REPORT_PATH})

Провайдеры: ${PROVIDERS.map((provider) => provider.id).join(", ")}
`);
}

function normalizeProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return PROVIDER_ALIASES.get(normalized) || normalized;
}

function sourceStatus(providerId) {
  if (providerId === "google-ai-overviews") {
    return {
      kind: "unavailable",
      status: "unavailable",
      label: "Google AI Overviews",
      reason: "У Google нет стабильного публичного API для получения AI Overviews.",
    };
  }
  if (providerId === "bing-copilot") {
    return {
      kind: "unavailable",
      status: "unavailable",
      label: "Bing Copilot",
      reason: "У Bing Copilot нет стабильного публичного API для получения ответов.",
    };
  }
  if (providerId === "perplexity") {
    const apiKey = process.env.GEO_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
    return {
      kind: "api",
      status: apiKey ? "configured" : "unavailable",
      label: "Perplexity",
      endpoint: process.env.GEO_PERPLEXITY_API_URL || "https://api.perplexity.ai/chat/completions",
      authEnv: "GEO_PERPLEXITY_API_KEY или PERPLEXITY_API_KEY",
      reason: apiKey ? null : "Не задан GEO_PERPLEXITY_API_KEY или PERPLEXITY_API_KEY.",
      apiKey,
    };
  }
  if (providerId === "chatgpt-web") {
    const apiKey =
      process.env.GEO_CHATGPT_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    return {
      kind: "api",
      status: apiKey ? "configured" : "unavailable",
      label: "ChatGPT с веб-поиском",
      endpoint: process.env.GEO_CHATGPT_API_URL || openAiResponsesUrl(),
      authEnv: "GEO_CHATGPT_API_KEY, OPENAI_API_KEY или AI_INTEGRATIONS_OPENAI_API_KEY",
      reason: apiKey
        ? null
        : "Не задан GEO_CHATGPT_API_KEY, OPENAI_API_KEY или AI_INTEGRATIONS_OPENAI_API_KEY.",
      apiKey,
    };
  }
  throw new Error(`Неизвестный провайдер "${providerId}".`);
}

function openAiResponsesUrl() {
  const baseUrl =
    process.env.GEO_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    "https://api.openai.com/v1";
  return `${baseUrl.replace(/\/+$/, "")}/responses`;
}

function publicSourceInfo(source) {
  const { apiKey, ...safeSource } = source;
  return safeSource;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return null;
  try {
    const url = new URL(value.trim().replace(/[),.;!?]+$/g, ""));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractUrls(value) {
  const urls = typeof value === "string" ? value.match(/https?:\/\/[^\s<>"'`]+/gi) || [] : [];
  return urls.map(normalizeUrl).filter(Boolean);
}

function isSiteUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase() === SITE_DOMAIN;
  } catch {
    return false;
  }
}

function getCitationUrl(citation) {
  if (typeof citation === "string") return normalizeUrl(citation);
  if (!citation || typeof citation !== "object") return null;
  for (const key of ["url", "link", "href", "source"]) {
    const url = normalizeUrl(citation[key]);
    if (url) return url;
  }
  return null;
}

function getAnswerText(response) {
  for (const key of ["answerText", "output_text", "text", "answer", "content", "response"]) {
    if (typeof response[key] === "string") return response[key];
    if (Array.isArray(response[key])) {
      const text = response[key]
        .map((part) => (typeof part === "string" ? part : part?.text || part?.content || ""))
        .filter(Boolean)
        .join("\n");
      if (text) return text;
    }
  }
  return "";
}

function isoWeek(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.valueOf())) throw new Error(`Некорректная дата проверки: ${dateValue}`);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86_400_000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function rate(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function citationRecords(response, checkedAt, defaultProvider) {
  const provider = normalizeProvider(response.provider || defaultProvider);
  if (!PROVIDER_BY_ID.has(provider)) {
    throw new Error(`Неизвестный провайдер "${response.provider || defaultProvider}".`);
  }
  const answerText = getAnswerText(response);
  const query = typeof response.query === "string" ? normalizeWhitespace(response.query) : "";
  const queryId = response.queryId || QUERIES.find((item) => item.query === query)?.id;
  const queryDefinition = QUERY_BY_ID.get(queryId);
  if (!queryDefinition) {
    throw new Error(`Не найден queryId "${queryId || "(пусто)"}". Используйте --list-queries.`);
  }
  const suppliedCitations = [
    ...(Array.isArray(response.citations) ? response.citations : []),
    ...(Array.isArray(response.sources) ? response.sources : []),
    ...(Array.isArray(response.references) ? response.references : []),
  ];
  const urls = [...new Set([
    ...suppliedCitations.map(getCitationUrl),
    ...extractUrls(answerText),
  ].filter(Boolean))];
  const citationTitles = suppliedCitations
    .map((citation) => (citation && typeof citation === "object" ? citation.title : ""))
    .filter((title) => typeof title === "string")
    .join("\n");
  const siteUrls = urls.filter(isSiteUrl);
  const citedPages = siteUrls.map((url) => {
    const parsed = new URL(url);
    return {
      url,
      path: `${parsed.pathname}${parsed.search}`,
      title: suppliedCitations.find((citation) => getCitationUrl(citation) === url)?.title || null,
      citationPosition: urls.indexOf(url) + 1,
      siteCitationPosition: siteUrls.indexOf(url) + 1,
    };
  });
  const mention = new RegExp(`${SITE_NAME.split(" ").join("\\s+")}`, "i").test(`${answerText}\n${citationTitles}`);
  const responseCheckedAt = response.checkedAt || checkedAt;
  return {
    checkedAt: new Date(responseCheckedAt).toISOString(),
    week: isoWeek(responseCheckedAt),
    provider,
    queryId: queryDefinition.id,
    query: queryDefinition.query,
    intent: queryDefinition.intent,
    targetPaths: queryDefinition.targetPaths,
    status: "checked",
    mention,
    siteLink: citedPages.length > 0,
    citedPage: citedPages[0]?.path || null,
    citationPosition: citedPages[0]?.citationPosition || null,
    siteCitationPosition: citedPages[0]?.siteCitationPosition || null,
    citedPages,
    answerPreview: normalizeWhitespace(answerText).slice(0, 240) || null,
  };
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw new Error(`Не удалось прочитать JSON ${path}: ${error.message}`);
  }
}

function emptyReport() {
  return {
    schemaVersion: 2,
    site: { name: SITE_NAME, domain: SITE_DOMAIN },
    providers: PROVIDERS,
    queries: QUERIES,
    checks: [],
    runs: [],
    weekly: [],
    updatedAt: null,
  };
}

function chooseLatestChecks(checks) {
  const latest = new Map();
  for (const check of [...checks].sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt))) {
    latest.set(`${check.provider}:${check.queryId}`, check);
  }
  return [...latest.values()];
}

function latestProviderRun(runs, providerId, week) {
  return [...runs]
    .filter((run) => run.week === week)
    .flatMap((run) => run.providers || [])
    .filter((provider) => provider.provider === providerId)
    .sort((a, b) => new Date(a.finishedAt || 0) - new Date(b.finishedAt || 0))
    .at(-1);
}

function summarizeWeek(checks, week, runs = []) {
  const rows = chooseLatestChecks(checks.filter((check) => check.week === week));
  const byProvider = PROVIDERS.map((provider) => {
    const providerRows = rows.filter((row) => row.provider === provider.id);
    const run = latestProviderRun(runs, provider.id, week);
    const queriesChecked = new Set(providerRows.map((row) => row.queryId)).size;
    const mentions = providerRows.filter((row) => row.mention).length;
    const siteLinks = providerRows.filter((row) => row.siteLink).length;
    return {
      provider: provider.id,
      label: provider.label,
      status: run?.status || (providerRows.length ? "manual-export" : "not-run"),
      source: run?.source || (providerRows.length ? "manual-export" : null),
      reason: run?.reason || null,
      failedQueries: run?.failedQueries || [],
      expectedQueries: QUERIES.length,
      responses: providerRows.length,
      queriesChecked,
      queryCoveragePct: rate(queriesChecked, QUERIES.length),
      mentions,
      mentionRatePct: rate(mentions, providerRows.length),
      siteLinks,
      citationRatePct: rate(siteLinks, providerRows.length),
    };
  });
  const byQuery = QUERIES.map((query) => {
    const queryRows = rows.filter((row) => row.queryId === query.id);
    const mentions = queryRows.filter((row) => row.mention).length;
    const siteLinks = queryRows.filter((row) => row.siteLink).length;
    const pages = [...new Set(queryRows.flatMap((row) => row.citedPages.map((page) => page.path)))];
    const unavailableProviders = PROVIDERS
      .map((provider) => latestProviderRun(runs, provider.id, week))
      .filter((run) => ["unavailable", "error"].includes(run?.status))
      .map((run) => run.provider);
    return {
      queryId: query.id,
      query: query.query,
      targetPaths: query.targetPaths,
      responses: queryRows.length,
      mentions,
      mentionRatePct: rate(mentions, queryRows.length),
      siteLinks,
      citationRatePct: rate(siteLinks, queryRows.length),
      citedPages: pages,
      notRun: queryRows.length === 0 && unavailableProviders.length === 0,
      blockedByUnavailable: queryRows.length === 0 && unavailableProviders.length > 0,
      unavailableProviders,
    };
  });
  const pages = [...new Set(QUERIES.flatMap((query) => query.targetPaths))].map((path) => {
    const pageRows = rows.filter((row) => row.targetPaths.includes(path));
    const siteLinks = pageRows.filter((row) => row.citedPages.some((page) => page.path === path)).length;
    return {
      path,
      responses: pageRows.length,
      mentions: pageRows.filter((row) => row.mention).length,
      siteLinks,
      citationRatePct: rate(siteLinks, pageRows.length),
      needsReview: pageRows.length > 0 && siteLinks === 0,
    };
  });
  const mentions = rows.filter((row) => row.mention).length;
  const siteLinks = rows.filter((row) => row.siteLink).length;
  const citedPageCounts = new Map();
  for (const row of rows) {
    for (const page of row.citedPages) citedPageCounts.set(page.path, (citedPageCounts.get(page.path) || 0) + 1);
  }
  return {
    week,
    runs: runs.filter((run) => run.week === week).length,
    expectedResponses: QUERIES.length * PROVIDERS.length,
    responses: rows.length,
    responseCoveragePct: rate(rows.length, QUERIES.length * PROVIDERS.length),
    queriesChecked: new Set(rows.map((row) => row.queryId)).size,
    queryCoveragePct: rate(new Set(rows.map((row) => row.queryId)).size, QUERIES.length),
    mentions,
    mentionRatePct: rate(mentions, rows.length),
    siteLinks,
    citationRatePct: rate(siteLinks, rows.length),
    byProvider,
    byQuery,
    pages,
    topCitedPages: [...citedPageCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([path, count]) => ({ path, count })),
  };
}

function rebuildWeekly(report) {
  const runs = Array.isArray(report.runs) ? report.runs : [];
  const weeks = [...new Set([
    ...report.checks.map((check) => check.week),
    ...runs.map((run) => run.week),
  ])].sort();
  report.weekly = weeks.map((week) => summarizeWeek(report.checks, week, runs));
  report.updatedAt = new Date().toISOString();
  return report;
}

function printQueries() {
  console.log(`Набор GEO-запросов (${QUERIES.length}; проверять во всех четырёх провайдерах):`);
  for (const [index, query] of QUERIES.entries()) {
    console.log(`${String(index + 1).padStart(2, "0")}. [${query.id}] ${query.query} → ${query.targetPaths.join(", ")}`);
  }
}

function printSources() {
  console.log("Источники GEO-ответов:");
  for (const provider of PROVIDERS) {
    const source = sourceStatus(provider.id);
    const endpoint = source.endpoint ? ` → ${source.endpoint}` : "";
    console.log(`- ${provider.label}: ${source.status}${endpoint}`);
    if (source.reason) console.log(`  ${source.reason}`);
  }
}

function printSummary(report) {
  if (!report.weekly.length) {
    console.log("История GEO-цитирования пока пуста. Передайте --input или запустите --weekly.");
    return;
  }
  const formatRate = (value) => value == null ? "—" : `${value}%`;
  console.log(`GEO citation history: ${SITE_NAME} (${SITE_DOMAIN})`);
  for (const week of report.weekly) {
    console.log(`\n${week.week}: ${week.responses} ответов, покрытие ${formatRate(week.queryCoveragePct)}, упоминание ${formatRate(week.mentionRatePct)}, ссылка на сайт ${formatRate(week.citationRatePct)}`);
    for (const provider of week.byProvider) {
      if (provider.status === "unavailable" || provider.status === "error") {
        console.log(`  ${provider.label}: ${provider.status} — ${provider.reason || "ответы не записывались"}`);
      } else {
        console.log(`  ${provider.label}: ${provider.responses} ответов, ${formatRate(provider.mentionRatePct)} упоминаний, ${formatRate(provider.citationRatePct)} ссылок`);
      }
    }
    const reviewPages = week.pages.filter((page) => page.needsReview).map((page) => page.path);
    console.log(`  Страницы без цитат в этой неделе: ${reviewPages.length ? reviewPages.join(", ") : "нет"}`);
  }
  const latest = report.weekly.at(-1);
  console.log(`\nПоследняя неделя: ${latest.runs || 0} плановых запусков, ${latest.responses}/${latest.expectedResponses || QUERIES.length * PROVIDERS.length} фактических ответов (${latest.responseCoveragePct ?? 0}%).`);
  const notRun = latest.byQuery.filter((query) => query.notRun).map((query) => query.queryId);
  if (notRun.length) console.log(`\nНе проверены в ${latest.week}: ${notRun.join(", ")}`);
  const blocked = latest.byQuery.filter((query) => query.blockedByUnavailable).map((query) => query.queryId);
  if (blocked.length) console.log(`\nЗаблокированы недоступностью источников в ${latest.week}: ${blocked.join(", ")}`);
}

async function saveReport(path, report) {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`История сохранена: ${path}`);
}

async function requestJson(url, options) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const text = await response.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (!response.ok) {
        const detail = body?.error?.message || body?.message || text.slice(0, 240);
        throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      }
      if (!body || typeof body !== "object") throw new Error("API вернул не JSON-объект.");
      return body;
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? new Error(`тайм-аут после ${REQUEST_TIMEOUT_MS} мс`)
        : error;
      if (attempt < RETRIES) await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function perplexityResult(body) {
  const choice = body?.choices?.[0];
  const answerText = choice?.message?.content;
  if (typeof answerText !== "string") throw new Error("Perplexity не вернул текст ответа.");
  return { answerText, citations: Array.isArray(body.citations) ? body.citations : [] };
}

function chatGptResult(body) {
  const citations = [];
  const outputParts = Array.isArray(body?.output) ? body.output : [];
  for (const item of outputParts) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      for (const annotation of Array.isArray(part?.annotations) ? part.annotations : []) {
        if (annotation?.type === "url_citation" && annotation.url) {
          citations.push({ url: annotation.url, title: annotation.title || null });
        }
      }
    }
  }
  const answerText = typeof body?.output_text === "string"
    ? body.output_text
    : outputParts
      .flatMap((item) => item?.content || [])
      .map((part) => part?.text || "")
      .filter(Boolean)
      .join("\n");
  if (!answerText) throw new Error("ChatGPT не вернул текст ответа.");
  return { answerText, citations };
}

async function captureProviderQuery(providerId, query) {
  const source = sourceStatus(providerId);
  if (source.status !== "configured") {
    throw new Error(source.reason || "Источник недоступен.");
  }
  if (providerId === "perplexity") {
    const body = await requestJson(source.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${source.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GEO_PERPLEXITY_MODEL || "sonar",
        messages: [{ role: "user", content: query.query }],
      }),
    });
    return perplexityResult(body);
  }
  if (providerId === "chatgpt-web") {
    const body = await requestJson(source.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${source.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GEO_CHATGPT_MODEL || "gpt-4.1",
        tools: [{ type: "web_search_preview" }],
        input: query.query,
      }),
    });
    return chatGptResult(body);
  }
  throw new Error(`Для провайдера ${providerId} не настроен API-адаптер.`);
}

async function runWeeklyMeasurement() {
  const checkedAt = new Date().toISOString();
  const run = {
    checkedAt,
    week: isoWeek(checkedAt),
    queryIds: QUERIES.map((query) => query.id),
    expectedResponses: QUERIES.length * PROVIDERS.length,
    providers: [],
  };
  const rows = [];

  for (const provider of PROVIDERS) {
    const source = sourceStatus(provider.id);
    const providerRun = {
      provider: provider.id,
      source: publicSourceInfo(source),
      queryIds: QUERIES.map((query) => query.id),
      startedAt: new Date().toISOString(),
      attemptedQueries: 0,
      completedQueries: 0,
      failedQueries: [],
    };
    if (source.status !== "configured") {
      providerRun.status = "unavailable";
      providerRun.reason = source.reason;
      providerRun.finishedAt = new Date().toISOString();
      run.providers.push(providerRun);
      continue;
    }

    for (const query of QUERIES) {
      providerRun.attemptedQueries += 1;
      try {
        const captured = await captureProviderQuery(provider.id, query);
        rows.push(citationRecords({
          provider: provider.id,
          queryId: query.id,
          answerText: captured.answerText,
          citations: captured.citations,
        }, checkedAt, provider.id));
        providerRun.completedQueries += 1;
      } catch (error) {
        providerRun.failedQueries.push({
          queryId: query.id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    providerRun.status = providerRun.completedQueries
      ? (providerRun.failedQueries.length ? "partial" : "ok")
      : "error";
    if (providerRun.status === "error") {
      providerRun.reason = "Источник настроен, но не вернул ни одного ответа.";
    }
    providerRun.finishedAt = new Date().toISOString();
    run.providers.push(providerRun);
  }
  run.finishedAt = new Date().toISOString();
  return { run, rows };
}

function appendRows(report, incoming) {
  const incomingKeys = new Set(incoming.map((row) => `${row.checkedAt}:${row.provider}:${row.queryId}`));
  report.checks = report.checks.filter((row) => !incomingKeys.has(`${row.checkedAt}:${row.provider}:${row.queryId}`));
  report.checks.push(...incoming);
  report.checks.sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.listQueries) {
    printQueries();
    return;
  }
  if (options.listSources) {
    printSources();
    return;
  }
  const report = (await readJson(options.report, null)) || emptyReport();
  report.schemaVersion = Math.max(Number(report.schemaVersion) || 1, 2);
  report.providers = PROVIDERS;
  report.queries = QUERIES;
  report.runs = Array.isArray(report.runs) ? report.runs : [];
  if (options.weekly) {
    if (QUERIES.length !== 20) {
      throw new Error(`Недельный замер должен содержать ровно 20 запросов, сейчас: ${QUERIES.length}.`);
    }
    const { run, rows } = await runWeeklyMeasurement();
    appendRows(report, rows);
    report.runs.push(run);
    rebuildWeekly(report);
    await saveReport(options.report, report);
    printSummary(report);
    return;
  }
  if (options.summary || !options.input) {
    printSummary(report);
    if (!options.summary && !options.input) {
      console.log("\nДля нового замера используйте: --input <json-файл>");
    }
    return;
  }
  const input = await readJson(options.input);
  if (!input || typeof input !== "object" || !Array.isArray(input.responses)) {
    throw new Error("Ожидается JSON-объект с массивом responses.");
  }
  if (QUERIES.length !== 20) {
    throw new Error(`Набор запросов должен содержать ровно 20 элементов, сейчас: ${QUERIES.length}.`);
  }
  const checkedAt = input.checkedAt || new Date().toISOString();
  const defaultProvider = normalizeProvider(input.provider || "");
  const incomingByKey = new Map();
  for (const response of input.responses) {
    const row = citationRecords(response, checkedAt, defaultProvider);
    incomingByKey.set(`${row.checkedAt}:${row.provider}:${row.queryId}`, row);
  }
  const incoming = [...incomingByKey.values()];
  appendRows(report, incoming);
  rebuildWeekly(report);
  await saveReport(options.report, report);
  printSummary(report);
  const missing = QUERIES.filter((query) => !incoming.some((row) => row.queryId === query.id));
  if (missing.length) {
    console.log(`\nНе запущены в этом замере (${missing.length}): ${missing.map((query) => query.id).join(", ")}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`GEO citation check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}