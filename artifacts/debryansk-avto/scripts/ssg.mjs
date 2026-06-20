#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist", "public");

const SITE = "https://debryansk-auto.ru";

const STATIC_ROUTES = {
  "/": {
    title: "Дебрянск Авто — Территория Автомобилей",
    description:
      "Дебрянск Авто — Территория Автомобилей. Группа компаний 9 брендов в Брянске. Продажа, сервис и финансирование с 2011 года.",
  },
  "/new-cars": {
    title: "Новые автомобили в Брянске — дилерский центр «Дебрянск Авто»",
    description:
      "Купите новый автомобиль у официального дилера в Брянске. Большой выбор авто в наличии, кредит, trade-in, гарантийное обслуживание.",
  },
  "/cars": {
    title: "Автомобили с пробегом в Брянске — дилер «Дебрянск Авто»",
    description:
      "Проверенные автомобили с пробегом в наличии у официального дилера Брянска. Отбор по качеству, кредит, трейд-ин.",
  },
  "/service": {
    title: "Сервисное обслуживание в Брянске — дилер «Дебрянск Авто»",
    description:
      "Профессиональное ТО и ремонт автомобилей в дилерских центрах Брянска. Запись онлайн, оригинальные запчасти.",
  },
  "/buyout": {
    title: "Выкуп автомобилей в Брянске — честная цена «Дебрянск Авто»",
    description:
      "Продайте свой автомобиль за 30 минут. Онлайн-оценка, бесплатный выезд, мгновенная оплата.",
  },
  "/news": {
    title: "Новости автомобильного рынка — Дебрянск Авто",
    description:
      "Актуальные новости об автомобилях, акциях и жизни группы компаний «Дебрянск Авто».",
  },
  "/about": {
    title: "О компании «Дебрянск Авто» — официальный дилер в Брянске",
    description:
      "Группа компаний «Дебрянск Авто» — официальный мультибрендовый дилер в Брянске. 9 брендов, 4 дилерских центра.",
  },
  "/contacts": {
    title:
      "Контакты «Дебрянск Авто» — адреса и телефоны дилерских центров Брянска",
    description:
      "Адреса, телефоны, часы работы всех дилерских центров «Дебрянск Авто» в Брянске.",
  },
  "/vacancies": {
    title: "Вакансии дилера «Дебрянск Авто» — работа в Брянске",
    description:
      "Работа в автодилерских центрах «Дебрянск Авто». Менеджеры, автомеханики, администраторы.",
  },
};

function injectMeta(html, title, description, canonical) {
  let result = html;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const t = esc(title);
  const d = esc(description);

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
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${canonical}" />`
  );
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${t}" />`
  );
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${d}" />`
  );
  if (result.includes('<link rel="canonical"')) {
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
  return result;
}

function writeRoute(routePath, title, description) {
  const canonical = `${SITE}${routePath}`;
  let template;
  try {
    template = readFileSync(join(distDir, "index.html"), "utf-8");
  } catch {
    console.error("SSG: cannot read dist/public/index.html");
    process.exit(1);
  }
  const html = injectMeta(template, title, description, canonical);

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
      writeRoute(route, meta.title, meta.description);
    }
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const [route, meta] of Object.entries(STATIC_ROUTES)) {
      writeRoute(route, meta.title, meta.description);
    }

    const brandsResult = await pool.query(
      "SELECT name, slug FROM brands WHERE slug IS NOT NULL AND slug != ''"
    );
    for (const row of brandsResult.rows) {
      writeRoute(
        `/brands/${row.slug}`,
        `${row.name} в Брянске — официальный дилер | Дебрянск Авто`,
        `Купите ${row.name} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`
      );
    }

    const newsResult = await pool.query(
      "SELECT title, slug, excerpt FROM news WHERE published_at IS NOT NULL AND slug IS NOT NULL AND slug != ''"
    );
    for (const row of newsResult.rows) {
      writeRoute(
        `/news/${row.slug}`,
        `${row.title} — Дебрянск Авто`,
        row.excerpt ||
          "Актуальная новость автомобильного рынка от дилерского центра «Дебрянск Авто»."
      );
    }

    const carsResult = await pool.query(
      "SELECT external_id, brand, model, year, price, type FROM cars WHERE external_id IS NOT NULL"
    );
    const fmt = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    });
    for (const row of carsResult.rows) {
      const priceStr = fmt.format(row.price);
      const prefix = row.type === "new" ? "new-cars" : "cars";
      writeRoute(
        `/${prefix}/${row.external_id}`,
        `${row.brand} ${row.model} ${row.year} — ${priceStr} — Дебрянск Авто`,
        `Купите ${row.brand} ${row.model} ${row.year} в Брянске. Цена ${priceStr}. Официальный дилер «Дебрянск Авто».`
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
