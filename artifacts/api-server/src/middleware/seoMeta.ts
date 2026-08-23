import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "fs";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getPrerenderCache, isSsgRoute, rewriteAssetTagsToCurrent } from "./prerender";

const BOT_UA =
  /googlebot|yandexbot|bingbot|duckduckbot|facebookexternalhit|twitterbot|telegrambot|whatsapp|slackbot|linkedinbot|applebot|baiduspider|ia_archiver|vkshare|odklbot|yandex.com\/bots|yandexadnet|yandeximages|yandexscreenshot|yandexwebmaster|msnbot|seznambot|serpstatbot|ahrefsbot|semrushbot|dotbot|mj12bot|petalbot|screamingfrog|lighthouse|claude|anthropic|squirrel|squirrelscan/i;

const SITE = "https://debryansk-auto.ru";
const DEFAULT_OG_IMAGE = `${SITE}/opengraph.jpg`;

const DEFAULT_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large";

const DEFAULT_META = {
  title: "Дебрянск Авто — официальный автосалон в Брянске | Продажа, сервис, кредит",
  description: "Официальный дилер Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, EXEED, Tenet и Mercedes-Benz в Брянске. 4 дилерских центра. Продажа, сервис и финансирование с 2011 года.",
  h1: "Дебрянск Авто — официальный дилер автомобилей в Брянске",
  robots: DEFAULT_ROBOTS,
};

export const STATIC_META: Record<string, { title: string; description: string; h1: string; robots?: string }> = {
  "/": DEFAULT_META,
  "/brands": {
    title: "Бренды автомобилей и официальный сервис в Брянске — Дебрянск Авто",
    description: "Официальные дилеры новых автомобилей и сервисные бренды в Брянске. Каталог автомобилей с пробегом, адреса дилерских центров и актуальные предложения Дебрянск Авто.",
    h1: "Бренды автомобилей и сервис Дебрянск Авто в Брянске",
    robots: DEFAULT_ROBOTS,
  },
  "/new-cars": {
    title: "Новые автомобили в Брянске — Дебрянск Авто",
    description: "Новые автомобили 14 брендов у официальных дилеров Брянска. Выгодное кредитование, специальные программы, гарантия производителя. Дебрянск Авто.",
    h1: "Новые автомобили в Брянске",
    robots: DEFAULT_ROBOTS,
  },
  "/cars": {
    title: "Автомобили с пробегом в Брянске — Дебрянск Авто",
    description: "Купить авто с пробегом в Брянске. Выгодные цены, проверенные автомобили, кредит, трейд-ин. Дебрянск Авто — 14 брендов.",
    h1: "Автомобили с пробегом в Брянске",
    robots: DEFAULT_ROBOTS,
  },
  "/service": {
    title: "Сервисное обслуживание автомобилей в Брянске — ТО, ремонт, запчасти | Дебрянск Авто",
    description: "Официальный сервис Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, EXEED и других брендов в Брянске. Онлайн-запись, оригинальные запчасти, гарантийный ремонт.",
    h1: "Сервисное обслуживание автомобилей в Брянске",
    robots: DEFAULT_ROBOTS,
  },
  "/buyout": {
    title: "Выкуп и комиссионная продажа авто в Брянске | Дебрянск Авто",
    description: "Срочный выкуп автомобиля за 30 минут или комиссионная продажа по максимальной цене. Оценка бесплатно, оплата в день сделки. Официальный дилер «Дебрянск Авто».",
    h1: "Выкуп и комиссионная продажа автомобилей в Брянске",
    robots: DEFAULT_ROBOTS,
  },
  "/news": {
    title: "Новости автосалона Дебрянск Авто в Брянске",
    description: "Актуальные новости об автомобилях, акциях и скидках от группы компаний «Дебрянск Авто» — официального мультибрендового дилера в Брянске.",
    h1: "Новости Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
  "/about": {
    title: "О компании Дебрянск Авто — группа компаний 9 БР",
    description: "«Дебрянск Авто» — официальный мультибрендовый дилер в Брянске с 2011 года. 10 брендов: Haval, Jetour, OMODA, Jaecoo, Soueast. 4 дилерских центра.",
    h1: "О компании Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
  "/contacts": {
    title: "Контакты дилерских центров Дебрянск Авто в Брянске",
    description: "Адреса и телефоны 4 дилерских центров «Дебрянск Авто» в Брянске: Советская, Литейная, Московский, Супонево. Звоните: +7 (4832) 77-77-70.",
    h1: "Контакты дилерских центров Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
  "/vacancies": {
    title: "Вакансии дилера «Дебрянск Авто» — работа в Брянске",
    description: "Актуальные вакансии в автодилерских центрах «Дебрянск Авто». Менеджеры, механики, администраторы. Обучение и карьерный рост.",
    h1: "Вакансии в Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
  "/legal": {
    title: "Юридическая информация и реквизиты | Дебрянск Авто",
    description: "Реквизиты ООО «Дебрянск Авто»: ИНН, КПП, ОГРН, банковские реквизиты, юридический адрес и данные генерального директора.",
    h1: "Юридическая информация",
    robots: DEFAULT_ROBOTS,
  },
  "/privacy": {
    title: "Политика конфиденциальности и обработки персональных данных | Дебрянск Авто",
    description: "Политика конфиденциальности ООО «Дебрянск Авто» — порядок сбора, хранения и защиты персональных данных пользователей сайта debryansk-auto.ru (ФЗ-152).",
    h1: "Политика конфиденциальности и обработки персональных данных",
    robots: DEFAULT_ROBOTS,
  },
  "/service/bonus": {
    title: "Бонусная программа — Дебрянск Авто | Копите и тратьте бонусы",
    description: "Бонусная программа автодилера «Дебрянск Авто» в Брянске. Начисление 10% от суммы заказ-наряда. Списание от 5% до 10% по накопительным уровням.",
    h1: "Бонусная программа Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
  "/corporate": {
    title: "Корпоративным клиентам — Дебрянск Авто | Автомобили для бизнеса в Брянске",
    description: "Официальный дилер «Дебрянск Авто» для юридических лиц и ИП. Корпоративные скидки, полный НДС 20%, лизинг, trade-in, персональный менеджер. Брянск.",
    h1: "Корпоративное обслуживание в Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
  "/promotions": {
    title: "Акции и спецпредложения — Дебрянск Авто | Брянск",
    description: "Актуальные акции на покупку автомобилей от официального дилера Дебрянск Авто в Брянске. Скидки, выгодный кредит, трейд-ин бонусы.",
    h1: "Акции и спецпредложения Дебрянск Авто",
    robots: DEFAULT_ROBOTS,
  },
};

const distPath =
  process.env.FRONTEND_DIST_PATH ||
  path.resolve(__dirname, "../../debryansk-avto/dist/public");

const ssgCache: Map<string, string> = new Map();

function getSsgHtml(route: string, bypassCache = false): string | null {
  // "/" is dynamic (promotions/brands rendered by Puppeteer into GCS cache),
  // NOT a truly-static SSG file. Prefer the live Puppeteer snapshot from
  // cache.pages over the bare dist/public/index.html SPA shell, which has
  // no real content and previously caused Googlebot to see an empty page.
  //
  // EXCEPTION: when the prerender crawler itself is requesting "/" (identified
  // via the x-prerender-bot header, bypassCache=true), it must NOT be served
  // its own previous snapshot back — that creates a self-perpetuating loop
  // where a broken capture (e.g. stale JS bundle hash) can never self-heal
  // because Puppeteer never sees the live SPA shell to re-render from.
  if (route === "/" && !bypassCache) {
    const cached = getPrerenderCache().pages.get("/");
    // Homepage content is kept as a Puppeteer snapshot, but its hashed asset
    // names must always match the build currently deployed to the VPS.
    if (cached) return rewriteAssetTagsToCurrent(cached);
  }
  if (!bypassCache && ssgCache.has(route)) return ssgCache.get(route)!;
  try {
    // Map route to SSG file path: /service -> dist/public/service/index.html
    const filePath = route === "/"
      ? path.join(distPath, "index.html")
      : path.join(distPath, route.replace(/^\//, ""), "index.html");
    const html = readFileSync(filePath, "utf-8");
    if (!bypassCache) ssgCache.set(route, html);
    return html;
  } catch {
    // Fallback to root index.html for routes without SSG
    try {
      const rootPath = path.join(distPath, "index.html");
      const html = readFileSync(rootPath, "utf-8");
      if (!bypassCache) ssgCache.set(route, html);
      return html;
    } catch {
      return null;
    }
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

function buildBreadcrumbList(routePath: string, title: string): string {
  const items: Array<{"@type": "ListItem"; position: number; name: string; item: string}> = [];
  items.push({ "@type": "ListItem", position: 1, name: "Главная", item: `${SITE}/` });

  const segments = routePath.split("/").filter(Boolean);
  let currentPath = "";
  let position = 2;

  const segmentName = (seg: string): string => {
    const map: Record<string, string> = {
      brands: "Бренды",
      news: "Новости",
      service: "Сервис",
      buyout: "Выкуп",
      vacancies: "Вакансии",
      contacts: "Контакты",
      about: "О компании",
      "new-cars": "Новые авто",
      cars: "Авто с пробегом",
      legal: "Юридическая информация",
      privacy: "Политика конфиденциальности",
      bonus: "Бонусная программа",
    };
    return map[seg] || seg;
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;
    let name: string;
    if (i === segments.length - 1) {
      name = title.split(" | ")[0].split(" — ")[0].slice(0, 60);
    } else {
      name = segmentName(seg);
    }
    items.push({ "@type": "ListItem", position, name, item: `${SITE}${currentPath}` });
    position++;
  }

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  });
}

function injectMeta(
  html: string,
  title: string,
  description: string,
  canonical: string,
  ogImage: string,
  h1: string,
  extraJsonLd?: string,
  robots?: string,
  breadcrumbLd?: string,
  ogType?: string,
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
  // Strip existing BreadcrumbList ld+json (we rebuild it dynamically) but preserve FAQPage/NewsArticle/other schemas from SSG
  // Use a more robust approach: find all ld+json blocks, keep non-BreadcrumbList ones
  const preservedLd: string[] = [];
  let ldMatch: RegExpExecArray | null;
  const ldRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  while ((ldMatch = ldRegex.exec(result)) !== null) {
    try {
      const parsed = JSON.parse(ldMatch[1].trim());
      const atType = parsed["@type"];
      const isBreadcrumb = atType === "BreadcrumbList";
      const isLocalBusiness = Array.isArray(atType) && atType.includes("AutoDealer") && atType.includes("LocalBusiness");
      if (!isBreadcrumb && !isLocalBusiness) {
        preservedLd.push(ldMatch[0]);
      }
    } catch {
      // If can't parse, preserve as-is (safety)
      preservedLd.push(ldMatch[0]);
    }
  }
  // Remove all ld+json blocks, then re-insert preserved ones
  result = result.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, "");
  // Re-insert preserved ld+json blocks before </head>
  if (preservedLd.length > 0) {
    result = result.replace("</head>", `  ${preservedLd.join("\n  ")}\n  </head>`);
  }
  // SSG templates can contain their own sr-only H1. Remove it here because
  // the semantic main block below is the single authoritative H1 for every
  // server-enriched response.
  result = result.replace(/<h1 class="sr-only">[^<]*<\/h1>\s*/g, "");

  // Insert clean, deduplicated meta block right after <meta name="viewport"...>
  const metaBlock = [
    `<title>${title}</title>`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${robots || "index, follow"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:site_name" content="Дебрянск Авто" />`,
    `<meta property="og:type" content="${ogType || "website"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
  ].join("\n    ");

  const beforeViewport = result;
  result = result.replace(
    /(<meta name="viewport"[^>]*\/?>)/,
    `$1\n    ${metaBlock}`
  );
  // Fallback: if viewport tag not found (Puppeteer may omit self-closing slash),
  // insert the meta block right after <head>
  if (result === beforeViewport) {
    result = result.replace("<head>", `<head>\n    ${metaBlock}`);
  }

  // Inject LCP image preload + schema.org JSON-LD before </head>
  const ldScripts = [
    `<script type="application/ld+json">${LOCAL_BUSINESS_SCHEMA}</script>`,
    breadcrumbLd ? `<script type="application/ld+json">${breadcrumbLd}</script>` : "",
    extraJsonLd ? `<script type="application/ld+json">${extraJsonLd}</script>` : "",
  ].filter(Boolean).join("\n    ");
  const lcpPreload = `<link rel="preload" as="image" href="${ogImage}" fetchpriority="high" />`;
  result = result.replace("</head>", `  ${lcpPreload}\n  ${ldScripts}\n  </head>`);

  // Inject main landmark + static navigation for crawlers (visually hidden)
  result = result.replace(
    /<div id="root"><\/div>/,
    `<div id="root"></div>
    <main aria-label="Основной контент" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">
      <h1>${h1}</h1>
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

type MetaResult = { title: string; description: string; canonical: string; ogImage: string; h1: string; jsonLd?: string; robots?: string; breadcrumbLd?: string; bodyHtml?: string; botBodyHtml?: string; ogType?: string };

/** Escape HTML special characters for safe injection into attributes and text. */
function esc(s: string | number | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtRub(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);
}

type NewCarRow = { external_id: string; brand: string; model: string; year: number; price: number; max_discount: number | null; image_url: string | null; color: string | null };
type UsedCarRow = { external_id: string; brand: string; model: string; year: number; price: number; image_url: string | null; mileage: number | null };
type BrandIndexRow = { name: string; slug: string; is_service_only: boolean };
type BrandIndexItem = { name: string; href: string };
type BrandIndexGroup = { title: string; description: string; items: BrandIndexItem[] };

function buildBrandIndexGroups(rows: BrandIndexRow[]): BrandIndexGroup[] {
  const groups: BrandIndexGroup[] = [
    { title: "Новые автомобили", description: "Официальные дилерские страницы новых автомобилей: модели, актуальные предложения и запись на тест-драйв.", items: [] },
    { title: "Автомобили с пробегом", description: "Проверенные автомобили с пробегом представлены в отдельном каталоге с актуальным наличием и ценами.", items: [] },
    { title: "Сервисные бренды", description: "Официальное сервисное обслуживание, ТО, ремонт и оригинальные запчасти для указанных марок.", items: [] },
  ];

  for (const row of rows) {
    // mb-bryansk is a legacy alias that 301-redirects to Mercedes-Benz.
    if (!row.name || !row.slug || row.slug === "mb-bryansk") continue;
    const isUsedCars = row.slug === "s-probegom" || /пробег/i.test(row.name);
    const groupIndex = row.is_service_only ? 2 : isUsedCars ? 1 : 0;
    groups[groupIndex].items.push({
      name: isUsedCars ? "Автомобили с пробегом" : row.name,
      href: isUsedCars ? "/cars" : `/brands/${row.slug}`,
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

function buildBrandIndexBodyHtml(groups: BrandIndexGroup[]): string {
  const sectionId = (title: string) => title === "Новые автомобили" ? "new" : title === "Автомобили с пробегом" ? "used" : "service";
  return `<section data-seo-brands-index="true" aria-label="Бренды Дебрянск Авто">
    <p>Дебрянск Авто объединяет дилерские центры новых автомобилей, направление автомобилей с пробегом и официальный сервис в Брянске и Супонево.</p>
    ${groups.map((group) => `<section aria-labelledby="brands-${sectionId(group.title)}">
      <h2 id="brands-${sectionId(group.title)}">${esc(group.title)}</h2>
      <p>${esc(group.description)}</p>
      <ul>${group.items.map((item) => `<li><a href="${esc(item.href)}">${esc(item.name)}</a></li>`).join("")}</ul>
    </section>`).join("\n")}
  </section>`;
}

function buildBrandIndexJsonLd(groups: BrandIndexGroup[]): string {
  const items = groups.flatMap((group) => group.items);
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Бренды автомобилей и сервис Дебрянск Авто",
    "description": "Официальные дилеры новых автомобилей, сервисные бренды и автомобили с пробегом в Брянске.",
    "url": `${SITE}/brands`,
    "isPartOf": { "@type": "WebSite", "name": "Дебрянск Авто", "url": SITE },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": items.length,
      "itemListElement": items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "url": `${SITE}${item.href}`,
      })),
    },
  });
}

// ── GEO intent blocks — visible to crawlers via botBodyHtml ────────────────

function buildNewCarsGeoBotHtml(): string {
  return `<section data-seo-geo="new-cars" aria-label="Новые автомобили в Брянске">
    <h2>Новые автомобили у официального дилера в Брянске</h2>
    <p>«Дебрянск Авто» — официальный дилер новых автомобилей Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, Exeed, Tenet в Брянске. Весь каталог в наличии на площадках дилерских центров.</p>
    <p>Способы приобретения: автокредит, программа трейд-ин, лизинг для юридических лиц. На все новые автомобили распространяется гарантия производителя.</p>
    <ul>
      <li><a href="/brands/haval-city">Haval City — официальный дилер в Брянске</a></li>
      <li><a href="/brands/haval-pro">Haval Pro — официальный дилер в Брянске</a></li>
      <li><a href="/brands/jetour">Jetour — официальный дилер в Брянске</a></li>
      <li><a href="/brands/omoda">OMODA — официальный дилер в Брянске</a></li>
      <li><a href="/brands/jaecoo">JAECOO — официальный дилер в Брянске</a></li>
      <li><a href="/brands/soueast">Soueast — официальный дилер в Брянске</a></li>
      <li><a href="/brands/volkswagen">Volkswagen — официальный дилер в Брянске</a></li>
      <li><a href="/brands/skoda">SKODA — официальный дилер в Брянске</a></li>
      <li><a href="/brands/exeed">EXEED — официальный дилер в Брянске</a></li>
      <li><a href="/brands/tenet">Tenet — официальный дилер в Брянске</a></li>
    </ul>
    <p>Запись на тест-драйв и консультация по телефону <a href="tel:+74832777770">+7 (4832) 77-77-70</a>. Режим работы: ежедневно 9:00–21:00.</p>
  </section>`;
}

function buildUsedCarsGeoBotHtml(): string {
  return `<section data-seo-geo="used-cars" aria-label="Автомобили с пробегом в Брянске">
    <h2>Автомобили с пробегом у официального дилера в Брянске</h2>
    <p>Каталог автомобилей с пробегом «Дебрянск Авто» регулярно обновляется. Выбор по марке, модели, году выпуска, ценовому диапазону и пробегу. Онлайн-заявка и просмотр на площадке в Брянске.</p>
    <p>Доступны: автокредит, программа трейд-ин. Автомобили проверены специалистами официального дилера.</p>
    <p>Телефон: <a href="tel:+74832777770">+7 (4832) 77-77-70</a>. Ежедневно 9:00–21:00.</p>
  </section>`;
}

function buildServiceGeoBotHtml(): string {
  return `<section data-seo-geo="service" aria-label="Сервисное обслуживание в Брянске">
    <h2>Официальный сервис автомобилей в Брянске</h2>
    <p>Сервисные услуги: техническое обслуживание и ремонт, кузовной ремонт, детейлинг, компьютерная диагностика, шиномонтаж и хранение шин, оригинальные запасные части.</p>
    <p>Обслуживаемые марки: Haval, Jetour, OMODA, JAECOO, Soueast, Volkswagen, SKODA, Exeed, Tenet, Mercedes-Benz и другие. Запись на сервис онлайн или по телефону <a href="tel:+74832777770">+7 (4832) 77-77-70</a>.</p>
    <p>Адреса сервисных центров: ул. Советская, д. 77; ул. Литейная, 3/2; пр. Московский, 2Г; с. Супонево, ул. Шоссейная, 12Г. Режим работы: ежедневно 9:00–21:00.</p>
  </section>`;
}

function buildBuyoutGeoBotHtml(): string {
  return `<section data-seo-geo="buyout" aria-label="Выкуп автомобилей в Брянске">
    <h2>Выкуп и комиссионная продажа автомобилей в Брянске</h2>
    <p>Срочный выкуп: оценка бесплатна, принимаем любую марку и год выпуска. Деньги переводятся в день сделки. Документы на снятие с учёта оформляем самостоятельно.</p>
    <p>Комиссионная продажа: автомобиль размещается одновременно на Авито, Авто.ру, Дром и в каталоге дилера. Хранение на охраняемой стоянке бесплатно.</p>
    <p>Официальный дилер «Дебрянск Авто» в Брянске. Телефон: <a href="tel:+74832777770">+7 (4832) 77-77-70</a>. Ежедневно 9:00–21:00.</p>
  </section>`;
}

// ── Car grids for /new-cars and /cars catalog pages ────────────────────────

function buildNewCarsGridHtml(cars: NewCarRow[]): string {
  if (!cars.length) return "";
  const cards = cars.map(c => {
    const rawPrice = Number(c.price);
    const disc = Number(c.max_discount) || 0;
    const salePrice = Math.max(0, rawPrice - disc);
    const priceLabel = disc > 0 ? `от ${esc(fmtRub(salePrice))}` : esc(fmtRub(rawPrice));
    const name = esc(`${c.brand} ${c.model} ${c.year}`);
    const id = encodeURIComponent(c.external_id);
    const img = c.image_url
      ? `<img src="${esc(c.image_url)}" alt="Фото ${name}" loading="lazy" width="320" height="200" />`
      : "";
    return `<article><a href="/new-cars/${id}">${img}<h2>${name}</h2><p>${priceLabel}</p></a></article>`;
  }).join("\n");
  return `<section aria-label="Новые автомобили в Брянске">\n${cards}\n</section>`;
}

function buildUsedCarsGridHtml(cars: UsedCarRow[]): string {
  if (!cars.length) return "";
  const cards = cars.map(c => {
    const priceStr = esc(fmtRub(Number(c.price)));
    const run = c.mileage ? ` · ${Math.round(c.mileage / 1000)} тыс. км` : "";
    const name = esc(`${c.brand} ${c.model} ${c.year}`);
    const id = encodeURIComponent(c.external_id);
    const img = c.image_url
      ? `<img src="${esc(c.image_url)}" alt="Фото ${name}" loading="lazy" width="320" height="200" />`
      : "";
    return `<article><a href="/cars/${id}">${img}<h2>${name}</h2><p>${priceStr}${run}</p></a></article>`;
  }).join("\n");
  return `<section aria-label="Автомобили с пробегом в Брянске">\n${cards}\n</section>`;
}

/** Internal resolver — returns route-specific metadata without DB overrides. */
async function resolveMetaBase(pathStr: string): Promise<MetaResult | null> {
  const staticMeta = STATIC_META[pathStr];
  if (staticMeta) {
    const extra: Record<string, string> = {};
    if (pathStr === "/contacts") extra.jsonLd = CONTACT_PAGE_SCHEMA;
    const breadcrumbLd = buildBreadcrumbList(pathStr, staticMeta.title);
    const ogImageMap: Record<string, string> = {
      "/service": `${SITE}/api/og-image/service.png`,
      "/service/bonus": `${SITE}/api/og-image/bonus.png`,
      "/vacancies": `${SITE}/api/og-image/vacancies.png`,
      "/buyout": `${SITE}/api/og-image/buyout.png`,
      "/new-cars": `${SITE}/api/og-image/catalog/new.png`,
      "/cars": `${SITE}/api/og-image/catalog/used.png`,
      "/corporate": `${SITE}/api/og-image/corporate.png`,
    };
    const isServiceRoute = pathStr.startsWith("/service/");
    const ogImage = ogImageMap[pathStr]
      ?? (isServiceRoute ? `${SITE}/api/og-image/service.png` : DEFAULT_OG_IMAGE);
    const base: MetaResult = { ...staticMeta, canonical: `${SITE}${pathStr}`, ogImage, breadcrumbLd, ...extra };

    // For catalog pages: inject a bot-readable car grid so Googlebot/Yandex
    // can discover and index individual car listings (the React catalog is
    // client-side only and invisible to crawlers without this injection).
    if (pathStr === "/new-cars") {
      try {
        const r = await db.execute(sql`
          SELECT external_id, brand, model, year, price, max_discount, image_url, color
          FROM cars WHERE type = 'new'
          ORDER BY popularity_score DESC NULLS LAST, price ASC
          LIMIT 100
        `);
        if (r.rows.length > 0) {
          base.bodyHtml = buildNewCarsGridHtml(r.rows as NewCarRow[]);
        }
      } catch {
        // DB error — serve page without grid rather than failing
      }
      base.botBodyHtml = buildNewCarsGeoBotHtml();
    } else if (pathStr === "/cars") {
      try {
        const r = await db.execute(sql`
          SELECT external_id, brand, model, year, price, image_url, mileage
          FROM cars WHERE type = 'used'
          ORDER BY popularity_score DESC NULLS LAST, price ASC
          LIMIT 100
        `);
        if (r.rows.length > 0) {
          base.bodyHtml = buildUsedCarsGridHtml(r.rows as UsedCarRow[]);
        }
      } catch {
        // DB error — serve page without grid
      }
      base.botBodyHtml = buildUsedCarsGeoBotHtml();
    } else if (pathStr === "/service") {
      base.botBodyHtml = buildServiceGeoBotHtml();
    } else if (pathStr === "/buyout") {
      base.botBodyHtml = buildBuyoutGeoBotHtml();
    } else if (pathStr === "/brands") {
      try {
        const result = await db.execute(sql`
          SELECT name, slug, is_service_only
          FROM brands
          WHERE slug IS NOT NULL AND slug != ''
          ORDER BY is_service_only, name
        `);
        const groups = buildBrandIndexGroups(result.rows as BrandIndexRow[]);
        if (groups.length > 0) {
          base.botBodyHtml = buildBrandIndexBodyHtml(groups);
          base.jsonLd = buildBrandIndexJsonLd(groups);
        }
      } catch (err) {
        logger.warn({ err }, "seoMeta: unable to build brands index content");
      }
    }

    return base;
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
        ? (metaTitle.includes("Дебрянск") ? metaTitle.trim() : `${metaTitle.trim()} | Дебрянск Авто`)
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
      const breadcrumbLd = buildBreadcrumbList(pathStr, title);
      return {
        title,
        description,
        canonical: `${SITE}/brands/${slug}`,
        ogImage: `${SITE}/api/og-image/brand/${slug}.png`,
        h1,
        breadcrumbLd,
      };
    }
  }

  // News pages: /news/:slug
  const newsMatch = pathStr.match(/^\/news\/([^\/]+)$/);
  if (newsMatch) {
    const slug = newsMatch[1];
    const result = await db.execute(
      sql`SELECT title, slug, excerpt, image, images, published_at, content FROM news WHERE slug = ${slug} LIMIT 1`
    );
    const row = result.rows[0] as {
      title: string; slug: string; excerpt: string | null;
      image: string | null; images: string[] | null;
      published_at: string | null; content: string | null;
    } | undefined;
    if (row) {
      const newsDesc = row.excerpt
        ? (row.excerpt.length > 155 ? row.excerpt.slice(0, 152) + "…" : row.excerpt)
        : "Актуальная новость автомобильного рынка от дилерского центра «Дебрянск Авто» в Брянске.";
      // Use article's own image for og:image — prefer first gallery image, fall back to cover image
      const articleImage = (row.images && row.images.length > 0 ? row.images[0] : null) || row.image || DEFAULT_OG_IMAGE;
      const articleImageFull = articleImage.startsWith("http") ? articleImage : `${SITE}${articleImage}`;
      const datePublished = row.published_at
        ? new Date(row.published_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const newsArticleSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": row.title,
        "description": newsDesc,
        "url": `${SITE}/news/${slug}`,
        "image": articleImageFull,
        "datePublished": datePublished,
        "dateModified": datePublished,
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
        "inLanguage": "ru"
      });
      const breadcrumbLd = buildBreadcrumbList(pathStr, row.title);
      // Inject article body text as hidden block so bots can read content
      const bodyHtml = row.content
        ? `<article aria-label="${row.title}" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">` +
          `<h1>${row.title}</h1>` +
           `<p>Автор: Редакция Дебрянск Авто${row.published_at ? ` · Опубликовано: ${datePublished}` : ""}</p>` +
          row.content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").slice(0, 8000) +
          `</article>`
        : undefined;
      return {
        title: `${row.title} | Дебрянск Авто`,
        description: newsDesc,
        canonical: `${SITE}/news/${slug}`,
        ogImage: articleImageFull,
        ogType: "article",
        h1: row.title,
        jsonLd: newsArticleSchema,
        breadcrumbLd,
        bodyHtml,
      };
    }
  }

  // Promotion pages: /promotions/:slug
  const promoMatch = pathStr.match(/^\/promotions\/([^\/]+)$/);
  if (promoMatch) {
    const slug = promoMatch[1];
    const result = await db.execute(
      sql`SELECT title, slug, description, image, expires_at, is_active FROM promotions WHERE slug = ${slug} LIMIT 1`
    );
    const row = result.rows[0] as { title: string; slug: string; description: string | null; image: string | null; expires_at: string | null; is_active: boolean } | undefined;
    if (row) {
      const isExpired = !!row.expires_at && new Date(row.expires_at) < new Date();
      const rawDesc = row.description || `Акция «${row.title}» от официального дилера Дебрянск Авто в Брянске.`;
      const promoDesc = rawDesc.length > 155 ? rawDesc.slice(0, 152) + "…" : rawDesc;
      const breadcrumbLd = buildBreadcrumbList(pathStr, row.title);
      return {
        title: `${row.title}${isExpired || !row.is_active ? " (акция завершена)" : ""} | Дебрянск Авто`,
        description: promoDesc,
        canonical: `${SITE}/promotions/${slug}`,
        ogImage: row.image || DEFAULT_OG_IMAGE,
        h1: row.title,
        breadcrumbLd,
        robots: (isExpired || !row.is_active) ? "noindex, follow" : undefined,
      };
    }
  }

  // SEO landing pages: /p/:slug
  const landingMatch = pathStr.match(/^\/p\/([^\/]+)$/);
  if (landingMatch) {
    const slug = landingMatch[1];
    try {
      const result = await db.execute(sql`
        SELECT meta_title, meta_description, h1 FROM seo_landing_pages
        WHERE slug = ${slug} AND is_published = true LIMIT 1
      `);
      const row = result.rows[0] as { meta_title: string | null; meta_description: string | null; h1: string | null } | undefined;
      if (row) {
        const title = row.meta_title || `${slug} — Дебрянск Авто`;
        const description = row.meta_description || `Официальный дилер «Дебрянск Авто» в Брянске.`;
        const h1 = row.h1 || title;
        const breadcrumbLd = buildBreadcrumbList(pathStr, title);
        return {
          title, description, h1,
          canonical: `${SITE}/p/${slug}`,
          ogImage: DEFAULT_OG_IMAGE,
          robots: DEFAULT_ROBOTS,
          breadcrumbLd,
        };
      }
    } catch {
      // DB error — fall through to null
    }
  }

  // Car detail pages: /new-cars/:id or /cars/:id
  const carMatch = pathStr.match(/^\/(new-cars|cars)\/([^\/]+)$/);
  if (carMatch) {
    const type = carMatch[1] === "new-cars" ? "new" : "used";
    const id = decodeURIComponent(carMatch[2]);
    const result = await db.execute(
      sql`SELECT brand, model, modification, year, price, max_discount, description, image_url, external_id, color, mileage FROM cars WHERE external_id = ${id} AND type = ${type} LIMIT 1`
    );
    const row = result.rows[0] as { brand: string; model: string; modification: string | null; year: number; price: number; max_discount: number | null; description: string | null; image_url: string | null; external_id: string; color: string | null; mileage: number | null } | undefined;
    if (row) {
      const isNew = type === "new";
      const rawPrice = Number(row.price);
      const maxDiscount = isNew ? (Number(row.max_discount) || 0) : 0;
      const salePrice = isNew ? Math.max(0, rawPrice - maxDiscount) : rawPrice;
      const priceStr = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(salePrice);
      const modShort = row.modification ? row.modification.replace(/\s*\([^)]+\)/, "").trim() : null;
      const stockNum = row.external_id.replace(/^.*?(\d+)$/, "$1").slice(-6);
      const color = row.color || null;
      const runKm = row.mileage ? Math.round(row.mileage / 1000) + " тыс. км" : null;
      // Build title: regional anchor "в Брянске" + differentiator (color/mod/run)
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
      const robots = "index, follow, max-snippet:-1, max-image-preview:large";
      const breadcrumbLd = buildBreadcrumbList(pathStr, title);
      const ogType = type === "new" ? "new" : "used";
      const ogId = encodeURIComponent(row.external_id);
      return {
        title,
        description,
        canonical: `${SITE}${pathStr}`,
        ogImage: `${SITE}/api/og-image/car/${ogType}/${ogId}.png`,
        h1,
        robots,
        breadcrumbLd,
      };
    }
  }

  return null;
}

/**
 * Public API — resolves route metadata and applies DB-layer overrides from
 * `page_seo_overrides` as the final step. Overrides are applied regardless of
 * which branch resolved the base metadata (STATIC_META, brands, news, cars…).
 * Empty/null override values are ignored so they never blank out base metadata.
 */
export async function resolveMeta(
  pathStr: string,
): Promise<MetaResult | null> {
  const base = await resolveMetaBase(pathStr);
  if (!base) return null;

  try {
    const ov = await db.execute(sql`
      SELECT meta_title, meta_description FROM page_seo_overrides WHERE route = ${pathStr} LIMIT 1
    `);
    if (ov.rows.length > 0) {
      const row = ov.rows[0] as { meta_title: string | null; meta_description: string | null };
      // Only apply non-empty values — an absent key should not blank out base metadata
      if (row.meta_title)       base.title       = row.meta_title;
      if (row.meta_description) base.description = row.meta_description;
    }
  } catch {
    // page_seo_overrides may not exist yet on first boot; silently ignore
  }

  return base;
}

function buildNotFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Страница не найдена — Дебрянск Авто</title>
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${SITE}/404" />
</head>
<body>
  <h1>Страница не найдена</h1>
  <p>Запрашиваемая страница не существует. <a href="${SITE}/">Вернуться на главную</a>.</p>
</body>
</html>`;
}

export function seoMetaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ua = (req.headers["user-agent"] ?? "") as string;
  const isBot = BOT_UA.test(ua);

  // Skip static files
  if (/\.\w{2,10}$/.test(req.path)) {
    next();
    return;
  }

  const route = (req.path || "/").replace(/\/$/, "") || "/";
  const bypassCache = req.headers["x-prerender-bot"] === "1";

  // Non-SSG dynamic routes (e.g. /new-cars, /cars, /brands/*, car details) are
  // prerendered by Puppeteer. When the prerender crawler itself is asking,
  // do NOT inject server-side meta — otherwise React Helmet adds a second set
  // and the captured snapshot ends up with duplicate title/description/OG tags.
  // Let React Helmet be the single source of truth for these pages.
  if (bypassCache && !isSsgRoute(route)) {
    next();
    return;
  }

  resolveMeta(route)
    .then((meta) => {
      if (!meta) {
        // Unknown route — return a real 404 for crawlers so it does not look
        // like a soft-404 copy of the homepage. Browsers still get the SPA shell
        // via the downstream fallback so React can render a client-side 404 page.
        if (isBot) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.status(404).send(buildNotFoundHtml());
          logger.info({ route, ua: ua.substring(0, 40) }, "seoMeta: served 404 for unknown route");
          return;
        }
        next();
        return;
      }
      const html = getSsgHtml(route, bypassCache);
      if (!html) {
        next();
        return;
      }
      let enriched = injectMeta(html, meta.title, meta.description, meta.canonical, meta.ogImage, meta.h1, meta.jsonLd, meta.robots, meta.breadcrumbLd, meta.ogType);
      // For catalog pages (/new-cars, /cars): inject a bot-readable car grid before </body>
      // so Googlebot/Yandex can discover individual car listings from the catalog page.
      // It sits outside #root, after the React app/footer, therefore always hide it
      // inline so it cannot surface as unstyled cards for regular visitors.
      if (meta.bodyHtml) {
        enriched = enriched.replace(
          "</body>",
          `<div data-seo-catalog-grid="true" style="display:none" aria-hidden="true">${meta.bodyHtml}</div>\n</body>`,
        );
      }
      if (meta.botBodyHtml && isBot) {
        enriched = enriched.replace("</body>", `${meta.botBodyHtml}\n</body>`);
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-SeoMeta", "1");
      // Never let the browser cache this response for prerender-bot requests — the
      // crawler must always hit the network for a fresh live shell, otherwise Chrome's
      // disk cache can silently serve back a stale captured snapshot without even
      // triggering request interception, re-perpetuating a broken capture forever.
      res.setHeader("Cache-Control", bypassCache ? "no-store" : "public, max-age=300");
      res.status(200).send(enriched);
      logger.info({ route, ua: ua.substring(0, 40) }, "seoMeta: served enriched HTML");
    })
    .catch((err) => {
      logger.warn({ err, route }, "seoMeta: failed to resolve meta");
      next();
    });
}
