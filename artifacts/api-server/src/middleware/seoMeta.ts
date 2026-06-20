import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "fs";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const BOT_UA =
  /googlebot|yandexbot|bingbot|duckduckbot|facebookexternalhit|twitterbot|telegrambot|whatsapp|slackbot|linkedinbot|applebot|baiduspider|ia_archiver|vkshare|odklbot|yandex.com\/bots|yandexadnet|yandeximages|yandexscreenshot|yandexwebmaster|msnbot|seznambot|serpstatbot|ahrefsbot|semrushbot|dotbot|mj12bot|petalbot|screamingfrog|lighthouse|claude|anthropic/i;

const SITE = "https://debryansk-auto.ru";

const DEFAULT_META = {
  title: "Дебрянск Авто — Территория Автомобилей",
  description: "Дебрянск Авто — Территория Автомобилей. Группа компаний 9 брендов в Брянске. Продажа, сервис и финансирование с 2011 года.",
};

const STATIC_META: Record<string, { title: string; description: string }> = {
  "/": DEFAULT_META,
  "/new-cars": {
    title: "Новые автомобили в Брянске — дилерский центр «Дебрянск Авто»",
    description: "Купите новый автомобиль у официального дилера в Брянске. Большой выбор авто в наличии, кредит, trade-in, гарантийное обслуживание.",
  },
  "/cars": {
    title: "Автомобили с пробегом в Брянске — дилер «Дебрянск Авто»",
    description: "Проверенные автомобили с пробегом в наличии у официального дилера Брянска. Отбор по качеству, кредит, трейд-ин.",
  },
  "/service": {
    title: "Сервисное обслуживание в Брянске — дилер «Дебрянск Авто»",
    description: "Профессиональное ТО и ремонт автомобилей в дилерских центрах Брянска. Запись онлайн, оригинальные запчасти.",
  },
  "/buyout": {
    title: "Выкуп автомобилей в Брянске — честная цена «Дебрянск Авто»",
    description: "Продайте свой автомобиль за 30 минут. Онлайн-оценка, бесплатный выезд, мгновенная оплата.",
  },
  "/news": {
    title: "Новости автомобильного рынка — Дебрянск Авто",
    description: "Актуальные новости об автомобилях, акциях и жизни группы компаний «Дебрянск Авто».",
  },
  "/about": {
    title: "О компании «Дебрянск Авто» — официальный дилер в Брянске",
    description: "Группа компаний «Дебрянск Авто» — официальный мультибрендовый дилер в Брянске. 9 брендов, 4 дилерских центра.",
  },
  "/contacts": {
    title: "Контакты «Дебрянск Авто» — адреса и телефоны дилерских центров Брянска",
    description: "Адреса, телефоны, часы работы всех дилерских центров «Дебрянск Авто» в Брянске.",
  },
  "/vacancies": {
    title: "Вакансии дилера «Дебрянск Авто» — работа в Брянске",
    description: "Работа в автодилерских центрах «Дебрянск Авто». Менеджеры, автомеханики, администраторы.",
  },
};

let indexHtml: string | null = null;

function getIndexHtml(): string | null {
  if (indexHtml) return indexHtml;
  try {
    const distPath =
      process.env.FRONTEND_DIST_PATH ||
      path.resolve(__dirname, "../../debryansk-avto/dist/public");
    const filePath = path.join(distPath, "index.html");
    indexHtml = readFileSync(filePath, "utf-8");
    return indexHtml;
  } catch {
    return null;
  }
}

function injectMeta(html: string, title: string, description: string, canonical: string): string {
  let result = html;
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  result = result.replace(
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${description}" />`
  );
  result = result.replace(
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${title}" />`
  );
  result = result.replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${description}" />`
  );
  result = result.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`
  );
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${title}" />`
  );
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${description}" />`
  );
  // Ensure canonical link exists
  if (result.includes('<link rel="canonical"')) {
    result = result.replace(
      /<link rel="canonical" href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${canonical}" />`
    );
  } else {
    result = result.replace(
      /<meta name="description"[^>]*\/>/,
      `<meta name="description" content="${description}" />\n    <link rel="canonical" href="${canonical}" />`
    );
  }
  return result;
}

async function resolveMeta(
  pathStr: string,
): Promise<{ title: string; description: string; canonical: string } | null> {
  const meta = STATIC_META[pathStr];
  if (meta) {
    return { ...meta, canonical: `${SITE}${pathStr}` };
  }

  // Brand pages: /brands/:slug
  const brandMatch = pathStr.match(/^\/brands\/([^\/]+)$/);
  if (brandMatch) {
    const slug = brandMatch[1];
    const result = await db.execute(
      sql`SELECT name, slug FROM brands WHERE slug = ${slug} AND slug IS NOT NULL LIMIT 1`
    );
    const row = result.rows[0] as { name: string; slug: string } | undefined;
    if (row) {
      return {
        title: `${row.name} в Брянске — официальный дилер | Дебрянск Авто`,
        description: `Купите ${row.name} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`,
        canonical: `${SITE}/brands/${slug}`,
      };
    }
  }

  // News pages: /news/:slug
  const newsMatch = pathStr.match(/^\/news\/([^\/]+)$/);
  if (newsMatch) {
    const slug = newsMatch[1];
    const result = await db.execute(
      sql`SELECT title, slug, excerpt FROM news WHERE slug = ${slug} LIMIT 1`
    );
    const row = result.rows[0] as { title: string; slug: string; excerpt: string | null } | undefined;
    if (row) {
      return {
        title: `${row.title} — Дебрянск Авто`,
        description: row.excerpt || "Актуальная новость автомобильного рынка от дилерского центра «Дебрянск Авто».",
        canonical: `${SITE}/news/${slug}`,
      };
    }
  }

  // Car detail pages: /new-cars/:id or /cars/:id
  const carMatch = pathStr.match(/^\/(new-cars|cars)\/([^\/]+)$/);
  if (carMatch) {
    const type = carMatch[1] === "new-cars" ? "new" : "used";
    const id = decodeURIComponent(carMatch[2]);
    const result = await db.execute(
      sql`SELECT brand, model, year, price, description FROM cars WHERE external_id = ${id} AND type = ${type} LIMIT 1`
    );
    const row = result.rows[0] as { brand: string; model: string; year: number; price: number; description: string | null } | undefined;
    if (row) {
      const priceStr = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(row.price);
      return {
        title: `${row.brand} ${row.model} ${row.year} — ${priceStr} — Дебрянск Авто`,
        description: row.description || `Купите ${row.brand} ${row.model} ${row.year} в Брянске. Цена ${priceStr}. Официальный дилер «Дебрянск Авто».`,
        canonical: `${SITE}${pathStr}`,
      };
    }
  }

  return null;
}

export function seoMetaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.PRERENDER_ENABLED !== "true") {
    next();
    return;
  }

  const ua = (req.headers["user-agent"] ?? "") as string;
  if (!BOT_UA.test(ua)) {
    next();
    return;
  }

  // Skip static files
  if (/\.\w{2,10}$/.test(req.path)) {
    next();
    return;
  }

  const route = req.path || "/";

  resolveMeta(route)
    .then((meta) => {
      if (!meta) {
        next();
        return;
      }
      const html = getIndexHtml();
      if (!html) {
        next();
        return;
      }
      const enriched = injectMeta(html, meta.title, meta.description, meta.canonical);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-SeoMeta", "1");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.status(200).send(enriched);
      logger.info({ route, ua: ua.substring(0, 40) }, "seoMeta: served enriched HTML");
    })
    .catch((err) => {
      logger.warn({ err, route }, "seoMeta: failed to resolve meta");
      next();
    });
}
