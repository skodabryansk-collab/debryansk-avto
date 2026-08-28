import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, RefreshCw, RotateCcw, Server, HardDrive, Clock, AlertTriangle, CheckCircle, XCircle, Zap, ChevronDown, ChevronRight
} from "lucide-react";
import {
  getPrerenderEntries,
  getPrerenderEntryStatus,
  getServerHealth,
  rebuildPrerenderRoute,
  rebuildPrerenderBulk,
  runPrerender,
  getPrerenderStatus,
  type PrerenderEntry,
  type ServerHealth,
} from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function formatAge(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}д назад`;
  if (hours > 0) return `${hours}ч назад`;
  if (mins > 0) return `${mins}м назад`;
  return "только что";
}

type StatusKey = "fresh" | "stale" | "very_stale" | "missing";

function statusLabel(s: StatusKey) {
  const map: Record<StatusKey, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    fresh:      { label: "Свежий",   variant: "default" },
    stale:      { label: "Устарел",  variant: "secondary" },
    very_stale: { label: "Очень старый", variant: "destructive" },
    missing:    { label: "Нет кэша", variant: "destructive" },
  };
  return map[s] ?? map.missing;
}

function groupEntries(entries: PrerenderEntry[]) {
  const groups: Record<string, PrerenderEntry[]> = {
    brands:   [],
    new_cars: [],
    used_cars: [],
    news:     [],
    other:    [],
  };
  for (const e of entries) {
    if (e.route.startsWith("/brands/")) groups.brands.push(e);
    else if (e.route.startsWith("/new-cars/")) groups.new_cars.push(e);
    else if (e.route.startsWith("/cars/")) groups.used_cars.push(e);
    else if (e.route.startsWith("/news/")) groups.news.push(e);
    else groups.other.push(e);
  }
  return groups;
}

const GROUP_LABELS: Record<string, string> = {
  brands:    "Бренды",
  new_cars:  "Новые авто",
  used_cars: "Б/У авто",
  news:      "Новости",
  other:     "Прочее",
};

// ─── Server Health Card ───────────────────────────────────────────────────────

function ServerHealthPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["server-health"],
    queryFn: getServerHealth,
    refetchInterval: 30000,
  });

  const restartWarning = (data?.pm2_restarts ?? 0) > 10;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Здоровье сервера</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : !data ? (
          <p className="text-sm text-red-500">Ошибка загрузки</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Uptime */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Аптайм
              </div>
              <span className="text-lg font-semibold">{formatUptime(data.uptime_seconds)}</span>
            </div>

            {/* Memory */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <HardDrive className="h-3 w-3" /> Память
              </div>
              <span className="text-lg font-semibold">{formatBytes(data.memory_rss)}</span>
              <span className="text-xs text-muted-foreground">heap {formatBytes(data.memory_heap_used)}</span>
            </div>

            {/* PM2 Restarts */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RotateCcw className="h-3 w-3" /> Рестарты PM2
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-semibold ${restartWarning ? "text-red-600" : ""}`}>
                  {data.pm2_restarts ?? "—"}
                </span>
                {restartWarning && (
                  <span title="Более 10 рестартов — возможен crash loop">
                    <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                  </span>
                )}
              </div>
              {data.pm2_uptime_ms != null && (
                <span className="text-xs text-muted-foreground">PM2 uptime {formatUptime(data.pm2_uptime_ms / 1000)}</span>
              )}
            </div>

            {/* Node version */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" /> Node.js
              </div>
              <span className="text-sm font-medium">{data.node_version}</span>
              <span className="text-xs text-muted-foreground">
                {data.pm2_status ? (
                  <span className={data.pm2_status === "online" ? "text-green-600" : "text-red-600"}>
                    PM2: {data.pm2_status}
                  </span>
                ) : "без PM2"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Prerender Cache Group ────────────────────────────────────────────────────

function CacheGroupTable({
  groupKey,
  entries,
  onRebuild,
  rebuilding,
}: {
  groupKey: string;
  entries: PrerenderEntry[];
  onRebuild: (routes: string[]) => void;
  rebuilding: boolean;
}) {
  const [expanded, setExpanded] = React.useState(groupKey === "brands" || groupKey === "other");

  const staleCount = entries.filter(e => e.status === "stale" || e.status === "very_stale").length;
  const missingCount = entries.filter(e => e.status === "missing").length;
  const totalSize = entries.reduce((acc, e) => acc + (e.size_bytes ?? 0), 0);

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-semibold">{GROUP_LABELS[groupKey] ?? groupKey}</CardTitle>
            <span className="text-xs text-muted-foreground">{entries.length} страниц · {formatBytes(totalSize)}</span>
            {missingCount > 0 && <Badge variant="destructive" className="text-xs">{missingCount} нет</Badge>}
            {staleCount > 0 && <Badge variant="secondary" className="text-xs">{staleCount} устарело</Badge>}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            disabled={rebuilding}
            onClick={(e) => { e.stopPropagation(); onRebuild(entries.map(en => en.route)); }}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${rebuilding ? "animate-spin" : ""}`} />
            Пересобрать группу
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Маршрут</th>
                  <th className="text-right py-2 pr-4 font-medium">Размер</th>
                  <th className="text-right py-2 pr-4 font-medium">Обновлён</th>
                  <th className="text-center py-2 pr-4 font-medium">Статус</th>
                  <th className="text-right py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const { label, variant } = statusLabel(entry.status as StatusKey);
                  return (
                    <tr key={entry.route} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs">{entry.route}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {entry.size_bytes != null ? formatBytes(entry.size_bytes) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {entry.mtime ? formatAge(entry.mtime) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <Badge variant={variant} className="text-xs">{label}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          disabled={rebuilding}
                          onClick={() => onRebuild([entry.route])}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrerenderMonitorPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: entriesData, isLoading: entriesLoading, refetch: refetchEntries } = useQuery({
    queryKey: ["prerender-entries"],
    queryFn: getPrerenderEntries,
    refetchInterval: 60000,
  });

  const { data: prerenderStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["prerender-status-monitor"],
    queryFn: getPrerenderEntryStatus,
    refetchInterval: 5000,
  });

  const isRunning = prerenderStatus?.status === "running";

  // Mutation: rebuild specific route(s)
  const rebuildMutation = useMutation({
    mutationFn: async (routes: string[]): Promise<{ ok: boolean; message: string }> => {
      const result = routes.length === 1
        ? await rebuildPrerenderRoute(routes[0])
        : await rebuildPrerenderBulk(routes);
      return { ok: result.ok, message: result.message };
    },
    onSuccess: (_data, routes) => {
      toast({
        title: "Пририндер запущен",
        description: `${routes.length === 1 ? routes[0] : `${routes.length} страниц`} — ~30 сек`,
      });
      // Poll until done
      const interval = setInterval(async () => {
        const s = await getPrerenderEntryStatus();
        if (s.status !== "running") {
          clearInterval(interval);
          refetchEntries();
          queryClient.invalidateQueries({ queryKey: ["prerender-status-monitor"] });
        }
      }, 3000);
      setTimeout(() => clearInterval(interval), 180000);
    },
    onError: (err: Error) => {
      if (err.message.includes("уже выполняется") || err.message.includes("409")) {
        toast({ title: "Пририндер уже запущен", description: "Подождите завершения", variant: "default" });
      } else {
        toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      }
    },
  });

  // Mutation: full site prerender
  const fullPrerenderMutation = useMutation({
    mutationFn: runPrerender,
    onSuccess: () => {
      toast({ title: "Полный пририндер запущен", description: "Обновит все страницы (~10–15 мин)" });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const entries = entriesData?.entries ?? [];
  const groups = groupEntries(entries);

  const totalEntries = entries.length;
  const freshCount   = entries.filter(e => e.status === "fresh").length;
  const staleCount   = entries.filter(e => e.status === "stale" || e.status === "very_stale").length;
  const missingCount = entries.filter(e => e.status === "missing").length;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Мониторинг Prerender
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Состояние Puppeteer-кэша и здоровья сервера
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchEntries(); refetchStatus(); }}
            disabled={entriesLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${entriesLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
          <Button
            size="sm"
            onClick={() => fullPrerenderMutation.mutate()}
            disabled={isRunning || fullPrerenderMutation.isPending}
          >
            <Zap className="h-4 w-4 mr-1" />
            Полный crawl
          </Button>
        </div>
      </div>

      {/* Running status banner */}
      {isRunning && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
          <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
          <div>
            <span className="font-medium">Пририндер выполняется…</span>
            {prerenderStatus?.startedAt && (
              <span className="text-sm ml-2 text-blue-600">начат {formatAge(prerenderStatus.startedAt)}</span>
            )}
          </div>
        </div>
      )}

      {/* Last run status */}
      {!isRunning && prerenderStatus?.lastStatus && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
          prerenderStatus.lastStatus === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {prerenderStatus.lastStatus === "success"
            ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
            : <XCircle className="h-4 w-4 flex-shrink-0" />}
          <span>
            Последний запуск: <strong>{prerenderStatus.lastStatus === "success" ? "успешно" : "ошибка"}</strong>
            {prerenderStatus.completedAt && <span className="ml-1 opacity-75">({formatAge(prerenderStatus.completedAt)})</span>}
          </span>
        </div>
      )}

      {/* Server health */}
      <ServerHealthPanel />

      {/* Cache summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Всего страниц", value: totalEntries, icon: HardDrive, color: "" },
          { label: "Свежих", value: freshCount, icon: CheckCircle, color: "text-green-600" },
          { label: "Устаревших", value: staleCount, icon: AlertTriangle, color: staleCount > 0 ? "text-yellow-600" : "" },
          { label: "Нет кэша", value: missingCount, icon: XCircle, color: missingCount > 0 ? "text-red-600" : "" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cache groups */}
      {entriesLoading ? (
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Сканирование кэша…</p></CardContent></Card>
      ) : entries.length === 0 ? (
        <Card><CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <HardDrive className="h-10 w-10 opacity-30" />
            <p>Кэш пустой — запустите полный crawl или пересоберите отдельные маршруты</p>
          </div>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(groups)
            .filter(([, es]) => es.length > 0)
            .map(([groupKey, es]) => (
              <CacheGroupTable
                key={groupKey}
                groupKey={groupKey}
                entries={es}
                onRebuild={(routes) => rebuildMutation.mutate(routes)}
                rebuilding={rebuildMutation.isPending || isRunning}
              />
            ))}
        </div>
      )}
    </div>
  );
}
