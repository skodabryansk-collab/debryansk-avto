import { Router, type IRouter } from "express";
import {
  db,
  newsTable, leadsTable, brandsTable, usersTable,
  calltouchCalls, carsTable,
  reviewsCacheTable, reviewsMetaTable,
  conversations, messages,
  promotionsTable, faqsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAdmin);

/* ── Metrika: in-memory cache 10 min ─────────────────────────── */
const COUNTER_MAIN = 109748190;
let metrikaCache: { data: { today: number; week: number; month: number }; expiresAt: number } | null = null;

function fmtDate(d: Date): string { return d.toISOString().split("T")[0]; }
function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return fmtDate(d); }

async function fetchVisits(date1: string, date2: string): Promise<number> {
  const token = process.env["YANDEX_METRIKA_TOKEN"] || "";
  if (!token) return 0;
  const url = new URL("https://api-metrika.yandex.net/stat/v1/data");
  url.searchParams.set("ids", String(COUNTER_MAIN));
  url.searchParams.set("date1", date1);
  url.searchParams.set("date2", date2);
  url.searchParams.set("metrics", "ym:s:visits");
  const r = await fetch(url.toString(), {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await r.json() as { totals?: number[]; errors?: unknown[] };
  if (!r.ok || (json.errors as unknown[])?.length) return 0;
  return Math.round((json.totals?.[0] as number) || 0);
}

async function getVisitors(): Promise<{ today: number; week: number; month: number } | null> {
  if (metrikaCache && Date.now() < metrikaCache.expiresAt) return metrikaCache.data;
  try {
    const today = fmtDate(new Date());
    const [todayV, weekV, monthV] = await Promise.all([
      fetchVisits(today, today),
      fetchVisits(daysAgo(7), daysAgo(1)),
      fetchVisits(daysAgo(30), daysAgo(1)),
    ]);
    const data = { today: todayV, week: weekV, month: monthV };
    metrikaCache = { data, expiresAt: Date.now() + 10 * 60_000 };
    return data;
  } catch (err) {
    logger.warn({ err }, "[dashboard] metrika fetch failed");
    return metrikaCache?.data ?? null;
  }
}

/* ── Vacancies: HH.ru public API, кеш 5 мин ─────────────────── */
const HH_EMPLOYER_ID = "2421744";
let hhCache: { count: number; expiresAt: number } | null = null;

async function getHhVacancyCount(): Promise<number> {
  if (hhCache && Date.now() < hhCache.expiresAt) return hhCache.count;
  try {
    const r = await fetch(
      `https://api.hh.ru/vacancies?employer_id=${HH_EMPLOYER_ID}&per_page=1`,
      { headers: { "User-Agent": "debryansk-auto/1.0" }, signal: AbortSignal.timeout(10_000) }
    );
    if (!r.ok) return hhCache?.count ?? 0;
    const json = await r.json() as { found?: number };
    const count = Number(json.found ?? 0);
    hhCache = { count, expiresAt: Date.now() + 5 * 60_000 };
    return count;
  } catch {
    return hhCache?.count ?? 0;
  }
}

/* ── GET /api/admin/dashboard ────────────────────────────────── */
router.get("/", async (_req, res) => {
  try {
    const [
      callsTotal, callsMissed, callsAnswered,
      carsNew, carsUsed, carsSync,
      leadsTotal, leadsToday,
      leadsCallback, leadsTestdrive, leadsCredit, leadsTradeIn,
      revCache, revMeta,
      navTotal, navToday, navRated,
      newsCount, promoCount, faqCount,
    ] = await Promise.all([
      /* Calltouch */
      db.select({ count: sql<number>`count(*)` }).from(calltouchCalls).where(sql`started_at >= current_date - interval '30 days'`),
      db.select({ count: sql<number>`count(*)` }).from(calltouchCalls).where(sql`status = 'missed' AND started_at >= current_date`),
      db.select({ count: sql<number>`count(*)` }).from(calltouchCalls).where(sql`status = 'completed' AND started_at >= current_date`),
      /* Cars */
      db.select({ count: sql<number>`count(*)` }).from(carsTable).where(sql`type = 'new'`),
      db.select({ count: sql<number>`count(*)` }).from(carsTable).where(sql`type = 'used'`),
      db.select({ lastSync: sql<string | null>`MAX(synced_at)` }).from(carsTable),
      /* Leads */
       db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)'`),
       db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND created_at >= current_date`),
       db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND type = 'callback'`),
       db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND type = 'testdrive'`),
       db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND type = 'credit'`),
       db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND type = 'tradein'`),
      /* Reviews */
      db.select().from(reviewsCacheTable).limit(1),
      db.select().from(reviewsMetaTable).limit(1),
      /* Navigator */
      db.select({ count: sql<number>`count(*)` }).from(conversations).where(sql`consented_at IS NOT NULL`),
      db.select({ count: sql<number>`count(*)` }).from(conversations).where(sql`consented_at IS NOT NULL AND created_at >= current_date`),
      db.select({ count: sql<number>`count(*)` }).from(messages).where(sql`rating IS NOT NULL`),
      /* Content */
      db.select({ count: sql<number>`count(*)` }).from(newsTable),
      db.select({ count: sql<number>`count(*)` }).from(promotionsTable).where(sql`is_active = true`),
      db.select({ count: sql<number>`count(*)` }).from(faqsTable).where(sql`is_published = true`),
    ]);

    /* Вакансии с HH.ru (публичный API, кеш 5 мин) */
    const hhVacancyCount = await getHhVacancyCount();

    /* SEO top-3 with position change (table may not exist yet) */
    type SeoRow = { query_text: string; avg_position: number; total_shows: number };
    let seoPositions: Array<{ query: string; position: number; change: number | null }> = [];
    try {
      const latestRow = await db.execute(sql`SELECT MAX(snapshot_date) AS latest FROM seo_query_snapshots`);
      const latestDate = (latestRow.rows[0] as { latest?: string })?.latest;
      if (latestDate) {
        const topRows = (await db.execute(sql`
          SELECT query_text, avg_position, total_shows
          FROM seo_query_snapshots
          WHERE snapshot_date = ${latestDate}
          ORDER BY total_shows DESC LIMIT 3
        `)).rows as SeoRow[];

        const oldDateRow = await db.execute(sql`
          SELECT MAX(snapshot_date) AS latest FROM seo_query_snapshots
          WHERE snapshot_date <= (${latestDate}::date - INTERVAL '6 days')
        `);
        const oldDate = (oldDateRow.rows[0] as { latest?: string })?.latest;

        const oldMap = new Map<string, number>();
        if (oldDate) {
          const oldRows = (await db.execute(sql`
            SELECT query_text, avg_position FROM seo_query_snapshots
            WHERE snapshot_date = ${oldDate} ORDER BY total_shows DESC LIMIT 50
          `)).rows as SeoRow[];
          for (const r of oldRows) oldMap.set(r.query_text, r.avg_position);
        }

        seoPositions = topRows.map(r => ({
          query: r.query_text,
          position: Math.round(r.avg_position * 10) / 10,
          change: oldMap.has(r.query_text)
            ? Math.round((oldMap.get(r.query_text)! - r.avg_position) * 10) / 10
            : null,
        }));
      }
    } catch { /* таблица seo_query_snapshots может не существовать */ }

    /* Метрика (кешируется, не блокирует если недоступна) */
    const visitors = await getVisitors();

    return res.json({
      ok: true,
      calls: {
        total30d: Number(callsTotal[0]?.count ?? 0),
        missedToday: Number(callsMissed[0]?.count ?? 0),
        answeredToday: Number(callsAnswered[0]?.count ?? 0),
      },
      cars: {
        newCount: Number(carsNew[0]?.count ?? 0),
        usedCount: Number(carsUsed[0]?.count ?? 0),
        lastSyncAt: carsSync[0]?.lastSync ?? null,
      },
      leads: {
        total: Number(leadsTotal[0]?.count ?? 0),
        today: Number(leadsToday[0]?.count ?? 0),
        byType: {
          callback: Number(leadsCallback[0]?.count ?? 0),
          testdrive: Number(leadsTestdrive[0]?.count ?? 0),
          credit: Number(leadsCredit[0]?.count ?? 0),
          tradein: Number(leadsTradeIn[0]?.count ?? 0),
        },
      },
      reviews: {
        avgRating: Number(revCache[0]?.avg ?? 5),
        total: Number(revCache[0]?.total ?? 0),
        lastSyncAt: revMeta[0]?.lastSyncAt ?? null,
      },
      navigator: {
        total: Number(navTotal[0]?.count ?? 0),
        today: Number(navToday[0]?.count ?? 0),
        rated: Number(navRated[0]?.count ?? 0),
      },
      content: {
        news: Number(newsCount[0]?.count ?? 0),
        promotions: Number(promoCount[0]?.count ?? 0),
        faqs: Number(faqCount[0]?.count ?? 0),
        vacancies: hhVacancyCount,
      },
      seoPositions,
      visitors,
    });
  } catch (err) {
    logger.error({ err }, "[dashboard] failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/dashboard/trends — sparkline за 7 дней ─── */
router.get("/trends", async (_req, res) => {
  try {
    const [callRows, leadRows] = await Promise.all([
      db.execute(sql`
        SELECT
          (started_at AT TIME ZONE 'Europe/Moscow')::date AS day,
          count(*) AS total
        FROM calltouch_calls
        WHERE started_at >= current_date - INTERVAL '6 days'
        GROUP BY day
        ORDER BY day
      `),
      db.execute(sql`
        SELECT
          (created_at AT TIME ZONE 'Europe/Moscow')::date AS day,
          count(*) AS total
        FROM leads
        WHERE COALESCE(name, '') !~* '(test|тест)'
          AND created_at >= current_date - INTERVAL '6 days'
        GROUP BY day
        ORDER BY day
      `),
    ]);

    /* Заполнить пропущенные дни нулями */
    function fillDays(rows: Array<{ day: string; total: string | number }>) {
      const map = new Map<string, number>();
      for (const r of rows) {
        const key = typeof r.day === "string" ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
        map.set(key, Number(r.total));
      }
      const result: Array<{ date: string; total: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, total: map.get(key) ?? 0 });
      }
      return result;
    }

    return res.json({
      ok: true,
      calls: fillDays(callRows.rows as Array<{ day: string; total: string | number }>),
      leads: fillDays(leadRows.rows as Array<{ day: string; total: string | number }>),
    });
  } catch (err) {
    logger.error({ err }, "[dashboard/trends] failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/stats (совместимость с прежним дашбордом) ── */
router.get("/stats", async (_req, res) => {
  try {
    const [newsCount] = await db.select({ count: sql<number>`count(*)` }).from(newsTable);
    const [brandsCount] = await db.select({ count: sql<number>`count(*)` }).from(brandsTable);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [leadsToday] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND created_at >= current_date`);
    const [leadsWeek] = await db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(sql`COALESCE(name, '') !~* '(test|тест)' AND created_at >= current_date - interval '7 days'`);
    return res.json({
      ok: true,
      data: {
        newsCount: Number(newsCount?.count ?? 0),
        brandsCount: Number(brandsCount?.count ?? 0),
        usersCount: Number(usersCount?.count ?? 0),
        leadsToday: Number(leadsToday?.count ?? 0),
        leadsWeek: Number(leadsWeek?.count ?? 0),
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
