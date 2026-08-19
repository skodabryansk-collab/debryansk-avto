import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  getMetrikaSummary, getMetrikaChart, getMetrikaSources,
  getMetrikaPages, getMetrikaOnline, getLiveOnline, getVisitorActivity,
} from "@/lib/api";
import type { VisitorActivityCell, VisitorActivityMetric, VisitorActivityMode, VisitorActivityResult } from "@/lib/api";
import { Clock3, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

type Period = "today" | "7d" | "30d";

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function periodDates(period: Period): { date1: string; date2: string } {
  if (period === "today") return { date1: dateStr(0), date2: dateStr(0) };
  if (period === "30d") return { date1: dateStr(30), date2: dateStr(1) };
  return { date1: dateStr(7), date2: dateStr(1) };
}

function formatNum(n: number): string {
  return n.toLocaleString("ru-RU");
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}`;
}

/* ── Delta badge ── */
function DeltaBadge({ curr, prev, inverted = false }: { curr: number; prev: number; inverted?: boolean }) {
  if (!prev || prev === 0) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return <span className="text-xs text-slate-400 ml-1">0%</span>;
  const positive = inverted ? pct < 0 : pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ml-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

/* ── Skeleton ── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

/* ── Online badge ── */
function OnlineBadge() {
  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ["live-online"],
    queryFn: getLiveOnline,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  const { data: metrikaData } = useQuery({
    queryKey: ["metrika-online"],
    queryFn: getMetrikaOnline,
    refetchInterval: 30_000,
    retry: false,
  });

  // Предпочитаем собственный счётчик; Метрика — как запасной вариант
  const liveCount = liveData?.online ?? null;
  const metrikaCount = metrikaData?.online ?? null;
  const count = liveCount ?? metrikaCount;
  const isLoading = liveLoading;
  const isLive = liveCount !== null;

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isLoading ? "bg-slate-300 animate-pulse" : count !== null ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
      <div>
        <div className="text-sm text-slate-500">Сейчас на сайте</div>
        <div className="text-2xl font-bold text-slate-900 leading-tight">
          {isLoading ? <Skeleton className="h-7 w-12" /> : count !== null ? formatNum(count) : "—"}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {isLive ? "собственный счётчик" : metrikaCount !== null ? "Яндекс.Метрика" : "нет данных"} · обновляется каждые 30 сек
          {isLive && metrikaCount !== null && metrikaCount !== liveCount && (
            <span className="ml-2 text-slate-300">· Метрика: {formatNum(metrikaCount)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── KPI Card ── */
interface KpiCardProps {
  label: string;
  value: string | number;
  curr: number;
  prev: number;
  loading: boolean;
  inverted?: boolean;
  suffix?: string;
}
function KpiCard({ label, value, curr, prev, loading, inverted, suffix }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="text-[11px] font-medium text-slate-400 mb-1">{label}</div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-20 mb-1" />
          <Skeleton className="h-4 w-14" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-slate-900 leading-tight">
            {typeof value === "number" ? formatNum(value) : value}{suffix}
          </div>
          <div className="flex items-center mt-1">
            <span className="text-xs text-slate-400">vs прошлый период</span>
            <DeltaBadge curr={curr} prev={prev} inverted={inverted} />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Custom chart tooltip ── */
function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800">{formatNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Source colors ── */
const SRC_COLORS: Record<string, string> = {
  "Поиск": "#0070b8",
  "Прямые": "#3b82f6",
  "Реклама": "#f59e0b",
  "Ссылки": "#10b981",
  "Соцсети": "#8b5cf6",
  "Email": "#ec4899",
  "Мессенджеры": "#06b6d4",
};
const DEFAULT_COLOR = "#94a3b8";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const ACTIVITY_METRICS: Array<{ value: VisitorActivityMetric; label: string; source: "visits" | "leads" | "calls" }> = [
  { value: "visits", label: "Визиты", source: "visits" },
  { value: "leads", label: "Заявки", source: "leads" },
  { value: "calls", label: "Звонки", source: "calls" },
  { value: "answered", label: "Отвеченные", source: "calls" },
  { value: "missed", label: "Пропущенные", source: "calls" },
];

function activityValue(value: number, mode: VisitorActivityMode): string {
  if (mode === "total") return formatNum(Math.round(value));
  return value.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function activityColor(value: number, maxValue: number): string {
  if (!value || !maxValue) return "#f1f5f9";
  const intensity = Math.sqrt(value / maxValue);
  return `hsl(207 89% ${95 - intensity * 50}%)`;
}

function ActivityHeatmap({
  data,
  isLoading,
  isError,
  metric,
  mode,
  onMetricChange,
  onModeChange,
}: {
  data: VisitorActivityResult | undefined;
  isLoading: boolean;
  isError: boolean;
  metric: VisitorActivityMetric;
  mode: VisitorActivityMode;
  onMetricChange: (metric: VisitorActivityMetric) => void;
  onModeChange: (mode: VisitorActivityMode) => void;
}) {
  const selected = ACTIVITY_METRICS.find(item => item.value === metric) ?? ACTIVITY_METRICS[0];
  const sourceUnavailable = data ? !data.sources[selected.source].ok : false;
  const cells = data?.cells[metric] ?? [];
  const bySlot = new Map(cells.map(cell => [`${cell.dayOfWeek}-${cell.hour}`, cell]));
  const maxValue = Math.max(0, ...cells.map(cell => cell.value));
  const peak = cells.reduce<VisitorActivityCell | null>((best, cell) =>
    !best || cell.value > best.value ? cell : best, null);
  const unavailableSources = data
    ? ACTIVITY_METRICS
      .filter(item => !data.sources[item.source].ok)
      .map(item => item.source)
      .filter((source, index, list) => list.indexOf(source) === index)
    : [];

  return (
    <section className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-[#0070b8]" />
            <h2 className="text-sm font-semibold text-slate-700">Активность по времени</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            День недели × час · время Москвы
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {(["average", "total"] as VisitorActivityMode[]).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                aria-pressed={mode === value}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  mode === value ? "bg-white text-[#0070b8] shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {value === "average" ? "Среднее" : "Всего"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {ACTIVITY_METRICS.map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => onMetricChange(item.value)}
                aria-pressed={metric === item.value}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                  metric === item.value
                    ? "bg-[#0070b8] text-white border-[#0070b8]"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full mt-5" />
      ) : isError ? (
        <div className="flex items-center justify-center h-56 mt-4 text-sm text-slate-400">
          Не удалось загрузить активность по времени
        </div>
      ) : sourceUnavailable ? (
        <div className="flex items-center justify-center h-56 mt-4 text-sm text-slate-400">
          Данные «{selected.label.toLowerCase()}» временно недоступны
        </div>
      ) : (
        <>
          {unavailableSources.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
              Часть источников временно недоступна: {unavailableSources.includes("visits") ? "Метрика" : ""}
              {unavailableSources.length > 1 && " и "}
              {unavailableSources.includes("leads") || unavailableSources.includes("calls") ? "база обращений" : ""}.
              Остальные показатели показаны без изменений.
            </div>
          )}
          <div className="mt-5 overflow-x-auto pb-1">
            <div className="min-w-[760px]">
              <table className="sr-only">
                <caption>
                  {selected.label}: {mode === "average" ? "среднее значение" : "всего"} по дням недели и часам, время Москвы
                </caption>
                <thead>
                  <tr>
                    <th scope="col">День недели</th>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <th key={hour} scope="col">{String(hour).padStart(2, "0")}:00</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((weekday, dayOfWeek) => (
                    <tr key={weekday}>
                      <th scope="row">{weekday}</th>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <td key={hour}>{activityValue(bySlot.get(`${dayOfWeek}-${hour}`)?.value ?? 0, mode)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: "46px repeat(24, minmax(24px, 1fr))" }}>
                <div />
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="text-center text-[10px] text-slate-400 tabular-nums">
                    {String(hour).padStart(2, "0")}
                  </div>
                ))}
                {WEEKDAYS.map((weekday, dayOfWeek) => (
                  <React.Fragment key={weekday}>
                    <div className="text-xs font-medium text-slate-500 pr-1">{weekday}</div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = bySlot.get(`${dayOfWeek}-${hour}`);
                      const value = cell?.value ?? 0;
                      const intensity = maxValue ? Math.sqrt(value / maxValue) : 0;
                      const endHour = String((hour + 1) % 24).padStart(2, "0");
                      const title = `${weekday}, ${String(hour).padStart(2, "0")}:00–${endHour}:00 — ${activityValue(value, mode)} ${selected.label.toLowerCase()}`;
                      return (
                        <div
                          key={hour}
                          title={title}
                          aria-hidden="true"
                          className={`aspect-square min-h-6 rounded-[3px] border border-white/80 transition-transform hover:scale-110 hover:z-10 cursor-default ${
                            intensity > 0.58 ? "text-white" : "text-slate-600"
                          }`}
                          style={{ backgroundColor: activityColor(value, maxValue) }}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <span>Меньше</span>
              {[0, 0.2, 0.4, 0.65, 1].map(value => (
                <span
                  key={value}
                  className="w-4 h-4 rounded-[3px] border border-white"
                  style={{ backgroundColor: value ? activityColor(value * maxValue, maxValue) : "#f1f5f9" }}
                />
              ))}
              <span>Больше</span>
            </div>
            {peak && peak.value > 0 ? (
              <span>
                Пик: <strong className="text-slate-600">{WEEKDAYS[peak.dayOfWeek]}, {String(peak.hour).padStart(2, "0")}:00</strong>
                {" · "}{activityValue(peak.value, mode)} {selected.label.toLowerCase()}
              </span>
            ) : (
              <span>За период нет данных по выбранному показателю</span>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            {mode === "average"
              ? "Среднее значение для каждого сочетания дня недели и часа в выбранном периоде."
              : "Суммарное количество обращений и визитов в каждом сочетании дня недели и часа."}
          </p>
        </>
      )}
    </section>
  );
}

export default function VisitorsPage() {
  const [period, setPeriod] = React.useState<Period>("7d");
  const [updatedAt, setUpdatedAt] = React.useState<string>("");
  const [activityMetric, setActivityMetric] = React.useState<VisitorActivityMetric>("visits");
  const [activityMode, setActivityMode] = React.useState<VisitorActivityMode>("average");
  const { date1, date2 } = periodDates(period);

  const summaryQ = useQuery({
    queryKey: ["metrika-summary", period],
    queryFn: () => getMetrikaSummary(period),
    refetchInterval: 60_000,
    retry: 1,
  });

  const chartQ = useQuery({
    queryKey: ["metrika-chart", date1, date2],
    queryFn: () => getMetrikaChart(date1, date2),
    retry: 1,
  });

  const sourcesQ = useQuery({
    queryKey: ["metrika-sources", date1, date2],
    queryFn: () => getMetrikaSources(date1, date2),
    retry: 1,
  });

  const pagesQ = useQuery({
    queryKey: ["metrika-pages", date1, date2],
    queryFn: () => getMetrikaPages(date1, date2),
    retry: 1,
  });

  const activityQ = useQuery({
    queryKey: ["metrika-activity", period, activityMode],
    queryFn: () => getVisitorActivity(period, activityMode),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  React.useEffect(() => {
    if (summaryQ.isFetched) {
      const now = new Date();
      setUpdatedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }
  }, [summaryQ.dataUpdatedAt]);

  const s = summaryQ.data;
  const curr = s?.current;
  const prev = s?.previous;
  const loading = summaryQ.isLoading;

  const periodLabel: Record<Period, string> = {
    today: "Сегодня",
    "7d": "7 дней",
    "30d": "30 дней",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Посетители</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Яндекс.Метрика · debryansk-auto.ru
            {updatedAt && <span className="ml-2 text-slate-400">· обновлено в {updatedAt}</span>}
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["today", "7d", "30d"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setActivityMode(p === "today" ? "total" : "average");
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white text-[#0070b8] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {summaryQ.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {/unauthorized|401/i.test(String(summaryQ.error))
            ? "Сессия истекла — выйдите и войдите снова."
            : `Ошибка Метрики: ${String(summaryQ.error)}`}
        </div>
      )}

      {/* Online + KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="sm:col-span-2 lg:col-span-2">
          <OnlineBadge />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Визиты" value={curr?.visits ?? 0} curr={curr?.visits ?? 0} prev={prev?.visits ?? 0} loading={loading} />
          <KpiCard label="Посетители" value={curr?.users ?? 0} curr={curr?.users ?? 0} prev={prev?.users ?? 0} loading={loading} />
          <KpiCard label="Просмотры" value={curr?.pageviews ?? 0} curr={curr?.pageviews ?? 0} prev={prev?.pageviews ?? 0} loading={loading} />
          <KpiCard label="Отказы" value={curr?.bounceRate ?? 0} curr={curr?.bounceRate ?? 0} prev={prev?.bounceRate ?? 0} loading={loading} inverted suffix="%" />
        </div>
      </div>

      {/* Avg duration + chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ср. время */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ср. время на сайте</div>
          {loading ? (
            <>
              <Skeleton className="h-9 w-24 mb-2" />
              <Skeleton className="h-4 w-20" />
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {curr?.avgDurationFormatted ?? "—"}
              </div>
              <div className="flex items-center">
                <span className="text-xs text-slate-400">vs прошлый период</span>
                <DeltaBadge curr={curr?.avgDuration ?? 0} prev={prev?.avgDuration ?? 0} />
              </div>
              {!loading && curr && prev && (
                <div className="mt-4 text-xs text-slate-400">
                  Прошлый период: {prev.avgDurationFormatted}
                </div>
              )}
            </>
          )}
        </div>

        {/* Visits chart */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
          <div className="text-sm font-semibold text-slate-700 mb-4">Визиты по дням</div>
          {chartQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : chartQ.isError ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartQ.data?.rows ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0070b8" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0070b8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="visits" name="Визиты" stroke="#0070b8" strokeWidth={2} fill="url(#gradVisits)" dot={false} />
                <Area type="monotone" dataKey="users" name="Уники" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradUsers)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <ActivityHeatmap
        data={activityQ.data}
        isLoading={activityQ.isLoading}
        isError={activityQ.isError}
        metric={activityMetric}
        mode={activityMode}
        onMetricChange={setActivityMetric}
        onModeChange={setActivityMode}
      />

      {/* Sources + Pages row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Traffic sources */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm font-semibold text-slate-700 mb-4">Источники трафика</div>
          {sourcesQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !sourcesQ.data?.rows?.length ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, sourcesQ.data.rows.length * 40)}>
              <BarChart
                data={sourcesQ.data.rows}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  formatter={(v: number) => [formatNum(v), "Визиты"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="visits" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#64748b", formatter: (v: number) => formatNum(v) }}>
                  {sourcesQ.data.rows.map((row, i) => (
                    <Cell key={i} fill={SRC_COLORS[row.name] ?? DEFAULT_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top pages */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm font-semibold text-slate-700 mb-4">Топ страниц входа</div>
          {pagesQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !pagesQ.data?.rows?.length ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Нет данных</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 py-2.5 pr-3 pl-1">#</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 py-2.5">Страница</th>
                    <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400 py-2.5 pl-3">Визиты</th>
                    <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400 py-2.5 pl-3">Просмотры</th>
                  </tr>
                </thead>
                <tbody>
                  {pagesQ.data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                      <td className="py-2 max-w-[200px]">
                        <a
                          href={`https://debryansk-auto.ru${row.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0070b8] hover:underline flex items-center gap-1 truncate"
                          title={row.path}
                        >
                          <span className="truncate">{row.path}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                        </a>
                      </td>
                      <td className="py-2 pl-3 text-right font-semibold text-slate-800">{formatNum(row.visits)}</td>
                      <td className="py-2 pl-3 text-right text-slate-500">{formatNum(row.pageviews)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
