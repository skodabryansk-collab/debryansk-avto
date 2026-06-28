import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "fs";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const BOT_UA =
  /googlebot|yandexbot|bingbot|duckduckbot|facebookexternalhit|twitterbot|telegrambot|whatsapp|slackbot|linkedinbot|applebot|baiduspider|ia_archiver|vkshare|odklbot|yandex.com\/bots|yandexadnet|yandeximages|yandexscreenshot|yandexwebmaster|msnbot|seznambot|serpstatbot|ahrefsbot|semrushbot|dotbot|mj12bot|petalbot|screamingfrog|lighthouse|claude|anthropic|squirrel|squirrelscan/i;

const SITE = "https://debryansk-auto.ru";
const DEFAULT_OG_IMAGE = `${SITE}/opengraph.jpg`;

const DEFAULT_META = {
  title: "Дебрянск Авто — официальный автосалон в Брянске | Продажа, сервис, кредит",
  description: "Официальный дилер Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, EXEED, Tenet и Mercedes-Benz в Брянске. 4 дилерских центра. Продажа, сервис и финансирование с 2011 года.",
  h1: "Дебрянск Авто — официальный дилер автомобилей в Брянске",
};

const STATIC_META: Record<string, { title: string; description: string; h1: string }> = {
  "/": DEFAULT_META,
  "/new-cars": {
    title: "Новые автомобили в Брянске — каталог и цены | Дебрянск Авто",
    description: "Купите новый автомобиль у официального дилера в Брянске. Большой выбор авто в наличии, кредит, trade-in, гарантийное обслуживание.",
    h1: "Новые автомобили в Брянске",
  },
  "/cars": {
    title: "Автомобили с пробегом в Брянске — каталог | Дебрянск Авто",
    description: "Проверенные авто с пробегом у официального дилера «Дебрянск Авто» в Брянске. Более 200 машин в наличии. Кредит, трейд-ин, гарантия качества.",
    h1: "Автомобили с пробегом в Брянске",
  },
  "/service": {
    title: "Сервисное обслуживание автомобилей в Брянске — ТО, ремонт, запчасти | Дебрянск Авто",
    description: "Официальный сервис Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, EXEED и других брендов в Брянске. Онлайн-запись, оригинальные запчасти, гарантийный ремонт.",
    h1: "Сервисное обслуживание автомобилей в Брянске",
  },
  "/buyout": {
    title: "Выкуп и комиссионная продажа авто в Брянске | Дебрянск Авто",
    description: "Срочный выкуп автомобиля за 30 минут или комиссионная продажа по максимальной цене. Оценка бесплатно, оплата в день сделки. Официальный дилер «Дебрянск Авто».",
    h1: "Выкуп и комиссионная продажа автомобилей в Брянске",
  },
  "/news": {
    title: "Новости автосалона Дебрянск Авто в Брянске",
    description: "Актуальные новости об автомобилях, акциях и скидках от группы компаний «Дебрянск Авто» — официального мультибрендового дилера в Брянске.",
    h1: "Новости Дебрянск Авто",
  },
  "/about": {
    title: "О компании Дебрянск Авто — группа компаний 9 БР",
    description: "«Дебрянск Авто» — официальный мультибрендовый дилер в Брянске с 2011 года. 10 брендов: Haval, Jetour, OMODA, Jaecoo, Soueast. 4 дилерских центра.",
    h1: "О компании Дебрянск Авто",
  },
  "/contacts": {
    title: "Контакты дилерских центров Дебрянск Авто в Брянске",
    description: "Адреса и телефоны 4 дилерских центров «Дебрянск Авто» в Брянске: Советская, Литейная, Московский, Супонево. Звоните: +7 (4832) 77-77-70.",
    h1: "Контакты дилерских центров Дебрянск Авто",
  },
  "/vacancies": {
    title: "Вакансии дилера «Дебрянск Авто» — работа в Брянске",
    description: "Актуальные вакансии в автодилерских центрах «Дебрянск Авто». Менеджеры, механики, администраторы. Обучение и карьерный рост.",
    h1: "Вакансии в Дебрянск Авто",
  },
  "/legal": {
    title: "Юридическая информация и реквизиты | Дебрянск Авто",
    description: "Реквизиты ООО «Дебрянск Авто»: ИНН, КПП, ОГРН, банковские реквизиты, юридический адрес и данные генерального директора.",
    h1: "Юридическая информация",
  },
  "/privacy": {
    title: "Политика конфиденциальности и обработки персональных данных | Дебрянск Авто",
    description: "Политика конфиденциальности ООО «Дебрянск Авто» — порядок сбора, хранения и защиты персональных данных пользователей сайта debryansk-auto.ru (ФЗ-152).",
    h1: "Политика конфиденциальности и обработки персональных данных",
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

const LOCAL_BUSINESS_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": ["AutoDealer", "LocalBusiness"],
  "name": "Дебрянск Авто",
  "url": "https://debryansk-auto.ru",
  "logo": "https://debryansk-auto.ru/logo.svg",
  "image": "https://debryansk-auto.ru/og-image.jpg",
  "telephone": "+7-4832-77-77-70",
  "email": "info@debryansk-auto.ru",
  "openingHours": "Mo-Su 09:00-21:00",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "ул. Советская, д. 77",
    "addressLocality": "Брянск",
    "addressRegion": "Брянская область",
    "postalCode": "241050",
    "addressCountry": "RU"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 53.2431,
    "longitude": 34.3636
  },
  "sameAs": ["https://vk.com/debryansk_avto"],
  "priceRange": "₽₽₽"
});

const CONTACT_PAGE_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Контакты Дебрянск Авто",
  "url": "https://debryansk-auto.ru/contacts",
  "description": "Адреса и телефоны дилерских центров Дебрянск Авто в Брянске",
  "mainEntity": {
    "@type": "AutoDealer",
    "name": "Дебрянск Авто",
    "telephone": "+7-4832-77-77-70",
    "openingHours": "Mo-Su 09:00-21:00",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "ул. Советская, д. 77",
      "postalCode": "241050",
      "addressLocality": "Брянск",
      "addressCountry": "RU"
    }
  }
});

function injectMeta(
  html: string,
  title: string,
  description: string,
  canonical: string,
  ogImage: string,
  h1: string,
  extraJsonLd?: string,
): string {
  let result = html;

  // Strip ALL existing title/canonical/description/og/twitter tags to avoid duplicates
  // (React Helmet may have injected its own set into Puppeteer-rendered HTML)
  result = result.replace(/<title>[^<]*<\/title>\n?/g, "");
  result = result.replace(/<link rel="canonical"[^>]*\/?>\n?/gi, "");
  result = result.replace(/<meta name="description"[^>]*\/?>\n?/gi, "");
  result = result.replace(/<meta name="robots"[^>]*\/?>\n?/gi, "");
  result = result.replace(/<meta property="og:[^"]*"[^>]*\/?>\n?/gi, "");
  result = result.replace(/<meta name="twitter:[^"]*"[^>]*\/?>\n?/gi, "");

  // Insert clean, deduplicated meta block right after <meta name="viewport"...>
  const metaBlock = [
    `<title>${title}</title>`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:site_name" content="Дебрянск Авто" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
  ].join("\n    ");

  result = result.replace(
    /(<meta name="viewport"[^>]*\/>)/,
    `$1\n    ${metaBlock}`
  );

  // Inject LCP image preload + schema.org JSON-LD before </head>
  const ldScripts = [
    `<script type="application/ld+json">${LOCAL_BUSINESS_SCHEMA}</script>`,
    extraJsonLd ? `<script type="application/ld+json">${extraJsonLd}</script>` : "",
  ].filter(Boolean).join("\n    ");
  const lcpPreload = `<link rel="preload" as="image" href="${ogImage}" fetchpriority="high" />`;
  result = result.replace("</head>", `  ${lcpPreload}\n  ${ldScripts}\n  </head>`);

  // Inject main landmark + static navigation for crawlers (visually hidden)
  result = result.replace(
    /<div id="root"><\/div>/,
    `<div id="root"></div>
    <main aria-label="Основной контент" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">
      <nav aria-label="Основная навигация">
        <a href="/new-cars">Новые автомобили в Брянске</a>
        <a href="/cars">Автомобили с пробегом в Брянске</a>
        <a href="/service">Сервисное обслуживание</a>
        <a href="/buyout">Выкуп автомобилей</a>
        <a href="/about">О компании Дебрянск Авто</a>
        <a href="/contacts">Контакты</a>
        <a href="/news">Новости</a>
        <a href="/vacancies">Вакансии</a>
        <a href="/privacy">Политика конфиденциальности</a>
        <a href="/brands/haval-pro">Haval Pro официальный дилер Брянск</a>
        <a href="/brands/haval-city">Haval City официальный дилер Брянск</a>
        <a href="/brands/jetour">Jetour официальный дилер Брянск</a>
        <a href="/brands/omoda">OMODA официальный дилер Брянск</a>
        <a href="/brands/jaecoo">JAECOO официальный дилер Брянск</a>
        <a href="/brands/volkswagen">Volkswagen официальный дилер Брянск</a>
        <a href="/brands/skoda">SKODA официальный дилер Брянск</a>
        <a href="/brands/exeed">EXEED официальный дилер Брянск</a>
        <a href="/brands/tenet">Tenet официальный дилер Брянск</a>
        <a href="/brands/mercedes-benz">Mercedes-Benz официальный дилер Брянск</a>
      </nav>
      <address>
        <p>Дебрянск Авто — официальный дилер Haval, Jetour, OMODA, Volkswagen в Брянске</p>
        <p>Телефон: <a href="tel:+74832777770">+7 (4832) 77-77-70</a></p>
        <p>Адрес: г. Брянск, ул. Советская, д. 77 | ул. Литейная, 3/2 | пр. Московский, 2Г | с. Супонево, ул. Шоссейная, 12Г</p>
        <p>Режим работы: ежедневно 9:00–21:00</p>
        <p>Email: <a href="mailto:info@debryansk-auto.ru">info@debryansk-auto.ru</a></p>
      </address>
    </main>`
  );

  return result;
}

async function resolveMeta(
  pathStr: string,
): Promise<{ title: string; description: string; canonical: string; ogImage: string; h1: string; jsonLd?: string } | null> {
  const meta = STATIC_META[pathStr];
  if (meta) {
    const extra = pathStr === "/contacts" ? { jsonLd: CONTACT_PAGE_SCHEMA } : {};
    return { ...meta, canonical: `${SITE}${pathStr}`, ogImage: DEFAULT_OG_IMAGE, ...extra };
  }

  // Brand pages: /brands/:slug
  const brandMatch = pathStr.match(/^\/brands\/([^\/]+)$/);
  if (brandMatch) {
    const slug = brandMatch[1];
    const result = await db.execute(
      sql`SELECT b.name, b.slug, b.is_service_only, bpc.meta_description, bpc.meta_title FROM brands b LEFT JOIN brand_page_content bpc ON bpc.brand_id = b.id WHERE b.slug = ${slug} AND b.slug IS NOT NULL LIMIT 1`
    );
    const row = result.rows[0] as { name: string; slug: string; is_service_only: boolean; meta_description: string | null; meta_title: string | null } | undefined;
    if (row) {
      const isService = row.is_service_only;
      const metaDesc = row.meta_description;
      const metaTitle = row.meta_title;
      const title = metaTitle
        ? `${metaTitle} | Дебрянск Авто`
        : `${row.name} в Брянске — ${isService ? "официальный сервис" : "официальный дилер"} | Дебрянск Авто`;
      const description = metaDesc
        ? metaDesc
        : (isService
            ? `Официальный сервис ${row.name} в Брянске — гарантийное и постгарантийное обслуживание, оригинальные запчасти. Дебрянск Авто.`
            : `Купите ${row.name} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`
          );
      const h1 = isService
        ? `Официальный сервис ${row.name} в Брянске — Дебрянск Авто`
        : `Официальный дилер ${row.name} в Брянске — Дебрянск Авто`;
      return {
        title,
        description,
        canonical: `${SITE}/brands/${slug}`,
        ogImage: DEFAULT_OG_IMAGE,
        h1,
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
      const newsDesc = row.excerpt
        ? (row.excerpt.length > 155 ? row.excerpt.slice(0, 152) + "…" : row.excerpt)
        : "Актуальная новость автомобильного рынка от дилерского центра «Дебрянск Авто» в Брянске.";
      const newsArticleSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": row.title,
        "description": newsDesc,
        "url": `${SITE}/news/${slug}`,
        "publisher": {
          "@type": "Organization",
          "name": "Дебрянск Авто",
          "logo": { "@type": "ImageObject", "url": "https://debryansk-auto.ru/logo.svg" }
        },
        "author": {
          "@type": "Organization",
          "name": "Редакция Дебрянск Авто",
          "url": "https://debryansk-auto.ru/about"
        },
        "datePublished": new Date().toISOString().split("T")[0],
        "inLanguage": "ru"
      });
      return {
        title: `${row.title} | Дебрянск Авто`,
        description: newsDesc,
        canonical: `${SITE}/news/${slug}`,
        ogImage: DEFAULT_OG_IMAGE,
        h1: row.title,
        jsonLd: newsArticleSchema,
      };
    }
  }

  // Car detail pages: /new-cars/:id or /cars/:id
  const carMatch = pathStr.match(/^\/(new-cars|cars)\/([^\/]+)$/);
  if (carMatch) {
    const type = carMatch[1] === "new-cars" ? "new" : "used";
    const id = decodeURIComponent(carMatch[2]);
    const result = await db.execute(
      sql`SELECT brand, model, modification, year, price, description, image_url, external_id FROM cars WHERE external_id = ${id} AND type = ${type} LIMIT 1`
    );
    const row = result.rows[0] as { brand: string; model: string; modification: string | null; year: number; price: number; description: string | null; image_url: string | null; external_id: string } | undefined;
    if (row) {
      const priceStr = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(row.price);
      const isNew = type === "new";
      // Short modification suffix for title uniqueness (e.g. "1.5 AMT" from "1.5 AMT (143 л.с.)")
      const modShort = row.modification ? row.modification.replace(/\s*\([^)]+\)/, "").trim() : null;
      // Stock number from external_id for guaranteed uniqueness
      const stockNum = row.external_id.replace(/^.*?(\d+)$/, "$1").slice(-6);
      // Build title — drop modification if full title >70 chars
      const titleWithMod = isNew
        ? `Купить ${row.brand} ${row.model} ${row.year}${modShort ? `, ${modShort}` : ""} — №${stockNum} | Дебрянск Авто`
        : `${row.brand} ${row.model} ${row.year} б/у — ${priceStr} №${stockNum} | Дебрянск Авто`;
      const titleNoMod = isNew
        ? `Купить ${row.brand} ${row.model} ${row.year} — №${stockNum} | Дебрянск Авто`
        : `${row.brand} ${row.model} ${row.year} б/у №${stockNum} | Дебрянск Авто`;
      const title = titleWithMod.length > 70 ? titleNoMod : titleWithMod;
      const h1 = isNew
        ? `Купить ${row.brand} ${row.model} ${row.year} в Брянске`
        : `${row.brand} ${row.model} ${row.year} с пробегом`;
      // Unique description: include stock# to differentiate identical brand+model+year+mod+price
      const description = `Купите ${row.brand} ${row.model} ${row.year}${modShort ? `, ${modShort}` : ""} в Брянске. Цена ${priceStr}. Арт. №${stockNum}. Официальный дилер «Дебрянск Авто» — +7 (4832) 63-10-00.`;
      return {
        title,
        description,
        canonical: `${SITE}${pathStr}`,
        ogImage: row.image_url || DEFAULT_OG_IMAGE,
        h1,
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
  const ua = (req.headers["user-agent"] ?? "") as string;

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
      const enriched = injectMeta(html, meta.title, meta.description, meta.canonical, meta.ogImage, meta.h1, meta.jsonLd);
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
