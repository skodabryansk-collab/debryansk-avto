#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = process.env["FRONTEND_DIST_PATH"]
  ? join(process.env["FRONTEND_DIST_PATH"])
  : join(__dirname, "..", "dist", "public");

const SITE = "https://debryansk-auto.ru";
const DEFAULT_OG_IMAGE = `${SITE}/opengraph.jpg`;

const STATIC_ROUTES = {
  "/service/bonus": {
    title: "Бонусная программа — Дебрянск Авто | Копите и тратьте бонусы",
    description: "Бонусная программа автодилера «Дебрянск Авто» в Брянске. Начисление 10% от суммы заказ-наряда. Списание от 5% до 10% по накопительным уровням.",
    h1: "Бонусная программа Дебрянск Авто",
  },
  "/": {
    title: "Дебрянск Авто — официальный автосалон в Брянске | Продажа, сервис, кредит",
    description:
      "Официальный дилер Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, EXEED, Tenet и Mercedes-Benz в Брянске. 4 дилерских центра. Продажа, сервис и финансирование с 2011 года.",
    h1: "Дебрянск Авто — официальный дилер автомобилей в Брянске",
  },
  "/brands": {
    title: "Бренды автомобилей и официальный сервис в Брянске — Дебрянск Авто",
    description:
      "Официальные дилеры новых автомобилей и сервисные бренды в Брянске. Каталог автомобилей с пробегом, адреса дилерских центров и актуальные предложения Дебрянск Авто.",
    h1: "Бренды автомобилей и сервис Дебрянск Авто в Брянске",
  },
  "/new-cars": {
    title: "Новые автомобили в Брянске — Дебрянск Авто",
    description:
      "Новые автомобили 14 брендов у официальных дилеров Брянска. Выгодное кредитование, специальные программы, гарантия производителя. Дебрянск Авто.",
    h1: "Новые автомобили в Брянске",
  },
  "/cars": {
    title: "Автомобили с пробегом в Брянске — Дебрянск Авто",
    description:
      "Купить авто с пробегом в Брянске. Выгодные цены, проверенные автомобили, кредит, трейд-ин. Дебрянск Авто — 14 брендов.",
    h1: "Автомобили с пробегом в Брянске",
  },
  "/service": {
    title: "Сервисное обслуживание автомобилей в Брянске — ТО, ремонт, запчасти | Дебрянск Авто",
    description:
      "Официальный сервис Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, EXEED и других брендов в Брянске. Онлайн-запись, оригинальные запчасти, гарантийный ремонт.",
    h1: "Сервисное обслуживание автомобилей в Брянске",
  },
  "/buyout": {
    title: "Выкуп и комиссионная продажа авто в Брянске | Дебрянск Авто",
    description:
      "Срочный выкуп автомобиля за 30 минут или комиссионная продажа по максимальной цене. Оценка бесплатно, оплата в день сделки. Официальный дилер «Дебрянск Авто».",
    h1: "Выкуп и комиссионная продажа автомобилей в Брянске",
  },
  "/news": {
    title: "Новости автосалона Дебрянск Авто в Брянске",
    description:
      "Актуальные новости об автомобилях, акциях и жизни группы компаний «Дебрянск Авто».",
    h1: "Новости Дебрянск Авто",
  },
  "/about": {
    title: "О компании Дебрянск Авто — группа компаний 9 БР",
    description:
      "Группа компаний «Дебрянск Авто» — официальный мультибрендовый дилер в Брянске. 10 брендов, 4 дилерских центра с 2011 года.",
    h1: "О компании Дебрянск Авто",
  },
  "/contacts": {
    title: "Контакты дилерских центров Дебрянск Авто в Брянске",
    description:
      "Адреса и телефоны 4 дилерских центров «Дебрянск Авто» в Брянске: Советская, Литейная, Московский, Супонево. Звоните: +7 (4832) 77-77-70.",
    h1: "Контакты дилерских центров Дебрянск Авто",
  },
  "/vacancies": {
    title: "Вакансии дилера «Дебрянск Авто» — работа в Брянске",
    description:
      "Работа в автодилерских центрах «Дебрянск Авто». Менеджеры, автомеханики, администраторы.",
    h1: "Вакансии в Дебрянск Авто",
  },
  "/privacy": {
    title: "Политика конфиденциальности | Дебрянск Авто",
    description:
      "Политика конфиденциальности ООО «9 БР» (Дебрянск Авто) — порядок сбора, хранения и обработки персональных данных пользователей сайта.",
    h1: "Политика конфиденциальности",
  },
  "/promotions": {
    title: "Акции и спецпредложения — Дебрянск Авто | Брянск",
    description:
      "Актуальные акции на покупку автомобилей от официального дилера Дебрянск Авто в Брянске. Скидки, выгодный кредит, трейд-ин бонусы.",
    h1: "Акции и спецпредложения Дебрянск Авто",
  },
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function injectMeta(html, title, description, canonical, ogImage, h1, jsonLd) {
  let result = html;
  const t = esc(title);
  const d = esc(description);
  const img = esc(ogImage || DEFAULT_OG_IMAGE);
  const h = esc(h1);

  result = result.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  result = result.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${d}" />`
  );
  result = result.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${t}" />`
  );
  result = result.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${d}" />`
  );
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${t}" />`
  );
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${d}" />`
  );

  // Inject or replace robots meta
  const DEFAULT_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large";
  if (/<meta\s+name="robots"\s+content="[^"]*"\s*\/?/i.test(result)) {
    result = result.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/gi,
      `<meta name="robots" content="${DEFAULT_ROBOTS}" />`
    );
  } else {
    result = result.replace(
      "</head>",
      `    <meta name="robots" content="${DEFAULT_ROBOTS}" />\n  </head>`
    );
  }

  // Inject or replace og:url
  if (/<meta property="og:url" content="[^"]*"\s*\/?/.test(result)) {
    result = result.replace(
      /<meta property="og:url" content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${canonical}" />`
    );
  } else {
    result = result.replace(
      /<meta property="og:type"/,
      `<meta property="og:url" content="${canonical}" />\n    <meta property="og:type"`
    );
  }

  // Inject or replace og:image
  if (/<meta property="og:image" content="[^"]*"\s*\/?/.test(result)) {
    result = result.replace(
      /<meta property="og:image" content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${img}" />`
    );
  } else {
    result = result.replace(
      /<meta property="og:type"/,
      `<meta property="og:image" content="${img}" />\n    <meta property="og:type"`
    );
  }

  // Inject or replace og:site_name
  if (/<meta property="og:site_name" content="[^"]*"\s*\/?/.test(result)) {
    result = result.replace(
      /<meta property="og:site_name" content="[^"]*"\s*\/?>/,
      `<meta property="og:site_name" content="Дебрянск Авто" />`
    );
  } else {
    result = result.replace(
      /<meta property="og:type"/,
      `<meta property="og:site_name" content="Дебрянск Авто" />\n    <meta property="og:type"`
    );
  }

  // Inject or replace twitter:image
  if (/<meta name="twitter:image" content="[^"]*"\s*\/?/.test(result)) {
    result = result.replace(
      /<meta name="twitter:image" content="[^"]*"\s*\/?>/,
      `<meta name="twitter:image" content="${img}" />`
    );
  } else {
    result = result.replace(
      /<meta name="twitter:card"/,
      `<meta name="twitter:image" content="${img}" />\n    <meta name="twitter:card"`
    );
  }

  // Canonical
  if (/<link rel="canonical" href="[^"]*"\s*\/?/.test(result)) {
    result = result.replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${canonical}" />`
    );
  } else {
    result = result.replace(
      /<meta name="description"/,
      `<link rel="canonical" href="${canonical}" />\n    <meta name="description"`
    );
  }

  // Inject or remove JSON-LD (jsonLd can be a single object or array of objects)
  const ldList = Array.isArray(jsonLd) ? jsonLd : (jsonLd ? [jsonLd] : []);
  if (ldList.length > 0) {
    const ldTags = ldList.map(ld => {
      const payload = JSON.stringify({ "@context": "https://schema.org", ...ld });
      return `<script type="application/ld+json">${payload}</script>`;
    }).join("\n    ");
    if (result.includes('type="application/ld+json"')) {
      // replace existing first ld+json block, append the rest after it
      const first = ldList[0];
      const firstPayload = JSON.stringify({ "@context": "https://schema.org", ...first });
      result = result.replace(
        /<script type="application\/ld\+json">[^]*?<\/script>/,
        `<script type="application/ld+json">${firstPayload}</script>`
      );
      // If there are more, insert them after the first one
      if (ldList.length > 1) {
        const rest = ldList.slice(1).map(ld => {
          const payload = JSON.stringify({ "@context": "https://schema.org", ...ld });
          return `<script type="application/ld+json">${payload}</script>`;
        }).join("\n    ");
        result = result.replace(
          /<script type="application\/ld\+json">[^]*?<\/script>/,
          (match) => `${match}\n    ${rest}`
        );
      }
    } else {
      // insert before closing </head>
      result = result.replace(
        /<\/head>/,
        `    ${ldTags}\n  </head>`
      );
    }
  } else {
    // Remove stale JSON-LD from index.html template (it has wrong FAQ for this route)
    result = result.replace(
      /<script type="application\/ld\+json">[^]*?<\/script>\n?/,
      ""
    );
  }

  // Inject H1 as screen-reader-only element for search engines
  result = result.replace(
    /<div id="root"><\/div>/,
    `<div id="root"></div>\n    <h1 class="sr-only">${h}</h1>`
  );

  return result;
}

function buildNewsGridHtml(articles) {
  if (!articles || articles.length === 0) return "";
  const cards = articles.map(a => {
    const cat = esc(a.category || "\u041d\u043e\u0432\u043e\u0441\u0442\u0438");
    const title = esc(a.title);
    const excerpt = esc((a.excerpt || "").substring(0, 140));
    const slug = esc(a.slug);
    const img = esc(a.image || "");
    const dateStr = a.published_at
      ? new Date(a.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const readTime = a.read_time ?? 3;
    return `
      <article class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <a href="/news/${slug}">
          <div class="h-40 overflow-hidden">
            <img src="${img}" alt="${title}" class="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
        </a>
        <div class="p-4">
          <span class="inline-flex items-center bg-[#0070b8]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">${cat}</span>
          <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-2 mb-2">
            <span>${dateStr}</span>
            <span class="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
            <span>${readTime} \u043c\u0438\u043d</span>
          </div>
          <a href="/news/${slug}">
            <h3 class="font-bold text-slate-900 text-sm leading-snug hover:text-[#0070b8] transition-colors mb-1">${title}</h3>
          </a>
          <p class="text-slate-500 text-xs leading-relaxed">${excerpt}</p>
          <a href="/news/${slug}" class="inline-flex items-center gap-1 text-[#0070b8] text-xs font-bold mt-2 hover:underline">
            \u0427\u0438\u0442\u0430\u0442\u044c \u0434\u0430\u043b\u044c\u0448\u0435 <span aria-hidden="true">\u2192</span>
          </a>
        </div>
      </article>`;
  }).join("");

  // Wrapped in display:none so the grid is invisible to regular users but
  // crawlable by Googlebot/Yandex (they index hidden content and follow hidden links).
  // The React app renders its own visible news grid after hydration.
  return `<div style="display:none" aria-hidden="true"><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 container mx-auto px-4 sm:px-6 py-6 sm:py-8">${cards}</div></div>`;
}

function buildBrandContentHtml(description, faq) {
  const parts = [];

  if (description && description.trim().length > 50) {
    const paragraphs = description
      .split(/\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p class="text-slate-600 text-sm leading-relaxed mb-3">${esc(p)}</p>`)
      .join("");
    parts.push(`<div class="prose-sm text-slate-700 mb-6">${paragraphs}</div>`);
  }

  let faqArr = [];
  if (faq) {
    try {
      faqArr = typeof faq === "string" ? JSON.parse(faq) : faq;
    } catch { faqArr = []; }
  }
  const publishedFaq = Array.isArray(faqArr)
    ? faqArr.filter(f => f.is_published !== false)
    : [];

  if (publishedFaq.length > 0) {
    const items = publishedFaq
      .map(f => `
        <div class="border-b border-slate-100 py-3">
          <p class="font-semibold text-sm text-slate-800 mb-1">${esc(f.question || "")}</p>
          <p class="text-sm text-slate-600 leading-relaxed">${esc(f.answer || "")}</p>
        </div>`)
      .join("");
    parts.push(`<div class="mt-4">${items}</div>`);
  }

  if (parts.length === 0) return "";
  // The React brand page renders this content in its intended place. This
  // static copy is only for crawler discovery and lives after #root, so it
  // must never become a visible section below the application footer.
  return `<section data-seo-brand-content="true" style="display:none" aria-hidden="true">${parts.join("")}</section>`;
}

let _template = null;
function getTemplate() {
  if (_template) return _template;
  try {
    let raw = readFileSync(join(distDir, "index.html"), "utf-8");
    // Strip any previously injected sr-only H1 tags so re-runs are idempotent
    raw = raw.replace(/\n\s*<h1 class="sr-only">[^<]*<\/h1>/g, "");
    // Strip all previously injected ld+json blocks (they are regenerated per-route)
    raw = raw.replace(/\n\s*<script type="application\/ld\+json">[^]*?<\/script>/g, "");
    _template = raw;
    return _template;
  } catch {
    console.error("SSG: cannot read dist/public/index.html");
    process.exit(1);
  }
}

function writeRoute(routePath, title, description, h1, ogImage, jsonLd) {
  const canonical = `${SITE}${routePath}`;
  const template = getTemplate();
  const html = injectMeta(template, title, description, canonical, ogImage || DEFAULT_OG_IMAGE, h1, jsonLd);

  let filePath;
  if (routePath === "/") {
    filePath = join(distDir, "index.html");
    // Root index.html doubles as the SPA shell template that Puppeteer loads
    // when crawling brand/car pages. If it keeps the sr-only H1, Puppeteer
    // captures it alongside the React-rendered H1 → duplicate H1s for bots.
    // seoMeta handles the root-route H1 via injectMeta at request time anyway.
    const cleanHtml = html.replace(/\n?\s*<h1 class="sr-only">[^<]*<\/h1>/g, "");
    writeFileSync(filePath, cleanHtml);
  } else {
    const parts = routePath.slice(1).split("/");
    const dir = join(distDir, ...parts);
    mkdirSync(dir, { recursive: true });
    filePath = join(dir, "index.html");
    writeFileSync(filePath, html);
  }
  console.log(`SSG: ${routePath}`);
}

// Build JobPosting JSON-LD for the /vacancies page
function buildVacanciesLd() {
  const vacancies = [
    { title: "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u043f\u043e \u043f\u0440\u043e\u0434\u0430\u0436\u0430\u043c \u043d\u043e\u0432\u044b\u0445 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0435\u0439", description: "\u041a\u043e\u043d\u0441\u0443\u043b\u044c\u0442\u0438\u0440\u0443\u0435\u043c \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0435\u0439, \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u043c \u0441 \u0432\u044b\u0431\u043e\u0440\u043e\u043c \u0438 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0435\u043c \u043d\u043e\u0432\u043e\u0433\u043e \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044f.", salaryFrom: 80000, salaryTo: null, location: "\u0421\u0443\u043f\u043e\u043d\u0435\u0432\u043e" },
    { title: "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u043f\u043e \u043f\u0440\u043e\u0434\u0430\u0436\u0430\u043c \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0435\u0439 \u0441 \u043f\u0440\u043e\u0431\u0435\u0433\u043e\u043c", description: "\u041f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u043c \u0438 \u043f\u0440\u043e\u0434\u0430\u0451\u043c \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0438 \u0441 \u043f\u0440\u043e\u0431\u0435\u0433\u043e\u043c: \u043e\u0446\u0435\u043d\u043a\u0430, \u0432\u044b\u043a\u0443\u043f, trade-in.", salaryFrom: 70000, salaryTo: null, location: "\u0421\u0443\u043f\u043e\u043d\u0435\u0432\u043e" },
    { title: "\u0421\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442 \u043f\u043e trade-in \u0438 \u0432\u044b\u043a\u0443\u043f\u0443", description: "\u041f\u0440\u043e\u0432\u043e\u0434\u0438\u043c \u043e\u0441\u043c\u043e\u0442\u0440 \u0438 \u043e\u0446\u0435\u043d\u043a\u0443 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0435\u0439 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u0434\u043b\u044f trade-in.", salaryFrom: 65000, salaryTo: 100000, location: "\u0411\u0440\u044f\u043d\u0441\u043a" },
    { title: "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u043f\u043e \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u043c \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u0430\u043c", description: "\u041e\u0444\u043e\u0440\u043c\u043b\u044f\u0435\u043c \u043a\u0440\u0435\u0434\u0438\u0442\u044b, \u0441\u0442\u0440\u0430\u0445\u043e\u0432\u043a\u0438 \u0438 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0434\u043b\u044f \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u0435\u0439.", salaryFrom: 75000, salaryTo: null, location: "\u0411\u0440\u044f\u043d\u0441\u043a" },
    { title: "\u041c\u0430\u0441\u0442\u0435\u0440-\u043a\u043e\u043d\u0441\u0443\u043b\u044c\u0442\u0430\u043d\u0442 \u0441\u0435\u0440\u0432\u0438\u0441\u043d\u043e\u0439 \u0437\u043e\u043d\u044b", description: "\u041f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u043c \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0438 \u0432 \u0441\u0435\u0440\u0432\u0438\u0441, \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0438\u0440\u0443\u0435\u043c \u0440\u0435\u043c\u043e\u043d\u0442.", salaryFrom: 70000, salaryTo: null, location: "\u0411\u0440\u044f\u043d\u0441\u043a" },
    { title: "\u0410\u0432\u0442\u043e\u043c\u0435\u0445\u0430\u043d\u0438\u043a", description: "\u0412\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u043c \u0422\u041e \u0438 \u0440\u0435\u043c\u043e\u043d\u0442 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u0435\u0439 \u0432 \u043e\u0444\u0438\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u043c \u0434\u0438\u043b\u0435\u0440\u0441\u043a\u043e\u043c \u0441\u0435\u0440\u0432\u0438\u0441\u0435.", salaryFrom: 60000, salaryTo: 110000, location: "\u0411\u0440\u044f\u043d\u0441\u043a" },
    { title: "\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440 \u0434\u0438\u043b\u0435\u0440\u0441\u043a\u043e\u0433\u043e \u0446\u0435\u043d\u0442\u0440\u0430", description: "\u0412\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u043c \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432, \u043e\u0442\u0432\u0435\u0447\u0430\u0435\u043c \u043d\u0430 \u0437\u0432\u043e\u043d\u043a\u0438, \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u043c \u0441 \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0435\u0439 \u043f\u043e \u0414\u0426.", salaryFrom: 45000, salaryTo: 55000, location: "\u0411\u0440\u044f\u043d\u0441\u043a" },
    { title: "HR-\u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442", description: "\u041f\u043e\u0434\u0431\u0438\u0440\u0430\u0435\u043c \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u0434\u0438\u043b\u0435\u0440\u0441\u043a\u0438\u0445 \u0446\u0435\u043d\u0442\u0440\u043e\u0432, \u0432\u0435\u0434\u0451\u043c \u0430\u0434\u0430\u043f\u0442\u0430\u0446\u0438\u044e.", salaryFrom: 55000, salaryTo: 75000, location: "\u0411\u0440\u044f\u043d\u0441\u043a" },
  ];

  return {
    "@type": "ItemList",
    name: "\u0412\u0430\u043a\u0430\u043d\u0441\u0438\u0438 \u0414\u0435\u0431\u0440\u044f\u043d\u0441\u043a \u0410\u0432\u0442\u043e",
    url: `${SITE}/vacancies`,
    numberOfItems: vacancies.length,
    itemListElement: vacancies.map((v, i) => {
      const job = {
        "@type": "JobPosting",
        title: v.title,
        description: v.description,
        datePosted: "2026-01-01",
        validThrough: "2026-12-31",
        employmentType: "FULL_TIME",
        hiringOrganization: {
          "@type": "Organization",
          name: "\u0414\u0435\u0431\u0440\u044f\u043d\u0441\u043a \u0410\u0432\u0442\u043e",
          sameAs: SITE,
          logo: `${SITE}/favicon.svg`,
        },
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            streetAddress: "\u0443\u043b. \u0421\u043e\u0432\u0435\u0442\u0441\u043a\u0430\u044f, \u0434. 77",
            addressLocality: "\u0411\u0440\u044f\u043d\u0441\u043a",
            addressRegion: "\u0411\u0440\u044f\u043d\u0441\u043a\u0430\u044f \u043e\u0431\u043b\u0430\u0441\u0442\u044c",
            postalCode: "241050",
            addressCountry: "RU",
          },
        },
      };
      if (v.salaryFrom) {
        job.baseSalary = {
          "@type": "MonetaryAmount",
          currency: "RUB",
          value: {
            "@type": "QuantitativeValue",
            minValue: v.salaryFrom,
            maxValue: v.salaryTo || v.salaryFrom,
            unitText: "MONTH",
          },
        };
      }
      return {
        "@type": "ListItem",
        position: i + 1,
        item: job,
      };
    }),
  };
}

function buildFaqLd(faqItems) {
  if (!faqItems || faqItems.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faqItems.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

// Build BreadcrumbList schema.org markup for any route
function buildBreadcrumbList(routePath, title) {
  const items = [];
  items.push({ "@type": "ListItem", position: 1, name: "Главная", item: `${SITE}/` });

  const segments = routePath.split("/").filter(Boolean);
  let currentPath = "";
  let position = 2;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;
    let name;
    if (i === segments.length - 1) {
      // Last segment = current page title (shortened)
      name = title.split(" | ")[0].split(" — ")[0].slice(0, 60);
    } else {
      // Parent segment = section name
      name = segmentName(seg);
    }
    items.push({ "@type": "ListItem", position, name, item: `${SITE}${currentPath}` });
    position++;
  }

  return { "@type": "BreadcrumbList", itemListElement: items };
}

function segmentName(seg) {
  const map = {
    brands: "Бренды",
    news: "Новости",
    service: "Сервис",
    bonus: "Бонусная программа",
    buyout: "Выкуп",
    vacancies: "Вакансии",
    contacts: "Контакты",
    about: "О компании",
    "new-cars": "Новые авто",
    cars: "Авто с пробегом",
    legal: "Юридическая информация",
    privacy: "Политика конфиденциальности",
    promotions: "Акции",
  };
  return map[seg] || seg;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("SSG: DATABASE_URL not set — skipping dynamic routes");
    for (const [route, meta] of Object.entries(STATIC_ROUTES)) {
      writeRoute(route, meta.title, meta.description, meta.h1, DEFAULT_OG_IMAGE);
    }
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Load all FAQs from the new faqs table
    const faqsResult = await pool.query(
      "SELECT page_slug, question, answer, include_in_schema, sort_order FROM faqs WHERE include_in_schema = true ORDER BY page_slug, sort_order, id"
    );
    const faqsByPage = {};
    for (const row of faqsResult.rows) {
      const slug = row.page_slug;
      if (!faqsByPage[slug]) faqsByPage[slug] = [];
      faqsByPage[slug].push(row);
    }

    // Map static route paths to faqs page_slug keys
    const staticRouteSlugMap = {
      "/": "main",
      "/service": "service",
      "/service/bonus": "bonus-program",
      "/buyout": "buyout",
      "/vacancies": "vacancies",
    };

    // Load page_seo_overrides so SSG static files reflect admin-applied meta changes
    let seoOverrides = {};
    try {
      const ovResult = await pool.query(
        "SELECT route, meta_title, meta_description FROM page_seo_overrides WHERE route = ANY($1)",
        [Object.keys(STATIC_ROUTES)]
      );
      for (const row of ovResult.rows) {
        seoOverrides[row.route] = { meta_title: row.meta_title, meta_description: row.meta_description };
      }
    } catch {
      // page_seo_overrides may not exist yet — use hardcoded defaults
    }

    for (const [route, meta] of Object.entries(STATIC_ROUTES)) {
      const faqSlug = staticRouteSlugMap[route];
      const faqLd = faqSlug ? buildFaqLd(faqsByPage[faqSlug]) : null;
      const breadcrumbLd = buildBreadcrumbList(route, meta.title);
      const extras = [];
      if (faqLd) extras.push(faqLd);
      if (route === "/vacancies") extras.push(buildVacanciesLd());
      extras.push(breadcrumbLd);
      const ov = seoOverrides[route];
      const title = (ov?.meta_title) || meta.title;
      const description = (ov?.meta_description) || meta.description;
      writeRoute(route, title, description, meta.h1, DEFAULT_OG_IMAGE, extras);
    }

    const brandsResult = await pool.query(
      "SELECT b.id, b.name, b.slug, b.is_service_only, bpc.meta_description, bpc.meta_title, bpc.description as brand_description, bpc.faq FROM brands b LEFT JOIN brand_page_content bpc ON bpc.brand_id = b.id WHERE b.slug IS NOT NULL AND b.slug != ''"
    );
    for (const row of brandsResult.rows) {
      const faqSlug = `brands/${row.slug}`;
      const faqLd = buildFaqLd(faqsByPage[faqSlug]);
      const isService = row.is_service_only === true;
      const metaDesc = row.meta_description;
      const metaTitle = row.meta_title;
      const brandName = row.name;
      const title = metaTitle
        ? (metaTitle.includes("Дебрянск") ? metaTitle.trim() : `${metaTitle.trim()} | Дебрянск Авто`)
        : `${brandName} в Брянске — ${isService ? "официальный сервис" : "официальный дилер"} | Дебрянск Авто`;
      const description = metaDesc
        ? metaDesc
        : (isService
            ? `Официальный сервис ${brandName} в Брянске — гарантийное и постгарантийное обслуживание, оригинальные запчасти. Дебрянск Авто.`
            : `Купите ${brandName} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`
          );
      const h1 = isService
        ? `Официальный сервис ${brandName} в Брянске — Дебрянск Авто`
        : `Официальный дилер ${brandName} в Брянске — Дебрянск Авто`;
      const breadcrumbLd = buildBreadcrumbList(`/brands/${row.slug}`, title);
      const jsonLd = faqLd ? [faqLd, breadcrumbLd] : [breadcrumbLd];
      writeRoute(
        `/brands/${row.slug}`,
        title,
        description,
        h1,
        DEFAULT_OG_IMAGE,
        jsonLd
      );

      // ——— Inject brand description + FAQ into body (like /news grid) ———
      const brandContentHtml = buildBrandContentHtml(row.brand_description, row.faq);
      if (brandContentHtml) {
        const brandFile = join(distDir, "brands", row.slug, "index.html");
        if (existsSync(brandFile)) {
          let brandHtml = readFileSync(brandFile, "utf-8");
          brandHtml = brandHtml.replace(/<\/body>/, `${brandContentHtml}\n  </body>`);
          writeFileSync(brandFile, brandHtml);
        }
      }
    }

    const newsResult = await pool.query(
      "SELECT title, slug, excerpt, category, image, published_at, read_time FROM news WHERE published_at IS NOT NULL AND slug IS NOT NULL AND slug != '' ORDER BY published_at DESC"
    );
    const newsArticles = newsResult.rows;
    for (const row of newsArticles) {
      const newsTitle = `${row.title} | Дебрянск Авто`;
      const breadcrumbLd = buildBreadcrumbList(`/news/${row.slug}`, newsTitle);
      writeRoute(
        `/news/${row.slug}`,
        newsTitle,
        row.excerpt ||
          "Актуальная новость автомобильного рынка от дилерского центра «Дебрянск Авто».",
        row.title,
        DEFAULT_OG_IMAGE,
        breadcrumbLd
      );
    }
    // ——— Inject news grid into /news page for server-side article links ———
    if (newsArticles.length > 0) {
      const newsGridHtml = buildNewsGridHtml(newsArticles);
      const newsFile = join(distDir, "news", "index.html");
      if (existsSync(newsFile)) {
        let newsHtml = readFileSync(newsFile, "utf-8");
        newsHtml = newsHtml.replace(/<\/body>/, `${newsGridHtml}\n  </body>`);
        writeFileSync(newsFile, newsHtml);
        console.log("SSG: /news  → injected article grid (", newsArticles.length, "articles)");
      }
    }

    const fmt = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    });

    const carsResult = await pool.query(
      "SELECT external_id, brand, model, year, price, max_discount, type, image_url, modification, mileage, color FROM cars WHERE external_id IS NOT NULL"
    );
    for (const row of carsResult.rows) {
      const isNew = row.type === "new";
      const rawPrice = Number(row.price);
      const maxDiscount = isNew ? (Number(row.max_discount) || 0) : 0;
      const salePrice = isNew ? Math.max(0, rawPrice - maxDiscount) : rawPrice;
      const priceStr = fmt.format(salePrice);
      const prefix = isNew ? "new-cars" : "cars";
      const modShort = row.modification ? String(row.modification).replace(/\s*\([^)]+\)/, "").trim() : null;
      const stockNum = String(row.external_id).replace(/^.*?(\d+)$/, "$1").slice(-6);
      const color = row.color || null;
      const runKm = row.mileage ? Math.round(row.mileage / 1000) + " тыс. км" : null;
      let title;
      if (isNew) {
        const full = `Купить ${row.brand} ${row.model} ${row.year} в Брянске${modShort ? `, ${modShort}` : ""}${color ? `, ${color}` : ""} | Дебрянск Авто`;
        const noColor = `Купить ${row.brand} ${row.model} ${row.year} в Брянске${modShort ? `, ${modShort}` : ""} | Дебрянск Авто`;
        const noMod = `Купить ${row.brand} ${row.model} ${row.year} в Брянске | Дебрянск Авто`;
        title = full.length <= 70 ? full : (noColor.length <= 70 ? noColor : noMod);
      } else {
        const full = `${row.brand} ${row.model} ${row.year} б/у в Брянске${runKm ? `, ${runKm}` : ""}${color ? `, ${color}` : ""} | Дебрянск Авто`;
        const noColor = `${row.brand} ${row.model} ${row.year} б/у в Брянске${runKm ? `, ${runKm}` : ""} | Дебрянск Авто`;
        const noRun = `${row.brand} ${row.model} ${row.year} б/у в Брянске | Дебрянск Авто`;
        title = full.length <= 70 ? full : (noColor.length <= 70 ? noColor : noRun);
      }
      const h1 = isNew
        ? `Купить ${row.brand} ${row.model} ${row.year} в Брянске`
        : `${row.brand} ${row.model} ${row.year} с пробегом`;
      const priceLabel = isNew && maxDiscount > 0 ? `от ${priceStr}` : priceStr;
      const description = `Купите ${row.brand} ${row.model} ${row.year}${modShort ? `, ${modShort}` : ""} в Брянске. Цена ${priceLabel}. Арт. №${stockNum}. Официальный дилер «Дебрянск Авто» — +7 (4832) 77-77-70.`;
      const breadcrumbLd = buildBreadcrumbList(`/${prefix}/${row.external_id}`, title);
      writeRoute(
        `/${prefix}/${row.external_id}`,
        title,
        description,
        h1,
        row.image_url || DEFAULT_OG_IMAGE,
        breadcrumbLd
      );
    }
  } finally {
    await pool.end();
  }

  console.log("SSG: complete");
}

main().catch((err) => {
  console.error("SSG error:", err);
  process.exit(1);
});
