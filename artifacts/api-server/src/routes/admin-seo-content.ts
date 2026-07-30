/**
 * SEO Content Plan routes.
 * GET  /api/admin/seo/content-topics   — top Wordstat queries w/ news coverage info
 * POST /api/admin/seo/generate-article — AI article draft for a given topic
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

const ARTICLE_SYSTEM = `Ты редактор блога официального автодилера «Дебрянск Авто» в Брянске.

Пиши живым, экспертным языком. Без воды и клише.
Статья должна давать реальную пользу — отвечать на вопрос читателя.
В конце — мягкое приглашение посетить дилерский центр или записаться на тест-драйв (без «обращайтесь», «не упустите»).

ЗАПРЕЩЕНО:
- Называть конкретные цены, ставки по кредиту, количество авто в наличии
- Фразы: «широкий выбор», «выгодные условия», «надёжное место», «команда профессионалов», «обращайтесь»
- Упоминать конкурентов по имени

НАПИСАНИЕ МОДЕЛЕЙ:
- Кириллица с заглавной: Джолион, Дарго, Дашинг (не ДЖОЛИОН)
- Haval City / Haval Pro → пиши просто «Haval» без суббренда

Структура: введение (1 абзац) + 3–4 смысловых абзаца + заключение (1 абзац).
Абзацы разделяй пустой строкой (два переноса строки).`;

/* ── GET /admin/seo/content-topics ─────────────────────────────────── */
router.get("/content-topics", async (_req, res) => {
  try {
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
      LIMIT 60
    `);

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

    const data = (topicsRaw.rows as {
      query: string; shows_count: string; latest_date: string; source: string;
    }[]).map(r => ({
      query: r.query,
      showsCount: Number(r.shows_count),
      latestDate: r.latest_date,
      source: r.source,
      covered: isCovered(r.query),
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    logger.error({ err }, "[seo-content] content-topics failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /admin/seo/generate-article ──────────────────────────────── */
router.post("/generate-article", async (req, res) => {
  const { topic, keywords = [] } = req.body as { topic?: string; keywords?: string[] };
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return res.status(400).json({ ok: false, error: "topic is required" });
  }

  const kwLine = Array.isArray(keywords) && keywords.length > 0
    ? `\nДополнительные ключевые слова: ${keywords.slice(0, 10).join(", ")}`
    : "";

  const prompt =
    `Тема: «${topic.trim()}»${kwLine}\n\n` +
    `Напиши черновик статьи для автодилера. Верни ТОЛЬКО JSON (без markdown-обёртки):\n` +
    `{\n` +
    `  "title": "заголовок 50–70 символов, не повторяй запрос дословно",\n` +
    `  "category": "одна из: Авторынок | Советы покупателю | Тест-драйвы | Финансирование | Сервис | Trade-in",\n` +
    `  "excerpt": "анонс 1–2 предложения, 120–160 символов",\n` +
    `  "content": "5 абзацев через \\n\\n, каждый 60–100 слов",\n` +
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
      temperature: 0.8,
      max_tokens: 1800,
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
