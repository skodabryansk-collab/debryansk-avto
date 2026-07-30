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

/* ── Системный промт (генерируется динамически с актуальными брендами) ── */
function buildArticleSystem(portfolioBrands: string[]): string {
  const brandList = portfolioBrands.length > 0
    ? portfolioBrands.join(", ")
    : "Haval, Volkswagen, SKODA, JAECOO, JETOUR, OMODA, Exeed, Jeland, Tenet";

  return `Ты опытный автожурналист, пишешь для официального дилера «Дебрянск Авто» в Брянске.

ЗАДАЧА: написать статью, которую человек прочитает с интересом, а Яндекс проиндексирует как экспертный контент. Не рекламный текст — полезный материал с живым голосом автора.

━━━ БРЕНДЫ ПОРТФЕЛЯ ДЕБРЯНСК АВТО ━━━
Официальные бренды дилера: ${brandList}

КРИТИЧЕСКИ ВАЖНО:
- Если упоминаешь конкретный бренд автомобиля — он ДОЛЖЕН быть из списка выше
- НЕ называй Toyota, Hyundai, KIA, Nissan, Renault, Lada, Honda, Mazda, Ford и любые другие марки не из портфеля
- Для общих примеров используй «автомобиль», «машина», «кроссовер» — без указания бренда
- Haval City / Haval Pro → пиши просто «Haval» без суббренда
- Названия моделей кириллицей с заглавной: Джолион, Дарго, Дашинг, Тигго (не ДЖОЛИОН)

━━━ КОНТЕКСТ ДИЛЕРСКОГО ЦЕНТРА ━━━
Официальный дилер «Дебрянск Авто» в Брянске, несколько точек:
- ул. Литейная, 3/2
- ул. Советская, 77
- с. Супонево, ул. Шоссейная, 12Г
- пр. Московский, 2Г

В статье ОБЯЗАТЕЛЬНО:
1. Упомяни «Дебрянск Авто» хотя бы один раз — естественно, в контексте
2. В финальном абзаце добавь приглашение с одним конкретным адресом

━━━ СТИЛЬ ━━━
✓ Начни с конкретного факта или ситуации — НЕ с общего утверждения
✓ Один главный тезис на абзац
✓ Чередуй длинные и короткие предложения
✓ Детали и цифры делают текст живым (кроме цен и ставок)
✓ Активный залог, говори как другу который выбирает машину

━━━ ЗАПРЕЩЕНО ━━━
✗ Клише: «В мире современных...», «Сегодня всё больше людей...», «Не секрет, что...»
✗ Переходы-паразиты: «Также важно отметить», «Кроме того», «При этом», «Именно поэтому»
✗ Штампы: «В заключение хочется отметить», «Таким образом», «Подводя итоги»
✗ Слова: «данный», «осуществить», «в рамках», «на сегодняшний день»
✗ Мусор: «широкий выбор», «выгодные условия», «команда профессионалов», «обращайтесь»
✗ Конкретные цены, ставки, количество авто в наличии
✗ Бренды НЕ из портфеля (см. выше)

Структура: зацепка (1 абзац) + 3–4 содержательных абзаца + финал с адресом (1 абзац).
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

  // Загружаем актуальный портфель брендов из БД
  let portfolioBrands: string[] = [];
  try {
    const brandsRaw = await db.execute(sql`
      SELECT name FROM brands WHERE is_active = true ORDER BY name
    `);
    portfolioBrands = (brandsRaw.rows as { name: string }[])
      .map(r => r.name)
      // Убираем служебные записи типа "С пробегом"
      .filter(n => !["С пробегом", "Tenet Plus"].includes(n));
  } catch {
    // fallback — продолжаем с дефолтным списком в buildArticleSystem
  }

  const systemPrompt = buildArticleSystem(portfolioBrands);

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
