import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSeoAudit, runSeoAudit, clearPrerenderCache, requestYandexRecrawl, generateBrandDescriptions, rebuildCache, prerenderRoute, prerenderBulk, getPrerenderStatus, getRebuildStatus, runPrerender,
  getRouteHealth, repairRoute,
  type SeoPageItem, type GeneratedBrandDescription, type OpStatus, type RouteHealthItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash2, AlertTriangle, CheckCircle2, Globe, Tag, FileText, RefreshCw, Play, Wand2, Hammer, Loader, Clock, CircleCheck, CircleX } from "lucide-react";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function OpCard({
  label,
  icon,
  op,
  onStart,
  starting,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  op: OpStatus | undefined;
  onStart: () => void;
  starting: boolean;
  disabled?: boolean;
}) {
  const running = op?.status === "running";
  const lastOk = op?.lastStatus === "success";
  const lastErr = op?.lastStatus === "error";

  return (
    <div className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
      running ? "border-blue-200 bg-blue-50" :
      lastErr ? "border-red-200 bg-red-50" :
      lastOk ? "border-emerald-200 bg-emerald-50/60" :
      "border-slate-200 bg-white"
    }`}>
      <div className={`flex-shrink-0 ${running ? "text-blue-500" : lastErr ? "text-red-500" : lastOk ? "text-emerald-500" : "text-slate-400"}`}>
        {running
          ? <Loader className="w-5 h-5 animate-spin" />
          : lastErr
          ? <CircleX className="w-5 h-5" />
          : lastOk
          ? <CircleCheck className="w-5 h-5" />
          : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" />
          {running
            ? op?.startedAt
              ? `Запущено в ${new Date(op.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
              : "Выполняется..."
            : op?.lastRanAt
            ? `Завершено ${formatRelativeTime(op.lastRanAt)}`
            : "Не запускалось"}
          {lastErr && op?.lastExitCode != null && op.lastExitCode !== 0 && (
            <span className="text-red-500 ml-1">(код {op.lastExitCode})</span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onStart}
        disabled={starting || running || disabled}
        className={running
          ? "border-blue-200 text-blue-600"
          : lastErr
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"}
      >
        {running ? "Выполняется" : starting ? "Запуск..." : "Запустить"}
      </Button>
    </div>
  );
}

const sourceLabels: Record<SeoPageItem["source"], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  static: { label: "Статическая", icon: FileText },
  brand: { label: "Бренд", icon: Tag },
  promotion: { label: "Акция", icon: FileText },
  car: { label: "Авто", icon: FileText },
  ssg: { label: "SSG", icon: FileText },
};

export default function SeoPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SeoPageItem["source"] | "all">("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [brandPreview, setBrandPreview] = useState<GeneratedBrandDescription[] | null>(null);

  const { data: audit, isLoading } = useQuery({
    queryKey: ["seo-audit"],
    queryFn: getSeoAudit,
  });

  const { data: prerenderStatus } = useQuery({
    queryKey: ["prerender-status"],
    queryFn: getPrerenderStatus,
    refetchInterval: 3000,
  });
  const isPrerenderRunning = prerenderStatus?.status === "running";

  const { data: rebuildStatus } = useQuery({
    queryKey: ["rebuild-status"],
    queryFn: getRebuildStatus,
    refetchInterval: 3000,
  });
  const isSsgRebuilding = rebuildStatus?.status === "running";

  // Auto-trigger audit when prerender or SSG rebuild transitions from "running" → "idle"
  const prevPrerenderStatus = useRef<string | undefined>(undefined);
  const prevRebuildStatus = useRef<string | undefined>(undefined);

  useEffect(() => {
    const current = prerenderStatus?.status;
    if (prevPrerenderStatus.current === "running" && current === "idle") {
      auditMutation.mutate();
    }
    prevPrerenderStatus.current = current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prerenderStatus?.status]);

  useEffect(() => {
    const current = rebuildStatus?.status;
    if (prevRebuildStatus.current === "running" && current === "idle") {
      auditMutation.mutate();
    }
    prevRebuildStatus.current = current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildStatus?.status]);

  const clearMutation = useMutation({
    mutationFn: (route: string) => clearPrerenderCache(route),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seo-audit"] });
      toast({ title: "Кеш сброшен", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const recrawlMutation = useMutation({
    mutationFn: (route: string) => requestYandexRecrawl(`https://debryansk-auto.ru${route}`),
    onSuccess: (data) => {
      toast({ title: "Запрос отправлен", description: `task_id: ${data.task_id}, остаток квоты: ${data.quota_remainder}` });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка переобхода", description: err.message, variant: "destructive" });
    },
  });

  const auditMutation = useMutation({
    mutationFn: runSeoAudit,
    onSuccess: (data) => {
      queryClient.setQueryData(["seo-audit"], data);
      const issueCount = data.items.filter((i) => i.issues.length > 0).length;
      toast({ title: "Аудит завершён", description: `Проверено ${data.items.length} страниц, проблем: ${issueCount}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка аудита", description: err.message, variant: "destructive" });
    },
  });

  const generateBrandsMutation = useMutation({
    mutationFn: (apply: boolean) => generateBrandDescriptions(apply),
    onSuccess: (data) => {
      setBrandPreview(data.generated);
      if (data.applied) {
        toast({ title: "Описания применены", description: `Обновлено: ${data.applied.updated}, пропущено: ${data.applied.skipped}.` });
        queryClient.invalidateQueries({ queryKey: ["seo-audit"] });
      } else {
        toast({ title: "Описания сгенерированы", description: `Превью для ${data.generated.length} брендов.` });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка генерации", description: err.message, variant: "destructive" });
    },
  });

  const rebuildMutation = useMutation({
    mutationFn: () => rebuildCache(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rebuild-status"] });
      toast({ title: "Пересборка SSG запущена", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка пересборки", description: err.message, variant: "destructive" });
    },
  });

  const fullPrerenderMutation = useMutation({
    mutationFn: () => runPrerender(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prerender-status"] });
      toast({ title: "Массовый пририндер запущен", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка пририндера", description: err.message, variant: "destructive" });
    },
  });

  const prerenderRouteMutation = useMutation({
    mutationFn: (route: string) => prerenderRoute(route),
    onSuccess: (data) => {
      // Don't invalidate audit immediately — auto-trigger fires when prerender completes
      queryClient.invalidateQueries({ queryKey: ["prerender-status"] });
      toast({ title: "Пририндер запущен", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка пририндера", description: err.message, variant: "destructive" });
    },
  });

  const prerenderBulkMutation = useMutation({
    mutationFn: (routes: string[]) => prerenderBulk(routes),
    onSuccess: (data) => {
      // Don't invalidate audit immediately — auto-trigger fires when prerender completes
      queryClient.invalidateQueries({ queryKey: ["prerender-status"] });
      toast({ title: `Пририндер запущен (${data.count} стр.)`, description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка массового пририндера", description: err.message, variant: "destructive" });
    },
  });

  const { data: routeHealth, isLoading: routeHealthLoading } = useQuery({
    queryKey: ["route-health"],
    queryFn: getRouteHealth,
  });

  const repairMutation = useMutation({
    mutationFn: (route: string) => repairRoute(route),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["route-health"] });
      queryClient.invalidateQueries({ queryKey: ["seo-audit"] });
      toast({ title: "Маршрут восстановлен", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка восстановления", description: err.message, variant: "destructive" });
    },
  });

  const technicalIssues: RouteHealthItem[] = (routeHealth?.items ?? []).filter(
    (i) => i.status !== "ok" || i.issueSummary.length > 0
  );

  const items = audit?.items ?? [];
  const cacheProblemItems = items.filter((i) =>
    i.issues.some((issue) => issue.includes("Не в кеше") || issue.includes("Кеш устарел"))
  );

  const filtered = items.filter((p) => {
    if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
    if (onlyProblems && p.issues.length === 0) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.route.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.issues.some((i) => i.toLowerCase().includes(q))
    );
  });

  const totalIssues = items.filter((i) => i.issues.length > 0).length;
  const staleCount = items.filter((i) => i.isStale).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Search className="w-5 h-5 text-[#0070b8]" />
        <h1 className="text-xl font-bold text-slate-900">SEO / Метатеги</h1>
      </div>
      <p className="text-sm text-slate-500">
        Здесь отображаются title и description, которые видят поисковые боты (YandexBot/Googlebot) при обходе сайта.
      </p>

      {/* Блок статуса операций — всегда виден */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Фоновые операции</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <OpCard
            label="Пересборка SSG (статические страницы)"
            icon={<Hammer className="w-5 h-5" />}
            op={rebuildStatus}
            onStart={() => rebuildMutation.mutate()}
            starting={rebuildMutation.isPending}
            disabled={isSsgRebuilding}
          />
          <OpCard
            label="Пририндер Puppeteer (все страницы)"
            icon={<Globe className="w-5 h-5" />}
            op={prerenderStatus}
            onStart={() => fullPrerenderMutation.mutate()}
            starting={fullPrerenderMutation.isPending}
            disabled={isPrerenderRunning}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск по пути, title или description..."
            className="pl-9"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SeoPageItem["source"] | "all")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0070b8]/30"
        >
          <option value="all">Все источники</option>
          <option value="static">Статические</option>
          <option value="brand">Бренды</option>
          <option value="promotion">Акции</option>
          <option value="car">Авто</option>
          <option value="ssg">SSG</option>
        </select>
        <Button
          variant={onlyProblems ? "default" : "outline"}
          onClick={() => setOnlyProblems((v) => !v)}
          className={onlyProblems ? "bg-red-500 hover:bg-red-600 text-white" : "border-slate-200 text-slate-600"}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Только проблемы
        </Button>
        <Button
          onClick={() => auditMutation.mutate()}
          disabled={auditMutation.isPending}
          className="bg-[#0070b8] hover:bg-[#005f9e] text-white"
        >
          <Play className="w-4 h-4 mr-2" />
          {auditMutation.isPending ? "Аудит..." : "Запустить аудит"}
        </Button>
        {staleCount > 0 && (
          <Button
            variant="outline"
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending || isSsgRebuilding}
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <Hammer className={`w-4 h-4 mr-2 ${isSsgRebuilding ? "animate-spin" : ""}`} />
            {rebuildMutation.isPending ? "Сборка..." : isSsgRebuilding ? "Сборка SSG..." : "Пересобрать SSG"}
          </Button>
        )}
        {cacheProblemItems.length > 0 && (
          <Button
            variant="outline"
            onClick={() => prerenderBulkMutation.mutate(cacheProblemItems.map((i) => i.route))}
            disabled={prerenderBulkMutation.isPending || isPrerenderRunning}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Globe className={`w-4 h-4 mr-2 ${isPrerenderRunning ? "animate-spin" : ""}`} />
            {prerenderBulkMutation.isPending || isPrerenderRunning
              ? "Пририндер..."
              : `Исправить кеш (${cacheProblemItems.length})`}
          </Button>
        )}
      </div>

      {items.some((i) => !i.isCached) && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader className={`w-4 h-4 ${isPrerenderRunning ? "animate-spin text-blue-500" : "text-slate-400"}`} />
          <span>
            {isPrerenderRunning
              ? "Пририндер запущен — кнопки заблокированы до завершения"
              : "Страницы без кеша можно пририндерить по одной или запустить общий пририндер."}
          </span>
        </div>
      )}

      {audit && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Страниц проверено</div>
            <div className="text-lg font-bold text-slate-900">{items.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Проблем</div>
            <div className={`text-lg font-bold ${totalIssues > 0 ? "text-red-600" : "text-emerald-600"}`}>{totalIssues}</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Устаревший кеш</div>
            <div className={`text-lg font-bold ${staleCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>{staleCount}</div>
          </div>
        </div>
      )}
      {audit && (
        <div className="text-xs text-slate-400">
          Последний аудит: {new Date(audit.ranAt).toLocaleString("ru-RU")}
        </div>
      )}

      {/* Route Health section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-800">Техническое здоровье маршрутов</h2>
          {routeHealth && (
            <span className="ml-auto text-xs text-slate-400">
              Проверено: {new Date(routeHealth.checkedAt).toLocaleString("ru-RU")}
            </span>
          )}
        </div>
        {routeHealthLoading ? (
          <div className="px-4 py-3 text-sm text-slate-500">Загрузка...</div>
        ) : technicalIssues.length === 0 ? (
          <div className="px-4 py-3 flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            Технических проблем не обнаружено
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Маршрут</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2 text-left">Проблема</th>
                  <th className="px-4 py-2 text-left">Возраст кеша</th>
                  <th className="px-4 py-2 text-left">Краулер</th>
                  <th className="px-4 py-2 text-left">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicalIssues.map((item) => (
                  <tr key={item.route} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-[#0070b8]">
                      <a
                        href={`https://debryansk-auto.ru${item.route}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {item.route}
                      </a>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.status === "ok"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.status === "error"
                          ? "bg-red-100 text-red-700"
                          : item.status === "redirect"
                          ? "bg-amber-100 text-amber-700"
                          : item.status === "timeout"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-700 max-w-xs truncate" title={item.issueSummary}>
                      {item.issueSummary || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {item.cacheAge ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`text-xs font-medium ${
                        item.crawlerStatus === "indexed"
                          ? "text-emerald-600"
                          : item.crawlerStatus === "blocked" || item.crawlerStatus === "noindex"
                          ? "text-red-600"
                          : "text-slate-400"
                      }`}>
                        {item.crawlerStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => repairMutation.mutate(item.route)}
                        disabled={repairMutation.isPending}
                        className="border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        <Hammer className="w-3.5 h-3.5 mr-1.5" />
                        Починить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Страница</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Источник</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-left">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((page) => {
                  const hasIssues = page.issues.length > 0;
                  const SourceIcon = sourceLabels[page.source].icon;
                  return (
                    <tr key={page.route} className={hasIssues ? "bg-red-50/50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 align-top">
                        <a
                          href={`https://debryansk-auto.ru${page.route}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0070b8] font-mono hover:underline"
                        >
                          {page.route}
                        </a>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[280px] max-w-xs">
                        <div className="font-medium text-slate-900 whitespace-pre-wrap break-words">{page.title}</div>
                      </td>
                      <td className="px-4 py-3 align-top min-w-[320px] max-w-md">
                        <div className="text-slate-600 whitespace-pre-wrap break-words">{page.description}</div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <SourceIcon className="w-3.5 h-3.5" />
                          {sourceLabels[page.source].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {hasIssues ? (
                          <div className="space-y-1">
                            {page.issues.map((issue, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {issue}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${page.isCached ? "text-emerald-600" : "text-slate-500"}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {page.isCached ? "В кеше" : "Не в кеше"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearMutation.mutate(page.route)}
                            disabled={clearMutation.isPending}
                            className="border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Сбросить кеш
                          </Button>
                          {(page.source === "static" || page.source === "ssg") && page.isStale && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rebuildMutation.mutate()}
                              disabled={rebuildMutation.isPending}
                              className="border-amber-200 text-amber-700 hover:bg-amber-50"
                            >
                              <Hammer className="w-3.5 h-3.5 mr-1.5" />
                              Пересобрать SSG
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => recrawlMutation.mutate(page.route)}
                            disabled={recrawlMutation.isPending}
                            className="border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Переобход Яндекс
                          </Button>
                          {page.source !== "static" && (!page.isCached || page.isStale) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => prerenderRouteMutation.mutate(page.route)}
                              disabled={prerenderRouteMutation.isPending || isPrerenderRunning}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              <Globe className={`w-3.5 h-3.5 mr-1.5 ${isPrerenderRunning ? "animate-spin" : ""}`} />
                              {prerenderRouteMutation.isPending
                                ? "Запуск..."
                                : isPrerenderRunning
                                ? "Пририндер..."
                                : page.isStale
                                ? "Обновить кеш"
                                : "Пририндерить"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500">
            Всего: {items.length} | Показано: {filtered.length} | Проблемы: {totalIssues} | Устаревший кеш: {staleCount}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Wand2 className="w-5 h-5 text-[#0070b8]" />
          <h2 className="text-lg font-bold text-slate-900">Уникализация description для брендов</h2>
        </div>
        <p className="text-sm text-slate-500">
          Сгенерируйте уникальные meta-description для брендовых страниц на основе данных каталога (модели, цены, типы кузова). Сначала превью — потом применение.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => generateBrandsMutation.mutate(false)}
            disabled={generateBrandsMutation.isPending}
            className="border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Сгенерировать превью
          </Button>
          {brandPreview && (
            <Button
              onClick={() => generateBrandsMutation.mutate(true)}
              disabled={generateBrandsMutation.isPending}
              className="bg-[#0070b8] hover:bg-[#005f9e] text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Применить {brandPreview.length} описаний
            </Button>
          )}
        </div>

        {brandPreview && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Бренд</th>
                  <th className="px-4 py-3 text-left">Сгенерированный title</th>
                  <th className="px-4 py-3 text-left">Сгенерированный description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brandPreview.map((b) => (
                  <tr key={b.slug}>
                    <td className="px-4 py-3 font-medium">{b.brandName}</td>
                    <td className="px-4 py-3 max-w-xs">{b.title}</td>
                    <td className="px-4 py-3 max-w-md text-slate-600">{b.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
