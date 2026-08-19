import { useLocation } from "wouter";

export interface ExitIntentContent {
  headline: string;
  subline: string;
}

/** Capitalise each hyphen-separated word: "great-wall" → "Great Wall" */
function slugToName(slug: string): string {
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Returns contextual headline + subline for the exit-intent slider
 * based on the current route and (for car detail pages) window.__EXIT_INTENT_CAR__.
 */
export function useExitIntentContext(): ExitIntentContent {
  const [location] = useLocation();

  // /new-cars/:id — specific new car
  if (/^\/new-cars\/[^/]+$/.test(location)) {
    const car = (window as any).__EXIT_INTENT_CAR__ as { mark: string; model: string } | undefined;
    const label = car ? `${car.mark} ${car.model}` : "этот автомобиль";
    return {
      headline: `Уходите без ${label}?`,
      subline: "Оставьте номер — дадим лучшую цену и расскажем о наличии",
    };
  }

  // /cars/:id — specific used car
  if (/^\/cars\/[^/]+$/.test(location)) {
    const car = (window as any).__EXIT_INTENT_CAR__ as { mark: string; model: string } | undefined;
    const label = car ? `${car.mark} ${car.model}` : "этот автомобиль";
    return {
      headline: `Этот ${label} ждёт нового хозяина`,
      subline: "Запишитесь на осмотр — перезвоним и согласуем время",
    };
  }

  // /new-cars — catalog of new cars
  if (location === "/new-cars") {
    return {
      headline: "Не нашли подходящий вариант?",
      subline: "Скажите бюджет и пожелания — подберём из наличия",
    };
  }

  // /cars — catalog of used cars
  if (location === "/cars") {
    return {
      headline: "Нужна помощь с выбором б/у авто?",
      subline: "Перезвоним и подберём под ваш бюджет",
    };
  }

  // /brands/:slug — brand landing page
  const brandMatch = location.match(/^\/brands\/([^/]+)$/);
  if (brandMatch) {
    const brand = slugToName(brandMatch[1]);
    return {
      headline: `Вопросы по ${brand}?`,
      subline: "Расскажем о наличии, покупке, сервисе и актуальных условиях",
    };
  }

  // /buyout — appraisal and vehicle buyout
  if (location === "/buyout" || location.startsWith("/buyout/")) {
    return {
      headline: "Хотите узнать стоимость своего авто?",
      subline: "Оценим автомобиль и расскажем об условиях выкупа или обмена",
    };
  }

  // / (home) — broad offer covering the dealership's main services
  if (location === "/" || location === "") {
    return {
      headline: "Нужна помощь с автомобилем?",
      subline: "Подскажем по покупке, сервису, выкупу и другим услугам",
    };
  }

  // Any other page — generic fallback without assuming a purchase intent
  return {
    headline: "Остались вопросы?",
    subline: "Подскажем по автомобилям, сервису, выкупу и другим услугам",
  };
}
