/**
 * Pre-rendering script for Дебрянск Авто
 * Usage:
 *   node scripts/prerender.mjs              — full crawl of all routes
 *   node scripts/prerender.mjs --cars-only  — only car detail pages
 *
 * Env vars (inherited from running process or .env):
 *   PRERENDER_SITE_URL              — base URL of the running Express server (default: http://localhost:8080)
 *   LOCAL_PRERENDER_CACHE_DIR       — local directory where HTML is stored
 */

import { writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = (process.env.PRERENDER_SITE_URL || "http://localhost:8080").replace(/\/$/, "");
const CACHE_DIR = process.env.LOCAL_PRERENDER_CACHE_DIR || path.resolve(__dirname, "../prerender-cache");
const INTERNAL_SECRET = process.env.PRERENDER_INTERNAL_SECRET;
const POOL_SIZE = Number(process.env.PRERENDER_POOL_SIZE) || 2;
const PAGE_TIMEOUT_MS = 14_000;
const NETWORK_IDLE_MS = 800;

// Routes whose page content is entirely static (no DB-driven sections worth rendering).
const SSG_ROUTES = new Set([
  "/legal", "/privacy"
]);
function isSsgRoute(route) {
  if (SSG_ROUTES.has(route)) return true;
  if (route.startsWith("/news/")) return true;
  return false;
}

const carsOnly = process.argv.includes("--cars-only");
const routeArgs = [];
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === "--route" && process.argv[i + 1]) {
    routeArgs.push(process.argv[i + 1]);
  }
}
const singleRoute = routeArgs.length === 1 ? routeArgs[0] : null;
const bulkRoutes = routeArgs.length > 1 ? routeArgs : null;

function routeToFilePath(route) {
  const clean = route === "/" ? "" : route.replace(/^\//, "").replace(/\/$/, "");
  const rel = clean ? `${clean}/index.html` : "index.html";
  return path.join(CACHE_DIR, rel);
}

async function saveToDisk(route, html, manifest) {
  const filePath = routeToFilePath(route);
  await mkdir(path.dirname(filePath), { recursive: true });
  const suffix = `.${process.pid}.${Date.now()}.tmp`;
  await writeFile(`${filePath}${suffix}`, html, "utf-8");
  await rename(`${filePath}${suffix}`, filePath);
  const manifestPath = path.join(path.dirname(filePath), "prerender-manifest.json");
  await writeFile(`${manifestPath}${suffix}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  await rename(`${manifestPath}${suffix}`, manifestPath);
}

function getMeta(html, attribute, key) {
  const tag = html.match(new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

function validateSnapshot(route, html) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const canonicalTag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
  const canonical = canonicalTag?.match(/href=["']([^"']*)["']/i)?.[1] ?? null;
  const errors = [];
  if (!html.includes("<main") || html.length < 5_000) errors.push("empty SPA shell");
  if (!title || title === "Дебрянск Авто") errors.push("missing title");
  if (!getMeta(html, "name", "description")) errors.push("missing description");
  if (canonical !== `https://debryansk-auto.ru${route}`) errors.push("wrong canonical");
  if (!getMeta(html, "name", "robots")) errors.push("missing robots");
  if (route.startsWith("/brands/")) {
    if (html.includes("Бренд не найден")) errors.push("brand error page");
    if (!/<h1[\s>]/i.test(html)) errors.push("missing H1");
    if (!/<script[^>]+application\/ld\+json/i.test(html)) errors.push("missing JSON-LD");
  }
  return { valid: errors.length === 0, errors, title, canonical, robots: getMeta(html, "name", "robots") };
}

async function getRoutes() {
  const staticRoutes = carsOnly
    ? []
    : ["/", "/new-cars", "/service", "/service/bonus", "/contacts", "/vacancies", "/about", "/news", "/buyout", "/cars", "/corporate"];

  const [newCarsRes, usedCarsRes, newsRes, brandsRes, promotionsRes] = await Promise.all([
    fetch(`${SITE_URL}/api/cars/new`)
      .then((r) => r.json())
      .catch(() => ({ data: [] })),
    fetch(`${SITE_URL}/api/cars/used`)
      .then((r) => r.json())
      .catch(() => ({ data: [] })),
    carsOnly
      ? Promise.resolve({ data: [] })
      : fetch(`${SITE_URL}/api/news`)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
    carsOnly
      ? Promise.resolve({ ok: true, data: [] })
      : fetch(`${SITE_URL}/api/brands`)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
    carsOnly
      ? Promise.resolve({ data: [] })
      : fetch(`${SITE_URL}/api/promotions`)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
  ]);

  const newCarRoutes = (newCarsRes.data || []).map(
    (c) => `/new-cars/${encodeURIComponent(c.id)}`,
  );
  const usedCarRoutes = (usedCarsRes.data || []).map(
    (c) => `/cars/${encodeURIComponent(c.id)}`,
  );
  const newsRoutes = (newsRes.data || []).map(
    (n) => `/news/${encodeURIComponent(n.slug)}`,
  );
  const brandRoutes = (brandsRes.data || [])
    .filter((b) => b.slug && b.slug !== "s-probegom")
    .map((b) => `/brands/${b.slug}`);
  const promotionRoutes = (promotionsRes.data || [])
    .filter((p) => p.slug)
    .map((p) => `/promotions/${encodeURIComponent(p.slug)}`);

  return [...brandRoutes, ...staticRoutes, ...promotionRoutes, ...newCarRoutes, ...usedCarRoutes, ...newsRoutes];
}

function isLongWaitRoute(route) {
  return route === "/" || route.startsWith("/brands/");
}

async function processRoute(page, route) {
  if (isSsgRoute(route)) {
    console.log(`[prerender] SKIP ${route} (SSG HTML already has correct FAQ schema)`);
    return;
  }
  const url = `${SITE_URL}${route}`;
  const gotoTimeout = isLongWaitRoute(route) ? 25_000 : PAGE_TIMEOUT_MS;
  try {
    // Tell the server this is the prerender crawler itself. The middleware will
    // then skip server-side meta injection for non-SSG routes and let React
    // Helmet be the single source of truth, avoiding duplicate title/description/OG tags.
    await page.setExtraHTTPHeaders({ "x-prerender-bot": "1" });
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: gotoTimeout,
    });

    let readyMarkerFound = true;
    if (isLongWaitRoute(route)) {
      readyMarkerFound = await page
        .waitForSelector("[data-prerender-ready]", { timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      if (!readyMarkerFound) {
        console.warn(`[prerender] WARN: [data-prerender-ready] not found at ${route}`);
      }
      await page
        .waitForNetworkIdle({ idleTime: 1_500, timeout: 15_000 })
        .catch(() => {
          console.warn(`[prerender] WARN: network idle timeout at ${route} — capturing anyway`);
        });
    } else {
      await page
        .waitForNetworkIdle({ idleTime: NETWORK_IDLE_MS, timeout: PAGE_TIMEOUT_MS })
        .catch(() => {});
      await page.waitForSelector("main", { timeout: 3_000 }).catch(() => {});
    }

    const html = await page.content();

    const hasContent =
      html.length > 5_000 &&
      !html.includes("data-loading") &&
      html.includes("<main");

    if (!hasContent) {
      console.warn(`[prerender] WARN: possibly empty content at ${route} (len=${html.length})`);
    }

    let cleanHtml = html
      .replaceAll("http://localhost:8080", "https://debryansk-auto.ru")
      .replaceAll("localhost:8080", "https://debryansk-auto.ru");

    // Strip duplicate <title> tags — React Helmet prepends its own <title> while
    // seoMeta's injectMeta() also injects one, leaving two consecutive tags in the
    // Puppeteer-captured HTML.  Keep only the LAST occurrence (seoMeta's value is
    // always appended after the Helmet-injected one and is the authoritative value).
    const titleMatches = [...cleanHtml.matchAll(/<title>[^<]*<\/title>/gi)];
    if (titleMatches.length > 1) {
      const lastTitle = titleMatches.at(-1)[0];
      // Remove all <title> occurrences then re-insert the last one at the position
      // where the first one was (preserving head order).
      const firstIndex = cleanHtml.indexOf(titleMatches[0][0]);
      cleanHtml = cleanHtml.replace(/<title>[^<]*<\/title>/gi, "");
      cleanHtml = cleanHtml.slice(0, firstIndex) + lastTitle + cleanHtml.slice(firstIndex);
    }

    const validation = validateSnapshot(route, cleanHtml);
    if (route.startsWith("/brands/") && (!readyMarkerFound || response?.status() !== 200)) {
      validation.errors.push(!readyMarkerFound ? "brand data did not become ready" : `HTTP ${response?.status()}`);
      validation.valid = false;
    }
    if (!validation.valid) {
      console.error(`[prerender] REJECT ${route}: ${validation.errors.join(", ")}`);
      return;
    }

    await saveToDisk(route, cleanHtml, {
      route,
      generatedAt: new Date().toISOString(),
      generator: "prerender.mjs",
      title: validation.title,
      canonical: validation.canonical,
      robots: validation.robots,
      validationVersion: 1,
    });

    if (INTERNAL_SECRET) {
      fetch(`${SITE_URL}/api/internal/prerender-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-prerender-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ route, html: cleanHtml }),
      }).catch(() => {});
    }

    console.log(`[prerender] OK   ${route} (${Math.round(html.length / 1024)}KB)`);
  } catch (err) {
    console.error(`[prerender] FAIL ${route}: ${err.message}`);
  }
}

async function main() {
  const startedAt = Date.now();
  console.log(`[prerender] Starting — carsOnly=${carsOnly}, singleRoute=${singleRoute || "none"}, site=${SITE_URL}, cacheDir=${CACHE_DIR}`);

  let routes;
  if (bulkRoutes) {
    routes = bulkRoutes;
  } else if (singleRoute) {
    routes = [singleRoute];
  } else {
    routes = await getRoutes();
  }
  console.log(`[prerender] ${routes.length} routes to process`);

  if (routes.length === 0) {
    console.log("[prerender] Nothing to do, exiting");
    return;
  }

  let executablePath;
  const { execSync } = await import("child_process");

  // Honour explicit override first (e.g. PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`[prerender] Using Chromium from env: ${executablePath}`);
  } else {
    try {
      executablePath = execSync(
        "which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null || which chromium 2>/dev/null || which chromium-browser 2>/dev/null",
        { encoding: "utf8" }
      ).trim().split("\n")[0].trim();
    } catch {
      console.error("[prerender] FATAL: no Chromium found; install system chromium package");
      process.exit(1);
    }
    if (!executablePath) {
      console.error("[prerender] FATAL: no Chromium found; install system chromium package");
      process.exit(1);
    }
  }

  console.log(`[prerender] Using Chromium: ${executablePath}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const poolSize = Math.min(POOL_SIZE, routes.length);
    const pages = await Promise.all(
      Array.from({ length: poolSize }, () => browser.newPage()),
    );

    for (const page of pages) {
      await page.setViewport({ width: 1280, height: 900 });
      await page.setCacheEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const url = req.url();
        if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
          req.continue({ headers: { ...req.headers(), "X-Prerender-Bot": "1" } });
        } else {
          req.continue();
        }
      });
      await page.evaluateOnNewDocument(() => { window.__PRERENDER__ = true; });
      page.on("console", (msg) => {
        const type = msg.type();
        if (type === "error" || type === "warning" || type === "warn") {
          console.log(`[puppeteer][${type}] ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => {
        console.error(`[puppeteer][pageerror] ${err.message}`);
      });
    }

    let idx = 0;

    async function worker(page) {
      while (true) {
        const route = routes[idx++];
        if (!route) break;
        await processRoute(page, route);
      }
    }

    await Promise.all(pages.map((page) => worker(page)));
  } finally {
    await browser.close();
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[prerender] Done — ${routes.length} routes in ${elapsed}s`);
}

main().catch((err) => {
  console.error("[prerender] Fatal error:", err);
  process.exit(1);
});
