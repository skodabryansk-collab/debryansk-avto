import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const COUNTER_MAIN = 109748190;
const COUNTER_MAPS = 102232991;
const REPORT_TO = "sales@debryansk-auto.ru";
const API_BASE = "https://api-metrika.yandex.net/stat/v1/data";

const BLUE = "#0070b8";
const DARK = "#1a2332";
const GREEN = "#15803d";
const RED = "#dc2626";
const ORANGE = "#d97706";

/* ── Goals to track (id → display name) ── */
const GOALS: Array<{ id: number; name: string }> = [
  { id: 567620431, name: "📞 Клик по телефону" },
  { id: 567837105, name: "📋 Отправка формы" },
  { id: 568274052, name: "✅ Контактные данные отправлены" },
  { id: 572559350, name: "🛒 Заказ создан (CRM)" },
  { id: 572559351, name: "💳 Заказ оплачен (CRM)" },
];

/* ── Transport ── */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env["SMTP_HOST"] || "smtp.timeweb.ru",
    port: Number(process.env["SMTP_PORT"] || 465),
    secure: Number(process.env["SMTP_PORT"] || 465) === 465,
    auth: {
      user: process.env["SMTP_USER"] || "sales@debryansk-auto.ru",
      pass: process.env["SMTP_PASS"],
    },
    tls: { rejectUnauthorized: false },
  });
}

/* ── Metrika API ── */
interface MetrikaRow {
  dimensions: Array<{ name: string; id?: string }>;
  metrics: number[];
}
interface MetrikaResponse {
  data: MetrikaRow[];
  totals: number[];
  errors?: Array<{ error_type: string; message: string }>;
}

function getToken(): string {
  return process.env["YANDEX_METRIKA_TOKEN"] || "";
}

async function fetchMetrika(params: Record<string, string | number>): Promise<MetrikaResponse> {
  const token = getToken();
  if (!token) throw new Error("YANDEX_METRIKA_TOKEN не задан");

  const url = new URL(API_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const r = await fetch(url.toString(), {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

  const json = await r.json() as MetrikaResponse;
  if (!r.ok || json.errors?.length) {
    const msg = json.errors?.[0]?.message || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return json;
}

/* ── Date helpers ── */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
function weekAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 8);
  return d.toISOString().split("T")[0];
}
function formatDate(iso: string): string {
  const [y, m, day] = iso.split("-");
  return `${day}.${m}.${y}`;
}
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}
function delta(curr: number, prev: number): string {
  if (!prev) return "";
  const pct = Math.round(((curr - prev) / prev) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}%`;
}
function deltaColor(curr: number, prev: number): string {
  if (!prev) return DARK;
  return curr >= prev ? GREEN : RED;
}

/* ── Traffic source names ── */
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

/* ── HTML builders ── */
function metricRow(label: string, curr: number | string, prev?: number, fmt?: (n: number) => string): string {
  const currNum = typeof curr === "number" ? curr : 0;
  const formatted = fmt ? fmt(currNum) : currNum.toLocaleString("ru-RU");
  const dlt = prev !== undefined ? delta(currNum, prev) : "";
  const clr = prev !== undefined ? deltaColor(currNum, prev) : DARK;
  return `
  <tr>
    <td style="padding:8px 14px;color:#64748b;font-size:12px;font-weight:600;width:40%;border-right:1px solid #e2e8f0;font-family:Arial,sans-serif">${label}</td>
    <td style="padding:8px 14px;color:${DARK};font-size:13px;font-family:Arial,sans-serif;font-weight:700">${formatted}${dlt ? `&nbsp;<span style="color:${clr};font-size:11px;font-weight:600">${dlt}</span>` : ""}</td>
  </tr>`;
}

function section(title: string, emoji: string): string {
  return `<div style="background:#f0f7ff;border-left:4px solid ${BLUE};margin:20px 24px 0;padding:8px 14px;border-radius:0 8px 8px 0;font-family:Arial,sans-serif">
    <span style="font-size:16px">${emoji}</span>
    <span style="color:${BLUE};font-weight:700;font-size:13px;margin-left:6px">${title}</span>
  </div>`;
}

function table(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:calc(100% - 48px);margin:10px 24px 0;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;border-collapse:collapse">
    <tbody>${rows}</tbody>
  </table>`;
}

function altRow(label: string, val: string, i: number): string {
  return `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
    <td style="padding:7px 14px;color:#64748b;font-size:11px;width:55%;border-right:1px solid #e2e8f0;font-family:Arial,sans-serif">${label}</td>
    <td style="padding:7px 14px;color:${DARK};font-size:12px;font-family:Arial,sans-serif;font-weight:600">${val}</td>
  </tr>`;
}

function goalRow(name: string, reaches: number, reachesW: number, i: number): string {
  const dlt = delta(reaches, reachesW);
  const clr = deltaColor(reaches, reachesW);
  const badge = reaches > 0
    ? `<span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px">${reaches}</span>`
    : `<span style="display:inline-block;background:#f1f5f9;color:#94a3b8;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px">0</span>`;
  return `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
    <td style="padding:8px 14px;color:#64748b;font-size:11px;width:65%;border-right:1px solid #e2e8f0;font-family:Arial,sans-serif">${name}</td>
    <td style="padding:8px 14px;font-family:Arial,sans-serif">${badge}${dlt ? `&nbsp;<span style="color:${clr};font-size:10px;font-weight:600">${dlt}</span>` : ""}</td>
  </tr>`;
}

function buildHtml(report: ReportData): string {
  const yest = formatDate(report.date);
  const weekAgo = formatDate(report.weekDate);

  let body = `
  <div style="background:linear-gradient(135deg,${DARK} 0%,#253447 100%);padding:20px 24px 16px">
    <div style="color:#fff;font-size:18px;font-weight:800;font-family:Arial,sans-serif">📊 Яндекс.Метрика</div>
    <div style="color:#8fa8c0;font-size:12px;margin-top:4px;font-family:Arial,sans-serif">
      debryansk-auto.ru &nbsp;·&nbsp; ${yest} &nbsp;·&nbsp; сравнение с ${weekAgo}
    </div>
  </div>`;

  if (report.error) {
    body += `<div style="margin:20px 24px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:14px;color:#b91c1c;font-family:Arial,sans-serif;font-size:13px">
      ⚠️ ${report.error}
    </div>`;
  } else {
    const m = report.main!;

    /* ── Основные метрики ── */
    body += section("Основные метрики", "📈");
    body += table(
      metricRow("Визиты", m.visits, m.visitsW) +
      metricRow("Уникальные посетители", m.users, m.usersW) +
      metricRow("Просмотры страниц", m.pageviews) +
      metricRow("Отказы", m.bounceRate, undefined, n => n.toFixed(1) + "%") +
      metricRow("Ср. время на сайте", m.avgDuration, undefined, formatDuration)
    );

    /* ── Достижение целей ── */
    if (report.goals.length > 0) {
      const hasAny = report.goals.some(g => g.reaches > 0 || g.reachesW > 0);
      body += section("Достижение целей", "🎯");
      if (hasAny) {
        body += table(
          report.goals
            .map((g, i) => goalRow(g.name, g.reaches, g.reachesW, i))
            .join("")
        );
      } else {
        body += `<div style="margin:10px 24px;color:#94a3b8;font-size:12px;font-family:Arial,sans-serif">Нет данных по целям за этот день</div>`;
      }
    }

    /* ── Источники трафика ── */
    if (report.sources.length > 0) {
      body += section("Источники трафика", "🔍");
      const srcRows = report.sources
        .map((s, i) => altRow(s.name, `${s.visits.toLocaleString("ru-RU")}${s.visitsW ? `&nbsp;<span style="color:${deltaColor(s.visits, s.visitsW)};font-size:10px">&nbsp;${delta(s.visits, s.visitsW)}</span>` : ""}`, i))
        .join("");
      body += table(srcRows);
    }

    /* ── Топ поисковых запросов ── */
    if (report.searchQueries.length > 0) {
      body += section("Топ поисковых запросов", "🔎");
      const sqRows = report.searchQueries
        .map((q, i) => altRow(`${i + 1}. ${q.phrase}`, q.visits.toLocaleString("ru-RU"), i))
        .join("");
      body += table(sqRows);
    }

    /* ── Топ страниц входа ── */
    if (report.topPages.length > 0) {
      body += section("Топ-5 страниц входа", "📄");
      const pageRows = report.topPages
        .map((p, i) => altRow(`${i + 1}. ${p.path}`, p.visits.toLocaleString("ru-RU"), i))
        .join("");
      body += table(pageRows);
    }

    /* ── Поисковые системы ── */
    if (report.searchEngines.length > 0) {
      body += section("Поисковые системы", "🌐");
      const seRows = report.searchEngines
        .map((se, i) => altRow(se.name, se.visits.toLocaleString("ru-RU"), i))
        .join("");
      body += table(seRows);
    }

    /* ── Карточка на Картах ── */
    if (report.maps) {
      body += section("Карточка на Яндекс.Картах", "🗺");
      const mp = report.maps;
      body += table(
        metricRow("Визиты", mp.visits, mp.visitsW) +
        metricRow("Посетители", mp.users, mp.usersW)
      );
    }
  }

  body += `<div style="background:#f2f5f8;border-top:1px solid #dde3ea;padding:12px 24px;margin-top:20px">
    <div style="color:#8fa8c0;font-size:11px;font-family:Arial,sans-serif">
      Дебрянск Авто &nbsp;·&nbsp; Автоматический отчёт &nbsp;·&nbsp; Ежедневно 9:00 МСК
    </div>
  </div>`;

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#e8eef4;font-family:'Segoe UI',Arial,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#e8eef4;padding:24px 16px">
  <tr><td>
    <table cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 6px 32px rgba(0,0,0,0.13);background:#fff">
      <tr><td>${body}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ── Data collection ── */
interface ReportData {
  date: string;
  weekDate: string;
  main?: {
    visits: number; users: number; pageviews: number;
    bounceRate: number; avgDuration: number;
    visitsW: number; usersW: number;
  };
  goals: Array<{ name: string; reaches: number; reachesW: number }>;
  sources: Array<{ name: string; visits: number; visitsW: number }>;
  searchQueries: Array<{ phrase: string; visits: number }>;
  topPages: Array<{ path: string; visits: number }>;
  searchEngines: Array<{ name: string; visits: number }>;
  maps?: { visits: number; users: number; visitsW: number; usersW: number };
  error?: string;
}

async function collectReport(): Promise<ReportData> {
  const date = yesterdayStr();
  const weekDate = weekAgoStr();
  const data: ReportData = { date, weekDate, goals: [], sources: [], searchQueries: [], topPages: [], searchEngines: [] };

  /* ── Build goal metrics string ── */
  const goalMetrics = GOALS.map(g => `ym:s:goal${g.id}reaches`).join(",");

  /* ── Parallel: main metrics + goals (yesterday + week ago) + sources + top pages ── */
  const [mainYest, mainWeek, goalsYest, goalsWeek, srcYest, srcWeek, topRes] = await Promise.all([
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: date, date2: date,
      metrics: "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds",
    }),
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: weekDate, date2: weekDate,
      metrics: "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds",
    }),
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: date, date2: date,
      metrics: goalMetrics,
    }),
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: weekDate, date2: weekDate,
      metrics: goalMetrics,
    }),
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: date, date2: date,
      dimensions: "ym:s:trafficSource",
      metrics: "ym:s:visits",
      sort: "-ym:s:visits",
      limit: 10,
    }),
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: weekDate, date2: weekDate,
      dimensions: "ym:s:trafficSource",
      metrics: "ym:s:visits",
      sort: "-ym:s:visits",
      limit: 10,
    }),
    fetchMetrika({
      ids: COUNTER_MAIN,
      date1: date, date2: date,
      dimensions: "ym:s:startURLPath",
      metrics: "ym:s:visits",
      sort: "-ym:s:visits",
      limit: 5,
    }),
  ]);

  /* ── Main metrics ── */
  const [mv, mu, mp, mb, md] = mainYest.totals;
  const [mvW, muW] = mainWeek.totals;
  data.main = {
    visits: Math.round(mv || 0),
    users: Math.round(mu || 0),
    pageviews: Math.round(mp || 0),
    bounceRate: mb || 0,
    avgDuration: md || 0,
    visitsW: Math.round(mvW || 0),
    usersW: Math.round(muW || 0),
  };

  /* ── Goals ── */
  data.goals = GOALS.map((g, idx) => ({
    name: g.name,
    reaches: Math.round(goalsYest.totals[idx] || 0),
    reachesW: Math.round(goalsWeek.totals[idx] || 0),
  }));

  /* ── Sources ── */
  const srcWeekMap = new Map<string, number>();
  for (const row of srcWeek.data) {
    const id = row.dimensions[0]?.id || row.dimensions[0]?.name;
    srcWeekMap.set(String(id), Math.round(row.metrics[0] || 0));
  }
  data.sources = srcYest.data.map(row => {
    const id = row.dimensions[0]?.id;
    const name = srcName(id, row.dimensions[0]?.name);
    const visits = Math.round(row.metrics[0] || 0);
    const visitsW = srcWeekMap.get(String(id)) || 0;
    return { name, visits, visitsW };
  }).filter(s => s.visits > 0);

  /* ── Top entry pages ── */
  data.topPages = topRes.data.map(row => ({
    path: row.dimensions[0]?.name || "/",
    visits: Math.round(row.metrics[0] || 0),
  })).filter(p => p.visits > 0);

  /* ── Search queries + search engines (parallel, only if organic > 0) ── */
  const organicVisits = data.sources.find(s => s.name === "Поиск")?.visits || 0;
  if (organicVisits > 0) {
    const [sqRes, seRes] = await Promise.all([
      fetchMetrika({
        ids: COUNTER_MAIN,
        date1: date, date2: date,
        dimensions: "ym:s:searchPhrase",
        metrics: "ym:s:visits",
        sort: "-ym:s:visits",
        limit: 10,
        filters: "ym:s:searchPhrase!='(not set)'",
      }),
      fetchMetrika({
        ids: COUNTER_MAIN,
        date1: date, date2: date,
        dimensions: "ym:s:searchEngine",
        metrics: "ym:s:visits",
        sort: "-ym:s:visits",
        limit: 5,
      }),
    ]);

    data.searchQueries = sqRes.data
      .map(row => ({
        phrase: row.dimensions[0]?.name || "—",
        visits: Math.round(row.metrics[0] || 0),
      }))
      .filter(q => q.visits > 0 && q.phrase !== "(not set)" && q.phrase !== "—");

    data.searchEngines = seRes.data
      .map(row => ({ name: row.dimensions[0]?.name || "Другие", visits: Math.round(row.metrics[0] || 0) }))
      .filter(se => se.visits > 0);
  }

  /* ── Maps counter ── */
  const [mapsYest, mapsWeek] = await Promise.all([
    fetchMetrika({
      ids: COUNTER_MAPS,
      date1: date, date2: date,
      metrics: "ym:s:visits,ym:s:users",
    }),
    fetchMetrika({
      ids: COUNTER_MAPS,
      date1: weekDate, date2: weekDate,
      metrics: "ym:s:visits,ym:s:users",
    }),
  ]);
  data.maps = {
    visits: Math.round(mapsYest.totals[0] || 0),
    users: Math.round(mapsYest.totals[1] || 0),
    visitsW: Math.round(mapsWeek.totals[0] || 0),
    usersW: Math.round(mapsWeek.totals[1] || 0),
  };

  return data;
}

/* ── Send report ── */
export async function sendMetrikaReport(): Promise<void> {
  if (!getToken()) {
    logger.warn("[metrika] YANDEX_METRIKA_TOKEN not set — skipping report");
    return;
  }

  const date = yesterdayStr();
  let reportData: ReportData;

  try {
    reportData = await collectReport();
    logger.info({ date }, "[metrika] Report data collected");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "[metrika] Failed to collect report");
    reportData = { date, weekDate: weekAgoStr(), goals: [], sources: [], searchQueries: [], topPages: [], searchEngines: [], error: msg };
  }

  const html = buildHtml(reportData);
  const dateFormatted = formatDate(date);
  const subject = reportData.error
    ? `⚠ Отчёт Метрики не собрался — ${dateFormatted}`
    : `📊 Метрика debryansk-auto.ru — ${dateFormatted}`;

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: `"Дебрянск Авто — Аналитика" <${process.env["SMTP_USER"] || "sales@debryansk-auto.ru"}>`,
      to: REPORT_TO,
      subject,
      html,
    });
    logger.info({ to: REPORT_TO, subject }, "[metrika] Report sent");
  } catch (err) {
    logger.error({ err }, "[metrika] Failed to send report email");
    throw err;
  }
}

/* ── Preview (returns HTML without sending) ── */
export async function previewMetrikaReport(): Promise<{ subject: string; html: string }> {
  const date = yesterdayStr();
  let reportData: ReportData;

  try {
    reportData = await collectReport();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    reportData = { date, weekDate: weekAgoStr(), goals: [], sources: [], searchQueries: [], topPages: [], searchEngines: [], error: msg };
  }

  const html = buildHtml(reportData);
  const dateFormatted = formatDate(date);
  const subject = reportData.error
    ? `⚠ Отчёт Метрики не собрался — ${dateFormatted}`
    : `📊 Метрика debryansk-auto.ru — ${dateFormatted}`;

  return { subject, html };
}

/* ── Scheduler: 9:00 MSK = 06:00 UTC ── */
export function scheduleMetrikaReport(): void {
  const REPORT_HOUR_UTC = 6;
  const REPORT_MIN_UTC = 0;

  function msUntilNext(): number {
    const now = new Date();
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      REPORT_HOUR_UTC, REPORT_MIN_UTC, 0, 0,
    ));
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const ms = msUntilNext();
    const hh = Math.floor(ms / 3_600_000);
    logger.info({ inHours: hh }, "[metrika] Next report scheduled");
    setTimeout(() => {
      sendMetrikaReport()
        .then(() => logger.info("[metrika] Scheduled report sent"))
        .catch(err => logger.error({ err }, "[metrika] Scheduled report failed"));
      setInterval(() => {
        sendMetrikaReport()
          .then(() => logger.info("[metrika] Scheduled report sent"))
          .catch(err => logger.error({ err }, "[metrika] Scheduled report failed"));
      }, 24 * 60 * 60 * 1000);
    }, ms);
  }

  scheduleNext();
}
