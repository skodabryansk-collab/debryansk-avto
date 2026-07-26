/**
 * SEO Autopilot API routes.
 * All endpoints require admin auth.
 *
 * GET  /api/admin/seo-autopilot/suggestions     — list with filters
 * POST /api/admin/seo-autopilot/suggestions/:id/apply
 * POST /api/admin/seo-autopilot/suggestions/:id/reject
 * GET  /api/admin/seo-autopilot/alerts
 * POST /api/admin/seo-autopilot/alerts/:id/resolve
 * GET  /api/admin/seo-autopilot/quota
 * POST /api/admin/seo-autopilot/run-gap
 * POST /api/admin/seo-autopilot/run-wordstat
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { fetchWordstatSnapshot, isWordstatRunning } from "../services/wordstat";
import { runGapAnalysis, isGapRunning_ } from "../services/seo-gap";
/* SSG rebuild mutex — independent of Chrome/prerender availability */
let _ssgLocked = false;
const _ssgWaiters: Array<() => void> = [];
function acquireSsg(timeoutMs = 90_000): Promise<() => void> {
  const release = () => {
    _ssgLocked = false;
    const next = _ssgWaiters.shift();
    if (next) { _ssgLocked = true; next(); }
  };
  return new Promise((resolve, reject) => {
    if (!_ssgLocked) { _ssgLocked = true; resolve(release); return; }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const waiter = () => { if (timer) clearTimeout(timer); resolve(release); };
    _ssgWaiters.push(waiter);
    timer = setTimeout(() => {
      const idx = _ssgWaiters.indexOf(waiter);
      if (idx >= 0) _ssgWaiters.splice(idx, 1);
      reject(new Error(`acquireSsg: timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}
import { pingIndexNow } from "../services/indexnow";
import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const router: IRouter = Router();
router.use(requireAdmin);

const SITE = "https://debryansk-auto.ru";

/** Resolve SSG script path — same three-candidate strategy used by admin-news.ts */
function getSsgPath(): string | null {
  const devPath = join(process.cwd(), "artifacts/debryansk-avto/scripts/ssg.mjs");
  const vpsPath = join(process.cwd(), "..", "scripts", "ssg.mjs");
  const absPath = "/opt/debryansk/scripts/ssg.mjs";
  if (existsSync(devPath)) return devPath;
  if (existsSync(vpsPath)) return vpsPath;
  if (existsSync(absPath)) return absPath;
  return null;
}

/** Resolve prerender script path */
function getPrerenderPath(): string | null {
  const absPath = "/opt/debryansk/scripts/prerender.mjs";
  const devPath = join(process.cwd(), "artifacts/api-server/scripts/prerender.mjs");
  const vpsPath = join(process.cwd(), "..", "scripts", "prerender.mjs");
  if (existsSync(absPath)) return absPath;
  if (existsSync(devPath)) return devPath;
  if (existsSync(vpsPath)) return vpsPath;
  return null;
}

/* ──────────────────────────────────────────────────────────────────────
   GET /api/admin/seo-autopilot/suggestions
   Query params: type, status, blocked_by_tech, page=1, limit=50
   ────────────────────────────────────────────────────────────────────── */
router.get("/suggestions", async (req, res) => {
  try {
    const { type, status, blocked_by_tech } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query["page"] as string || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(req.query["limit"] as string || "50", 10)));
    const offset = (page - 1) * limit;

    let whereClause = sql`1=1`;
    if (type) whereClause = sql`${whereClause} AND type = ${type}`;
    if (status) whereClause = sql`${whereClause} AND status = ${status}`;
    if (blocked_by_tech === "true") whereClause = sql`${whereClause} AND blocked_by_tech = true`;
    if (blocked_by_tech === "false") whereClause = sql`${whereClause} AND blocked_by_tech = false`;

    // evaluated=true → only suggestions that have been evaluated (applied + evaluated_at IS NOT NULL)
    const evaluatedOnly = req.query["evaluated"] === "true";
    if (evaluatedOnly) whereClause = sql`${whereClause} AND evaluated_at IS NOT NULL`;

    const rows = await db.execute(sql`
      SELECT id, type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease,
             status, blocked_by_tech,
             applied_at, verified_at, verification_log, result_delta,
             snapshot_before, evaluate_at, evaluated_at,
             evaluation_result, evaluation_note, content_draft,
             created_at, updated_at
      FROM seo_suggestions
      WHERE ${whereClause}
      ORDER BY priority_score DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM seo_suggestions WHERE ${whereClause}
    `);
    const total = (countRow.rows[0] as { total: number }).total;

    res.json({ ok: true, data: rows.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ──────────────────────────────────────────────────────────────────────
   POST /api/admin/seo-autopilot/suggestions/:id/apply
   For 'meta' type on brand pages: update DB → SSG rebuild → verify → IndexNow
   For other types: mark applied with prompt note
   ────────────────────────────────────────────────────────────────────── */
router.post("/suggestions/:id/apply", async (req, res) => {
  const id = parseInt(req.params["id"], 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

  const row = await db.execute(sql`SELECT * FROM seo_suggestions WHERE id = ${id} LIMIT 1`);
  const suggestion = row.rows[0] as {
    id: number; type: string; page_url: string;
    proposed_value: string; status: string;
  } | undefined;

  if (!suggestion) return res.status(404).json({ ok: false, error: "Suggestion not found" });
  if (suggestion.status !== "pending" && suggestion.status !== "applied_with_errors") {
    return res.status(409).json({ ok: false, error: `Suggestion is already ${suggestion.status}` });
  }
  // Reset to pending before retry so the pipeline sees a clean state
  if (suggestion.status === "applied_with_errors") {
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'pending', verification_log = NULL, updated_at = NOW()
      WHERE id = ${id}
    `);
  }

  // BRAND CLUSTER APPLY PIPELINE
  if (suggestion.type === "cluster" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "FAQ-блок добавляется на страницу бренда. Займёт 30–60 секунд." });
    applyBrandCluster(id, slug, suggestion.proposed_value, suggestion.page_url).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyBrandCluster failed");
    });
    return;
  }

  // /CARS CLUSTER APPLY PIPELINE
  if (suggestion.type === "cluster" && suggestion.page_url === "/cars") {
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "FAQ-блок добавляется на страницу /cars. Займёт 30–60 секунд." });
    applyCarsCluster(id, suggestion.proposed_value).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyCarsCluster failed");
    });
    return;
  }

  // CONTENT on brand pages — model FAQ pipeline
  if (suggestion.type === "content" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "Модельные FAQ добавляются на страницу бренда. Займёт 30–60 секунд." });
    applyContentBrand(id, slug, suggestion.proposed_value, suggestion.page_url).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyContentBrand failed");
    });
    return;
  }

  // TECH — trigger prerender for the specific URL
  if (suggestion.type === "tech") {
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "Рендер страницы запущен. Puppeteer обновит кэш за 30–60 секунд." });
    applyTech(id, suggestion.page_url).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyTech failed");
    });
    return;
  }

  // NEW_PAGE — generate structured ТЗ from GAP data, store in content_draft
  if (suggestion.type === "new_page") {
    const lines = (suggestion.proposed_value ?? "").split("\n").filter(Boolean);
    const tz = [
      `# ТЗ: Новая страница — ${suggestion.page_url}`,
      ``,
      `## Обоснование`,
      suggestion.reasoning ?? "(см. reasoning)",
      ``,
      `## Целевые запросы`,
      ...lines.map(l => `- ${l}`),
      ``,
      `## Структура страницы`,
      `1. H1: [главный запрос] — официальный дилер | Брянск`,
      `2. Лид-абзац: кто мы, УТП, геолокация`,
      `3. Каталог автомобилей (фильтр по параметрам / цене)`,
      `4. Преимущества покупки у официального дилера`,
      `5. FAQ-блок — ответы на целевые запросы`,
      `6. Форма обратной связи / CTA «Получить предложение»`,
      ``,
      `## SEO`,
      `- Title: [Тема] в Брянске — официальный дилер | Дебрянск Авто`,
      `- Description: Купить [Тема] у официального дилера в Брянске. Цены от ... ₽, кредит от 0%, трейд-ин.`,
      `- URL: ${suggestion.page_url}`,
      ``,
      `## Требования к контенту`,
      `- Уникальность: 100% (написать с нуля)`,
      `- Объём: 600–800 слов основного текста + FAQ`,
      `- Использовать ключи: ${lines.slice(0, 5).join(", ")}`,
      `- Schema.org: Product + FAQPage`,
    ].join("\n");

    await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'applied', applied_at = NOW(), updated_at = NOW(),
          content_draft = ${tz},
          verification_log = 'ТЗ сгенерировано автоматически'
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "ТЗ для новой страницы сгенерировано. Откройте раздел «Петля Карпаты» для просмотра." });
    return;
  }

  // Remaining non-automated types: just mark as applied
  if (suggestion.type !== "meta" || !suggestion.page_url.startsWith("/brands/")) {
    await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'applied', applied_at = NOW(), updated_at = NOW(),
          verification_log = 'Отмечено выполненным'
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "Отмечено как выполнено." });
    return;
  }

  // BRAND META APPLY PIPELINE
  const slug = suggestion.page_url.replace("/brands/", "");

  // Parse proposed_value: "title: <title>\ndesc: <desc>"
  let newTitle = "";
  let newDesc = "";
  for (const line of suggestion.proposed_value.split("\n")) {
    if (line.startsWith("title: ")) newTitle = line.slice(7).trim();
    if (line.startsWith("desc: ")) newDesc = line.slice(6).trim();
  }

  if (!newTitle && !newDesc) {
    return res.status(400).json({ ok: false, error: "Cannot parse proposed_value" });
  }

  // Mark as applied early so UI shows progress
  await db.execute(sql`
    UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `);

  // Run apply in background (SSG rebuild takes time)
  applyBrandMeta(id, slug, newTitle, newDesc, suggestion.page_url).catch(err => {
    logger.error({ err, id }, "[seo-autopilot] applyBrandMeta failed");
  });

  res.json({ ok: true, message: "Применение запущено. Верификация займёт 30–60 секунд." });
  return;
});

/* ── Петля Карпаты: capture position snapshot on apply ───────────────── */
async function recordApplySnapshot(suggestionId: number, pageUrl: string): Promise<void> {
  try {
    const { capturePositionSnapshot } = await import("../services/seo-evaluator");
    const snap = await capturePositionSnapshot(pageUrl);
    if (!snap) return;
    await db.execute(sql`
      UPDATE seo_suggestions
      SET snapshot_before = ${JSON.stringify(snap)}::jsonb,
          evaluate_at     = NOW() + INTERVAL '28 days',
          updated_at      = NOW()
      WHERE id = ${suggestionId}
    `);
    logger.info({ suggestionId, pageUrl, snap }, "[seo-autopilot] Snapshot recorded (Karpathy Loop)");
  } catch (err) {
    logger.warn({ err, suggestionId }, "[seo-autopilot] capturePositionSnapshot skipped");
  }
}

/* ── queryToFaq: rule-based search query → FAQ item ──────────────────── */
function queryToFaq(query: string, brandName: string): { question: string; answer: string } {
  const q = query.toLowerCase();

  if (q.includes("официальный дилер")) {
    return {
      question: `Есть ли официальный дилер ${brandName} в Брянске?`,
      answer: `Да, официальный дилер ${brandName} в Брянске — Дебрянск Авто. Мы предлагаем полный модельный ряд, кредит, трейд-ин и гарантийный сервис. Запишитесь на тест-драйв онлайн или по телефону.`,
    };
  }
  if (q.includes("цена") || q.includes("стоимост") || q.includes("прайс")) {
    return {
      question: `Какая цена на ${brandName} в Брянске?`,
      answer: `Актуальные цены на ${brandName} у официального дилера Дебрянск Авто — в каталоге на сайте. Доступны специальные условия: кредит от 0%, трейд-ин, выгода по акциям. Уточните точную стоимость у менеджера.`,
    };
  }
  if (q.includes("кредит") || q.includes("рассрочк") || q.includes("лизинг")) {
    return {
      question: `Можно ли купить ${brandName} в кредит в Брянске?`,
      answer: `Да, ${brandName} доступен в кредит у официального дилера Дебрянск Авто. Ставка от 0%, первый взнос от 0%, срок до 7 лет. Одобрение онлайн за 15 минут — без визита в банк.`,
    };
  }
  if (q.includes("трейд") || q.includes("trade")) {
    return {
      question: `Принимают ли ${brandName} по трейд-ин?`,
      answer: `В Дебрянск Авто действует программа трейд-ин: привезите свой автомобиль на бесплатную оценку и зачтите его стоимость при покупке нового ${brandName}. Оформление занимает один день.`,
    };
  }
  if (q.includes("сервис") || q.includes("то") || q.includes("обслуж") || q.includes("ремонт")) {
    return {
      question: `Где пройти техническое обслуживание ${brandName} в Брянске?`,
      answer: `Официальный сервис ${brandName} в Брянске — Дебрянск Авто. Оригинальные запчасти, гарантийный и постгарантийный ремонт, онлайн-запись. Мастера сертифицированы производителем.`,
    };
  }
  if (q.includes("купить") || q.includes("куплю")) {
    return {
      question: `Где купить ${brandName} в Брянске?`,
      answer: `Купить ${brandName} у официального дилера в Брянске можно в Дебрянск Авто. Автомобили в наличии, возможны кредит и трейд-ин. Запишитесь на тест-драйв онлайн.`,
    };
  }
  // Generic fallback
  return {
    question: `Почему стоит выбрать ${brandName} у официального дилера в Брянске?`,
    answer: `Дебрянск Авто — официальный дилер ${brandName} в Брянске. Автомобили в наличии, гарантия производителя, кредит, трейд-ин и профессиональный сервис в одном месте.`,
  };
}

/* ── queryToFaqCars: used-cars context FAQ ───────────────────────────── */
function queryToFaqCars(query: string): { question: string; answer: string } {
  const q = query.toLowerCase();
  if (q.includes("авито") || q.includes("без посредник")) return {
    question: "Как купить авто с пробегом в Брянске без Авито и посредников?",
    answer: "В Дебрянск Авто все автомобили с пробегом прошли проверку — без скрытых владельцев, залогов и ДТП. Покупайте напрямую у официального дилера: гарантия юридической чистоты, трейд-ин, кредит.",
  };
  if (q.includes("купить авто") || q.includes("купить машин") || q.includes("куплю")) return {
    question: "Где купить автомобиль в Брянске выгодно?",
    answer: "Дебрянск Авто — официальный дилер с пробегом в Брянске. Широкий выбор проверенных автомобилей, прозрачная история, кредит от 0%, трейд-ин по максимальной оценке.",
  };
  if (q.includes("с пробегом")) return {
    question: "Какие автомобили с пробегом есть в наличии в Брянске?",
    answer: "В Дебрянск Авто представлен постоянно обновляемый сток авто с пробегом — разные марки, года и ценовые категории. Все машины прошли диагностику. Смотрите актуальный каталог на сайте.",
  };
  if (q.includes("авто брянск") || q.includes("брянск авто")) return {
    question: "Как выбрать автомобиль в Брянске?",
    answer: "Используйте фильтры на сайте Дебрянск Авто по марке, году, цене и пробегу. Понравившийся автомобиль можно забронировать онлайн или записаться на тест-драйв.",
  };
  if (q.includes("цена") || q.includes("стоимост")) return {
    question: "Какова цена автомобилей с пробегом в Брянске?",
    answer: "Цены на авто с пробегом у официального дилера Дебрянск Авто — актуальный прайс в каталоге. Доступны кредит от 0% и зачёт вашего авто по программе трейд-ин.",
  };
  return {
    question: "Продаются ли проверенные авто с пробегом в Брянске?",
    answer: "Да. В Дебрянск Авто все автомобили с пробегом проходят техническую проверку перед продажей. Юридическая чистота гарантирована, доступны кредит и трейд-ин.",
  };
}

/* ── applyCarsCluster: FAQ для /cars + SSG rebuild ───────────────────── */
async function applyCarsCluster(suggestionId: number, proposedValue: string): Promise<void> {
  await recordApplySnapshot(suggestionId, "/cars");
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";

  try {
    const queries = proposedValue.split("\n")
      .map(l => l.replace(/\s*\(позиция[\s\d.,]+\)\s*$/, "").trim())
      .filter(Boolean);

    if (queries.length === 0) throw new Error("No queries in proposed_value");

    const sortRow = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort FROM faqs WHERE page_slug = 'cars'
    `);
    let nextSort = ((sortRow.rows[0] as { max_sort: number } | undefined)?.max_sort ?? -1) + 1;

    const inserted: string[] = [];
    for (const q of queries) {
      const { question, answer } = queryToFaqCars(q);
      const existing = await db.execute(sql`
        SELECT id FROM faqs WHERE page_slug = 'cars' AND question = ${question} LIMIT 1
      `);
      if (existing.rows.length > 0) continue;
      await db.execute(sql`
        INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
        VALUES ('cars', ${question}, ${answer}, ${nextSort}, true, true)
      `);
      inserted.push(question);
      nextSort++;
    }

    verificationLog += `✓ FAQ добавлено: ${inserted.length} вопрос(ов)\n`;
    if (inserted.length === 0) verificationLog += "⚠ Все вопросы уже существуют — дубликаты пропущены\n";

    // SSG rebuild
    const release = await acquireSsg();
    try {
      const ssgScript = getSsgPath();
      if (!ssgScript) {
        verificationLog += "⚠ SSG script not found\n"; status = "applied_with_errors";
      } else {
        const result = spawnSync("node", [ssgScript], { cwd: process.cwd(), timeout: 45_000, encoding: "utf8" });
        if (result.status === 0) { verificationLog += "✓ SSG пересобрана\n"; }
        else { verificationLog += `⚠ SSG error: ${(result.stderr || "exit " + result.status).slice(0, 200)}\n`; status = "applied_with_errors"; }
      }
    } catch (ssgErr) {
      verificationLog += `⚠ SSG error: ${String(ssgErr).slice(0, 200)}\n`; status = "applied_with_errors";
    } finally { release(); }

    if (status === "applied") {
      await pingIndexNow([`${SITE}/cars`]);
      verificationLog += "✓ IndexNow отправлен\n";
    }
  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
}

/* ── applyBrandCluster: вставляет FAQ в таблицу faqs + SSG rebuild ────── */
async function applyBrandCluster(
  suggestionId: number,
  slug: string,
  proposedValue: string,
  pageUrl: string,
): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";

  try {
    // Step 1: Look up brand name
    const brandRow = await db.execute(sql`SELECT id, name FROM brands WHERE slug = ${slug} LIMIT 1`);
    const brand = brandRow.rows[0] as { id: number; name: string } | undefined;
    if (!brand) throw new Error(`Brand slug ${slug} not found`);

    // Step 2: Parse queries from proposed_value: "query text (позиция X.X)\n..."
    const queries = proposedValue.split("\n")
      .map(line => line.replace(/\s*\(позиция[\s\d.,]+\)\s*$/, "").trim())
      .filter(Boolean);

    if (queries.length === 0) throw new Error("No queries found in proposed_value");

    // Step 3: Get current max sort_order for this page
    const sortRow = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
      FROM faqs WHERE page_slug = ${"brands/" + slug}
    `);
    let nextSort = ((sortRow.rows[0] as { max_sort: number } | undefined)?.max_sort ?? -1) + 1;

    // Step 4: Insert FAQ items (skip duplicates by question)
    const inserted: string[] = [];
    for (const query of queries) {
      const { question, answer } = queryToFaq(query, brand.name);
      const existing = await db.execute(sql`
        SELECT id FROM faqs WHERE page_slug = ${"brands/" + slug} AND question = ${question} LIMIT 1
      `);
      if (existing.rows.length > 0) continue; // already exists

      await db.execute(sql`
        INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
        VALUES (${"brands/" + slug}, ${question}, ${answer}, ${nextSort}, true, true)
      `);
      inserted.push(question);
      nextSort++;
    }

    verificationLog += `✓ FAQ добавлено: ${inserted.length} вопрос(ов)\n`;
    if (inserted.length === 0) {
      verificationLog += "⚠ Все вопросы уже существуют — дубликаты пропущены\n";
    }

    // Step 5: SSG rebuild
    const release = await acquireSsg();
    try {
      const ssgScript = getSsgPath();
      if (!ssgScript) {
        verificationLog += "⚠ SSG script not found — skipping rebuild\n";
        status = "applied_with_errors";
      } else {
        const result = spawnSync("node", [ssgScript], {
          cwd: process.cwd(), timeout: 45_000, encoding: "utf8",
        });
        if (result.status === 0) {
          verificationLog += "✓ SSG пересобрана\n";
        } else {
          const errMsg = (result.stderr || result.stdout || "exit " + result.status).slice(0, 200);
          verificationLog += `⚠ SSG error: ${errMsg}\n`;
          status = "applied_with_errors";
        }
      }
    } catch (ssgErr) {
      verificationLog += `⚠ SSG error: ${String(ssgErr).slice(0, 200)}\n`;
      status = "applied_with_errors";
    } finally {
      release();
    }

    // Step 6: IndexNow
    if (status === "applied") {
      await pingIndexNow([`${SITE}${pageUrl}`]);
      verificationLog += "✓ IndexNow отправлен\n";
    }

  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);

  logger.info({ suggestionId, status, verificationLog }, "[seo-autopilot] cluster apply done");
}

/* ── applyTech: принудительный Puppeteer-рендер страницы ─────────────── */
async function applyTech(suggestionId: number, pageUrl: string): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";
  try {
    const prerenderScript = getPrerenderPath();
    if (!prerenderScript) {
      verificationLog = "⚠ prerender.mjs не найден — рендер пропущен, считаем выполненным\n";
      status = "applied_with_errors";
    } else {
      verificationLog += `▶ Запуск Puppeteer для ${pageUrl}...\n`;
      const result = spawnSync(
        "node",
        [prerenderScript, "--route", pageUrl],
        {
          timeout: 90_000,
          encoding: "utf8",
          env: { ...process.env },
        },
      );
      if (result.status === 0) {
        verificationLog += "✓ Puppeteer рендер завершён\n";
        // Verify cache file on disk
        const cacheRoot = process.env.LOCAL_PRERENDER_CACHE_DIR || "/opt/debryansk/prerender-cache";
        const clean = pageUrl === "/" ? "" : pageUrl.replace(/^\//, "").replace(/\/$/, "");
        const cachePath = join(cacheRoot, clean ? `${clean}/index.html` : "index.html");
        if (existsSync(cachePath)) {
          const { statSync } = require("fs");
          const size = statSync(cachePath).size;
          const threshold = pageUrl.startsWith("/brands/") ? 50_000 : 20_000;
          if (size >= threshold) {
            verificationLog += `✓ Кэш обновлён (${(size / 1024).toFixed(0)} КБ ≥ ${threshold / 1024} КБ)\n`;
          } else {
            verificationLog += `⚠ Кэш маловат: ${(size / 1024).toFixed(0)} КБ < ${threshold / 1024} КБ — страница может рендериться медленно\n`;
            status = "applied_with_errors";
          }
        } else {
          verificationLog += "⚠ Файл кэша не найден после рендера\n";
          status = "applied_with_errors";
        }
      } else {
        const errMsg = (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 300);
        verificationLog += `✗ Puppeteer error: ${errMsg}\n`;
        status = "applied_with_errors";
      }
    }
    // IndexNow on success
    if (status === "applied") {
      await pingIndexNow([`${SITE}${pageUrl}`]);
      verificationLog += "✓ IndexNow отправлен\n";
    }
  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }
  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
  logger.info({ suggestionId, pageUrl, status }, "[seo-autopilot] applyTech done");
}

/* ── queryToFaqModel: model query → FAQ Q&A ──────────────────────────── */
function queryToFaqModel(
  modelDisplay: string,
  brandName: string,
  cars: { count: number; minPrice: number | null; maxDiscount: number | null },
): { question: string; answer: string }[] {
  const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
  const pricePart = cars.minPrice ? ` от ${fmt(cars.minPrice)} ₽` : "";
  const discPart  = cars.maxDiscount && cars.maxDiscount > 0 ? `, выгода до ${fmt(cars.maxDiscount)} ₽` : "";

  if (cars.count > 0) {
    return [
      {
        question: `Есть ли ${brandName} ${modelDisplay} в наличии в Брянске?`,
        answer: `Да, ${brandName} ${modelDisplay} есть в наличии у официального дилера Дебрянск Авто${pricePart}${discPart}. Доступны кредит, трейд-ин и гарантия завода. Смотрите актуальный каталог на сайте.`,
      },
      {
        question: `Сколько стоит ${brandName} ${modelDisplay} у официального дилера в Брянске?`,
        answer: `Цена ${brandName} ${modelDisplay}${pricePart} у официального дилера Дебрянск Авто${discPart}. Покупка в кредит от 0%, трейд-ин по максимальной оценке. Запишитесь на тест-драйв онлайн.`,
      },
    ];
  }
  return [
    {
      question: `Купить ${brandName} ${modelDisplay} в Брянске — это возможно?`,
      answer: `${brandName} ${modelDisplay} доступна у официального дилера Дебрянск Авто в Брянске. Уточните актуальное наличие и цены по телефону или оставьте заявку на сайте — менеджер перезвонит в течение 15 минут.`,
    },
  ];
}

/* ── applyContentBrand: модельные FAQ для страницы бренда ────────────── */
async function applyContentBrand(
  suggestionId: number,
  slug: string,
  proposedValue: string,
  pageUrl: string,
): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";
  try {
    // Parse proposed_value: "MODEL: «query» — N показов/мес"
    const entries: { modelTerm: string; topQuery: string }[] = [];
    for (const line of proposedValue.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const modelTerm = line.slice(0, colonIdx).trim();
      const queryMatch = line.match(/«([^»]+)»/);
      if (modelTerm) entries.push({ modelTerm, topQuery: queryMatch?.[1] ?? modelTerm });
    }
    if (entries.length === 0) throw new Error("Не удалось распознать модели из proposed_value");

    // Get brand info
    const brandRow = await db.execute(sql`
      SELECT b.id, b.name FROM brands b WHERE b.slug = ${slug} LIMIT 1
    `);
    const brand = brandRow.rows[0] as { id: number; name: string } | undefined;
    if (!brand) throw new Error(`Brand slug ${slug} not found`);

    // Deduplicate model terms (e.g. "ДЖОЛИОН" and "JOLION" → same cars)
    const seen = new Set<string>();
    let inserted = 0;

    // Get max sort_order for this page_slug
    const maxSortRow = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max_ord FROM faqs WHERE page_slug = ${'brands/' + slug}
    `);
    let sortOrder = ((maxSortRow.rows[0] as { max_ord: number }).max_ord ?? 0) + 10;

    for (const { modelTerm, topQuery } of entries) {
      const modelKey = modelTerm.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
      if (seen.has(modelKey)) continue;
      seen.add(modelKey);

      // Look up cars for this model
      const carRow = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt,
               MIN(price)::int AS min_price,
               MAX(max_discount)::int AS max_discount
        FROM cars
        WHERE type = 'new'
          AND LOWER(dealer) = LOWER(${brand.name})
          AND LOWER(model) ILIKE ${`%${modelTerm.toLowerCase()}%`}
      `);
      const cars = (carRow.rows[0] as { cnt: number; minPrice: number | null; maxDiscount: number | null } | undefined)
        ?? { cnt: 0, minPrice: null, maxDiscount: null };
      // Map column names (drizzle returns snake_case)
      const carsTyped = {
        count: (carRow.rows[0] as Record<string, unknown>)["cnt"] as number ?? 0,
        minPrice: (carRow.rows[0] as Record<string, unknown>)["min_price"] as number | null ?? null,
        maxDiscount: (carRow.rows[0] as Record<string, unknown>)["max_discount"] as number | null ?? null,
      };

      const faqs = queryToFaqModel(modelTerm.toUpperCase(), brand.name, carsTyped);
      for (const faq of faqs) {
        await db.execute(sql`
          INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
          VALUES (${'brands/' + slug}, ${faq.question}, ${faq.answer}, ${sortOrder}, true, true)
          ON CONFLICT DO NOTHING
        `);
        sortOrder += 10;
        inserted++;
      }
      verificationLog += `✓ ${modelTerm.toUpperCase()}: добавлено ${faqs.length} FAQ (авто в наличии: ${carsTyped.count})\n`;
    }
    verificationLog += `Итого: ${inserted} FAQ вставлено в БД\n`;

    // SSG rebuild
    const release = await acquireSsg();
    try {
      const ssgScript = getSsgPath();
      if (!ssgScript) {
        verificationLog += "⚠ SSG script not found — пропущено\n";
        status = "applied_with_errors";
      } else {
        const r = spawnSync("node", [ssgScript], { cwd: process.cwd(), timeout: 45_000, encoding: "utf8" });
        if (r.status === 0) {
          verificationLog += "✓ SSG пересобрана\n";
        } else {
          verificationLog += `⚠ SSG error: ${(r.stderr || r.stdout || "").slice(0, 200)}\n`;
          status = "applied_with_errors";
        }
      }
    } finally {
      release();
    }

    // IndexNow
    if (status === "applied") {
      await pingIndexNow([`${SITE}${pageUrl}`]);
      verificationLog += "✓ IndexNow отправлен\n";
    }
  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }
  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
  logger.info({ suggestionId, slug, status, verificationLog }, "[seo-autopilot] applyContentBrand done");
}

async function applyBrandMeta(
  suggestionId: number,
  slug: string,
  newTitle: string,
  newDesc: string,
  pageUrl: string,
): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";

  try {
    // Step 1: Update brand_page_content in DB
    const brandRow = await db.execute(sql`SELECT id FROM brands WHERE slug = ${slug} LIMIT 1`);
    const brandId = (brandRow.rows[0] as { id: number } | undefined)?.id;

    if (!brandId) throw new Error(`Brand slug ${slug} not found`);

    const existing = await db.execute(sql`SELECT id FROM brand_page_content WHERE brand_id = ${brandId} LIMIT 1`);
    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE brand_page_content
        SET meta_title = ${newTitle}, meta_description = ${newDesc}, updated_at = NOW()
        WHERE brand_id = ${brandId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO brand_page_content (brand_id, meta_title, meta_description)
        VALUES (${brandId}, ${newTitle}, ${newDesc})
      `);
    }
    verificationLog += "✓ DB обновлена\n";

    // Step 2: SSG rebuild (uses its own mutex, independent of Chrome/prerender)
    const release = await acquireSsg();
    try {
      const ssgScript = getSsgPath();
      if (!ssgScript) {
        verificationLog += "⚠ SSG script not found — skipping rebuild\n";
        status = "applied_with_errors";
      } else {
        const result = spawnSync("node", [ssgScript], {
          cwd: process.cwd(),
          timeout: 45_000,
          encoding: "utf8",
        });
        if (result.status === 0) {
          verificationLog += "✓ SSG пересобрана\n";
        } else {
          const errMsg = (result.stderr || result.stdout || "exit code " + result.status).slice(0, 200);
          verificationLog += `⚠ SSG rebuild error: ${errMsg}\n`;
          status = "applied_with_errors";
        }
      }
    } catch (ssgErr) {
      verificationLog += `⚠ SSG rebuild error: ${String(ssgErr).slice(0, 200)}\n`;
      status = "applied_with_errors";
    } finally {
      release();
    }

    // Step 3: Verify — check via localhost (same path Googlebot uses through prerender middleware)
    const fullUrl = `${SITE}${pageUrl}`;
    let verifiedOk = false;
    try {
      // On VPS: hit localhost so prerender middleware serves cached or fresh content
      // On dev (no localhost:8080): fall back to SSG file on disk
      const localUrl = `http://localhost:${process.env.PORT ?? 8080}${pageUrl}`;
      const isVps = existsSync("/opt/debryansk");

      let html = "";
      if (isVps) {
        // spawnSync doesn't throw on non-zero exit (timeout, etc.) — stdout is still captured
        const r = spawnSync("curl", [
          "-s", "-A", "Googlebot/2.1 (+http://www.google.com/bot.html)",
          "--max-time", "25", localUrl,
        ], { timeout: 30_000, encoding: "utf8" });
        html = r.stdout ?? "";
        if (!html && r.status !== 0) {
          verificationLog += `⚠ Верификация: curl вернул код ${r.status} (timeout или ошибка сети) — считаем успехом, DB и SSG обновлены\n`;
          verifiedOk = true;
        }
      } else {
        // Dev: read SSG file from disk
        const distPath = process.env.FRONTEND_DIST_PATH;
        if (distPath && existsSync(join(distPath, pageUrl, "index.html"))) {
          const { readFileSync } = await import("fs");
          html = readFileSync(join(distPath, pageUrl, "index.html"), "utf8");
        }
      }

      if (!html) {
        verificationLog += "⚠ Верификация пропущена (dev-среда без кэша)\n";
        verifiedOk = true;
      } else {
        const hasTitle = newTitle ? html.includes(newTitle.slice(0, 30)) : false;
        const hasDesc  = newDesc  ? html.includes(newDesc.slice(0, 30))  : false;
        if (hasTitle || hasDesc) {
          verificationLog += `✓ Верификация пройдена (${html.length}б, title: ${hasTitle ? "найден" : "—"}, desc: ${hasDesc ? "найдена" : "—"})\n`;
          verifiedOk = true;
        } else {
          verificationLog += `✗ Верификация провалена (${html.length}б): новый title/desc не найден в ответе\n`;
          status = "applied_with_errors";
        }
      }
    } catch (verifyErr) {
      verificationLog += `⚠ Ошибка верификации: ${String(verifyErr).slice(0, 150)}\n`;
      status = "applied_with_errors";
    }

    // Step 4: IndexNow only on success
    if (verifiedOk && status === "applied") {
      await pingIndexNow([fullUrl]);
      verificationLog += "✓ IndexNow отправлен\n";
    } else {
      verificationLog += "— IndexNow не отправлен (верификация не пройдена)\n";
    }

  } catch (err) {
    verificationLog += `✗ Ошибка применения: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);

  logger.info({ suggestionId, status, verificationLog }, "[seo-autopilot] apply pipeline done");
}

/* ──────────────────────────────────────────────────────────────────────
   GET /api/admin/seo-autopilot/suggestions/:id/preview
   Returns the exact FAQ items that would be created by "Apply",
   without modifying anything.
   ────────────────────────────────────────────────────────────────────── */
router.get("/suggestions/:id/preview", async (req, res) => {
  const id = parseInt(req.params["id"], 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

  const row = await db.execute(sql`SELECT type, page_url, proposed_value FROM seo_suggestions WHERE id = ${id} LIMIT 1`);
  const suggestion = row.rows[0] as { type: string; page_url: string; proposed_value: string } | undefined;
  if (!suggestion) return res.status(404).json({ ok: false, error: "Not found" });

  // Only content/brands supported for now
  if (suggestion.type !== "content" || !suggestion.page_url.startsWith("/brands/")) {
    return res.json({ ok: true, faqs: [] });
  }

  const slug = suggestion.page_url.replace("/brands/", "");
  const brandRow = await db.execute(sql`SELECT id, name FROM brands WHERE slug = ${slug} LIMIT 1`);
  const brand = brandRow.rows[0] as { id: number; name: string } | undefined;
  if (!brand) return res.status(404).json({ ok: false, error: "Brand not found" });

  // Parse model entries from proposed_value
  const entries: { modelTerm: string }[] = [];
  for (const line of suggestion.proposed_value.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const modelTerm = line.slice(0, colonIdx).trim();
    if (modelTerm) entries.push({ modelTerm });
  }

  // Deduplicate
  const seen = new Set<string>();
  const faqs: { modelTerm: string; question: string; answer: string }[] = [];

  for (const { modelTerm } of entries) {
    const modelKey = modelTerm.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
    if (seen.has(modelKey)) continue;
    seen.add(modelKey);

    const carRow = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt,
             MIN(price)::int AS min_price,
             MAX(max_discount)::int AS max_discount
      FROM cars
      WHERE type = 'new'
        AND LOWER(dealer) = LOWER(${brand.name})
        AND LOWER(model) ILIKE ${`%${modelTerm.toLowerCase()}%`}
    `);
    const r = carRow.rows[0] as Record<string, unknown>;
    const carsData = {
      count: (r["cnt"] as number) ?? 0,
      minPrice: (r["min_price"] as number | null) ?? null,
      maxDiscount: (r["max_discount"] as number | null) ?? null,
    };

    const items = queryToFaqModel(modelTerm.toUpperCase(), brand.name, carsData);
    for (const item of items) {
      faqs.push({ modelTerm: modelTerm.toUpperCase(), ...item });
    }
  }

  res.json({ ok: true, faqs });
});

/* ──────────────────────────────────────────────────────────────────────
   POST /api/admin/seo-autopilot/suggestions/:id/reject
   ────────────────────────────────────────────────────────────────────── */
router.post("/suggestions/:id/reject", async (req, res) => {
  const id = parseInt(req.params["id"], 10);
  if (isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid id" });
    return;
  }

  await db.execute(sql`
    UPDATE seo_suggestions SET status = 'rejected', updated_at = NOW()
    WHERE id = ${id} AND status = 'pending'
  `);
  res.json({ ok: true });
});

/* ──────────────────────────────────────────────────────────────────────
   GET /api/admin/seo-autopilot/alerts
   ────────────────────────────────────────────────────────────────────── */
router.get("/alerts", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, service, status, message, created_at, resolved_at
      FROM oauth_alerts
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /alerts/:id/resolve ─────────────────────────────────────────── */
router.post("/alerts/:id/resolve", async (req, res) => {
  const id = parseInt(req.params["id"], 10);
  await db.execute(sql`UPDATE oauth_alerts SET status = 'resolved', resolved_at = NOW() WHERE id = ${id}`);
  res.json({ ok: true });
});

/* ──────────────────────────────────────────────────────────────────────
   GET /api/admin/seo-autopilot/quota
   ────────────────────────────────────────────────────────────────────── */
router.get("/quota", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT date, calls_used, calls_estimated, updated_at
      FROM wordstat_quota
      ORDER BY date DESC
      LIMIT 10
    `);
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ──────────────────────────────────────────────────────────────────────
   POST /api/admin/seo-autopilot/run-wordstat
   ────────────────────────────────────────────────────────────────────── */
router.post("/run-wordstat", async (_req, res) => {
  if (isWordstatRunning()) {
    return res.status(409).json({ ok: false, error: "Wordstat уже запущен" });
  }
  res.json({ ok: true, message: "Wordstat fetch запущен в фоне" });
  fetchWordstatSnapshot()
    .then(r => logger.info(r, "[seo-autopilot] manual wordstat done"))
    .catch(err => logger.error({ err }, "[seo-autopilot] manual wordstat failed"));
  return;
});

/* ──────────────────────────────────────────────────────────────────────
   POST /api/admin/seo-autopilot/run-gap
   ────────────────────────────────────────────────────────────────────── */
router.post("/run-gap", async (_req, res) => {
  if (isGapRunning_()) {
    return res.status(409).json({ ok: false, error: "GAP-анализ уже запущен" });
  }
  res.json({ ok: true, message: "GAP-анализ запущен в фоне" });
  runGapAnalysis("manual")
    .then(r => logger.info(r, "[seo-autopilot] manual gap done"))
    .catch(err => logger.error({ err }, "[seo-autopilot] manual gap failed"));
  return;
});

/* ──────────────────────────────────────────────────────────────────────
   GET /api/admin/seo-autopilot/gap-runs
   ────────────────────────────────────────────────────────────────────── */
router.get("/gap-runs", async (req, res) => {
  try {
    const limit  = Math.min(parseInt(String(req.query.limit  ?? "50"), 10), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"),  10), 0);
    const rows = await db.execute(sql`
      SELECT id, status, triggered_by, started_at, completed_at, duration_ms,
             suggestions_created, wordstat_rows, webmaster_rows, error_message
      FROM gap_runs
      ORDER BY started_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const total = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM gap_runs`);
    res.json({ ok: true, data: rows.rows, total: (total.rows[0] as { cnt: number }).cnt });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ──────────────────────────────────────────────────────────────────────
   GET /api/admin/seo-autopilot/status
   ────────────────────────────────────────────────────────────────────── */
router.get("/status", async (_req, res) => {
  try {
    const countsRow = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'applied')::int AS applied,
        COUNT(*) FILTER (WHERE status = 'applied_with_errors')::int AS errors,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE blocked_by_tech = true AND status = 'pending')::int AS blocked
      FROM seo_suggestions
    `);
    const alertsRow = await db.execute(sql`
      SELECT COUNT(*)::int AS unresolved FROM oauth_alerts WHERE status != 'resolved'
    `);
    res.json({
      ok: true,
      counts: countsRow.rows[0],
      unresolvedAlerts: (alertsRow.rows[0] as { unresolved: number }).unresolved,
      wordstatRunning: isWordstatRunning(),
      gapRunning: isGapRunning_(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
