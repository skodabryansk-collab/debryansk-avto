/**
 * SEO Content Plan routes.
 * GET  /api/admin/seo/content-topics   — Wordstat queries cross-checked with Webmaster niche vocab
 * POST /api/admin/seo/generate-article — AI article draft (human tone, local mentions)
 */
import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAdmin);

const ARTICLE_MODEL = "openai/gpt-4.1-mini";

/* ── Автомобильные стеммы (первичный фильтр ниши) ─────────────────
   Запрос считается нишевым если хотя бы одно его слово попадает в список.
   Используем точные слова + стеммы (startsWith) для русской морфологии.
──────────────────────────────────────────────────────────────────── */

/** Точные слова — короткие термины которые должны совпадать целиком */
const AUTO_EXACT = new Set([
  // Базовые
  "авто","машина","машину","машины","машине","автомобиль","автомобиля","автомобили",
  // Типы кузова
  "седан","купе","кабриолет","пикап","минивэн","фургон",
  // Финансирование
  "кредит","кредита","кредите","лизинг","лизинга","рассрочка","рассрочку",
  // Специфика
  "дилер","дилера","дилеров","дилере",
  // Бренды (короткие)
  "kia","byd","vw","vaz","лада","нива","гранта","веста","ларгус","datsun","tank",
]);

/** Стеммы — запрос содержит слово начинающееся с этой строки */
const AUTO_STEMS = [
  // Общие автотермины
  "автомобил", "автосалон", "автосервис", "автодилер", "автоцентр", "автохим",
  "автокредит", "автолизинг", "автострахов",
  // Типы кузова / привода
  "кроссовер", "хэтчбек", "внедорожник", "электромобил", "гибрид",
  // Обслуживание
  "техобслуж", "шиномонтаж", "запчаст", "тест-драйв", "тестдрайв",
  "трейд-ин", "трейдин",
  // Бренды которые продаёт дилер
  "haval", "chery", "geely", "volkswagen", "skoda",
  // Популярные бренды б/у рынка
  "hyundai", "toyota", "nissan", "renault", "honda", "mazda", "mitsubishi",
  "subaru", "suzuki", "changan", "omoda", "exeed", "jetour", "jaecoo",
  // Русские бренды/модели
  "дебрянск", // брендовые запросы
];

const STOPWORDS = new Set([
  "и","в","на","для","с","по","от","к","или","не","как","что","из","за","до",
  "а","но","то","же","бы","ли","при","об","их","его","её","всё","был",
  "где","так","уже","ещё","если","чем","когда","под","над","без","со","во",
]);

function isAutomotiveQuery(query: string): boolean {
  const words = query.toLowerCase().split(/[\s,.\-–—/]+/).filter(w => w.length >= 2);
  return words.some(w =>
    AUTO_EXACT.has(w) ||
    AUTO_STEMS.some(stem => w.startsWith(stem))
  );
}

/* ── Типы данных для динамического промта ────────────────────────── */
interface LocationFact {
  title: string;    // "Литейная"
  address: string;  // "г. Брянск, ул. Литейная, 3/2"
  salesBrands: string[];
  serviceBrands: string[];
  hasUsedCars: boolean;
}

/* ── Системный промт — динамический факт-лист из БД ─────────────── */
function buildArticleSystem(locations: LocationFact[]): string {
  // Все продажные бренды (без дублей)
  const allSales = [...new Set(locations.flatMap(l => l.salesBrands))];
  // Все сервисные бренды
  const allService = [...new Set(locations.flatMap(l => l.serviceBrands))];

  // Строим структурированный факт-лист адресов
  const factSheet = locations.map(l => {
    const parts: string[] = [];
    if (l.salesBrands.length)   parts.push(`продажи новых авто: ${l.salesBrands.join(", ")}`);
    if (l.serviceBrands.length) parts.push(`только сервис (продаж НЕТ): ${l.serviceBrands.join(", ")}`);
    if (l.hasUsedCars)          parts.push(`★ АВТОМОБИЛИ С ПРОБЕГОМ — только здесь`);
    return `📍 ${l.address} (${l.title})\n   ${parts.join("\n   ")}`;
  }).join("\n\n");

  // Правила выбора адреса для AI
  const addressRules = locations.map(l => {
    const triggers: string[] = [];
    l.salesBrands.forEach(b => triggers.push(b));
    l.serviceBrands.forEach(b => triggers.push(b));
    if (l.hasUsedCars) triggers.push("с пробегом", "б/у", "подержан", "трейд-ин", "trade-in", "выкуп");
    if (triggers.length === 0) return null;
    return `- Тема содержит [${triggers.join(" / ")}] → адрес: ${l.address}`;
  }).filter(Boolean).join("\n");

  return `Ты опытный автожурналист, пишешь для официального дилера «Дебрянск Авто» в Брянске.

ЗАДАЧА: написать статью, которую человек прочитает с интересом, а Яндекс проиндексирует как экспертный контент. Полезный материал с живым голосом — не рекламный текст.

━━━ ФАКТ-ЛИСТ ДЕБРЯНСК АВТО (точные данные, не придумывай) ━━━

${factSheet}

━━━ БРЕНДЫ ПОРТФЕЛЯ ━━━
Продажи новых авто: ${allSales.join(", ")}
Только сервис (без продаж): ${allService.join(", ")}

КРИТИЧЕСКИ ВАЖНО ПО БРЕНДАМ:
• Упоминаешь бренд автомобиля → ТОЛЬКО из списка выше
• Haval City и Haval Pro → пиши просто «Haval»
• НЕ называй: Toyota, Hyundai, KIA, Nissan, Renault, Lada, Honda, Mazda, Ford и любые другие бренды не из портфеля
• Для общих примеров используй «автомобиль», «машина», «кроссовер» — без бренда
• Модели кириллицей с заглавной: Джолион, Дарго, Дашинг, Тигго (не ДЖОЛИОН)
• Сервисные бренды (Volkswagen, SKODA, Exeed, Mercedes-Benz) — упоминай ТОЛЬКО в контексте сервиса/ТО, не продаж

━━━ ПРАВИЛО ВЫБОРА АДРЕСА ━━━
Выбери ОДИН конкретный адрес для финального абзаца по теме статьи:
${addressRules}
- Общая тема про сервис/ремонт без конкретного бренда → ул. Литейная, 3/2
- Если бренд не упоминается → ул. Литейная, 3/2 как основной адрес
НЕ ПРИДУМЫВАЙ адреса. Используй только те, что в факт-листе выше.

━━━ ОБЯЗАТЕЛЬНО В КАЖДОЙ СТАТЬЕ ━━━
1. «Дебрянск Авто» — упомяни хотя бы раз естественно, в контексте
2. Финальный абзац — приглашение с точным адресом (по правилу выше)

━━━ СТИЛЬ ━━━
✓ Начни с конкретного факта или ситуации — НЕ с «В мире современных автомобилей...»
✓ Один главный тезис на абзац, без перечисления всего подряд
✓ Чередуй длинные и короткие предложения
✓ Детали и цифры делают текст живым (кроме цен и ставок)
✓ Активный залог, говори как другу который выбирает машину

━━━ ЗАПРЕЩЕНО ━━━
✗ Клише: «В мире современных...», «Сегодня всё больше людей...», «Не секрет, что...»
✗ Паразиты: «Также важно отметить», «Кроме того», «При этом», «Именно поэтому»
✗ Штампы: «В заключение хочется отметить», «Таким образом», «Подводя итоги»
✗ Слова: «данный», «осуществить», «в рамках», «на сегодняшний день»
✗ Мусор: «широкий выбор», «выгодные условия», «команда профессионалов», «обращайтесь»
✗ Конкретные цены, ставки, количество авто в наличии
✗ Любые бренды НЕ из портфеля

Структура: зацепка (1 абзац) + 3–4 содержательных абзаца + финал с правильным адресом (1 абзац).
Абзацы через \\n\\n.`;
}

/* ── GET /admin/seo/content-topics ─────────────────────────────────── */
router.get("/content-topics", async (_req, res) => {
  try {
    // 1. Webmaster — строим словарь для проверки «подтверждён в городе»
    //    Это вторичный сигнал: запрос видел реальный трафик на нашем сайте
    const [webmasterRaw, topicsRaw, newsRaw] = await Promise.all([
      db.execute(sql`
        SELECT DISTINCT query_text
        FROM seo_query_snapshots
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM seo_query_snapshots)
        LIMIT 2000
      `),
      db.execute(sql`
        SELECT
          query,
          MAX(shows_count)   AS shows_count,
          MAX(snapshot_date) AS latest_date,
          source
        FROM wordstat_snapshots
        WHERE shows_count > 0
        GROUP BY query, source
        ORDER BY MAX(shows_count) DESC
        LIMIT 150
      `),
      db.execute(sql`SELECT title FROM news ORDER BY published_at DESC LIMIT 300`),
    ]);

    // Вебмастер: набор всех запросов (нормализованных) для быстрого поиска
    const webmasterSet = new Set<string>();
    const webmasterVocab = new Set<string>(); // отдельные слова
    for (const row of webmasterRaw.rows as { query_text: string }[]) {
      webmasterSet.add(row.query_text.toLowerCase().trim());
      for (const word of row.query_text.toLowerCase().split(/\s+/)) {
        if (word.length >= 4 && !STOPWORDS.has(word)) webmasterVocab.add(word);
      }
    }

    // 2. Покрытие существующими статьями
    const newsTitles = (newsRaw.rows as { title: string }[])
      .map(n => n.title.toLowerCase());

    function isCovered(query: string): boolean {
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.length < 2) return false;
      return newsTitles.some(t => words.filter(w => t.includes(w)).length >= 2);
    }

    // 3. «Подтверждён Вебмастером» — запрос или его близкий вариант есть в реальном трафике
    function isWebmasterConfirmed(query: string): boolean {
      if (webmasterSet.size === 0) return false;
      if (webmasterSet.has(query.toLowerCase().trim())) return true;
      // Нечёткое совпадение: ≥2 значимых слова из запроса есть в вебмастер-словаре
      const words = query.toLowerCase().split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w));
      if (words.length === 0) return false;
      return words.filter(w => webmasterVocab.has(w)).length >= Math.min(2, words.length);
    }

    const data = (topicsRaw.rows as {
      query: string; shows_count: string; latest_date: string; source: string;
    }[])
      .map(r => ({
        query: r.query,
        showsCount: Number(r.shows_count),
        latestDate: r.latest_date,
        source: r.source,
        covered: isCovered(r.query),
        // PRIMARY FILTER: только автомобильная тематика
        nicheRelevant: isAutomotiveQuery(r.query),
        // SECONDARY SIGNAL: этот запрос уже приносит трафик на наш сайт
        webmasterConfirmed: isWebmasterConfirmed(r.query),
      }))
      // Сортировка: вебмастер-подтверждённые вперёд, потом по частотности
      .sort((a, b) => {
        if (a.webmasterConfirmed !== b.webmasterConfirmed)
          return a.webmasterConfirmed ? -1 : 1;
        return b.showsCount - a.showsCount;
      });

    const nicheTotal = data.filter(d => d.nicheRelevant).length;
    const filteredOut = data.length - nicheTotal;

    return res.json({
      ok: true,
      data,
      meta: {
        hasWebmasterData: webmasterSet.size > 0,
        webmasterQueryCount: webmasterSet.size,
        nicheTotal,
        filteredOut,
      },
    });
  } catch (err) {
    logger.error({ err }, "[seo-content] content-topics failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /admin/seo/generate-article ──────────────────────────────── */
router.post("/generate-article", async (req, res) => {
  const { topic, keywords = [], relatedQueries = [] } = req.body as {
    topic?: string;
    keywords?: string[];
    relatedQueries?: string[];
  };
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return res.status(400).json({ ok: false, error: "topic is required" });
  }

  // Загружаем факт-лист локаций с брендами из БД
  let locationFacts: LocationFact[] = [];
  try {
    const locRows = await db.execute(sql`
      SELECT
        l.title        AS loc_title,
        l.address,
        l.sort_order,
        b.name         AS brand_name,
        b.is_service_only,
        lb.is_service  AS is_service_at_loc
      FROM locations l
      LEFT JOIN location_brands lb ON lb.location_id = l.id
      LEFT JOIN brands b ON b.id = lb.brand_id AND b.is_active = true
      ORDER BY l.sort_order, lb.sort_order
    `);

    // Группируем по локации
    const locMap = new Map<string, LocationFact>();
    for (const r of locRows.rows as {
      loc_title: string; address: string; sort_order: number;
      brand_name: string | null; is_service_only: boolean; is_service_at_loc: boolean;
    }[]) {
      if (!locMap.has(r.loc_title)) {
        locMap.set(r.loc_title, {
          title: r.loc_title,
          address: r.address,
          salesBrands: [],
          serviceBrands: [],
          hasUsedCars: r.loc_title === "Супонево",
        });
      }
      if (!r.brand_name) continue;
      const fact = locMap.get(r.loc_title)!;
      const displayName = ["Haval City", "Haval Pro"].includes(r.brand_name)
        ? "Haval" : r.brand_name;
      if (r.is_service_only || r.is_service_at_loc) {
        if (!fact.serviceBrands.includes(displayName)) fact.serviceBrands.push(displayName);
      } else {
        if (!fact.salesBrands.includes(displayName)) fact.salesBrands.push(displayName);
      }
    }
    locationFacts = [...locMap.values()];
  } catch (e) {
    logger.warn({ e }, "[seo-content] failed to load location facts, using fallback");
  }

  const systemPrompt = buildArticleSystem(locationFacts);

  // Смежные запросы из Вебмастера — дают AI контекст реальных поисковых интентов
  const relatedLine = relatedQueries.length > 0
    ? `\nСмежные запросы из Яндекс.Вебмастера (учти их интент): ${relatedQueries.slice(0, 8).join(", ")}`
    : "";
  const kwLine = Array.isArray(keywords) && keywords.length > 0
    ? `\nДополнительные ключевые слова: ${keywords.slice(0, 8).join(", ")}`
    : "";

  const prompt =
    `Тема: «${topic.trim()}»${relatedLine}${kwLine}\n\n` +
    `Напиши черновик статьи. Верни ТОЛЬКО JSON (без markdown-обёртки):\n` +
    `{\n` +
    `  "title": "заголовок 50–70 символов, зацепка для читателя, не повторяй запрос дословно",\n` +
    `  "category": "одна из: Авторынок | Советы покупателю | Тест-драйвы | Финансирование | Сервис | Trade-in",\n` +
    `  "excerpt": "анонс 1–2 предложения, 120–160 символов — интригуй, не пересказывай",\n` +
    `  "content": "5 абзацев через \\n\\n. Первый — зацепка. Три средних — суть. Пятый — приглашение с адресом Дебрянск Авто. Каждый абзац 60–100 слов.",\n` +
    `  "readTime": число минут (2–6),\n` +
    `  "slug": "transliterated-latin-slug-hyphenated"\n` +
    `}`;

  try {
    const completion = await openai.chat.completions.create({
      model: ARTICLE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.warn({ raw }, "[seo-content] JSON parse failed");
      return res.status(500).json({ ok: false, error: "AI вернул некорректный ответ, попробуйте ещё раз" });
    }

    if (!parsed["title"] || !parsed["content"]) {
      return res.status(500).json({ ok: false, error: "AI вернул неполный ответ, попробуйте ещё раз" });
    }

    return res.json({
      ok: true,
      data: {
        title:    String(parsed["title"]    ?? ""),
        category: String(parsed["category"] ?? "Авторынок"),
        excerpt:  String(parsed["excerpt"]  ?? ""),
        content:  String(parsed["content"]  ?? ""),
        readTime: typeof parsed["readTime"] === "number" ? parsed["readTime"] : 3,
        slug:     String(parsed["slug"]     ?? ""),
      },
    });
  } catch (err) {
    logger.error({ err }, "[seo-content] generate-article failed");
    return res.status(500).json({ ok: false, error: "Ошибка генерации, попробуйте ещё раз" });
  }
});

export default router;
