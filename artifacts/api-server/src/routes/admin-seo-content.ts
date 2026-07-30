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

/* ── Стоп-слова для нишевого словаря ─────────────────────────────── */
const STOPWORDS = new Set([
  "и","в","на","для","с","по","от","к","или","не","как","что","из","за","до",
  "а","но","то","же","бы","ли","при","об","до","их","его","её","всё","был",
  "где","так","уже","ещё","если","чем","когда","под","над","без","со","во",
]);

/* ── Дилерские адреса и компания (вшиты в промт) ─────────────────── */
const DEALER_CONTEXT = `
ДИЛЕРСКИЙ ЦЕНТР «ДЕБРЯНСК АВТО» — КОНТЕКСТ ДЛЯ СТАТЬИ:
Официальный дилер в Брянске, несколько точек:
- ул. Литейная, 3/2 (Haval, Chery, Geely, VW)
- ул. Советская, 77
- с. Супонево, ул. Шоссейная, 12Г
- пр. Московский, 2Г

В статье ОБЯЗАТЕЛЬНО:
1. Упомяни «Дебрянск Авто» хотя бы один раз — естественно, в контексте, не как рекламный слоган
2. В финальном абзаце добавь приглашение с одним конкретным адресом (выбери подходящий по теме)
`.trim();

/* ── Системный промт ─────────────────────────────────────────────── */
const ARTICLE_SYSTEM = `Ты опытный автожурналист, пишешь для официального дилера «Дебрянск Авто» в Брянске.

ЗАДАЧА: написать статью, которую человек прочитает с интересом, а Google проиндексирует как экспертный контент. Не рекламный текст — полезный материал с живым голосом автора.

${DEALER_CONTEXT}

━━━ СТИЛЬ ━━━
✓ Начни с конкретного факта, ситуации или вопроса из жизни — НЕ с общего утверждения типа «В мире современных автомобилей...»
✓ Один главный тезис на абзац — без перечисления всего подряд
✓ Чередуй длинные и короткие предложения. Короткие бьют точно
✓ Детали и цифры делают текст живым (кроме цен и ставок — их не называем)
✓ Активный залог лучше пассивного
✓ Говори с читателем, как будто объясняешь другу, который выбирает машину

━━━ ЗАПРЕЩЁННЫЕ ФРАЗЫ И ШАБЛОНЫ ━━━
✗ Вводные клише: «В мире современных...», «Сегодня всё больше людей...», «Не секрет, что...», «Актуальность данной темы...»
✗ Переходы-паразиты: «Также важно отметить», «Кроме того», «При этом стоит учитывать», «Именно поэтому», «Следует отметить»
✗ Выводы-штампы: «В заключение хочется отметить», «Подводя итоги», «Таким образом», «Резюмируя вышесказанное»
✗ Бюрократизмы: «данный», «осуществить», «в рамках», «на сегодняшний день», «в целях»
✗ Маркетинговый мусор: «широкий выбор», «выгодные условия», «надёжный выбор», «команда профессионалов», «обращайтесь», «не упустите»
✗ Риторические вопросы которые сами на себя отвечают
✗ Конкретные цены, ставки по кредиту, количество авто в наличии
✗ Упоминать конкурентов по имени

━━━ НАПИСАНИЕ МОДЕЛЕЙ ━━━
- Кириллица с заглавной: Джолион, Дарго, Дашинг, Тигго (не ДЖОЛИОН)
- Haval City / Haval Pro → просто «Haval» без суббренда

Структура: введение-зацепка (1 абзац) + 3–4 содержательных абзаца + финал с приглашением (1 абзац).
Абзацы разделяй пустой строкой (\\n\\n).`;

/* ── GET /admin/seo/content-topics ─────────────────────────────────── */
router.get("/content-topics", async (_req, res) => {
  try {
    // 1. Строим нишевый словарь из Яндекс.Вебмастера (реальные запросы пользователей)
    const webmasterRaw = await db.execute(sql`
      SELECT DISTINCT query_text
      FROM seo_query_snapshots
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM seo_query_snapshots)
      LIMIT 2000
    `);
    const nicheVocab = new Set<string>();
    for (const row of webmasterRaw.rows as { query_text: string }[]) {
      for (const word of row.query_text.toLowerCase().split(/\s+/)) {
        if (word.length >= 3 && !STOPWORDS.has(word)) nicheVocab.add(word);
      }
    }
    const hasWebmasterData = nicheVocab.size > 0;

    // 2. Топ Wordstat-запросов
    const topicsRaw = await db.execute(sql`
      SELECT
        query,
        MAX(shows_count)   AS shows_count,
        MAX(snapshot_date) AS latest_date,
        source
      FROM wordstat_snapshots
      WHERE shows_count > 0
      GROUP BY query, source
      ORDER BY MAX(shows_count) DESC
      LIMIT 100
    `);

    // 3. Существующие новости для проверки покрытия
    const newsRaw = await db.execute(sql`
      SELECT title FROM news ORDER BY published_at DESC LIMIT 300
    `);
    const newsTitles = (newsRaw.rows as { title: string }[])
      .map(n => n.title.toLowerCase());

    function isCovered(query: string): boolean {
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.length < 2) return false;
      return newsTitles.some(t => words.filter(w => t.includes(w)).length >= 2);
    }

    // 4. Нишевая релевантность: запрос пересекается с Вебмастер-словарём
    function isNicheRelevant(query: string): boolean {
      if (!hasWebmasterData) return true; // если нет данных Вебмастера — пропускаем фильтр
      const words = query.toLowerCase().split(/\s+/)
        .filter(w => w.length >= 3 && !STOPWORDS.has(w));
      if (words.length === 0) return false;
      const matches = words.filter(w => nicheVocab.has(w)).length;
      // Хотя бы одно значимое слово должно быть в словаре ниши
      return matches >= 1;
    }

    const data = (topicsRaw.rows as {
      query: string; shows_count: string; latest_date: string; source: string;
    }[]).map(r => ({
      query: r.query,
      showsCount: Number(r.shows_count),
      latestDate: r.latest_date,
      source: r.source,
      covered: isCovered(r.query),
      nicheRelevant: isNicheRelevant(r.query),
    }));

    return res.json({
      ok: true,
      data,
      meta: { hasWebmasterData, nicheVocabSize: nicheVocab.size },
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
        { role: "system", content: ARTICLE_SYSTEM },
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
