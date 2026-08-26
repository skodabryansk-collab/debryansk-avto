import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, CircleSlash, Clock3, ExternalLink,
  Globe2, Link2, MessageSquareQuote, RefreshCw, SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGeoCitationReport,
  type GeoCitationProviderStatus,
  type GeoCitationQuery,
  type GeoCitationWeek,
} from "@/lib/api";

const STATUS_STYLE: Record<GeoCitationProviderStatus, { label: string; className: string }> = {
  ok: { label: "Получены", className: "bg-emerald-100 text-emerald-700" },
  partial: { label: "Частично", className: "bg-amber-100 text-amber-700" },
  "manual-export": { label: "Ручной экспорт", className: "bg-blue-100 text-blue-700" },
  unavailable: { label: "Недоступен", className: "bg-slate-100 text-slate-600" },
  error: { label: "Ошибка источника", className: "bg-red-100 text-red-700" },
  "not-run": { label: "Не запущен", className: "bg-slate-100 text-slate-500" },
};

function percentage(value: number | null | undefined): string {
  return value == null ? "—" : `${value}%`;
}

function dateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

function rateTone(value: number | null): string {
  if (value == null) return "text-slate-500";
  if (value >= 50) return "text-emerald-600";
  if (value > 0) return "text-amber-600";
  return "text-slate-700";
}

function QueryStatus({ query }: { query: GeoCitationQuery }) {
  if (query.blockedByUnavailable) {
    return <span className="text-xs text-slate-500">Источник недоступен</span>;
  }
  if (query.notRun) {
    return <span className="text-xs text-slate-500">Не запущен</span>;
  }
  if (query.responses > 0 && query.siteLinks === 0) {
    return <span className="text-xs font-medium text-amber-700">Нет ссылок на сайт</span>;
  }
  return <span className="text-xs text-emerald-700">Есть цитирование</span>;
}

function LatestSummary({ latest, updatedAt }: { latest: GeoCitationWeek; updatedAt: string | null }) {
  const emptyCitationQueries = latest.byQuery.filter((query) => query.responses > 0 && query.siteLinks === 0);
  const notRunQueries = latest.byQuery.filter((query) => query.notRun);
  const blockedQueries = latest.byQuery.filter((query) => query.blockedByUnavailable);
  const pagesNeedingReview = latest.pages.filter((page) => page.needsReview);
  const reviewQueries = latest.byQuery.filter(
    (query) => query.notRun || query.blockedByUnavailable || (query.responses > 0 && query.siteLinks === 0),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Последняя неделя</p>
          <h3 className="mt-0.5 text-xl font-bold text-slate-800">{latest.week}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Отчёт обновлён: {dateTime(updatedAt)} · Внешние AI-запросы при открытии страницы не выполняются.
          </p>
        </div>
        <span className="rounded-full bg-[#0070b8]/10 px-3 py-1.5 text-xs font-semibold text-[#0070b8]">
          {latest.runs} {latest.runs === 1 ? "плановый запуск" : "плановых запуска"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Ответы", value: `${latest.responses}/${latest.expectedResponses}`, note: `покрытие ${percentage(latest.responseCoveragePct)}`, icon: MessageSquareQuote, color: "text-[#0070b8]" },
          { label: "Проверено запросов", value: `${latest.queriesChecked}/20`, note: `покрытие ${percentage(latest.queryCoveragePct)}`, icon: SearchX, color: "text-violet-600" },
          { label: "Упоминания", value: percentage(latest.mentionRatePct), note: `${latest.mentions} ответов с названием`, icon: Globe2, color: rateTone(latest.mentionRatePct) },
          { label: "Ссылки на сайт", value: percentage(latest.citationRatePct), note: `${latest.siteLinks} ответов со ссылкой`, icon: Link2, color: rateTone(latest.citationRatePct) },
        ].map(({ label, value, note, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon className="h-3.5 w-3.5 text-slate-400" />
              {label}
            </div>
            <div className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">{note}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h4 className="text-sm font-bold text-slate-800">Источники AI-ответов</h4>
          <p className="mt-0.5 text-xs text-slate-500">Недоступные источники не входят в процент упоминаний и ссылок.</p>
        </div>
        <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          {latest.byProvider.map((provider) => {
            const status = STATUS_STYLE[provider.status] ?? STATUS_STYLE["not-run"];
            return (
              <div key={provider.provider} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800">{provider.label}</h5>
                    <p className="mt-1 text-xs text-slate-500">
                      {provider.responses}/{provider.expectedQueries} ответов · {percentage(provider.queryCoveragePct)} покрытие
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                {["unavailable", "error"].includes(provider.status) ? (
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    {provider.reason || "Ответы не были получены; это не считается отсутствием цитирования."}
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Упоминания</p>
                      <p className={`mt-0.5 text-sm font-bold ${rateTone(provider.mentionRatePct)}`}>{percentage(provider.mentionRatePct)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ссылки</p>
                      <p className={`mt-0.5 text-sm font-bold ${rateTone(provider.citationRatePct)}`}>{percentage(provider.citationRatePct)}</p>
                    </div>
                  </div>
                )}
                {provider.failedQueries.length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Не получено ответов: {provider.failedQueries.length}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="text-sm font-bold text-slate-800">Цитируемые страницы</h4>
            <p className="mt-0.5 text-xs text-slate-500">Какие URL сайта AI-системы показали в своих источниках.</p>
          </div>
          {latest.topCitedPages.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
              <CircleSlash className="h-4 w-4 text-slate-400" />
              В полученных ответах пока нет ссылок на сайт.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {latest.topCitedPages.slice(0, 8).map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-3 px-4 py-3">
                  <a
                    href={`https://debryansk-auto.ru${page.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate font-mono text-xs font-semibold text-[#0070b8] hover:underline"
                  >
                    {page.path}<ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                  <span className="shrink-0 rounded-full bg-[#0070b8]/10 px-2.5 py-1 text-xs font-bold text-[#0070b8]">
                    {page.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="text-sm font-bold text-slate-800">Страницы без цитат</h4>
            <p className="mt-0.5 text-xs text-slate-500">Показаны только страницы с полученными ответами без ссылки на них.</p>
          </div>
          {pagesNeedingReview.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Нет страниц, которые требуют проверки по последнему замеру.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pagesNeedingReview.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-3 px-4 py-3">
                  <a
                    href={`https://debryansk-auto.ru${page.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate font-mono text-xs font-semibold text-[#0070b8] hover:underline"
                  >
                    {page.path}<ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                  <span className="shrink-0 text-xs text-amber-700">{page.responses} ответов</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h4 className="text-sm font-bold text-slate-800">Запросы, требующие внимания</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Без ссылки на сайт: {emptyCitationQueries.length} · Не запущены: {notRunQueries.length} · Заблокированы источником: {blockedQueries.length}
          </p>
        </div>
        {reviewQueries.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Все полученные ответы в последнем замере содержат ссылку на сайт.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Запрос</th>
                  <th className="px-4 py-2.5 text-right">Ответы</th>
                  <th className="px-4 py-2.5 text-right">Ссылки</th>
                  <th className="px-4 py-2.5 text-left">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviewQueries.map((query) => (
                  <tr key={query.queryId} className="hover:bg-slate-50">
                    <td className="max-w-xl px-4 py-3 text-slate-700">{query.query}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{query.responses}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{query.siteLinks}</td>
                    <td className="px-4 py-3"><QueryStatus query={query} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SeoGeoCitationsTab() {
  const { data: report, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["seo-geo-citations"],
    queryFn: getGeoCitationReport,
    staleTime: 60_000,
  });

  const emptyState = report?.status === "empty" || report?.status === "invalid";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Globe2 className="h-4 w-4 text-violet-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">GEO-цитирование</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Упоминания и ссылки на сайт в ответах AI-поиска. Это наблюдаемые ответы, а не полное покрытие выдачи.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Обновить данные
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}</div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800"><AlertTriangle className="h-4 w-4" />Не удалось загрузить GEO-отчёт</div>
          <p className="mt-1 text-sm text-red-700">Повторите попытку. Если ошибка сохраняется, проверьте API и сохранённый недельный отчёт.</p>
        </div>
      ) : emptyState || !report?.data.latest ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          {report?.status === "invalid" ? <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" /> : <Clock3 className="mx-auto h-8 w-8 text-slate-400" />}
          <h3 className="mt-3 text-base font-bold text-slate-700">
            {report?.status === "invalid" ? "Отчёт требует проверки" : "Недельных GEO-данных пока нет"}
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
            {report?.message || "Запустите недельный замер на сервере — после сохранения отчёт появится здесь автоматически."}
          </p>
          <p className="mt-3 font-mono text-xs text-slate-500">pnpm run geo:citations:weekly</p>
        </div>
      ) : (
        <>
          <LatestSummary latest={report.data.latest} updatedAt={report.data.updatedAt} />
          {report.data.history.length > 1 && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h4 className="text-sm font-bold text-slate-800">Недельная динамика</h4>
                <p className="mt-0.5 text-xs text-slate-500">До 12 последних сохранённых недель.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Неделя</th>
                      <th className="px-4 py-2.5 text-right">Ответы</th>
                      <th className="px-4 py-2.5 text-right">Покрытие</th>
                      <th className="px-4 py-2.5 text-right">Упоминания</th>
                      <th className="px-4 py-2.5 text-right">Ссылки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...report.data.history].reverse().map((week) => (
                      <tr key={week.week} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-700">{week.week}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{week.responses}/{week.expectedResponses}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#0070b8]">{percentage(week.responseCoveragePct)}</td>
                        <td className={`px-4 py-3 text-right font-semibold tabular-nums ${rateTone(week.mentionRatePct)}`}>{percentage(week.mentionRatePct)}</td>
                        <td className={`px-4 py-3 text-right font-semibold tabular-nums ${rateTone(week.citationRatePct)}`}>{percentage(week.citationRatePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}