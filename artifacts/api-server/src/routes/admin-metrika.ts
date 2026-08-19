import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { sendMetrikaReport, previewMetrikaReport } from "../services/metrika-report";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
router.use(requireAdmin);

const COUNTER_MAIN = 109748190;
const API_BASE = "https://api-metrika.yandex.net/stat/v1/data";
const MGMT_BASE = "https://api-metrika.yandex.net/management/v1";

const SRC_MAP: Record<string, string> = {
  organic: "Поиск",
  direct: "Прямые",
  referral: "Ссылки",
  ad: "Реклама",
  social: "Соцсети",
  email: "Email",
  messenger: "Мессенджеры",
  internal: "Внутренние",
  undefined: "Неизвестные",
};

function srcName(id: string | undefined, name: string): string {
  return SRC_MAP[id || ""] || SRC_MAP[name?.toLowerCase() || ""] || name || "Прочее";
}

/* ── In-memory cache (TTL 5 min) ── */
interface CacheEntry { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown, ttlMs = 5 * 60_000): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/* ── Metrika API helpers ── */
function getToken(): string {
  return process.env["YANDEX_METRIKA_TOKEN"] || "";
}

interface MetrikaRow {
  dimensions: Array<{ name: string; id?: string }>;
  metrics: number[];
}
interface MetrikaResponse {
  data: MetrikaRow[];
  totals: number[];
  errors?: Array<{ error_type: string; message: string }>;
}

const METRIKA_QUEUE_WAIT_MS = 10_000;

interface MetrikaQueueItem {
  operation: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const metrikaQueue: MetrikaQueueItem[] = [];
let metrikaRequestInFlight = false;

function processMetrikaQueue(): void {
  if (metrikaRequestInFlight) return;
  const next = metrikaQueue.shift();
  if (!next) return;

  metrikaRequestInFlight = true;
  clearTimeout(next.timeout);
  void next.operation()
    .then(next.resolve, next.reject)
    .finally(() => {
      metrikaRequestInFlight = false;
      processMetrikaQueue();
    });
}

function withMetrikaSlot<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item: MetrikaQueueItem = {
      operation: operation as () => Promise<unknown>,
      resolve: value => resolve(value as T),
      reject,
      timeout: undefined as unknown as ReturnType<typeof setTimeout>,
    };
    item.timeout = setTimeout(() => {
      const index = metrikaQueue.indexOf(item);
      if (index === -1) return;
      metrikaQueue.splice(index, 1);
      reject(new Error("Метрика временно занята — данные о визитах будут обновлены при следующей попытке"));
    }, METRIKA_QUEUE_WAIT_MS);
    metrikaQueue.push(item);
    processMetrikaQueue();
  });
}

function isQuotaError(message: string): boolean {
  return /quota exceeded|parallel user requests|too many requests/i.test(message);
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchMetrika(
  params: Record<string, string | number>,
  { attempts = 3, requestTimeoutMs = 30_000 }: { attempts?: number; requestTimeoutMs?: number } = {},
): Promise<MetrikaResponse> {
  return withMetrikaSlot(async () => {
    const token = getToken();
    if (!token) throw new Error("YANDEX_METRIKA_TOKEN не задан");
    const url = new URL(API_BASE);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const r = await fetch(url.toString(), {
        headers: { Authorization: `OAuth ${token}` },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      const json = await r.json() as MetrikaResponse;
      const message = json.errors?.[0]?.message || `HTTP ${r.status}`;
      if (r.ok && !json.errors?.length) return json;

      if (attempt < attempts - 1 && isQuotaError(message)) {
        await wait((attempt + 1) * 1_000);
        continue;
      }
      throw new Error(message);
    }
    throw new Error("Метрика не вернула данные");
  });
}

/* ── Date helpers ── */
function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function moscowDateStr(daysAgo = 0): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find(p => p.type === "year")?.value);
  const month = Number(parts.find(p => p.type === "month")?.value);
  const day = Number(parts.find(p => p.type === "day")?.value);
  const date = new Date(Date.UTC(year, month - 1, day - daysAgo));
  return date.toISOString().slice(0, 10);
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

type ActivityMetric = "visits" | "leads" | "calls" | "answered" | "missed";
type ActivityCell = { dayOfWeek: number; hour: number; value: number };

function activityRange(period: string): { date1: string; date2: string } {
  if (period === "today") {
    const today = moscowDateStr();
    return { date1: today, date2: today };
  }
  if (period === "30d") {
    return { date1: moscowDateStr(30), date2: moscowDateStr(1) };
  }
  return { date1: moscowDateStr(7), date2: moscowDateStr(1) };
}

function makeActivityCells(): ActivityCell[] {
  return Array.from({ length: 7 * 24 }, (_, index) => ({
    dayOfWeek: Math.floor(index / 24),
    hour: index % 24,
    value: 0,
  }));
}

function weekdayOccurrences(date1: string, date2: string): number[] {
  const counts = Array.from({ length: 7 }, () => 0);
  const cursor = new Date(`${date1}T00:00:00Z`);
  const end = new Date(`${date2}T00:00:00Z`);
  while (cursor <= end) {
    const sundayFirst = cursor.getUTCDay();
    counts[sundayFirst === 0 ? 6 : sundayFirst - 1] += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return counts;
}

function aggregateActivity(
  rows: Array<{ date: string; dayOfWeek: number; hour: number; value: number }>,
  date1: string,
  date2: string,
  mode: "total" | "average",
): ActivityCell[] {
  const cells = makeActivityCells();
  for (const row of rows) {
    const index = row.dayOfWeek * 24 + row.hour;
    if (cells[index]) cells[index].value += Number(row.value) || 0;
  }
  if (mode === "average") {
    const occurrences = weekdayOccurrences(date1, date2);
    for (const cell of cells) {
      cell.value = occurrences[cell.dayOfWeek]
        ? Math.round((cell.value / occurrences[cell.dayOfWeek]) * 10) / 10
        : 0;
    }
  }
  return cells;
}

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/metrika/send-report — отправить отчёт сейчас
   ───────────────────────────────────────────────────────────── */
router.post("/send-report", async (_req, res) => {
  try {
    await sendMetrikaReport();
    res.json({ ok: true, message: "Отчёт успешно отправлен на sales@debryansk-auto.ru" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] Manual report send failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/preview — HTML письма без отправки
   ───────────────────────────────────────────────────────────── */
router.get("/preview", async (_req, res) => {
  try {
    const { subject, html } = await previewMetrikaReport();
    res.json({ ok: true, subject, html });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/summary?period=today|7d|30d
   ───────────────────────────────────────────────────────────── */
router.get("/summary", async (req, res) => {
  try {
    const period = (req.query["period"] as string) || "7d";
    const cacheKey = `summary:${period}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) { res.json(cached); return; }

    let date1: string, date2: string, prevDate1: string, prevDate2: string;
    const today = dateStr(0);
    if (period === "today") {
      date1 = today; date2 = today;
      prevDate1 = dateStr(1); prevDate2 = dateStr(1);
    } else if (period === "30d") {
      date1 = dateStr(30); date2 = dateStr(1);
      prevDate1 = dateStr(60); prevDate2 = dateStr(31);
    } else {
      date1 = dateStr(7); date2 = dateStr(1);
      prevDate1 = dateStr(14); prevDate2 = dateStr(8);
    }

    const metrics = "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds";
    const [curr, prev] = await Promise.all([
      fetchMetrika({ ids: COUNTER_MAIN, date1, date2, metrics }),
      fetchMetrika({ ids: COUNTER_MAIN, date1: prevDate1, date2: prevDate2, metrics }),
    ]);

    function parseTotals(t: number[]) {
      return {
        visits: Math.round(t[0] || 0),
        users: Math.round(t[1] || 0),
        pageviews: Math.round(t[2] || 0),
        bounceRate: +(t[3] || 0).toFixed(1),
        avgDuration: Math.round(t[4] || 0),
        avgDurationFormatted: formatDuration(t[4] || 0),
      };
    }

    const result = {
      ok: true,
      period,
      date1, date2,
      current: parseTotals(curr.totals),
      previous: parseTotals(prev.totals),
    };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] /summary failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/chart?date1=YYYY-MM-DD&date2=YYYY-MM-DD
   ───────────────────────────────────────────────────────────── */
router.get("/chart", async (req, res) => {
  try {
    const date1 = (req.query["date1"] as string) || dateStr(7);
    const date2 = (req.query["date2"] as string) || dateStr(1);
    const cacheKey = `chart:${date1}:${date2}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) { res.json(cached); return; }

    const r = await fetchMetrika({
      ids: COUNTER_MAIN, date1, date2,
      dimensions: "ym:s:date",
      metrics: "ym:s:visits,ym:s:users",
      sort: "ym:s:date",
      limit: 62,
    });

    const rows = r.data.map(row => ({
      date: row.dimensions[0]?.name || "",
      visits: Math.round(row.metrics[0] || 0),
      users: Math.round(row.metrics[1] || 0),
    }));

    const result = { ok: true, rows };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] /chart failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/sources?date1=YYYY-MM-DD&date2=YYYY-MM-DD
   ───────────────────────────────────────────────────────────── */
router.get("/sources", async (req, res) => {
  try {
    const date1 = (req.query["date1"] as string) || dateStr(7);
    const date2 = (req.query["date2"] as string) || dateStr(1);
    const cacheKey = `sources:${date1}:${date2}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) { res.json(cached); return; }

    const r = await fetchMetrika({
      ids: COUNTER_MAIN, date1, date2,
      dimensions: "ym:s:trafficSource",
      metrics: "ym:s:visits",
      sort: "-ym:s:visits",
      limit: 8,
    });

    const rows = r.data
      .map(row => ({
        name: srcName(row.dimensions[0]?.id, row.dimensions[0]?.name),
        visits: Math.round(row.metrics[0] || 0),
      }))
      .filter(s => s.visits > 0);

    const result = { ok: true, rows };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] /sources failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/pages?date1=YYYY-MM-DD&date2=YYYY-MM-DD
   ───────────────────────────────────────────────────────────── */
router.get("/pages", async (req, res) => {
  try {
    const date1 = (req.query["date1"] as string) || dateStr(7);
    const date2 = (req.query["date2"] as string) || dateStr(1);
    const cacheKey = `pages:${date1}:${date2}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) { res.json(cached); return; }

    const r = await fetchMetrika({
      ids: COUNTER_MAIN, date1, date2,
      dimensions: "ym:s:startURLPath",
      metrics: "ym:s:visits,ym:s:pageviews",
      sort: "-ym:s:visits",
      limit: 10,
    });

    const rows = r.data
      .map(row => ({
        path: row.dimensions[0]?.name || "/",
        visits: Math.round(row.metrics[0] || 0),
        pageviews: Math.round(row.metrics[1] || 0),
      }))
      .filter(p => p.visits > 0);

    const result = { ok: true, rows };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] /pages failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/activity?period=today|7d|30d
   Почасовая активность: визиты из Метрики, лиды и звонки из БД.
   ───────────────────────────────────────────────────────────── */
router.get("/activity", async (req, res) => {
  const period = (req.query["period"] as string) || "7d";
  const mode = req.query["mode"] === "total" ? "total" : "average";
  const safePeriod = period === "today" || period === "30d" ? period : "7d";
  const { date1, date2 } = activityRange(safePeriod);
  const cacheKey = `activity:${safePeriod}:${mode}:${date1}:${date2}`;

  try {
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) { res.json(cached); return; }

    const metrikaPromise = fetchMetrika({
      ids: COUNTER_MAIN,
      date1,
      date2,
      dimensions: "ym:s:date,ym:s:hour",
      metrics: "ym:s:visits",
      sort: "ym:s:date,ym:s:hour",
      limit: 1000,
      timezone: "Europe/Moscow",
    }, { attempts: 2, requestTimeoutMs: 8_000 });
    const leadsPromise = db.execute(sql`
      SELECT
        (created_at AT TIME ZONE 'Europe/Moscow')::date::text AS date,
        (((EXTRACT(DOW FROM (created_at AT TIME ZONE 'Europe/Moscow'))::int + 6) % 7))::int AS day_of_week,
        EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Moscow'))::int AS hour,
        COUNT(*)::int AS value
      FROM leads
      WHERE created_at IS NOT NULL
        AND (created_at AT TIME ZONE 'Europe/Moscow')::date BETWEEN ${date1}::date AND ${date2}::date
      GROUP BY date, day_of_week, hour
      ORDER BY date, hour
    `);
    const callsPromise = db.execute(sql`
      SELECT
        (started_at AT TIME ZONE 'Europe/Moscow')::date::text AS date,
        (((EXTRACT(DOW FROM (started_at AT TIME ZONE 'Europe/Moscow'))::int + 6) % 7))::int AS day_of_week,
        EXTRACT(HOUR FROM (started_at AT TIME ZONE 'Europe/Moscow'))::int AS hour,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS answered,
        COUNT(*) FILTER (WHERE status = 'missed')::int AS missed
      FROM calltouch_calls
      WHERE started_at IS NOT NULL
        AND (started_at AT TIME ZONE 'Europe/Moscow')::date BETWEEN ${date1}::date AND ${date2}::date
      GROUP BY date, day_of_week, hour
      ORDER BY date, hour
    `);

    const [metrikaResult, leadsResult, callsResult] = await Promise.allSettled([
      metrikaPromise,
      leadsPromise,
      callsPromise,
    ]);

    const sourceErrors: Record<string, string | null> = {
      visits: metrikaResult.status === "rejected" ? String(metrikaResult.reason) : null,
      leads: leadsResult.status === "rejected" ? String(leadsResult.reason) : null,
      calls: callsResult.status === "rejected" ? String(callsResult.reason) : null,
    };

    const visitsRows = metrikaResult.status === "fulfilled"
      ? metrikaResult.value.data.map(row => {
          const date = row.dimensions[0]?.name || "";
          const dateObj = new Date(`${date}T00:00:00Z`);
          const sundayFirst = dateObj.getUTCDay();
          const hourDimension = row.dimensions[1];
          return {
            date,
            dayOfWeek: sundayFirst === 0 ? 6 : sundayFirst - 1,
            hour: Math.max(0, Math.min(23, Number(hourDimension?.id ?? hourDimension?.name?.match(/^\d{1,2}/)?.[0]) || 0)),
            value: Math.round(row.metrics[0] || 0),
          };
        })
      : [];

    type LeadActivityRow = { date: string; day_of_week: number; hour: number; value: number };
    type CallActivityRow = { date: string; day_of_week: number; hour: number; total: number; answered: number; missed: number };
    const leadRows = leadsResult.status === "fulfilled"
      ? leadsResult.value.rows as unknown as LeadActivityRow[]
      : [];
    const callRows = callsResult.status === "fulfilled"
      ? callsResult.value.rows as unknown as CallActivityRow[]
      : [];

    const mapRows = (rows: Array<{ date: string; day_of_week: number; hour: number; value: number }>) =>
      rows.map(row => ({
        date: String(row.date),
        dayOfWeek: Number(row.day_of_week),
        hour: Number(row.hour),
        value: Number(row.value) || 0,
      }));
    const mapCallRows = (key: "total" | "answered" | "missed") =>
      callRows.map(row => ({
        date: String(row.date),
        dayOfWeek: Number(row.day_of_week),
        hour: Number(row.hour),
        value: Number(row[key]) || 0,
      }));

    const result = {
      ok: true,
      period: safePeriod,
      mode,
      date1,
      date2,
      cells: {
        visits: aggregateActivity(visitsRows, date1, date2, mode),
        leads: aggregateActivity(mapRows(leadRows), date1, date2, mode),
        calls: aggregateActivity(mapCallRows("total"), date1, date2, mode),
        answered: aggregateActivity(mapCallRows("answered"), date1, date2, mode),
        missed: aggregateActivity(mapCallRows("missed"), date1, date2, mode),
      } satisfies Record<ActivityMetric, ActivityCell[]>,
      sources: {
        visits: { ok: !sourceErrors.visits, error: sourceErrors.visits },
        leads: { ok: !sourceErrors.leads, error: sourceErrors.leads },
        calls: { ok: !sourceErrors.calls, error: sourceErrors.calls },
      },
    };

    const hasUnavailableSource = Object.values(sourceErrors).some(Boolean);
    cacheSet(cacheKey, result, hasUnavailableSource ? 30_000 : 5 * 60_000);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] /activity failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/metrika/online — сейчас на сайте (кеш 30 сек)
   ───────────────────────────────────────────────────────────── */
router.get("/online", async (_req, res) => {
  try {
    const cached = cacheGet<unknown>("online");
    if (cached) { res.json(cached); return; }

    const token = getToken();
    if (!token) { res.json({ ok: true, online: null }); return; }

    const url = `${MGMT_BASE}/counter/${COUNTER_MAIN}/online/`;
    const r = await fetch(url, {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!r.ok) { res.json({ ok: true, online: null }); return; }

    const json = await r.json() as { online?: { visits?: number } };
    const online = json.online?.visits ?? null;
    const result = { ok: true, online };
    cacheSet("online", result, 30_000);
    res.json(result);
  } catch (err: unknown) {
    logger.warn({ err }, "[metrika] /online failed — returning null");
    res.json({ ok: true, online: null });
  }
});

export default router;
