import { db } from "@workspace/db";
import { faqs } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const FAQ_SEED = [
  // === brands/haval-city (7) ===
  { page_slug: "brands/haval-city", question: "Какая гарантия на новый Haval City?", answer: "3 года или 150 000 км пробега на узлы и компоненты при заводском дефекте. Отдельно — 6 лет от сквозной коррозии кузова независимо от пробега. После основной гарантии для авто 2023 года выпуска и новее действует постгарантийная программа ещё на 2 года/150 000 км. Гарантия действует при прохождении ТО у официального дилера — Дебрянск Авто.", include_in_schema: true, sort_order: 1 },
  { page_slug: "brands/haval-city", question: "Чем Haval City отличается от Haval Pro?", answer: "Haval City — городские кроссоверы и пикапы (M6, Jolion, Dargo, Dargo X, F7, F7x, Poer). Haval Pro — внедорожники (H3, H5, H7, H9). В Дебрянск Авто обе линейки представлены в отдельных дилерских центрах в Брянске.", include_in_schema: true, sort_order: 2 },
  { page_slug: "brands/haval-city", question: "Как часто проходить ТО на Haval City в Брянске?", answer: "Интервал зависит от модели. Записаться на ТО в дилерском центре Haval City на ул. Литейная в Брянске можно онлайн на сайте или по телефону.", include_in_schema: true, sort_order: 3 },
  { page_slug: "brands/haval-city", question: "Можно ли купить Haval City в кредит у дилера в Брянске?", answer: "Да, действуют кредитные программы от банков-партнёров HAVAL. Точный расчёт — у менеджера дилерского центра Дебрянск Авто.", include_in_schema: true, sort_order: 4 },
  { page_slug: "brands/haval-city", question: "Какие модели Haval City есть в наличии в Брянске?", answer: "Jolion и M6 — в наличии разных комплектаций, Dargo, Dargo X, F7, F7x и Poer — в наличии и под заказ. Актуальный каталог с ценами — на странице бренда, обновляется в реальном времени.", include_in_schema: false, sort_order: 5 },
  { page_slug: "brands/haval-city", question: "Дебрянск Авто — официальный дилер Haval в Брянске?", answer: "Да, официальный дилер Haval City с 2011 года, часть группы компаний «Дебрянск Авто — Территория Автомобилей». Дилерский центр — ул. Литейная, 3/2, Брянск.", include_in_schema: true, sort_order: 6 },
  { page_slug: "brands/haval-city", question: "Принимаете ли вы авто в trade-in при покупке Haval City?", answer: "Да, любой автомобиль, не только Haval. Бесплатная оценка — около 30 минут, сумма сразу идёт в зачёт новой машины в любом дилерском центре на территории Дебрянск Авто.", include_in_schema: true, sort_order: 7 },

  // === service (5) ===
  { page_slug: "service", question: "Как записаться на сервисное обслуживание?", answer: "Записаться на ТО можно на странице Сервис — выберите ближайший сервисный центр, дату и удобное время. Мастер подтвердит запись по телефону.", include_in_schema: true, sort_order: 0 },
  { page_slug: "service", question: "Сколько стоит ТО для автомобилей ваших брендов?", answer: "Стоимость ТО зависит от модели и пробега. Во время записи мастер рассчитает точную стоимость. Регулярное ТО — от 6 тыс. рублей.", include_in_schema: true, sort_order: 1 },
  { page_slug: "service", question: "Есть ли гарантия на выполненные работы?", answer: "Да, мы даём гарантию на все виды работ. Гарантийные документы оформляются автоматически в системе. Срок гарантии — до 2 лет.", include_in_schema: true, sort_order: 2 },
  { page_slug: "service", question: "Можно ли приобрести запчасти без ремонта?", answer: "Конечно! Все оригинальные запчасти для автомобилей SKODA, Volkswagen, Mercedes-Benz, Exeed в наличии на складе. Заказ оформляется за 1–2 дня.", include_in_schema: false, sort_order: 3 },
  { page_slug: "service", question: "Работаете ли вы по программе техобслуживания?", answer: "Да, мы проводим все виды технического обслуживания по гарантийной программе производителя: ТО-0, ТА-0, ТО-1 и т.д.", include_in_schema: true, sort_order: 4 },

  // === main (4) ===
  { page_slug: "main", question: "Какие бренды вы представляете в Брянске?", answer: "Мы — официальный дилер SKODA, Volkswagen, Mercedes-Benz, EXEED, Chery, Haval, Jetour в Брянске. Каталог новых и подержанных авто — на сайте.", include_in_schema: true, sort_order: 0 },
  { page_slug: "main", question: "Можно ли купить авто в кредит?", answer: "Да, у нас действует программа кредитования: ставка от 0%, первоначальный взнос от 0%, срок до 7 лет. Одобрение за 15 минут.", include_in_schema: true, sort_order: 1 },
  { page_slug: "main", question: "Принимаете ли старый автомобиль по trade-in?", answer: "Бесспорно! Привезите своё авто на оценку — мы произведём бесплатную диагностику, оформим все документы и зачитаем цену в стоимость нового.", include_in_schema: true, sort_order: 2 },
  { page_slug: "main", question: "Где находятся ваши салоны?", answer: "Адреса всех автосалонов указаны на странице «Контакты» и в карточке каждого бренда. Работаем ежедневно с 9:00 до 21:00.", include_in_schema: false, sort_order: 3 },

  // === buyout (4) ===
  { page_slug: "buyout", question: "Как узнать предварительную стоимость моего авто?", answer: "Заполните краткую форму на странице «Выкуп»: марка, модель, год, пробег. Система оценит рыночную стоимость за 1 минуту.", include_in_schema: true, sort_order: 0 },
  { page_slug: "buyout", question: "Нужно ли приезжать в салон для оценки?", answer: "Необязательно — можно получить предварительную оценку онлайн. Для финального выкупа специалист проведёт осмотр на месте.", include_in_schema: true, sort_order: 1 },
  { page_slug: "buyout", question: "Выкупаете ли машины с пробегом и с проблемами?", answer: "Выкупаем автомобили в любом состоянии: с пробегом, после ДТП, с неисправными двигателем или кузовом. Конечная цена зависит от состояния.", include_in_schema: true, sort_order: 2 },
  { page_slug: "buyout", question: "Как быстро я получу деньги?", answer: "После оформления всех документов выкуп занимает 1–2 дня. Деньги переводятся на карту или выдаются наличными — по вашему выбору.", include_in_schema: true, sort_order: 3 },
];

export async function seedFaqsIfEmpty() {
  try {
    const result = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM faqs`);
    const cnt = Number((result.rows[0] as any)?.cnt ?? 0);

    if (cnt > 0) {
      logger.info({ cnt }, "[faq-seed] Table already has rows, skipping seed");
      return;
    }

    logger.info("[faq-seed] Table empty — seeding FAQ data");

    for (const item of FAQ_SEED) {
      await db.execute(sql`
        INSERT INTO faqs (page_slug, question, answer, include_in_schema, sort_order)
        VALUES (${item.page_slug}, ${item.question}, ${item.answer}, ${item.include_in_schema}, ${item.sort_order})
      `);
    }

    logger.info({ count: FAQ_SEED.length }, "[faq-seed] FAQ data seeded successfully");
  } catch (err) {
    logger.warn({ err }, "[faq-seed] Failed to seed FAQ data");
  }
}
