/**
 * Pre-rendering script for Дебрянск Авто
 * Usage:
 *   node scripts/prerender.mjs              — full crawl of all routes
 *   node scripts/prerender.mjs --cars-only  — only car detail pages
 *
 * Env vars (inherited from running process or .env):
 *   PRERENDER_SITE_URL                — base URL of the running Express server (default: http://localhost:8080)
 *   DEFAULT_OBJECT_STORAGE_BUCKET_ID  — GCS bucket where HTML is stored
 */

import { Storage } from "@google-cloud/storage";
import puppeteer from "puppeteer";

const SIDECAR = "http://127.0.0.1:1106";
const SITE_URL = (process.env.PRERENDER_SITE_URL || "http://localhost:8080").replace(/\/$/, "");
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const INTERNAL_SECRET = process.env.PRERENDER_INTERNAL_SECRET;
const POOL_SIZE = 5;
const PAGE_TIMEOUT_MS = 14_000;
const NETWORK_IDLE_MS = 800;

// Routes whose page content is entirely static (no DB-driven sections worth rendering).
// These are served to bots via seoMeta (SSG HTML + meta injection) — no Puppeteer needed.
// Contentful pages (/, /service, /service/bonus, /about, /news, /buyout, /cars) are
// intentionally excluded and rendered via Puppeteer so bots see real page content.
const SSG_ROUTES = new Set([
  "/vacancies", "/contacts", "/new-cars", "/legal", "/privacy"
]);
function isSsgRoute(route) {
  if (SSG_ROUTES.has(route)) return true;
  // /news/ — static article pages with SSG HTML
  if (route.startsWith("/news/")) return true;
  return false;
}

const carsOnly = process.argv.includes("--cars-only");

if (!BUCKET_ID) {
  console.error("[prerender] FATAL: DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  process.exit(1);
}

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function routeToObjectName(route) {
  const clean = route === "/" ? "" : route.replace(/^\//, "").replace(/\/$/, "");
  return clean ? `prerendered/${clean}/index.html` : "prerendered/index.html";
}

async function saveToGCS(route, html) {
  const file = gcs.bucket(BUCKET_ID).file(routeToObjectName(route));
  await file.save(Buffer.from(html, "utf-8"), {
    contentType: "text/html; charset=utf-8",
    resumable: false,
  });
}

async function getRoutes() {
  // Static routes with SSG HTML already have FAQ schema — skip prerender
  // Only prerender dynamic routes: car detail pages, news articles
  // Contentful static-URL pages: Puppeteer renders the full React DOM so bots get real content.
  // /vacancies, /contacts, /new-cars, /legal, /privacy stay as SSG-only (no DB-driven sections).
  const staticRoutes = carsOnly
    ? []
    : ["/", "/service", "/service/bonus", "/about", "/news", "/buyout", "/cars"];

  const [newCarsRes, usedCarsRes, newsRes, brandsRes] = await Promise.all([
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

  // Brand pages first — high SEO priority, must not be delayed by 400+ car routes
  return [...brandRoutes, ...staticRoutes, ...newCarRoutes, ...usedCarRoutes, ...newsRoutes];
}

async function processRoute(page, route) {
  if (isSsgRoute(route)) {
    console.log(`[prerender] SKIP ${route} (SSG HTML already has correct FAQ schema)`);
    return;
  }
  const url = `${SITE_URL}${route}`;
  // Brand pages need more time: React fetches models/prices/cards before setting data-prerender-ready
  const gotoTimeout = route.startsWith("/brands/") ? 25_000 : PAGE_TIMEOUT_MS;
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: gotoTimeout,
    });

    if (route.startsWith("/brands/")) {
      // Wait for React to mount (data-prerender-ready appears immediately),
      // then wait for network idle so all API fetches (models, cars, news) complete.
      await page
        .waitForSelector("[data-prerender-ready]", { timeout: 20_000 })
        .catch(() => {
          console.warn(`[prerender] WARN: [data-prerender-ready] not found at ${route} — using fallback`);
        });
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

    const cleanHtml = html
      .replaceAll("http://localhost:8080", "https://debryansk-auto.ru")
      .replaceAll("localhost:8080", "https://debryansk-auto.ru");

    await saveToGCS(route, cleanHtml);

    // Notify Express server to update in-memory cache immediately (don't wait for script exit)
    if (INTERNAL_SECRET) {
      fetch(`${SITE_URL}/api/internal/prerender-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-prerender-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ route, html }),
      }).catch(() => {}); // fire-and-forget, don't block prerender
    }

    console.log(`[prerender] OK   ${route} (${Math.round(html.length / 1024)}KB)`);
  } catch (err) {
    console.error(`[prerender] FAIL ${route}: ${err.message}`);
  }
}

async function main() {
  const startedAt = Date.now();
  console.log(`[prerender] Starting — carsOnly=${carsOnly}, site=${SITE_URL}`);

  const routes = await getRoutes();
  console.log(`[prerender] ${routes.length} routes to process`);

  if (routes.length === 0) {
    console.log("[prerender] Nothing to do, exiting");
    return;
  }

  let executablePath;
  const { execSync } = await import("child_process");
  try {
    executablePath = execSync(
      "which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null",
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

      // Add X-Prerender-Bot only to same-origin requests (localhost)
      // setExtraHTTPHeaders sends to ALL requests including cross-origin (Google Fonts etc.)
      // which triggers CORS preflight rejection — fonts fail to load in headless
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const url = req.url();
        if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
          req.continue({ headers: { ...req.headers(), "X-Prerender-Bot": "1" } });
        } else {
          req.continue();
        }
      });

      // Expose __PRERENDER__ flag so the app can skip headless-unsafe components (e.g. CTPhoneGuard)
      await page.evaluateOnNewDocument(() => { window.__PRERENDER__ = true; });

      // Log all browser console messages and page errors for debugging
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
