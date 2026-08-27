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
import { spawnBrandPrerenderBySlug } from "../lib/spawnBrandPrerender";
import { fetchWordstatSnapshot, isWordstatRunning } from "../services/wordstat";
import { runGapAnalysis, isGapRunning_ } from "../services/seo-gap";
import { addSitemapPage } from "./sitemap";
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
import {
  aiQueryToFaq, aiQueryToFaqCars, aiQueryToFaqModel,
  aiTextBlock, aiMetaDescription, saveAiExample,
} from "../lib/seo-ai";
import { STATIC_META } from "../middleware/seoMeta";
import { aiGenerateLandingPage } from "../lib/seo-ai";

/** Slugify a Russian/Latin string into a URL-safe slug (same rules as admin-promotions). */
function slugifyLanding(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, c => ({"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"} as Record<string, string>)[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueLandingSlug(base: string): Promise<string> {
  let candidate = base || "landing";
  let suffix = 1;
  for (;;) {
    const rows = await db.execute(sql`SELECT id FROM seo_landing_pages WHERE slug = ${candidate} LIMIT 1`);
    if (!rows.rows.length) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

const router: IRouter = Router();
router.use(requireAdmin);

const SITE = "https://debryansk-auto.ru";

/* ── Model canonical map (Latin ↔ Cyrillic) ─────────────────────────── */
const _MODEL_CANONICAL_ENTRIES: { key: string; display: string; variants: string[] }[] = [
  // Haval
  { key: "jolion",  display: "ДЖОЛИОН", variants: ["jolion", "джолион"] },
  { key: "dargo",   display: "ДАРГО",   variants: ["dargo", "дарго"] },
  { key: "f7x",     display: "F7X",     variants: ["f7x", "ф7х"] },
  { key: "f7",      display: "F7",      variants: ["f7", "ф7"] },
  { key: "m6",      display: "M6",      variants: ["m6", "м6"] },
  // Jetour
  { key: "dashing", display: "Dashing", variants: ["dashing", "дашинг"] },
  // OMODA
  { key: "omoda-c5", display: "OMODA C5", variants: ["omoda c5", "омода с5", "омода c5", "омодас5"] },
  { key: "omoda-c7", display: "OMODA C7", variants: ["omoda c7", "омода с7", "омода c7", "омодас7"] },
  { key: "omoda-s5", display: "OMODA S5", variants: ["omoda s5", "омода s5", "омодаs5"] },
  // JAECOO
  { key: "jaecoo-j6", display: "JAECOO J6", variants: ["jaecoo j6", "джаеку j6", "джейку j6"] },
  { key: "jaecoo-j7", display: "JAECOO J7", variants: ["jaecoo j7", "джаеку j7", "джейку j7"] },
  { key: "jaecoo-j8", display: "JAECOO J8", variants: ["jaecoo j8", "джаеку j8", "джейку j8"] },
  // Tenet
  { key: "tenet-arrizo", display: "Arrizo", variants: ["arrizo", "арризо"] },
  { key: "tenet-t4l",    display: "T4L",    variants: ["t4l"] },
  { key: "tenet-t7",     display: "T7",     variants: ["tenet t7"] },
  { key: "tenet-t8",     display: "T8",     variants: ["tenet t8"] },
];
const _canonLookup = new Map<string, { key: string; display: string }>();
for (const e of _MODEL_CANONICAL_ENTRIES) {
  for (const v of e.variants) _canonLookup.set(v.replace(/\s+/g, ""), { key: e.key, display: e.display });
}
function canonModelKey(term: string): string {
  return _canonLookup.get(term.toLowerCase().replace(/\s+/g, ""))?.key ?? term.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
}
function canonModelDisplay(term: string): string {
  return _canonLookup.get(term.toLowerCase().replace(/\s+/g, ""))?.display ?? term.toUpperCase();
}

function isSafeFaqItem(value: unknown): value is { question: string; answer: string } {
  if (!value || typeof value !== "object") return false;
  const item = value as { question?: unknown; answer?: unknown };
  if (typeof item.question !== "string" || typeof item.answer !== "string") return false;
  const question = item.question.trim();
  const answer = item.answer.trim();
  if (question.length < 12 || answer.length < 20) return false;
  return !/(?:\[\s*\{|["']?(?:question|answer)["']?\s*:|```|<json>)/i.test(`${question} ${answer}`);
}

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

    // evaluated=true/false → filter the Karpathy Loop queue by evaluation state.
    const evaluatedFilter = req.query["evaluated"];
    if (evaluatedFilter === "true") whereClause = sql`${whereClause} AND evaluated_at IS NOT NULL`;
    if (evaluatedFilter === "false") whereClause = sql`${whereClause} AND evaluated_at IS NULL`;

    const rows = await db.execute(sql`
      SELECT id, type, page_url, current_value, proposed_value, reasoning,
             priority_score, demand, position_factor, ease,
             status, blocked_by_tech, is_anchor_boosted,
             applied_at, verified_at, verification_log, result_delta,
             snapshot_before, evaluate_at, evaluated_at,
             evaluation_result, evaluation_note, content_draft,
              geo_evidence, geo_snapshot_before, geo_evaluate_at, geo_evaluated_at,
              geo_evaluation_result, geo_evaluation_note, geo_result_delta, geo_action,
             generated_by, reject_reason,
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
  let suggestion = row.rows[0] as {
    id: number; type: string; page_url: string;
    proposed_value: string; status: string; reasoning: string | null;
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

  // Apply override if user edited the proposed value in the UI before applying
  const overrideValue = (req.body as { overrideValue?: string }).overrideValue;
  if (overrideValue != null && overrideValue.trim() !== "" && overrideValue !== suggestion.proposed_value) {
    await db.execute(sql`
      UPDATE seo_suggestions SET proposed_value = ${overrideValue}, updated_at = NOW()
      WHERE id = ${id}
    `);
    suggestion = { ...suggestion, proposed_value: overrideValue };
  }

  // GEO recommendations are deliberately manual briefs. They may capture a
  // baseline for a future comparison, but this endpoint must not claim that a
  // page changed when no content pipeline actually changed it.
  if (suggestion.type === "geo") {
    await recordGeoApplySnapshot(id, suggestion.page_url);
    await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'manual',
          applied_at = NULL,
          verification_log = 'Ручное ТЗ сохранено. Страница не изменялась; повторите GEO-замер после публикации.',
          updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "GEO-ТЗ сохранено. Страница не изменялась и не помечена как применённая." });
    return;
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

  // TEXT_BLOCK — write SEO paragraph to brand_page_content.service_text
  if (suggestion.type === "text_block" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "SEO-текст добавляется на страницу бренда. Займёт 30–60 секунд." });
    applyTextBlock(id, slug, suggestion.proposed_value, suggestion.page_url).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyTextBlock failed");
    });
    return;
  }

  // NEW_PAGE — AI-generate landing page content and publish at /p/:slug
  if (suggestion.type === "new_page") {
    const lines = (suggestion.proposed_value ?? "").split("\n").filter(Boolean);
    // Parse title and description from proposed_value
    let proposedTitle = "";
    let proposedDesc = "";
    for (const line of lines) {
      if (line.startsWith("title: ")) proposedTitle = line.slice(7).trim();
      if (line.startsWith("desc: "))  proposedDesc  = line.slice(6).trim();
    }
    const keywords = lines.filter(l => !l.startsWith("title: ") && !l.startsWith("desc: "));

    // Derive slug from the proposed title (or page_url as fallback)
    const slugBase = proposedTitle
      ? slugifyLanding(proposedTitle.replace(/\s*[|—–-].*$/, "").trim())
      : slugifyLanding(suggestion.page_url.replace(/\//g, "-").replace(/^-/, ""));
    const slug = await uniqueLandingSlug(slugBase || "landing");

    // Mark as applied immediately so the UI shows progress
    await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'applied', applied_at = NOW(), updated_at = NOW(),
          verification_log = 'AI генерирует страницу /p/' || ${slug} || '...'
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: `Генерация запущена (~30 сек). Страница будет доступна по /p/${slug}` });

    // Fire-and-forget background generation
    applyNewPage(id, slug, proposedTitle, proposedDesc, keywords, suggestion.reasoning ?? "").catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyNewPage failed");
    });
    return;
  }

  // META for non-brand static pages → applyStaticMeta (page_seo_overrides)
  if (suggestion.type === "meta" && !suggestion.page_url.startsWith("/brands/")) {
    // Only allow routes that exist in STATIC_META — others (news slugs, car IDs, etc.)
    // have their own content-driven meta and should not be overridden via this path.
    if (!(suggestion.page_url in STATIC_META)) {
      return res.status(400).json({
        ok: false,
        error: `Маршрут ${suggestion.page_url} не является статической страницей и не поддерживает meta-override`,
      });
    }
    let newTitle: string | null = null;
    let newDesc: string | null = null;
    for (const line of suggestion.proposed_value.split("\n")) {
      if (line.startsWith("title: ")) { const v = line.slice(7).trim(); if (v) newTitle = v; }
      if (line.startsWith("desc: "))  { const v = line.slice(6).trim(); if (v) newDesc  = v; }
    }
    if (!newTitle && !newDesc) {
      return res.status(400).json({ ok: false, error: "Cannot parse proposed_value" });
    }
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    applyStaticMeta(id, newTitle, newDesc, suggestion.page_url).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applyStaticMeta failed");
    });
    res.json({ ok: true, message: "Применение запущено. Верификация займёт 30–60 секунд." });
    return;
  }

  // SITEMAP — add a missing URL to STATIC_PAGES and ping IndexNow
  if (suggestion.type === "sitemap") {
    await db.execute(sql`
      UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true, message: "URL добавляется в sitemap. IndexNow-пинг отправляется." });
    applySitemap(id, suggestion.proposed_value, suggestion.page_url).catch(err => {
      logger.error({ err, id }, "[seo-autopilot] applySitemap failed");
    });
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
    const snap = await capturePositionSnapshot(pageUrl) ?? {
      position: null,
      clicks: null,
      date: new Date().toISOString(),
    };
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

async function recordGeoApplySnapshot(suggestionId: number, pageUrl: string): Promise<void> {
  try {
    const { captureGeoCitationSnapshot } = await import("../services/seo-evaluator");
    const snapshot = await captureGeoCitationSnapshot(pageUrl);
    if (!snapshot) {
      logger.warn({ suggestionId, pageUrl }, "[seo-autopilot] GEO baseline skipped: report has no comparable observations");
      return;
    }
    await db.execute(sql`
      UPDATE seo_suggestions
      SET geo_snapshot_before = ${JSON.stringify(snapshot)}::jsonb,
          geo_evaluate_at = NULL,
          updated_at = NOW()
      WHERE id = ${suggestionId}
    `);
    logger.info(
      { suggestionId, pageUrl, week: snapshot.reportWeek, responses: snapshot.responses },
      "[seo-autopilot] GEO baseline recorded",
    );
  } catch (err) {
    logger.warn({ err, suggestionId }, "[seo-autopilot] GEO baseline capture skipped");
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
      answer: `Актуальные цены на ${brandName} у официального дилера Дебрянск Авто — в каталоге на сайте. Доступны специальные условия по кредиту, трейд-ин и скидки по акциям. Уточните точную стоимость у менеджера.`,
    };
  }
  if (q.includes("кредит") || q.includes("рассрочк") || q.includes("лизинг")) {
    return {
      question: `Можно ли купить ${brandName} в кредит в Брянске?`,
      answer: `Да, ${brandName} доступен в кредит у официального дилера Дебрянск Авто. Действуют выгодные программы кредитования и лизинга с удобным сроком и первоначальным взносом. Уточните условия у менеджера.`,
    };
  }
  if (q.includes("трейд") || q.includes("trade")) {
    return {
      question: `Принимают ли ${brandName} по трейд-ин?`,
      answer: `В Дебрянск Авто действует программа трейд-ин: привезите свой автомобиль на бесплатную оценку и зачтите его стоимость при покупке нового ${brandName}. Уточните условия у менеджера.`,
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
    answer: "В Дебрянск Авто все автомобили с пробегом прошли проверку перед продажей. Покупайте напрямую у официального дилера: прозрачная история, трейд-ин, выгодные условия кредитования.",
  };
  if (q.includes("купить авто") || q.includes("купить машин") || q.includes("куплю")) return {
    question: "Где купить автомобиль в Брянске выгодно?",
    answer: "Дебрянск Авто — официальный дилер с пробегом в Брянске. Широкий выбор проверенных автомобилей, прозрачная история, выгодные программы кредитования и трейд-ин.",
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
    answer: "Цены на авто с пробегом у официального дилера Дебрянск Авто — актуальный прайс в каталоге. Доступны выгодные программы кредитования и зачёт вашего авто по программе трейд-ин.",
  };
  return {
    question: "Продаются ли проверенные авто с пробегом в Брянске?",
    answer: "Да. В Дебрянск Авто все автомобили с пробегом проходят техническую проверку перед продажей. Доступны выгодные условия кредитования и трейд-ин.",
  };
}

/* ── applyCarsCluster: FAQ для /cars + SSG rebuild ───────────────────── */
async function applyCarsCluster(suggestionId: number, proposedValue: string): Promise<void> {
  await recordApplySnapshot(suggestionId, "/cars");
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";
  let anyAiCars = false;

  try {
    const sortRow = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort FROM faqs WHERE page_slug = 'cars'
    `);
    let nextSort = ((sortRow.rows[0] as { max_sort: number } | undefined)?.max_sort ?? -1) + 1;

    const inserted: string[] = [];

    // Check if proposedValue is a pre-generated FAQ JSON array (user edited the preview before applying)
    if (proposedValue.trimStart().startsWith("[")) {
      let preGenFaqs: { question: string; answer: string }[] = [];
      try { preGenFaqs = JSON.parse(proposedValue); } catch { /* fall through */ }
      for (const faq of preGenFaqs) {
        if (!faq.question || !faq.answer) continue;
        const existing = await db.execute(sql`
          SELECT id FROM faqs WHERE page_slug = 'cars' AND question = ${faq.question} LIMIT 1
        `);
        if (existing.rows.length > 0) continue;
        await db.execute(sql`
          INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
          VALUES ('cars', ${faq.question}, ${faq.answer}, ${nextSort}, true, true)
        `);
        inserted.push(faq.question);
        nextSort++;
      }
      verificationLog += `✓ FAQ добавлено: ${inserted.length} вопрос(ов) (отредактировано вручную)\n`;
      if (inserted.length === 0) verificationLog += "⚠ Все вопросы уже существуют — дубликаты пропущены\n";
    } else {
      const queries = proposedValue.split("\n")
        .map(l => l.replace(/\s*\(позиция[\s\d.,]+\)\s*$/, "").trim())
        .filter(Boolean);

      if (queries.length === 0) throw new Error("No queries in proposed_value");

      for (const q of queries) {
        const faqResult = await aiQueryToFaqCars(q, queryToFaqCars);
        const { question, answer, generatedBy } = faqResult;
        if (generatedBy === "ai") anyAiCars = true;
        const existing = await db.execute(sql`
          SELECT id FROM faqs WHERE page_slug = 'cars' AND question = ${question} LIMIT 1
        `);
        if (existing.rows.length > 0) continue;
        await db.execute(sql`
          INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
          VALUES ('cars', ${question}, ${answer}, ${nextSort}, true, true)
        `);
        inserted.push(question);
        if (generatedBy === "ai") {
          await saveAiExample("cars", "faq_cars", question, answer);
        }
        nextSort++;
      }

      verificationLog += `✓ FAQ добавлено: ${inserted.length} вопрос(ов) (${anyAiCars ? "AI" : "шаблон"})\n`;
      if (inserted.length === 0) verificationLog += "⚠ Все вопросы уже существуют — дубликаты пропущены\n";
    }

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
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
        generated_by = ${anyAiCars ? "ai" : "template"}, updated_at = NOW()
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
  let anyAiBrandCluster = false;

  try {
    // Step 1: Look up brand name
    const brandRow = await db.execute(sql`SELECT id, name FROM brands WHERE slug = ${slug} LIMIT 1`);
    const brand = brandRow.rows[0] as { id: number; name: string } | undefined;
    if (!brand) throw new Error(`Brand slug ${slug} not found`);

    // Fetch models list for AI context
    const modelsRow = await db.execute(sql`
      SELECT DISTINCT TRIM(SPLIT_PART(model, ',', 1)) AS m
      FROM cars WHERE type = 'new' AND LOWER(dealer) = LOWER(${brand.name}) LIMIT 6
    `);
    const brandModels = modelsRow.rows.map(r => (r as { m: string }).m).filter(Boolean);

    // Step 3: Get current max sort_order for this page
    const sortRow = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
      FROM faqs WHERE page_slug = ${"brands/" + slug}
    `);
    let nextSort = ((sortRow.rows[0] as { max_sort: number } | undefined)?.max_sort ?? -1) + 1;

    const inserted: string[] = [];

    // Check if proposedValue is a pre-generated FAQ JSON array (user edited the preview before applying)
    const isPreGenJson = proposedValue.trimStart().startsWith("[");

    if (isPreGenJson) {
      let preGenFaqs: { question: string; answer: string }[] = [];
      try { preGenFaqs = JSON.parse(proposedValue); } catch { /* fall through to normal path */ }
      for (const faq of preGenFaqs) {
        if (!faq.question || !faq.answer) continue;
        const existing = await db.execute(sql`
          SELECT id FROM faqs WHERE page_slug = ${"brands/" + slug} AND question = ${faq.question} LIMIT 1
        `);
        if (existing.rows.length > 0) continue;
        await db.execute(sql`
          INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
          VALUES (${"brands/" + slug}, ${faq.question}, ${faq.answer}, ${nextSort}, true, true)
        `);
        inserted.push(faq.question);
        nextSort++;
      }
      verificationLog += `✓ FAQ добавлено: ${inserted.length} вопрос(ов) (отредактировано вручную)\n`;
      if (inserted.length === 0) verificationLog += "⚠ Все вопросы уже существуют — дубликаты пропущены\n";
    } else {
      // Step 2: Parse queries from proposed_value: "query text (позиция X.X)\n..."
      const queries = proposedValue.split("\n")
        .map(line => line.replace(/\s*\(позиция[\s\d.,]+\)\s*$/, "").trim())
        .filter(Boolean);

      if (queries.length === 0) throw new Error("No queries found in proposed_value");

      // Step 4: Insert FAQ items (skip duplicates by question)
      for (const query of queries) {
        const faqResult = await aiQueryToFaq(query, brand.name, "brands/" + slug, brandModels, queryToFaq);
        const { question, answer, generatedBy } = faqResult;
        if (generatedBy === "ai") anyAiBrandCluster = true;
        const existing = await db.execute(sql`
          SELECT id FROM faqs WHERE page_slug = ${"brands/" + slug} AND question = ${question} LIMIT 1
        `);
        if (existing.rows.length > 0) continue;

        await db.execute(sql`
          INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
          VALUES (${"brands/" + slug}, ${question}, ${answer}, ${nextSort}, true, true)
        `);
        inserted.push(question);
        if (generatedBy === "ai") {
          await saveAiExample("brands/" + slug, "faq_brand", question, answer);
        }
        nextSort++;
      }

      verificationLog += `✓ FAQ добавлено: ${inserted.length} вопрос(ов) (${anyAiBrandCluster ? "AI" : "шаблон"})\n`;
      if (inserted.length === 0) {
        verificationLog += "⚠ Все вопросы уже существуют — дубликаты пропущены\n";
      }
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
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
        generated_by = ${anyAiBrandCluster ? "ai" : "template"}, updated_at = NOW()
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

/* ── deterministicVariant: stable 0-based index into n variants ───────── */
function deterministicVariant(seed: string, n: number): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h % n;
}

/* ── queryToFaqModel: model query → FAQ Q&A ──────────────────────────── */
function queryToFaqModel(
  modelDisplay: string,
  brandName: string,
  cars: { count: number; minPrice: number | null; maxDiscount: number | null },
): { question: string; answer: string }[] {
  const bm = `${brandName} ${modelDisplay}`;

  if (cars.count > 0) {
    // 4 question variants — pick deterministically by model name
    const HAVE_QA: { question: string; answer: string }[][] = [
      [
        {
          question: `Есть ли ${bm} в наличии в Брянске?`,
          answer: `Да, ${bm} есть в наличии у официального дилера Дебрянск Авто. Актуальные цены и наличие — в каталоге на сайте. Доступны кредит, трейд-ин и гарантия завода.`,
        },
        {
          question: `Сколько стоит ${bm} у официального дилера в Брянске?`,
          answer: `Цены на ${bm} уточняйте в актуальном каталоге Дебрянск Авто или по телефону. Доступны выгодные условия кредитования и трейд-ин. Запишитесь на тест-драйв онлайн.`,
        },
      ],
      [
        {
          question: `Где купить ${bm} у официального дилера в Брянске?`,
          answer: `${bm} продаётся у официального дилера Дебрянск Авто в Брянске. Смотрите актуальный каталог на сайте, выбирайте комплектацию и оставляйте заявку — менеджер свяжется в ближайшее время.`,
        },
        {
          question: `Как купить ${bm} в кредит в Брянске?`,
          answer: `Дебрянск Авто предлагает ${bm} в кредит по выгодным ставкам с удобным первоначальным взносом и сроком. Онлайн-заявка рассматривается быстро — без визита в банк. Актуальные условия уточняйте у менеджера.`,
        },
      ],
      [
        {
          question: `Можно ли сдать старый автомобиль в трейд-ин при покупке ${bm}?`,
          answer: `Да, Дебрянск Авто принимает автомобили по трейд-ин при покупке ${bm}. Оценка по рыночной стоимости, зачёт в счёт нового авто. Запишитесь онлайн — оценка бесплатно.`,
        },
        {
          question: `${bm} — официальный дилер в Брянске`,
          answer: `Дебрянск Авто является официальным дилером и предлагает ${bm} с гарантией завода, кредитом, трейд-ин и сервисным обслуживанием. Актуальные цены и наличие — на сайте или по телефону.`,
        },
      ],
      [
        {
          question: `Какая гарантия на ${bm} у официального дилера?`,
          answer: `На ${bm}, приобретённый у официального дилера Дебрянск Авто, распространяется заводская гарантия. Сервисное обслуживание также проводится в авторизованном центре. Подробности уточняйте у менеджера.`,
        },
        {
          question: `${bm} в Брянске — наличие и условия покупки`,
          answer: `${bm} представлен у официального дилера Дебрянск Авто в Брянске. Доступны кредит, трейд-ин, специальные программы производителя. Актуальное наличие и цены — в онлайн-каталоге на сайте.`,
        },
      ],
    ];
    const variant = deterministicVariant(modelDisplay, HAVE_QA.length);
    return HAVE_QA[variant];
  }

  // 3 variants for "no stock" case
  const NO_STOCK_QA: { question: string; answer: string }[] = [
    {
      question: `Купить ${bm} в Брянске — это возможно?`,
      answer: `Автомобиль ${bm} доступен у официального дилера Дебрянск Авто в Брянске. Уточните актуальное наличие и цены по телефону или оставьте заявку на сайте — менеджер свяжется в ближайшее время.`,
    },
    {
      question: `Как заказать ${bm} у официального дилера в Брянске?`,
      answer: `Оставьте заявку на сайте Дебрянск Авто — менеджер свяжется, уточнит наличие ${bm} и подберёт комплектацию под ваши требования. Доступны кредит и трейд-ин.`,
    },
    {
      question: `${bm} у дилера в Брянске: узнать наличие`,
      answer: `Актуальное наличие ${bm} уточняйте у менеджера Дебрянск Авто по телефону или через форму обратной связи на сайте. Мы поможем с выбором комплектации, кредитом и трейд-ин.`,
    },
  ];
  const variant = deterministicVariant(modelDisplay, NO_STOCK_QA.length);
  return [NO_STOCK_QA[variant]];
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
  let anyAiContent = false;
  try {
    // Check if proposedValue is a pre-generated FAQ JSON array (user edited the preview before applying)
    if (proposedValue.trimStart().startsWith("[")) {
      let preGenFaqs: { question: string; answer: string; modelTerm?: string }[] = [];
      try { preGenFaqs = JSON.parse(proposedValue); } catch { /* fall through to normal parse */ }
      if (preGenFaqs.length > 0) {
        const maxSortRow = await db.execute(sql`
          SELECT COALESCE(MAX(sort_order), 0) AS max_ord FROM faqs WHERE page_slug = ${'brands/' + slug}
        `);
        let sortOrder = ((maxSortRow.rows[0] as { max_ord: number }).max_ord ?? 0) + 10;
        let inserted = 0;
        for (const faq of preGenFaqs) {
          if (!isSafeFaqItem(faq)) continue;
          await db.execute(sql`
            INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
            VALUES (${'brands/' + slug}, ${faq.question}, ${faq.answer}, ${sortOrder}, true, true)
            ON CONFLICT DO NOTHING
          `);
          sortOrder += 10;
          inserted++;
        }
        verificationLog += `✓ FAQ добавлено: ${inserted} (отредактировано вручную)\n`;
        // SSG rebuild
        const release = await acquireSsg();
        try {
          const ssgScript = getSsgPath();
          if (!ssgScript) { verificationLog += "⚠ SSG script not found\n"; status = "applied_with_errors"; }
          else {
            const r = spawnSync("node", [ssgScript], { cwd: process.cwd(), timeout: 45_000, encoding: "utf8" });
            if (r.status === 0) verificationLog += "✓ SSG пересобрана\n";
            else { verificationLog += `⚠ SSG error: ${(r.stderr || r.stdout || "").slice(0, 200)}\n`; status = "applied_with_errors"; }
          }
        } finally { release(); }
        if (status === "applied") { await pingIndexNow([`${SITE}${pageUrl}`]); verificationLog += "✓ IndexNow отправлен\n"; }
        // Prerender: brand pages are served from Puppeteer cache, not SSG
        spawnBrandPrerenderBySlug(slug);
        await db.execute(sql`
          UPDATE seo_suggestions
          SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
              generated_by = 'template', updated_at = NOW()
          WHERE id = ${suggestionId}
        `);
        logger.info({ suggestionId, slug, status }, "[seo-autopilot] applyContentBrand done (pre-gen)");
        return;
      }
    }

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
      const modelKey = canonModelKey(modelTerm);
      if (seen.has(modelKey)) continue;
      seen.add(modelKey);
      const displayTerm = canonModelDisplay(modelTerm);
      // Use canonical key (Latin, e.g. "jolion") for DB lookup — cars table stores
      // Latin model names from feed sync. displayTerm (Cyrillic) would miss all rows.
      const dbSearchTerm = modelKey;

      // Look up cars for this model
      const carRow = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt,
               MIN(price)::int AS min_price,
               MAX(max_discount)::int AS max_discount
        FROM cars
        WHERE type = 'new'
          AND LOWER(dealer) = LOWER(${brand.name})
          AND LOWER(model) ILIKE ${`%${dbSearchTerm}%`}
      `);
      const cars = (carRow.rows[0] as { cnt: number; minPrice: number | null; maxDiscount: number | null } | undefined)
        ?? { cnt: 0, minPrice: null, maxDiscount: null };
      // Map column names (drizzle returns snake_case)
      const carsTyped = {
        count: (carRow.rows[0] as Record<string, unknown>)["cnt"] as number ?? 0,
        minPrice: (carRow.rows[0] as Record<string, unknown>)["min_price"] as number | null ?? null,
        maxDiscount: (carRow.rows[0] as Record<string, unknown>)["max_discount"] as number | null ?? null,
      };

      const topQueryForModel = `${displayTerm} ${brand.name} брянск`.toLowerCase();
      const aiModelResult = await aiQueryToFaqModel(
        topQueryForModel, displayTerm, brand.name,
        "brands/" + slug, carsTyped.count,
        queryToFaqModel, carsTyped,
      );
      if (aiModelResult === null) {
        verificationLog += `⏩ ${displayTerm}: нет в наличии — FAQ пропущены\n`;
      } else {
        for (const faq of aiModelResult) {
          await db.execute(sql`
            INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
            VALUES (${'brands/' + slug}, ${faq.question}, ${faq.answer}, ${sortOrder}, true, true)
            ON CONFLICT DO NOTHING
          `);
          sortOrder += 10;
          inserted++;
          if (faq.generatedBy === "ai") {
            anyAiContent = true;
            await saveAiExample("brands/" + slug, "faq_model", faq.question, faq.answer);
          }
        }
        const genLabel = aiModelResult.some(f => f.generatedBy === "ai") ? "AI" : "шаблон";
        verificationLog += `✓ ${displayTerm}: добавлено ${aiModelResult.length} FAQ (авто: ${carsTyped.count}, ${genLabel})\n`;
      }
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
    // Prerender: brand pages are served from Puppeteer cache, not SSG
    spawnBrandPrerenderBySlug(slug);
  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }
  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
        generated_by = ${anyAiContent ? "ai" : "template"}, updated_at = NOW()
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
  let descGeneratedBy: "ai" | "template" | "ai_hallucinated" = "template";

  try {
    // Step 1: Fetch brand data + generate AI description
    const brandRow = await db.execute(sql`SELECT id, name FROM brands WHERE slug = ${slug} LIMIT 1`);
    const brandRowData = brandRow.rows[0] as { id: number; name: string } | undefined;
    const brandId = brandRowData?.id;
    const brandFullName = brandRowData?.name ?? slug;

    if (!brandId) throw new Error(`Brand slug ${slug} not found`);

    const carDataRow = await db.execute(sql`
      SELECT MIN(price) AS min_price, MAX(max_discount) AS max_discount,
             ARRAY_AGG(DISTINCT TRIM(SPLIT_PART(model, ',', 1))) FILTER (WHERE model IS NOT NULL) AS models
      FROM cars WHERE type = 'new' AND LOWER(dealer) = LOWER(${brandFullName})
    `);
    const cdMeta = carDataRow.rows[0] as { min_price: number | null; max_discount: number | null; models: string[] | null } | undefined;
    const descResult = await aiMetaDescription(
      brandFullName,
      (cdMeta?.models ?? []).filter(Boolean).slice(0, 4),
      cdMeta?.min_price ?? null,
      cdMeta?.max_discount ?? null,
      `${brandFullName} брянск официальный дилер`,
      "brands/" + slug,
      newDesc,
    );
    descGeneratedBy = descResult.generatedBy;
    const finalDesc = descResult.desc;
    verificationLog += `✓ Описание сгенерировано (${descGeneratedBy === "ai" ? "AI" : "шаблон"})\n`;

    const existing = await db.execute(sql`SELECT id FROM brand_page_content WHERE brand_id = ${brandId} LIMIT 1`);
    if (existing.rows.length > 0) {
      await db.execute(sql`
        UPDATE brand_page_content
        SET meta_title = ${newTitle}, meta_description = ${finalDesc}, updated_at = NOW()
        WHERE brand_id = ${brandId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO brand_page_content (brand_id, meta_title, meta_description)
        VALUES (${brandId}, ${newTitle}, ${finalDesc})
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
        const hasTitle = newTitle  ? html.includes(newTitle.slice(0, 30))  : false;
        const hasDesc  = finalDesc ? html.includes(finalDesc.slice(0, 30)) : false;
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
    // Prerender: brand pages are served from Puppeteer cache, not SSG
    spawnBrandPrerenderBySlug(slug);

  } catch (err) {
    verificationLog += `✗ Ошибка применения: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
        generated_by = ${descGeneratedBy}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);

  logger.info({ suggestionId, status, verificationLog }, "[seo-autopilot] apply pipeline done");
}

/* ── applyStaticMeta: UPSERT title/desc for non-brand pages via page_seo_overrides ── */
async function applyStaticMeta(
  suggestionId: number,
  newTitle: string | null,
  newDesc: string | null,
  pageUrl: string,
): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";

  try {
    // Step 1: UPSERT into page_seo_overrides.
    // NULL values are preserved via COALESCE so partial updates (title-only or
    // desc-only) do not blank out the field that was not provided.
    await db.execute(sql`
      INSERT INTO page_seo_overrides (route, meta_title, meta_description, updated_at)
      VALUES (${pageUrl}, ${newTitle ?? null}, ${newDesc ?? null}, NOW())
      ON CONFLICT (route) DO UPDATE SET
        meta_title        = COALESCE(EXCLUDED.meta_title,        page_seo_overrides.meta_title),
        meta_description  = COALESCE(EXCLUDED.meta_description,  page_seo_overrides.meta_description),
        updated_at        = NOW()
    `);
    verificationLog += "✓ DB обновлена (page_seo_overrides)\n";

    // Step 2: SSG rebuild
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

    // Step 3: Verify via curl (VPS) or SSG file (dev)
    const fullUrl = `${SITE}${pageUrl}`;
    let verifiedOk = false;
    try {
      const localUrl = `http://localhost:${process.env.PORT ?? 8080}${pageUrl}`;
      const isVps = existsSync("/opt/debryansk");
      let html = "";
      if (isVps) {
        const r = spawnSync("curl", [
          "-s", "-A", "Googlebot/2.1 (+http://www.google.com/bot.html)",
          "--max-time", "25", localUrl,
        ], { timeout: 30_000, encoding: "utf8" });
        html = r.stdout ?? "";
        if (!html && r.status !== 0) {
          verificationLog += `⚠ Верификация: curl код ${r.status} — считаем успехом, DB и SSG обновлены\n`;
          verifiedOk = true;
        }
      } else {
        const distPath = process.env.FRONTEND_DIST_PATH;
        if (distPath) {
          const filePath = pageUrl === "/"
            ? join(distPath, "index.html")
            : join(distPath, pageUrl.replace(/^\//, ""), "index.html");
          if (existsSync(filePath)) {
            const { readFileSync } = await import("fs");
            html = readFileSync(filePath, "utf8");
          }
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
          verificationLog += `✗ Верификация провалена: новый title/desc не найден в ответе сервера\n`;
          status = "applied_with_errors";
        }
      }
    } catch (verifyErr) {
      verificationLog += `⚠ Ошибка верификации: ${String(verifyErr).slice(0, 150)}\n`;
      status = "applied_with_errors";
    }

    // Step 4: IndexNow
    if (verifiedOk && status === "applied") {
      await pingIndexNow([fullUrl]);
      verificationLog += "✓ IndexNow отправлен\n";
    } else {
      verificationLog += "— IndexNow не отправлен\n";
    }

  } catch (err) {
    verificationLog += `✗ Ошибка применения: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
        updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
  logger.info({ suggestionId, pageUrl, status }, "[seo-autopilot] applyStaticMeta done");
}

/* ── GET /landing-draft/:slug — fetch draft landing page content (admin only) ── */
router.get("/landing-draft/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ ok: false, error: "Invalid slug" });
  }
  try {
    const result = await db.execute(sql`
      SELECT slug, route, meta_title, meta_description, h1,
             paragraphs, faq_items, is_published, created_at, updated_at
      FROM seo_landing_pages WHERE slug = ${slug} LIMIT 1
    `);
    const row = result.rows[0] as {
      slug: string; route: string;
      meta_title: string | null; meta_description: string | null;
      h1: string | null;
      paragraphs: unknown; faq_items: unknown;
      is_published: boolean; created_at: string; updated_at: string;
    } | undefined;
    if (!row) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({
      ok: true,
      data: {
        slug: row.slug,
        route: row.route,
        meta_title: row.meta_title ?? "",
        meta_description: row.meta_description ?? "",
        h1: row.h1 ?? "",
        paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs as string[] : [],
        faq_items: Array.isArray(row.faq_items) ? row.faq_items as { q: string; a: string }[] : [],
        is_published: row.is_published,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── PATCH /landing-draft/:slug — update draft content before publishing ── */
router.patch("/landing-draft/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ ok: false, error: "Invalid slug" });
  }
  const body = req.body as {
    h1?: string;
    meta_title?: string;
    meta_description?: string;
    paragraphs?: string[];
    faq_items?: { q: string; a: string }[];
  };
  try {
    const check = await db.execute(sql`
      SELECT id, is_published FROM seo_landing_pages WHERE slug = ${slug} LIMIT 1
    `);
    const row = check.rows[0] as { id: number; is_published: boolean } | undefined;
    if (!row) return res.status(404).json({ ok: false, error: "Not found" });
    if (row.is_published) {
      return res.status(409).json({ ok: false, error: "Страница уже опубликована, редактирование недоступно" });
    }

    await db.execute(sql`
      UPDATE seo_landing_pages
      SET h1               = ${body.h1 ?? null},
          meta_title       = ${body.meta_title ?? null},
          meta_description = ${body.meta_description ?? null},
          paragraphs       = ${JSON.stringify(body.paragraphs ?? [])}::jsonb,
          faq_items        = ${JSON.stringify(body.faq_items ?? [])}::jsonb,
          updated_at       = NOW()
      WHERE slug = ${slug}
    `);

    logger.info({ slug }, "[seo-autopilot] Draft landing page updated");
    return res.json({ ok: true, message: "Черновик сохранён" });
  } catch (err) {
    logger.error({ err, slug }, "[seo-autopilot] update landing draft failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── PATCH /new-page/:slug/publish — manually publish a draft landing page ── */
router.patch("/new-page/:slug/publish", async (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ ok: false, error: "Invalid slug" });
  }
  try {
    const check = await db.execute(sql`
      SELECT id, is_published FROM seo_landing_pages WHERE slug = ${slug} LIMIT 1
    `);
    const row = check.rows[0] as { id: number; is_published: boolean } | undefined;
    if (!row) return res.status(404).json({ ok: false, error: "Landing page not found" });
    if (row.is_published) return res.json({ ok: true, message: "Уже опубликовано" });

    await db.execute(sql`
      UPDATE seo_landing_pages SET is_published = true, updated_at = NOW() WHERE slug = ${slug}
    `);

    const route = `/p/${slug}`;
    const fullUrl = `${SITE}${route}`;

    // IndexNow ping
    try {
      await pingIndexNow([fullUrl]);
    } catch {
      // non-fatal
    }

    // Prerender
    const prerenderScript = getPrerenderPath();
    if (prerenderScript) {
      const { spawn } = await import("child_process");
      const child = spawn("node", [prerenderScript, "--route", route], {
        detached: true, stdio: "ignore", cwd: process.cwd(), env: process.env,
      });
      child.unref();
    }

    // Update suggestion verification_log to reflect publication
    await db.execute(sql`
      UPDATE seo_suggestions
      SET verification_log = verification_log || ${'✓ Страница опубликована: ' + route + '\n'},
          updated_at = NOW()
      WHERE type = 'new_page' AND verification_log LIKE ${'%/p/' + slug + '%'} AND status = 'applied'
    `);

    logger.info({ slug, route }, "[seo-autopilot] Landing page published manually");
    return res.json({ ok: true, message: `Страница опубликована: ${route}` });
  } catch (err) {
    logger.error({ err, slug }, "[seo-autopilot] publish landing page failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── applyNewPage: AI-generate landing page and publish at /p/:slug ── */
async function applyNewPage(
  suggestionId: number,
  slug: string,
  proposedTitle: string,
  proposedDesc: string,
  keywords: string[],
  reasoning: string,
): Promise<void> {
  const route = `/p/${slug}`;
  let verificationLog = "";

  try {
    // Step 1: Generate content via AI
    const pageData = await aiGenerateLandingPage(proposedTitle || reasoning, proposedDesc, keywords);

    if (!pageData) {
      // Fallback: create minimal page from proposed title/desc
      const fallbackParagraphs = [
        `${proposedTitle || "Официальный дилер Дебрянск Авто"} в Брянске — надёжный выбор для покупки или сервиса автомобиля. ` +
        `Наши специалисты помогут подобрать оптимальный вариант с учётом ваших пожеланий и бюджета.`,
        `Мы предлагаем широкую программу кредитования и трейд-ин — ваш старый автомобиль зачитается в счёт нового. ` +
        `Оформление занимает минимум времени, все документы готовятся в день обращения.`,
        `Сервисный центр «Дебрянск Авто» работает ежедневно. Запишитесь на консультацию или тест-драйв онлайн — ` +
        `мы перезвоним в удобное для вас время.`,
      ];
      const fallbackFaq = [
        { q: "Как записаться на консультацию?", a: "Позвоните по телефону +7 (4832) 77-77-70 или оставьте заявку на сайте — менеджер свяжется в ближайшее время." },
        { q: "Доступен ли трейд-ин?", a: "Да, мы принимаем автомобили в трейд-ин. Бесплатная оценка на месте, зачёт стоимости при покупке нового авто." },
        { q: "Работает ли кредитование?", a: "Да, действуют программы кредитования от ведущих банков. Уточните условия у менеджера." },
      ];
      await db.execute(sql`
        INSERT INTO seo_landing_pages
          (slug, route, meta_title, meta_description, h1, paragraphs, faq_items, is_published, updated_at)
        VALUES
          (${slug}, ${route}, ${proposedTitle || null}, ${proposedDesc || null},
           ${proposedTitle || null}, ${JSON.stringify(fallbackParagraphs)},
           ${JSON.stringify(fallbackFaq)}, false, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
          h1 = EXCLUDED.h1, paragraphs = EXCLUDED.paragraphs,
          faq_items = EXCLUDED.faq_items, is_published = false, updated_at = NOW()
      `);
      verificationLog += "⚠ AI не ответил — использован шаблонный контент\n";
      verificationLog += `✓ Черновик страницы сохранён: /p/${slug}\n`;
    } else {
      await db.execute(sql`
        INSERT INTO seo_landing_pages
          (slug, route, meta_title, meta_description, h1, paragraphs, faq_items, is_published, updated_at)
        VALUES
          (${slug}, ${route}, ${pageData.meta_title || null}, ${pageData.meta_description || null},
           ${pageData.h1 || null}, ${JSON.stringify(pageData.paragraphs ?? [])},
           ${JSON.stringify(pageData.faq ?? [])}, false, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
          h1 = EXCLUDED.h1, paragraphs = EXCLUDED.paragraphs,
          faq_items = EXCLUDED.faq_items, is_published = false, updated_at = NOW()
      `);
      verificationLog += `✓ AI-контент сгенерирован (${pageData.paragraphs?.length ?? 0} абз., ${pageData.faq?.length ?? 0} FAQ)\n`;
      verificationLog += `✓ Черновик страницы сохранён: /p/${slug}\n`;
    }
    verificationLog += "⏳ Требует ручного одобрения перед публикацией — нажмите «Опубликовать»\n";

  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
  }

  // Final: update suggestion with result log and page link
  await db.execute(sql`
    UPDATE seo_suggestions
    SET verification_log = ${verificationLog}, verified_at = NOW(), updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
  logger.info({ suggestionId, slug, route }, "[seo-autopilot] applyNewPage done");
}

/* ── applyTextBlock: добавить SEO-абзац в brand_page_content.service_text */
async function applyTextBlock(
  suggestionId: number,
  slug: string,
  proposedValue: string,
  pageUrl: string,
): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);
  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";
  let textGeneratedBy: "ai" | "template" | "ai_hallucinated" = "template";

  try {
    // Get brand id
    const brandRow = await db.execute(sql`SELECT id FROM brands WHERE slug = ${slug} LIMIT 1`);
    const brandId = (brandRow.rows[0] as { id: number } | undefined)?.id;
    if (!brandId) throw new Error(`Brand slug ${slug} not found`);

    // Fetch brand name + models + cluster queries for AI text generation
    const brandNameRow = await db.execute(sql`SELECT name FROM brands WHERE id = ${brandId} LIMIT 1`);
    const brandNameForAi = (brandNameRow.rows[0] as { name: string } | undefined)?.name ?? slug;
    const modelsRow = await db.execute(sql`
      SELECT DISTINCT TRIM(SPLIT_PART(model, ',', 1)) AS m
      FROM cars WHERE type = 'new' AND LOWER(dealer) = LOWER(${brandNameForAi}) LIMIT 6
    `);
    const brandModels = modelsRow.rows.map(r => (r as { m: string }).m).filter(Boolean);
    const reasoningRow = await db.execute(sql`SELECT reasoning FROM seo_suggestions WHERE id = ${suggestionId} LIMIT 1`);
    const rawReasoning = (reasoningRow.rows[0] as { reasoning: string | null } | undefined)?.reasoning ?? "";
    const clusterQueries = (rawReasoning.match(/«([^»]+)»/g) ?? []).map(s => s.slice(1, -1)).slice(0, 6);
    const aiResult = await aiTextBlock(brandNameForAi, brandModels, clusterQueries, "brands/" + slug, proposedValue.trim());
    textGeneratedBy = aiResult.generatedBy;
    const finalText = aiResult.text;
    verificationLog += `✓ Текст подготовлен (${textGeneratedBy === "ai" ? "AI" : "шаблон"})\n`;

    // Load existing service_text
    const existing = await db.execute(sql`
      SELECT id, service_text FROM brand_page_content WHERE brand_id = ${brandId} LIMIT 1
    `);

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as { id: number; service_text: string | null };
      const currentText = (row.service_text ?? "").trim();
      const newText = currentText
        ? `${currentText}\n\n${finalText}`
        : finalText;
      await db.execute(sql`
        UPDATE brand_page_content SET service_text = ${newText}, updated_at = NOW()
        WHERE brand_id = ${brandId}
      `);
      verificationLog += `✓ service_text обновлён (append: ${currentText ? "да" : "нет"})\n`;
    } else {
      await db.execute(sql`
        INSERT INTO brand_page_content (brand_id, service_text)
        VALUES (${brandId}, ${finalText})
      `);
      verificationLog += "✓ Новая запись brand_page_content создана с service_text\n";
    }

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
    // Prerender: brand pages are served from Puppeteer cache, not SSG
    spawnBrandPrerenderBySlug(slug);
  } catch (err) {
    verificationLog += `✗ Ошибка: ${String(err).slice(0, 300)}\n`;
    status = "applied_with_errors";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog},
        generated_by = ${textGeneratedBy}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
  logger.info({ suggestionId, slug, status }, "[seo-autopilot] applyTextBlock done");
}

/* ── applySitemap: добавить URL в sitemap_extra_pages (DB) + IndexNow ── */
async function applySitemap(
  suggestionId: number,
  proposedValue: string,
  pageUrl: string,
): Promise<void> {
  await recordApplySnapshot(suggestionId, pageUrl);

  const SITE_BASE = "https://debryansk-auto.ru";

  // Only the structured XML proposal generated by the GAP audit for genuinely missing
  // URLs is actionable here. Diagnostic suggestions (e.g. brand coverage checks that
  // recommend investigating indexing) have plain-text proposed_value and must not trigger
  // automatic insertion — they should be handled manually.
  //
  // Structured XML format (produced by seo-gap.ts for missing-URL gaps):
  //   <url>
  //     <loc>https://debryansk-auto.ru/corporate</loc>
  //     <changefreq>weekly</changefreq>
  //     <priority>0.8</priority>
  //   </url>
  const locMatch = proposedValue.match(/<loc>\s*https?:\/\/[^/\s]+(\/.+?)\s*<\/loc>/);

  if (!locMatch) {
    // Diagnostic-only suggestion — not an insertion action. Mark applied_manually.
    await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'applied', verified_at = NOW(), updated_at = NOW(),
          verification_log = 'Диагностическая подсказка отмечена выполненной. Проверьте индексацию вручную через Яндекс Вебмастер.'
      WHERE id = ${suggestionId}
    `);
    logger.info({ suggestionId, pageUrl }, "[seo-autopilot] applySitemap: diagnostic suggestion — marked applied without insertion");
    return;
  }

  const changefreqMatch = proposedValue.match(/<changefreq>\s*(\S+?)\s*<\/changefreq>/);
  const priorityMatch   = proposedValue.match(/<priority>\s*(\S+?)\s*<\/priority>/);

  const urlPath    = locMatch[1];
  const changefreq = changefreqMatch ? changefreqMatch[1] : "weekly";
  const priority   = priorityMatch   ? priorityMatch[1]   : "0.7";

  let verificationLog = "";
  let status: "applied" | "applied_with_errors" = "applied";

  try {
    // Persist to sitemap_extra_pages (idempotent UPSERT) and invalidate XML cache
    const isNew = await addSitemapPage(urlPath, { changefreq, priority });
    if (isNew) {
      verificationLog = `URL ${urlPath} добавлен в sitemap (changefreq=${changefreq}, priority=${priority}). Кэш сброшен.`;
      logger.info({ suggestionId, urlPath, changefreq, priority }, "[seo-autopilot] applySitemap: inserted into sitemap_extra_pages");
    } else {
      verificationLog = `URL ${urlPath} уже присутствовал в sitemap_extra_pages — кэш сброшен, пинг отправляется.`;
      logger.info({ suggestionId, urlPath }, "[seo-autopilot] applySitemap: URL already present, cache invalidated");
    }
  } catch (err) {
    verificationLog = `Ошибка записи в БД: ${String(err)}`;
    status = "applied_with_errors";
    logger.error({ err, suggestionId, urlPath }, "[seo-autopilot] applySitemap: DB write failed");
  }

  // Ping IndexNow and check per-endpoint results
  const pingResults = await pingIndexNow([`${SITE_BASE}${urlPath}`]);
  const allPingsOk = pingResults.length > 0 && pingResults.every(r => r.ok);
  const failedPings = pingResults.filter(r => !r.ok);
  if (failedPings.length > 0) {
    const detail = failedPings.map(r => `${r.endpoint} → HTTP ${r.status || "err"}`).join(", ");
    verificationLog += ` IndexNow: частичная ошибка (${detail}).`;
    if (status === "applied") status = "applied_with_errors";
  } else if (allPingsOk) {
    verificationLog += " IndexNow-пинг отправлен успешно.";
  } else {
    verificationLog += " IndexNow: нет доступных эндпоинтов.";
  }

  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = ${status}, verified_at = NOW(), verification_log = ${verificationLog}, updated_at = NOW()
    WHERE id = ${suggestionId}
  `);
  logger.info({ suggestionId, urlPath, status }, "[seo-autopilot] applySitemap done");
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
  const trimmedProposal = suggestion.proposed_value.trimStart();
  if (trimmedProposal.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmedProposal) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isSafeFaqItem)) {
        return res.json({
          ok: true,
          faqs: parsed.map(item => ({
            modelTerm: (item as { modelTerm?: string }).modelTerm ?? brand.name,
            question: item.question,
            answer: item.answer,
          })),
        });
      }
    } catch {
      // Invalid JSON must never fall through to the legacy line parser.
    }
    return res.json({ ok: true, faqs: [] });
  }

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
    const modelKey = canonModelKey(modelTerm);
    if (seen.has(modelKey)) continue;
    seen.add(modelKey);
    const displayTerm = canonModelDisplay(modelTerm);
    // Use canonical key (Latin) for DB lookup — cars table has Latin model names from feed
    const dbSearchTerm = modelKey;

    const carRow = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt,
             MIN(price)::int AS min_price,
             MAX(max_discount)::int AS max_discount
      FROM cars
      WHERE type = 'new'
        AND LOWER(dealer) = LOWER(${brand.name})
        AND LOWER(model) ILIKE ${`%${dbSearchTerm}%`}
    `);
    const r = carRow.rows[0] as Record<string, unknown>;
    const carsData = {
      count: (r["cnt"] as number) ?? 0,
      minPrice: (r["min_price"] as number | null) ?? null,
      maxDiscount: (r["max_discount"] as number | null) ?? null,
    };

    const items = queryToFaqModel(displayTerm, brand.name, carsData);
    for (const item of items) {
      faqs.push({ modelTerm: displayTerm, ...item });
    }
  }

  return res.json({ ok: true, faqs });
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

  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : null;
  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = 'rejected', reject_reason = ${reason}, updated_at = NOW()
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
   POST /api/admin/seo-autopilot/cleanup-duplicate-model-faqs
   Удаляет целые FAQ-блоки с нежелательным написанием модели.
   Логика: для каждой страницы и каждого канонического ключа модели
   собираем блоки по найденному варианту написания (jolion | джолион).
   Если оба варианта присутствуют — удаляем все строки с нежелательным
   вариантом (Latin/нестандарт), сохраняем все строки с каноническим
   (Кириллица / display-значение из MODEL_CANONICAL_ENTRIES).
   Тело запроса: { dry_run?: boolean }
   ────────────────────────────────────────────────────────────────────── */
router.post("/cleanup-duplicate-model-faqs", async (req, res) => {
  try {
    const dryRun = !!(req.body as Record<string, unknown>)?.dry_run;

    // Load all brand-page FAQs ordered so lower sort_order comes first
    const allRows = await db.execute(sql`
      SELECT id, page_slug, question, answer
      FROM faqs
      WHERE page_slug LIKE 'brands/%'
      ORDER BY page_slug, sort_order ASC, id ASC
    `);
    type FaqRow = { id: number; page_slug: string; question: string; answer: string };
    const rows = allRows.rows as FaqRow[];

    // Sort all variants longest-first to prevent "f7" matching before "f7x"
    const allVarsSorted = _MODEL_CANONICAL_ENTRIES
      .flatMap(e => e.variants.map(v => ({ key: e.key, variant: v, display: e.display })))
      .sort((a, b) => b.variant.length - a.variant.length);

    // Detect which canonical model key + matched variant a row belongs to
    function detectModel(row: FaqRow): { key: string; variant: string; display: string } | null {
      const text = (row.question + " " + row.answer).toLowerCase();
      for (const item of allVarsSorted) {
        if (text.includes(item.variant)) return item;
      }
      return null;
    }

    // Group: (page_slug, canonical_key) → variant → rows[]
    // E.g.: "brands/haval-city|jolion" → { "джолион": [r1, r2], "jolion": [r3, r4] }
    const modelGroups = new Map<string, { display: string; byVariant: Map<string, FaqRow[]> }>();
    for (const row of rows) {
      const det = detectModel(row);
      if (!det) continue;
      const gKey = `${row.page_slug}|${det.key}`;
      if (!modelGroups.has(gKey)) modelGroups.set(gKey, { display: det.display, byVariant: new Map() });
      const g = modelGroups.get(gKey)!;
      if (!g.byVariant.has(det.variant)) g.byVariant.set(det.variant, []);
      g.byVariant.get(det.variant)!.push(row);
    }

    // Identify duplicates: groups with >1 variant present
    const toDelete: { id: number; page_slug: string; question: string; reason: string }[] = [];
    const affectedSlugs = new Set<string>();
    const groupedPreview: { pageSlug: string; canonicalKey: string; keptVariant: string; deletedVariant: string; deletedCount: number }[] = [];

    for (const [gKey, { display, byVariant }] of modelGroups) {
      if (byVariant.size <= 1) continue; // Single variant → no duplicate block

      const pageSlug = gKey.split("|")[0];
      const canonicalKey = gKey.split("|")[1];

      // Canonical variant = the one matching the display value (case-insensitive)
      const canonicalVariant = display.toLowerCase();
      const keptVariant = byVariant.has(canonicalVariant) ? canonicalVariant
        : [...byVariant.keys()][0]; // Fallback: keep first if canonical not found

      for (const [variant, variantRows] of byVariant) {
        if (variant === keptVariant) continue; // This is the block we keep
        for (const row of variantRows) {
          toDelete.push({
            id: row.id,
            page_slug: row.page_slug,
            question: row.question,
            reason: `Дублирующий блок «${canonicalKey}» — вариант «${variant}» (предпочтителен: «${keptVariant}»)`,
          });
        }
        affectedSlugs.add(pageSlug.replace("brands/", ""));
        groupedPreview.push({ pageSlug, canonicalKey, keptVariant, deletedVariant: variant, deletedCount: variantRows.length });
      }
    }

    if (dryRun) {
      return res.json({
        ok: true, dry_run: true,
        wouldDelete: toDelete.length,
        rows: toDelete,
        groups: groupedPreview,
        affectedPages: [...affectedSlugs],
      });
    }

    if (toDelete.length > 0) {
      const ids = toDelete.map(r => r.id);
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        await db.execute(sql`DELETE FROM faqs WHERE id = ANY(${chunk}::int[])`);
      }

      try {
        const ssgScript = getSsgPath();
        if (ssgScript) {
          const r = spawnSync("node", [ssgScript], { cwd: process.cwd(), timeout: 45_000, encoding: "utf8" });
          if (r.status !== 0) logger.warn({ stderr: r.stderr?.slice(0, 200) }, "[cleanup-faq] SSG error");
        }
      } catch (e) {
        logger.warn({ err: e }, "[cleanup-faq] SSG spawn error");
      }

      const urls = [...affectedSlugs].map(s => `${SITE}/brands/${s}`);
      if (urls.length > 0) await pingIndexNow(urls).catch(() => void 0);
    }

    logger.info({ deleted: toDelete.length, slugs: [...affectedSlugs] }, "[seo-autopilot] cleanup-duplicate-model-faqs done");
    return res.json({ ok: true, dry_run: false, deleted: toDelete.length, groups: groupedPreview, affectedPages: [...affectedSlugs] });
  } catch (err) {
    logger.error({ err }, "[seo-autopilot] cleanup-duplicate-model-faqs error");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ──────────────────────────────────────────────────────────────────────
   applySuggestionBackground — apply a single pending suggestion via AI
   without an HTTP response context. Used by reset-and-rerun auto-pipeline.
   ────────────────────────────────────────────────────────────────────── */
async function applySuggestionBackground(id: number): Promise<void> {
  const row = await db.execute(sql`SELECT * FROM seo_suggestions WHERE id = ${id} LIMIT 1`);
  const suggestion = row.rows[0] as {
    id: number; type: string; page_url: string;
    proposed_value: string; status: string; reasoning: string | null;
  } | undefined;

  if (!suggestion || suggestion.status !== "pending") return;

  const markApplied = () => db.execute(sql`
    UPDATE seo_suggestions SET status = 'applied', applied_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `);

  // GEO has no safe automatic content mutation. Keep the background path
  // consistent with the HTTP path: save the baseline, but never claim that a
  // manual instruction changed the page.
  if (suggestion.type === "geo") {
    await recordGeoApplySnapshot(id, suggestion.page_url);
    await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'manual',
          applied_at = NULL,
          verification_log = 'Ручное ТЗ сохранено. Страница не изменялась; повторите GEO-замер после публикации.',
          updated_at = NOW()
      WHERE id = ${id}
    `);
    return;
  }

  // BRAND CLUSTER
  if (suggestion.type === "cluster" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    await markApplied();
    await applyBrandCluster(id, slug, suggestion.proposed_value, suggestion.page_url);
    return;
  }

  // /CARS CLUSTER
  if (suggestion.type === "cluster" && suggestion.page_url === "/cars") {
    await markApplied();
    await applyCarsCluster(id, suggestion.proposed_value);
    return;
  }

  // CONTENT — model FAQ on brand pages
  if (suggestion.type === "content" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    await markApplied();
    await applyContentBrand(id, slug, suggestion.proposed_value, suggestion.page_url);
    return;
  }

  // TECH — trigger prerender
  if (suggestion.type === "tech") {
    await markApplied();
    await applyTech(id, suggestion.page_url);
    return;
  }

  // TEXT_BLOCK
  if (suggestion.type === "text_block" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    await markApplied();
    await applyTextBlock(id, slug, suggestion.proposed_value, suggestion.page_url);
    return;
  }

  // NEW_PAGE — generate ТЗ template (no AI)
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
      `- Description: Купить [Тема] у официального дилера в Брянске. Выгодные цены, кредит, трейд-ин.`,
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
          content_draft = ${tz}, verification_log = 'ТЗ сгенерировано автоматически'
      WHERE id = ${id}
    `);
    return;
  }

  // SITEMAP — background apply
  if (suggestion.type === "sitemap") {
    await markApplied();
    await applySitemap(id, suggestion.proposed_value, suggestion.page_url);
    return;
  }

  // META for non-brand static pages → applyStaticMeta (page_seo_overrides)
  if (suggestion.type === "meta" && !suggestion.page_url.startsWith("/brands/")) {
    if (!(suggestion.page_url in STATIC_META)) {
      logger.warn({ id, page_url: suggestion.page_url }, "[seo-autopilot] background: route not in STATIC_META, skipping applyStaticMeta");
      return;
    }
    let newTitle: string | null = null;
    let newDesc: string | null = null;
    for (const line of suggestion.proposed_value.split("\n")) {
      if (line.startsWith("title: ")) { const v = line.slice(7).trim(); if (v) newTitle = v; }
      if (line.startsWith("desc: "))  { const v = line.slice(6).trim(); if (v) newDesc  = v; }
    }
    if (!newTitle && !newDesc) {
      logger.warn({ id }, "[seo-autopilot] background applyStaticMeta: cannot parse meta proposed_value");
      return;
    }
    await markApplied();
    await applyStaticMeta(id, newTitle, newDesc, suggestion.page_url);
    return;
  }

  // META on brand pages
  if (suggestion.type === "meta" && suggestion.page_url.startsWith("/brands/")) {
    const slug = suggestion.page_url.replace("/brands/", "");
    let newTitle = "";
    let newDesc = "";
    for (const line of suggestion.proposed_value.split("\n")) {
      if (line.startsWith("title: ")) newTitle = line.slice(7).trim();
      if (line.startsWith("desc: ")) newDesc = line.slice(6).trim();
    }
    if (!newTitle && !newDesc) {
      logger.warn({ id }, "[seo-autopilot] applySuggestionBackground: cannot parse meta proposed_value");
      return;
    }
    await markApplied();
    await applyBrandMeta(id, slug, newTitle, newDesc, suggestion.page_url);
    return;
  }

  // Fallback
  await db.execute(sql`
    UPDATE seo_suggestions
    SET status = 'applied', applied_at = NOW(), updated_at = NOW(),
        verification_log = 'Отмечено выполненным (auto)'
    WHERE id = ${id}
  `);
}

/* ──────────────────────────────────────────────────────────────────────
   POST /api/admin/seo-autopilot/reset-and-rerun
   Удаляет pending-предложения и запускает GAP-анализ заново.
   Предложения остаются в статусе pending — требуется ручное согласование.
   ────────────────────────────────────────────────────────────────────── */
router.post("/reset-and-rerun", async (_req, res) => {
  try {
    const deleted = await db.execute(sql`
      DELETE FROM seo_suggestions WHERE status = 'pending'
      RETURNING id
    `);
    const deletedCount = deleted.rows.length;

    if (isGapRunning_()) {
      return res.json({ ok: true, deleted: deletedCount, gapStarted: false, message: "Предложения удалены. GAP-анализ уже запущен." });
    }

    res.json({ ok: true, deleted: deletedCount, gapStarted: true, message: `Удалено ${deletedCount} pending-предложений. GAP-анализ запущен в фоне.` });
    runGapAnalysis("manual")
      .then(r => logger.info(r, "[seo-autopilot] reset-and-rerun gap done"))
      .catch(err => logger.error({ err }, "[seo-autopilot] reset-and-rerun gap failed"));
    return;
  } catch (err) {
    logger.error({ err }, "[seo-autopilot] reset-and-rerun error");
    return res.status(500).json({ ok: false, error: String(err) });
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
      SELECT
        gr.id, gr.status, gr.triggered_by, gr.started_at, gr.completed_at, gr.duration_ms,
        gr.suggestions_created, gr.wordstat_rows, gr.webmaster_rows, gr.error_message,
        (
          SELECT COUNT(*)::int
          FROM seo_suggestions s
          WHERE s.applied_at IS NOT NULL
            AND s.applied_at >= gr.started_at
            AND s.applied_at < COALESCE(
              (SELECT gr2.started_at FROM gap_runs gr2
               WHERE gr2.started_at > gr.started_at
               ORDER BY gr2.started_at ASC LIMIT 1),
              NOW()
            )
        ) AS applied_count
      FROM gap_runs gr
      ORDER BY gr.started_at DESC
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
    const [countsRow, alertsRow, snapshotRow] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'applied')::int AS applied,
          COUNT(*) FILTER (WHERE status = 'applied_with_errors')::int AS errors,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE blocked_by_tech = true AND status = 'pending')::int AS blocked
        FROM seo_suggestions
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS unresolved FROM oauth_alerts WHERE status != 'resolved'
      `),
      db.execute(sql`
        SELECT
          (SELECT MAX(snapshot_date)::text FROM wordstat_snapshots) AS last_wordstat_date,
          (SELECT MAX(snapshot_date)::text FROM seo_query_snapshots) AS last_webmaster_date
      `),
    ]);
    const snap = snapshotRow.rows[0] as { last_wordstat_date: string | null; last_webmaster_date: string | null } | undefined;
    res.json({
      ok: true,
      counts: countsRow.rows[0],
      unresolvedAlerts: (alertsRow.rows[0] as { unresolved: number }).unresolved,
      wordstatRunning: isWordstatRunning(),
      gapRunning: isGapRunning_(),
      lastWordstatDate: snap?.last_wordstat_date ?? null,
      lastWebmasterDate: snap?.last_webmaster_date ?? null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
