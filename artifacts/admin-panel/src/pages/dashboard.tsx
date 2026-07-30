import React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getDashboardTrends, getMetrikaOnline, getLiveOnline } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Phone, Car, Inbox, Star, Bot, BarChart2, Search, FileText,
  ChevronRight, TrendingUp, TrendingDown, Minus, RefreshCw,
  PhoneMissed, PhoneCall, Tag, BookOpen, Briefcase, ExternalLink,
  Radio,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

/* ── helpers ─────────────────────────────────────────────────── */
function n(v: number | undefined | null): string {
  if (v === undefined || v === null) return "—";
  return v.toLocaleString("ru-RU");
}

function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"}`}
        />
      ))}
    </span>
  );
}

function Skeleton() {
  return <span className="inline-block w-10 h-5 bg-slate-100 rounded animate-pulse" />;
}

/* ── Sparkline ───────────────────────────────────────────────── */
interface SparklineProps {
  data: Array<{ date: string; total: number }>;
  color: string;
  gradientId: string;
}
function Sparkline({ data, color, gradientId }: SparklineProps) {
  const fmtDay = (d: unknown) => {
    if (!d || typeof d !== "string") return "";
    const [, , dd] = d.split("-");
    return dd ?? d;
  };
  return (
    <div className="mt-3 h-14">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0" }}
            formatter={(v: number) => [v, "шт."]}
            labelFormatter={fmtDay}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SparklineSkeleton() {
  return <div className="mt-3 h-14 bg-slate-50 rounded animate-pulse" />;
}

/* ── Section card ─────────────────────────────────────────────── */
interface SectionProps {
  title: string;
  icon: React.ElementType;
  color: string;
  to?: string;
  href?: string;
  loading?: boolean;
  children: React.ReactNode;
}
function Section({ title, icon: Icon, color, to, href, loading, children }: SectionProps) {
  const navigable = !!(to || href);
  const inner = (
    <Card className={`h-full border border-slate-100 shadow-sm transition-shadow ${navigable ? "hover:shadow-md cursor-pointer" : ""}`}>
      <CardHeader className="p-4 pb-3 flex flex-row items-center gap-2.5 border-b border-slate-50">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {href && <ExternalLink className="w-3.5 h-3.5 text-slate-300 ml-auto" />}
        {to && !href && <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />}
        {loading && !navigable && <RefreshCw className="w-3.5 h-3.5 text-slate-300 ml-auto animate-spin" />}
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {children}
      </CardContent>
    </Card>
  );

  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>;
  return inner;
}

/* ── Metric row ─────────────────────────────────────────────────── */
function Row({ label, value, accent, loading }: { label: React.ReactNode; value: React.ReactNode; accent?: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? "text-red-600" : "text-slate-800"}`}>
        {loading ? <Skeleton /> : value}
      </span>
    </div>
  );
}

/* ── Badge pill ─────────────────────────────────────────────────── */
function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${color}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-bold ml-3">{n(count)}</span>
    </div>
  );
}

/* ── Trend indicator ─────────────────────────────────────────────── */
function Trend({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-slate-400">—</span>;
  if (Math.abs(change) < 0.05) return (
    <span className="flex items-center gap-0.5 text-xs text-slate-400"><Minus className="w-3 h-3" />0.0</span>
  );
  if (change > 0) return (
    <span className="flex items-center gap-0.5 text-xs text-emerald-600"><TrendingUp className="w-3 h-3" />+{change.toFixed(1)}</span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="w-3 h-3" />{change.toFixed(1)}</span>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: getDashboardTrends,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const { data: onlineData } = useQuery({
    queryKey: ["metrika-online"],
    queryFn: getMetrikaOnline,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const { data: liveOnlineData } = useQuery({
    queryKey: ["live-online"],
    queryFn: getLiveOnline,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const d = data;
  const L = isLoading;
  const TL = trendsLoading;
  const onlineCount = onlineData?.online ?? null;
  const liveOnline = liveOnlineData?.online ?? null;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Дашборд</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400">обновлено в {lastUpdated}</span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 1. Звонки */}
        <Section title="Calltouch — звонки" icon={Phone} color="bg-blue-50 text-blue-600" to="/calltouch" loading={L}>
          <Row loading={L} label="Всего за 30 дней" value={n(d?.calls.total30d)} />
          <Row loading={L} label={<span className="flex items-center gap-1"><PhoneCall className="w-3 h-3 text-emerald-500" />Принято сегодня</span>} value={n(d?.calls.answeredToday)} />
          <Row loading={L} accent={!!d?.calls.missedToday} label={<span className="flex items-center gap-1"><PhoneMissed className="w-3 h-3 text-red-400" />Пропущено сегодня</span>} value={n(d?.calls.missedToday)} />
          {TL ? <SparklineSkeleton /> : trends?.calls ? (
            <Sparkline data={trends.calls} color="#3b82f6" gradientId="calls-grad" />
          ) : null}
        </Section>

        {/* 2. Автомобили */}
        <Section title="Автомобили" icon={Car} color="bg-violet-50 text-violet-600" href="https://debryansk-auto.ru/new-cars" loading={L}>
          <Row loading={L} label="Новые автомобили" value={n(d?.cars.newCount)} />
          <Row loading={L} label="Автомобили с пробегом" value={n(d?.cars.usedCount)} />
          <Row loading={L} label="Последняя синхр." value={ago(d?.cars.lastSyncAt)} />
        </Section>

        {/* 3. Лиды */}
        <Section title="Заявки (лиды)" icon={Inbox} color="bg-emerald-50 text-emerald-600" to="/leads" loading={L}>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 text-center bg-slate-50 rounded-lg p-2">
              <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.leads.today)}</div>
              <div className="text-xs text-slate-500">Сегодня</div>
            </div>
            <div className="flex-1 text-center bg-slate-50 rounded-lg p-2">
              <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.leads.total)}</div>
              <div className="text-xs text-slate-500">Всего</div>
            </div>
          </div>
          {!L && d && (
            <div className="grid grid-cols-2 gap-1.5">
              <Pill label="Звонок" count={d.leads.byType.callback} color="bg-blue-50 text-blue-700" />
              <Pill label="Тест-драйв" count={d.leads.byType.testdrive} color="bg-emerald-50 text-emerald-700" />
              <Pill label="Кредит" count={d.leads.byType.credit} color="bg-violet-50 text-violet-700" />
              <Pill label="Trade-in" count={d.leads.byType.tradein} color="bg-amber-50 text-amber-700" />
            </div>
          )}
          {TL ? <SparklineSkeleton /> : trends?.leads ? (
            <Sparkline data={trends.leads} color="#10b981" gradientId="leads-grad" />
          ) : null}
        </Section>

        {/* 4. Отзывы */}
        <Section title="Отзывы" icon={Star} color="bg-amber-50 text-amber-600" to="/reviews" loading={L}>
          {!L && d ? (
            <div className="flex items-center gap-3 mb-3 p-3 bg-amber-50/50 rounded-lg">
              <div className="text-3xl font-bold text-amber-600">{d.reviews.avgRating.toFixed(1)}</div>
              <div>
                <Stars rating={d.reviews.avgRating} />
                <div className="text-xs text-slate-500 mt-0.5">{n(d.reviews.total)} отзывов</div>
              </div>
            </div>
          ) : (
            <div className="h-16 bg-slate-50 rounded-lg animate-pulse mb-3" />
          )}
          <Row loading={L} label="Последняя синхр." value={ago(d?.reviews.lastSyncAt)} />
        </Section>

        {/* 5. Navigator AI */}
        <Section title="Navigator AI" icon={Bot} color="bg-sky-50 text-sky-600" to="/navigator" loading={L}>
          <Row loading={L} label="Всего диалогов" value={n(d?.navigator.total)} />
          <Row loading={L} label="Диалогов сегодня" value={n(d?.navigator.today)} />
          <Row loading={L} label="Оценённых ответов" value={n(d?.navigator.rated)} />
        </Section>

        {/* 6. Посетители */}
        <Section title="Посетители (Яндекс.Метрика)" icon={BarChart2} color="bg-rose-50 text-rose-600" to="/visitors" loading={L}>
          {/* Онлайн сейчас — живой счётчик с VPS */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0 animate-pulse" />
            <span className="text-xs text-emerald-700 font-medium">Онлайн сейчас</span>
            <span className="ml-auto text-sm font-bold text-emerald-700">
              {liveOnline !== null ? n(liveOnline) : "—"}
            </span>
          </div>
          {/* Метрика — историческая статистика */}
          {d?.visitors === null && !L ? (
            <div className="text-xs text-slate-400 py-2">Метрика недоступна</div>
          ) : (
            <>
              {onlineCount !== null && (
                <div className="text-[10px] text-slate-400 -mt-1 mb-2 pl-1">
                  Метрика: {n(onlineCount)} чел.
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1 text-center bg-slate-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.visitors?.today)}</div>
                  <div className="text-xs text-slate-500">Сегодня</div>
                </div>
                <div className="flex-1 text-center bg-slate-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.visitors?.week)}</div>
                  <div className="text-xs text-slate-500">7 дней</div>
                </div>
                <div className="flex-1 text-center bg-slate-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.visitors?.month)}</div>
                  <div className="text-xs text-slate-500">30 дней</div>
                </div>
              </div>
            </>
          )}
        </Section>

        {/* 7. SEO позиции */}
        <Section title="SEO позиции" icon={Search} color="bg-indigo-50 text-indigo-600" to="/seo-positions">
          {L ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-9 bg-slate-50 rounded-lg animate-pulse" />)}
            </div>
          ) : d?.seoPositions.length ? (
            <div className="space-y-1.5">
              {d.seoPositions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-xs text-slate-700 truncate">{s.query}</span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{s.position.toFixed(1)}</span>
                  <Trend change={s.change} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-2">Нет данных о позициях</div>
          )}
        </Section>

        {/* 8. Контент */}
        <Section title="Контент" icon={FileText} color="bg-teal-50 text-teal-600">
          <div className="grid grid-cols-2 gap-2">
            <Link to="/news" className="flex flex-col items-center bg-slate-50 hover:bg-teal-50 rounded-lg p-3 transition">
              <BookOpen className="w-5 h-5 text-slate-400 mb-1" />
              <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.content.news)}</div>
              <div className="text-xs text-slate-500">Новостей</div>
            </Link>
            <Link to="/promotions" className="flex flex-col items-center bg-slate-50 hover:bg-teal-50 rounded-lg p-3 transition">
              <Tag className="w-5 h-5 text-slate-400 mb-1" />
              <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.content.promotions)}</div>
              <div className="text-xs text-slate-500">Акций</div>
            </Link>
            <Link to="/faq" className="flex flex-col items-center bg-slate-50 hover:bg-teal-50 rounded-lg p-3 transition">
              <FileText className="w-5 h-5 text-slate-400 mb-1" />
              <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.content.faqs)}</div>
              <div className="text-xs text-slate-500">FAQ</div>
            </Link>
            <a href="https://hh.ru/employer/2421744" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center bg-slate-50 hover:bg-teal-50 rounded-lg p-3 transition">
              <Briefcase className="w-5 h-5 text-slate-400 mb-1" />
              <div className="text-lg font-bold text-slate-800">{L ? <Skeleton /> : n(d?.content.vacancies)}</div>
              <div className="text-xs text-slate-500">Вакансий</div>
            </a>
          </div>
        </Section>

      </div>
    </div>
  );
}
