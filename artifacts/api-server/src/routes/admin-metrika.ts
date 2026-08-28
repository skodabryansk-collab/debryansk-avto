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
const TARGET_CALL_MIN_DURATION_SECONDS = 30;
const UNIQUE_CONVERSION_WINDOW_HOURS = 24;
// Test submissions have no dedicated DB flag; the test suite identifies them
// by a name containing "test" or "тест".
const REAL_LEAD_NAME_SQL = sql`COALESCE(l.name, '') !~* '(test|тест)'`;

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

function moscowWindowBounds(dateFrom: string, dateTo: string) {
  const from = sql`(${dateFrom}::date AT TIME ZONE 'Europe/Moscow')`;
  const to = sql`((${dateTo}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Moscow')`;
  return { from, to };
}

/**
 * Returns only unique target calls in the requested Moscow date window.
 * A short/missed call does not consume the 24-hour uniqueness window because
 * it is not a conversion in the first place.
 */
function uniqueTargetCallsSql(dateFrom: string, dateTo: string) {
  const { from, to } = moscowWindowBounds(dateFrom, dateTo);
  return sql`
    SELECT *
    FROM (
      SELECT ranked.*,
             LAG(ranked.started_at) OVER (
               PARTITION BY ranked.unique_key
               ORDER BY ranked.started_at, ranked.id
             ) AS previous_started_at
      FROM (
        SELECT c.*,
               COALESCE(
                 NULLIF(
                   CASE
                     WHEN normalized.phone_digits ~ '^8[0-9]{10}$'
                       THEN '7' || SUBSTRING(normalized.phone_digits FROM 2)
                     WHEN normalized.phone_digits ~ '^[0-9]{10}$'
                       THEN '7' || normalized.phone_digits
                     ELSE normalized.phone_digits
                   END,
                   ''
                 ),
                 'call:' || c.call_id
               ) AS unique_key
        FROM calltouch_calls c
        CROSS JOIN LATERAL (
          SELECT regexp_replace(COALESCE(c.phone_number, ''), '[^0-9]', '', 'g') AS phone_digits
        ) normalized
        WHERE c.status = 'completed'
          AND c.duration_seconds > ${TARGET_CALL_MIN_DURATION_SECONDS}
          AND c.started_at IS NOT NULL
          AND c.started_at >= (${from} - INTERVAL '24 hours')
          AND c.started_at < ${to}
      ) ranked
    ) deduplicated
    WHERE (
      deduplicated.previous_started_at IS NULL
      OR deduplicated.started_at - deduplicated.previous_started_at >= INTERVAL '24 hours'
    )
      AND deduplicated.started_at >= ${from}
      AND deduplicated.started_at < ${to}
  `;
}

/**
 * Returns only unique website leads in the requested Moscow date window.
 * The same phone + form type + car is one conversion for 24 hours.
 * Without a phone number, each database row remains independently countable.
 */
function uniqueLeadsSql(dateFrom: string, dateTo: string) {
  const { from, to } = moscowWindowBounds(dateFrom, dateTo);
  return sql`
    SELECT *
    FROM (
      SELECT ranked.*,
             LAG(ranked.created_at) OVER (
               PARTITION BY ranked.unique_key
               ORDER BY ranked.created_at, ranked.id
             ) AS previous_created_at
      FROM (
        SELECT l.*,
               CASE
                 WHEN NULLIF(normalized.phone_digits, '') IS NULL
                   THEN 'lead:' || l.id::text
                 ELSE CASE
                   WHEN normalized.phone_digits ~ '^8[0-9]{10}$'
                     THEN '7' || SUBSTRING(normalized.phone_digits FROM 2)
                   WHEN normalized.phone_digits ~ '^[0-9]{10}$'
                     THEN '7' || normalized.phone_digits
                   ELSE normalized.phone_digits
                 END
                   || '|' || LOWER(TRIM(COALESCE(l.type, '')))
                   || '|' || LOWER(TRIM(COALESCE(l.car, '')))
               END AS unique_key
        FROM leads l
        CROSS JOIN LATERAL (
          SELECT regexp_replace(COALESCE(l.phone, ''), '[^0-9]', '', 'g') AS phone_digits
        ) normalized
        WHERE l.created_at IS NOT NULL
           AND ${REAL_LEAD_NAME_SQL}
          AND l.created_at >= (${from} - INTERVAL '24 hours')
          AND l.created_at < ${to}
      ) ranked
    ) deduplicated
    WHERE (
      deduplicated.previous_created_at IS NULL
      OR deduplicated.created_at - deduplicated.previous_created_at >= INTERVAL '24 hours'
    )
      AND deduplicated.created_at >= ${from}
      AND deduplicated.created_at < ${to}
  `;
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
      FROM leads l
      WHERE created_at IS NOT NULL
        AND COALESCE(l.name, '') !~* '(test|тест)'
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
   GET /api/admin/metrika/conversion — воронка конверсии
   ───────────────────────────────────────────────────────────── */
router.get("/conversion", async (req, res) => {
  const period = (req.query["period"] as string) || "7d";
  const safePeriod = (period === "today" || period === "30d" ? period : "7d") as "today" | "7d" | "30d";

  let date1: string, date2: string, prevDate1: string, prevDate2: string;
  if (safePeriod === "today") {
    date1 = moscowDateStr(0); date2 = moscowDateStr(0);
    prevDate1 = moscowDateStr(1); prevDate2 = moscowDateStr(1);
  } else if (safePeriod === "30d") {
    date1 = moscowDateStr(30); date2 = moscowDateStr(1);
    prevDate1 = moscowDateStr(60); prevDate2 = moscowDateStr(31);
  } else {
    date1 = moscowDateStr(7); date2 = moscowDateStr(1);
    prevDate1 = moscowDateStr(14); prevDate2 = moscowDateStr(8);
  }

  const cacheKey = `conversion:${safePeriod}:${date1}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }

  const [
    metrikaCurrR, metrikaPrevR,
    leadsCurrR, leadsPrevR,
    callsCurrR, callsPrevR,
    callsDailyR, leadsDailyR,
    callsBySourceR, leadsByTypeR, leadsByUtmSourceR,
  ] = await Promise.allSettled([
    fetchMetrika({ ids: COUNTER_MAIN, date1, date2, metrics: "ym:s:visits" }, { attempts: 2, requestTimeoutMs: 8_000 }),
    fetchMetrika({ ids: COUNTER_MAIN, date1: prevDate1, date2: prevDate2, metrics: "ym:s:visits" }, { attempts: 2, requestTimeoutMs: 8_000 }),
    db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (${uniqueLeadsSql(date1, date2)}) AS unique_leads
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (${uniqueLeadsSql(prevDate1, prevDate2)}) AS unique_leads
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        (SELECT COUNT(*)::int
         FROM (${uniqueTargetCallsSql(date1, date2)}) AS unique_target_calls) AS answered,
        COUNT(*) FILTER (WHERE status = 'missed')::int       AS missed
      FROM calltouch_calls
      WHERE started_at >= (${date1}::date AT TIME ZONE 'Europe/Moscow')
        AND started_at < ((${date2}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Moscow')
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        (SELECT COUNT(*)::int
         FROM (${uniqueTargetCallsSql(prevDate1, prevDate2)}) AS unique_target_calls) AS answered,
        COUNT(*) FILTER (WHERE status = 'missed')::int       AS missed
      FROM calltouch_calls
      WHERE started_at >= (${prevDate1}::date AT TIME ZONE 'Europe/Moscow')
        AND started_at < ((${prevDate2}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Moscow')
    `),
    db.execute(sql`
      WITH raw_calls AS (
        SELECT
          (started_at AT TIME ZONE 'Europe/Moscow')::date::text AS date,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'missed')::int AS missed
        FROM calltouch_calls
        WHERE started_at >= (${date1}::date AT TIME ZONE 'Europe/Moscow')
          AND started_at < ((${date2}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Moscow')
        GROUP BY 1
      ),
      unique_target_calls AS (
        SELECT
          (started_at AT TIME ZONE 'Europe/Moscow')::date::text AS date,
          COUNT(*)::int AS answered
        FROM (${uniqueTargetCallsSql(date1, date2)}) AS unique_calls
        GROUP BY 1
      )
      SELECT
        COALESCE(raw_calls.date, unique_target_calls.date) AS date,
        COALESCE(raw_calls.total, 0)::int AS total,
        COALESCE(unique_target_calls.answered, 0)::int AS answered,
        COALESCE(raw_calls.missed, 0)::int AS missed
      FROM raw_calls
      FULL OUTER JOIN unique_target_calls USING (date)
      ORDER BY 1
    `),
    db.execute(sql`
      SELECT
        (created_at AT TIME ZONE 'Europe/Moscow')::date::text AS date,
        COUNT(*)::int AS total
      FROM (${uniqueLeadsSql(date1, date2)}) AS unique_leads
      WHERE created_at >= (${date1}::date AT TIME ZONE 'Europe/Moscow')
        AND created_at < ((${date2}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Moscow')
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      WITH raw_calls AS (
        SELECT COALESCE(NULLIF(TRIM(source), ''), 'Неизвестно') AS source,
               COUNT(*)::int AS total
        FROM calltouch_calls
        WHERE started_at >= (${date1}::date AT TIME ZONE 'Europe/Moscow')
          AND started_at < ((${date2}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Moscow')
        GROUP BY 1
      ),
      unique_target_calls AS (
        SELECT COALESCE(NULLIF(TRIM(source), ''), 'Неизвестно') AS source,
               COUNT(*)::int AS answered
        FROM (${uniqueTargetCallsSql(date1, date2)}) AS unique_calls
        GROUP BY 1
      )
      SELECT raw_calls.source, raw_calls.total,
             COALESCE(unique_target_calls.answered, 0)::int AS answered
      FROM raw_calls
      LEFT JOIN unique_target_calls USING (source)
      ORDER BY raw_calls.total DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT
        COALESCE(NULLIF(TRIM(type), ''), 'other')  AS type,
        COUNT(*)::int                               AS count
      FROM (${uniqueLeadsSql(date1, date2)}) AS unique_leads
      GROUP BY 1 ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT
        COALESCE(NULLIF(TRIM(utm_source), ''), 'Неизвестно') AS source,
        COUNT(*)::int AS count
      FROM (${uniqueLeadsSql(date1, date2)}) AS unique_leads
      GROUP BY 1 ORDER BY count DESC
    `),
  ]);

  const metrikaOk   = metrikaCurrR.status === "fulfilled";
  const leadsOk     = leadsCurrR.status === "fulfilled";
  const calltouchOk = callsCurrR.status === "fulfilled";

  const currVisits = metrikaOk  ? Math.round(metrikaCurrR.value.totals[0] ?? 0) : 0;
  const prevVisits = metrikaPrevR.status === "fulfilled" ? Math.round(metrikaPrevR.value.totals[0] ?? 0) : 0;

  type AggRow = { total: number; answered: number; missed: number };
  const currLeads   = leadsOk ? Number((leadsCurrR.value.rows[0] as { total: number } | undefined)?.total ?? 0) : 0;
  const prevLeads   = leadsPrevR.status === "fulfilled" ? Number((leadsPrevR.value.rows[0] as { total: number } | undefined)?.total ?? 0) : 0;

  const currCalls   = calltouchOk ? (callsCurrR.value.rows[0] as AggRow | undefined) : undefined;
  const prevCalls   = callsPrevR.status === "fulfilled" ? (callsPrevR.value.rows[0] as AggRow | undefined) : undefined;
  const currAnswered = Number(currCalls?.answered ?? 0);
  const currMissed   = Number(currCalls?.missed   ?? 0);
  const currTotalCalls = Number(currCalls?.total  ?? 0);
  const prevAnswered = Number(prevCalls?.answered ?? 0);
  const prevMissed   = Number(prevCalls?.missed   ?? 0);
  const prevTotalCalls = Number(prevCalls?.total  ?? 0);

  const currGross = currLeads + currAnswered;
  const prevGross = prevLeads + prevAnswered;

  function rate(num: number, denom: number): number {
    if (!denom) return 0;
    return Math.round((num / denom) * 1000) / 10;
  }

  // Daily dynamics
  type DailyCallRow = { date: string; total: number; answered: number; missed: number };
  type DailyLeadRow = { date: string; total: number };
  const callsDaily = callsDailyR.status === "fulfilled"
    ? (callsDailyR.value.rows as unknown as DailyCallRow[]) : [];
  const leadsDaily = leadsDailyR.status === "fulfilled"
    ? (leadsDailyR.value.rows as unknown as DailyLeadRow[]) : [];

  const dailyMap = new Map<string, { leads: number; answeredCalls: number; missedCalls: number; grossConversions: number }>();
  for (const row of leadsDaily) {
    const e = dailyMap.get(row.date) ?? { leads: 0, answeredCalls: 0, missedCalls: 0, grossConversions: 0 };
    e.leads = Number(row.total);
    e.grossConversions = e.leads + e.answeredCalls;
    dailyMap.set(row.date, e);
  }
  for (const row of callsDaily) {
    const e = dailyMap.get(row.date) ?? { leads: 0, answeredCalls: 0, missedCalls: 0, grossConversions: 0 };
    e.answeredCalls = Number(row.answered);
    e.missedCalls   = Number(row.missed);
    e.grossConversions = e.leads + e.answeredCalls;
    dailyMap.set(row.date, e);
  }
  // Fill full date range (no gaps)
  const daily: Array<{ date: string; leads: number; answeredCalls: number; missedCalls: number; grossConversions: number }> = [];
  const cursor = new Date(`${date1}T00:00:00Z`);
  const endDay = new Date(`${date2}T00:00:00Z`);
  while (cursor <= endDay) {
    const d = cursor.toISOString().slice(0, 10);
    daily.push({ date: d, ...(dailyMap.get(d) ?? { leads: 0, answeredCalls: 0, missedCalls: 0, grossConversions: 0 }) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // By source (calltouch)
  type SourceRow = { source: string; total: number; answered: number };
  const bySource = callsBySourceR.status === "fulfilled"
    ? (callsBySourceR.value.rows as unknown as SourceRow[]).map(r => ({
        source: String(r.source),
        calls: Number(r.total),
        answeredCalls: Number(r.answered),
      }))
    : [];

  // By lead type
  type LeadTypeRow = { type: string; count: number };
  const LEAD_TYPE_LABELS: Record<string, string> = {
    callback: "Обратный звонок",
    testdrive: "Тест-драйв",
    credit: "Кредит",
    tradein: "Трейд-ин",
    lead: "Заявка с авто",
    other: "Прочее",
  };
  const byLeadType = leadsByTypeR.status === "fulfilled"
    ? (leadsByTypeR.value.rows as unknown as LeadTypeRow[]).map(r => ({
        type: String(r.type),
        label: LEAD_TYPE_LABELS[String(r.type)] ?? String(r.type),
        count: Number(r.count),
      }))
    : [];
  type LeadUtmSourceRow = { source: string; count: number };
  const byUtmSource = leadsByUtmSourceR.status === "fulfilled"
    ? (leadsByUtmSourceR.value.rows as unknown as LeadUtmSourceRow[]).map(r => ({
        source: String(r.source),
        count: Number(r.count),
      }))
    : [];

  const result = {
    ok: true,
    period: safePeriod,
    dateFrom: date1,
    dateTo: date2,
    current: {
      visits: currVisits,
      leads: currLeads,
      answeredCalls: currAnswered,
      missedCalls: currMissed,
      totalCalls: currTotalCalls,
      grossConversions: currGross,
      conversionRate: rate(currGross, currVisits),
      leadConversionRate: rate(currLeads, currVisits),
      callConversionRate: rate(currAnswered, currVisits),
    },
    previous: {
      visits: prevVisits,
      leads: prevLeads,
      answeredCalls: prevAnswered,
      missedCalls: prevMissed,
      totalCalls: prevTotalCalls,
      grossConversions: prevGross,
      conversionRate: rate(prevGross, prevVisits),
      leadConversionRate: rate(prevLeads, prevVisits),
      callConversionRate: rate(prevAnswered, prevVisits),
    },
    daily,
    bySource,
    byLeadType,
    byUtmSource,
    availability: {
      metrika: metrikaOk,
      leads: leadsOk,
      calltouch: calltouchOk,
    },
  };

  const hasFailure = !metrikaOk || !leadsOk || !calltouchOk;
  cacheSet(cacheKey, result, hasFailure ? 30_000 : 5 * 60_000);
  res.json(result);
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
