#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist", "public");

const SITE = "https://debryansk-auto.ru";
const DEFAULT_OG_IMAGE = `${SITE}/opengraph.jpg`;

const STATIC_ROUTES = {
  "/": {
    title: "Дебрянск Авто — официальный автосалон в Брянске | Продажа, сервис, кредит",
    description:
      "Официальный дилер Haval, Jetour, OMODA, JAECOO, Volkswagen, SKODA, EXEED, Tenet и Mercedes-Benz в Брянске. 4 дилерских центра. Продажа, сервис и финансирование с 2011 года.",
    h1: "Дебрянск Авто — официальный дилер автомобилей в Брянске",
  },
  "/new-cars": {
    title: "Новые автомобили в Брянске — каталог и цены | Дебрянск Авто",
    description:
      "Купите новый автомобиль у официального дилера в Брянске. Большой выбор авто в наличии, кредит, trade-in, гарантийное обслуживание.",
    h1: "Новые автомобили в Брянске",
  },
  "/cars": {
    title: "Автомобили с пробегом в Брянске — каталог | Дебрянск Авто",
    description:
      "Проверенные автомобили с пробегом в наличии у официального дилера Брянска. Отбор по качеству, кредит, трейд-ин.",
    h1: "Автомобили с пробегом в Брянске",
  },
  "/service": {
    title: "Сервисное обслуживание автомобилей в Брянске — ТО, ремонт, запчасти | Дебрянск Авто",
    description:
      "Официальный сервис Haval, Jetour, OMODA, JAECOO, Volkswagen, SKODA, EXEED и других брендов в Брянске. Онлайн-запись, оригинальные запчасти, гарантийный ремонт.",
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
      "Группа компаний «Дебрянск Авто» — официальный мультибрендовый дилер в Брянске. 9 брендов, 4 дилерских центра с 2011 года.",
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
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function injectMeta(html, title, description, canonical, ogImage, h1) {
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

  // Inject H1 as screen-reader-only element for search engines
  result = result.replace(
    /<div id="root"><\/div>/,
    `<div id="root"></div>\n    <h1 class="sr-only">${h}</h1>`
  );

  return result;
}

let _template = null;
function getTemplate() {
  if (_template) return _template;
  try {
    let raw = readFileSync(join(distDir, "index.html"), "utf-8");
    // Strip any previously injected sr-only H1 tags so re-runs are idempotent
    raw = raw.replace(/\n\s*<h1 class="sr-only">[^<]*<\/h1>/g, "");
    _template = raw;
    return _template;
  } catch {
    console.error("SSG: cannot read dist/public/index.html");
    process.exit(1);
  }
}

function writeRoute(routePath, title, description, h1, ogImage) {
  const canonical = `${SITE}${routePath}`;
  const template = getTemplate();
  const html = injectMeta(template, title, description, canonical, ogImage || DEFAULT_OG_IMAGE, h1);

  let filePath;
  if (routePath === "/") {
    filePath = join(distDir, "index.html");
  } else {
    const parts = routePath.slice(1).split("/");
    const dir = join(distDir, ...parts);
    mkdirSync(dir, { recursive: true });
    filePath = join(dir, "index.html");
  }
  writeFileSync(filePath, html);
  console.log(`SSG: ${routePath}`);
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
    for (const [route, meta] of Object.entries(STATIC_ROUTES)) {
      writeRoute(route, meta.title, meta.description, meta.h1, DEFAULT_OG_IMAGE);
    }

    const brandsResult = await pool.query(
      "SELECT name, slug FROM brands WHERE slug IS NOT NULL AND slug != ''"
    );
    for (const row of brandsResult.rows) {
      writeRoute(
        `/brands/${row.slug}`,
        `${row.name} в Брянске — официальный дилер | Дебрянск Авто`,
        `Купите ${row.name} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`,
        `${row.name} в Брянске — официальный дилер`,
        DEFAULT_OG_IMAGE
      );
    }

    const newsResult = await pool.query(
      "SELECT title, slug, excerpt FROM news WHERE published_at IS NOT NULL AND slug IS NOT NULL AND slug != ''"
    );
    for (const row of newsResult.rows) {
      writeRoute(
        `/news/${row.slug}`,
        `${row.title} | Дебрянск Авто`,
        row.excerpt ||
          "Актуальная новость автомобильного рынка от дилерского центра «Дебрянск Авто».",
        row.title,
        DEFAULT_OG_IMAGE
      );
    }

    const fmt = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    });

    const carsResult = await pool.query(
      "SELECT external_id, brand, model, year, price, type, image_url FROM cars WHERE external_id IS NOT NULL"
    );
    for (const row of carsResult.rows) {
      const priceStr = fmt.format(row.price);
      const isNew = row.type === "new";
      const prefix = isNew ? "new-cars" : "cars";
      const title = isNew
        ? `Купить ${row.brand} ${row.model} ${row.year} в Брянске — цена ${priceStr} | Дебрянск Авто`
        : `${row.brand} ${row.model} ${row.year} б/у — ${priceStr} | Дебрянск Авто`;
      const h1 = isNew
        ? `Купить ${row.brand} ${row.model} ${row.year} в Брянске`
        : `${row.brand} ${row.model} ${row.year} с пробегом`;
      writeRoute(
        `/${prefix}/${row.external_id}`,
        title,
        `${isNew ? "Купите" : "Купите"} ${row.brand} ${row.model} ${row.year} в Брянске. Цена ${priceStr}. Официальный дилер «Дебрянск Авто».`,
        h1,
        row.image_url || DEFAULT_OG_IMAGE
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
