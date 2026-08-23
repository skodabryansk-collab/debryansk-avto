#!/usr/bin/env node

/**
 * Read-only GEO/SEO regression check.
 *
 * Usage:
 *   pnpm run geo:check
 *   GEO_BASE_URL=http://localhost:8080 pnpm run geo:check
 *
 * The checks intentionally validate public HTML responses rather than React
 * source code. This protects the SSG/seoMeta contract that crawlers consume.
 */

import { writeFile } from "node:fs/promises";

const BASE_URL = (process.env.GEO_BASE_URL || "https://debryansk-auto.ru").replace(/\/+$/, "");
const CANONICAL_BASE_URL = (process.env.GEO_CANONICAL_BASE_URL || "https://debryansk-auto.ru").replace(/\/+$/, "");
const REPORT_PATH = process.env.GEO_REPORT_PATH || "";
const TIMEOUT_MS = Number(process.env.GEO_TIMEOUT_MS || 20_000);

const routes = [
  {
    path: "/",
    title: /Дебрянск Авто.*официальный автосалон.*Брянске/i,
    description: /официальн.*дилер.*Брянске/i,
    h1: /Дебрянск Авто.*официальный дилер.*Брянске/i,
    schemas: ["AutoDealer", "BreadcrumbList", "FAQPage"],
  },
  {
    path: "/new-cars",
    title: /Новые автомобили.*Брянске/i,
    description: /новый автомобиль|новые автомобили/i,
    h1: /Новые автомобили в Брянске/i,
    schemas: ["AutoDealer", "BreadcrumbList"],
  },
  {
    path: "/cars",
    title: /Авто(?:мобили)? с пробегом.*Брянске/i,
    description: /авто с пробегом.*Брянске/i,
    h1: /Автомобили с пробегом в Брянске/i,
    schemas: ["AutoDealer", "BreadcrumbList"],
  },
  {
    path: "/brands",
    title: /Бренды автомобилей.*сервис.*Брянске/i,
    description: /дилер.*автомобил.*сервисн.*бренд/i,
    h1: /Бренды автомобилей.*сервис.*Брянске/i,
    h1Count: 1,
    schemas: ["AutoDealer", "BreadcrumbList", "CollectionPage"],
    requiredText: ["Новые автомобили", "Автомобили с пробегом", "Сервисные бренды"],
    requiredLinks: ["/brands/haval-city", "/brands/jetour", "/brands/mercedes-benz", "/cars"],
    forbiddenLinks: ["/brands/mb-bryansk"],
    userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)",
  },
  {
    path: "/service",
    title: /Сервис.*Дебрянск Авто|Сервисное обслуживание.*Брянске/i,
    description: /сервис.*Брянске/i,
    h1: /Сервисное обслуживание автомобилей в Брянске/i,
    schemas: ["AutoDealer", "BreadcrumbList"],
  },
  {
    path: "/buyout",
    title: /Выкуп.*авто.*Брянске/i,
    description: /выкуп[\s\S]{0,240}автомобил/i,
    h1: /Выкуп.*автомобил.*Брянске/i,
    schemas: ["AutoDealer", "BreadcrumbList"],
  },
  {
    path: "/contacts",
    title: /Контакты.*Дебрянск Авто|Дебрянск Авто.*Брянске/i,
    description: /адрес.*телефон.*дилер.*Брянске/i,
    h1: /Контакты дилерских центров Дебрянск Авто/i,
    schemas: ["AutoDealer", "BreadcrumbList", "ContactPage"],
  },
  {
    path: "/news",
    title: /Новости.*Дебрянск Авто|Дебрянск Авто.*Брянске/i,
    description: /новости.*автомобил.*акци.*Брянске/i,
    h1: /Новости Дебрянск Авто/i,
    schemas: ["AutoDealer", "BreadcrumbList"],
  },
  {
    path: "/brands/haval-city",
    title: /Haval City.*Брянске|Haval.*Брянске/i,
    description: /Haval.*Брянске/i,
    h1: /Haval.*Брянске/i,
    schemas: ["AutoDealer"],
  },
];

const failures = [];
const results = [];

function fail(path, check, details) {
  failures.push({ path, check, details });
}

function getMeta(html, name, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<meta\\b[^>]+${name}=["']${escaped}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] || "";
}

function getCanonical(html) {
  const tag = html.match(/<link\b[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/href=["']([^"']*)["']/i)?.[1] || "";
}

function getTitle(html) {
  return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
}

function getH1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getSchemaTypes(html) {
  const types = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const value = JSON.parse(match[1]);
      const nodes = value?.["@graph"] || (Array.isArray(value) ? value : [value]);
      for (const node of nodes) {
        const type = node?.["@type"];
        if (Array.isArray(type)) types.push(...type);
        else if (type) types.push(type);
      }
    } catch {
      fail("global", "JSON-LD parse", "Invalid application/ld+json block");
    }
  }
  return [...new Set(types)];
}

async function fetchText(path, userAgent = "GEO-SEO-Regression-Check/1.0") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
    });
    return {
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      location: response.headers.get("location") || "",
      body: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkRoute(route) {
  let response;
  try {
    response = await fetchText(route.path, route.userAgent);
  } catch (error) {
    fail(route.path, "HTTP request", error instanceof Error ? error.message : String(error));
    return;
  }

  const { body } = response;
  const title = getTitle(body);
  const description = getMeta(body, "name", "description");
  const robots = getMeta(body, "name", "robots");
  const canonical = getCanonical(body);
  const h1s = getH1s(body);
  const schemaTypes = getSchemaTypes(body);

  if (response.status !== 200) fail(route.path, "HTTP status", `expected 200, got ${response.status}`);
  if (!/^text\/html\b/i.test(response.contentType)) fail(route.path, "content type", response.contentType);
  if (body.length < 5_000) fail(route.path, "indexable HTML", `only ${body.length} bytes`);
  if (!/<main\b/i.test(body)) fail(route.path, "main landmark", "missing <main>");
  if (!title || !route.title.test(title)) fail(route.path, "title", title || "missing");
  if (!description || !route.description.test(description)) fail(route.path, "description", description || "missing");
  if (!canonical) fail(route.path, "canonical", "missing");
  else if (canonical !== `${CANONICAL_BASE_URL}${route.path === "/" ? "/" : route.path}`) {
    fail(route.path, "canonical", `expected ${CANONICAL_BASE_URL}${route.path}, got ${canonical}`);
  }
  if (!robots || /\bnoindex\b|\bnone\b|\bnofollow\b/i.test(robots)) {
    fail(route.path, "robots", robots || "missing");
  }
  if (h1s.length === 0) fail(route.path, "H1", "missing");
  if (route.h1Count != null && h1s.length !== route.h1Count) {
    fail(route.path, "H1 count", `expected ${route.h1Count}, got ${h1s.length}`);
  }
  for (const text of route.requiredText || []) {
    if (!body.includes(text)) fail(route.path, "page content", `missing ${text}`);
  }
  for (const href of route.requiredLinks || []) {
    if (!body.includes(`href="${href}"`)) fail(route.path, "brand link", `missing ${href}`);
  }
  for (const href of route.forbiddenLinks || []) {
    if (body.includes(`href="${href}"`)) fail(route.path, "non-canonical link", `found ${href}`);
  }
  for (const expectedSchema of route.schemas) {
    if (!schemaTypes.includes(expectedSchema)) {
      fail(route.path, "JSON-LD", `missing ${expectedSchema}; found ${schemaTypes.join(", ") || "none"}`);
    }
  }
  if (["Страница не найдена", "Бренд не найден", "data-loading"].some((marker) => body.includes(marker))) {
    fail(route.path, "content state", "error/loading marker found");
  }

  results.push({
    path: route.path,
    status: response.status,
    bytes: body.length,
    title,
    canonical,
    robots,
    h1: h1s[0] || "",
    schemas: schemaTypes,
  });
}

async function checkTextResource(path, contentTypePattern) {
  try {
    const response = await fetchText(path);
    if (response.status !== 200) fail(path, "HTTP status", `expected 200, got ${response.status}`);
    if (!contentTypePattern.test(response.contentType)) fail(path, "content type", response.contentType);
    if (!response.body.trim()) fail(path, "body", "empty response");
    return response;
  } catch (error) {
    fail(path, "HTTP request", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function checkLlms() {
  const response = await checkTextResource("/llms.txt", /^text\/plain\b/i);
  if (!response) return;

  const requiredStatements = [
    /^# Дебрянск Авто/m,
    /Брянск/,
    /2011 год/,
    /Литейная/,
    /Советская/,
    /Супонево/,
    /Московский/,
    /Новые автомобили/,
    /Автомобили с пробегом/,
    /Сервисное обслуживание/,
  ];
  for (const statement of requiredStatements) {
    if (!statement.test(response.body)) {
      fail("/llms.txt", "entity profile", `missing required statement: ${statement}`);
    }
  }
  if (/<(?:!doctype|html|head|body|script)\b/i.test(response.body)) {
    fail("/llms.txt", "text-only response", "HTML markup found");
  }

  const links = [...response.body.matchAll(/\[[^\]]+\]\((https:\/\/debryansk-auto\.ru(?:\/[^)\s]*)?)\)/g)]
    .map((match) => match[1]);
  if (links.length < 6) {
    fail("/llms.txt", "official sources", `expected at least 6 links, got ${links.length}`);
    return;
  }

  for (const url of links) {
    const path = new URL(url).pathname;
    try {
      const target = await fetchTextFrom(CANONICAL_BASE_URL, path);
      if (target.status !== 200) {
        fail("/llms.txt", "official source", `${url} returned ${target.status}`);
      }
    } catch (error) {
      fail("/llms.txt", "official source", `${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function fetchTextFrom(baseUrl, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "GEO-SEO-Regression-Check/1.0" },
    });
    return { status: response.status, contentType: response.headers.get("content-type") || "", body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

await Promise.all(routes.map(checkRoute));
const robots = await checkTextResource("/robots.txt", /^text\/plain\b/i);
const sitemap = await checkTextResource("/sitemap.xml", /^(application\/xml|text\/xml)\b/i);
await checkLlms();

if (robots && !/Sitemap:\s*https:\/\/debryansk-auto\.ru\/sitemap\.xml/i.test(robots.body)) {
  fail("/robots.txt", "sitemap declaration", "canonical sitemap URL is missing");
}
if (robots && !/Disallow:\s*\/api\//i.test(robots.body)) {
  fail("/robots.txt", "API exclusion", "Disallow: /api/ is missing");
}
if (sitemap && !/<urlset\b/i.test(sitemap.body)) {
  fail("/sitemap.xml", "XML format", "missing <urlset>");
}
if (sitemap && !/<loc>https:\/\/debryansk-auto\.ru\/<\/loc>/i.test(sitemap.body)) {
  fail("/sitemap.xml", "home URL", "canonical home URL is missing");
}

const report = {
  checkedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  routeCount: routes.length,
  passed: failures.length === 0,
  failures,
  results,
};

console.log(`GEO/SEO check: ${BASE_URL}`);
console.log(`Routes checked: ${routes.length}`);
for (const result of results.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`  ${result.status === 200 ? "OK" : "!!"} ${result.path} (${result.bytes} bytes)`);
}
if (failures.length) {
  console.error(`\nFAILED checks: ${failures.length}`);
  for (const failure of failures) {
    console.error(`  ${failure.path} — ${failure.check}: ${failure.details}`);
  }
  process.exitCode = 1;
} else {
  console.log("\nAll GEO/SEO regression checks passed.");
}

if (REPORT_PATH) {
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report written: ${REPORT_PATH}`);
}