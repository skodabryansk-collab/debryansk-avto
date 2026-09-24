import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, CheckCircle2, Clock3, Plus, RefreshCw, XCircle } from "lucide-react";
import {
  addCmStockIntegration,
  getCmStockState,
  saveCmStockInterval,
  setCmStockIntegrationEnabled,
  startCmStockSync,
  type CmStockIntegration,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function formatDate(value: string | null | undefined) {
  if (!value) return "Ещё не запускалась";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(value: number) {
  if (!value) return "—";
  if (value < 60_000) return `${Math.max(1, Math.round(value / 1000))} сек`;
  return `${Math.floor(value / 60_000)} мин ${Math.round((value % 60_000) / 1000)} сек`;
}

function Status({ integration, running }: { integration: CmStockIntegration; running: boolean }) {
  if (running || integration.lastStatus === "running") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Обновляется</span>;
  }
  if (!integration.enabled) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"><XCircle className="h-3.5 w-3.5" />Отключена</span>;
  }
  if (integration.lastStatus === "error") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><AlertTriangle className="h-3.5 w-3.5" />Ошибка</span>;
  }
  if (integration.lastStatus === "success") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Работает</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><Clock3 className="h-3.5 w-3.5" />Ожидает первого запуска</span>;
}

export default function CmStockPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dealerId, setDealerId] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [mode, setMode] = useState<"catalog" | "options_only">("catalog");
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["cm-stock-state"],
    queryFn: getCmStockState,
    refetchInterval: 15_000,
  });

  const refreshState = () => queryClient.invalidateQueries({ queryKey: ["cm-stock-state"] });
  const intervalMutation = useMutation({
    mutationFn: saveCmStockInterval,
    onSuccess: () => {
      void refreshState();
      toast({ title: "Период сохранён", description: "Новое значение применится при следующей проверке расписания." });
    },
    onError: (err: Error) => toast({ title: "Ошибка", description: err.message, variant: "destructive" }),
  });
  const syncMutation = useMutation({
    mutationFn: startCmStockSync,
    onSuccess: result => {
      void refreshState();
      toast({ title: result.started ? "Сканирование запущено" : "Сканирование не запущено", description: result.message });
    },
    onError: (err: Error) => toast({ title: "Не удалось запустить", description: err.message, variant: "destructive" }),
  });
  const enabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setCmStockIntegrationEnabled(id, enabled),
    onSuccess: () => { void refreshState(); },
    onError: (err: Error) => toast({ title: "Не удалось изменить салон", description: err.message, variant: "destructive" }),
  });
  const addMutation = useMutation({
    mutationFn: addCmStockIntegration,
    onSuccess: () => {
      setDealerId("");
      setDealerName("");
      setMode("catalog");
      setFormOpen(false);
      void refreshState();
      toast({ title: "Салон добавлен", description: "Режим подключения сохранён. Синхронизация запустится по расписанию." });
    },
    onError: (err: Error) => toast({ title: "Не удалось добавить салон", description: err.message, variant: "destructive" }),
  });

  function submitIntegration(event: FormEvent) {
    event.preventDefault();
    addMutation.mutate({ dealerId: dealerId.trim(), dealerName: dealerName.trim(), mode });
  }

  const lastRun = data?.recentRuns[0];
  const nextRunAt = lastRun?.completed_at && data?.intervalMinutes
    ? new Date(new Date(lastRun.completed_at).getTime() + data.intervalMinutes * 60_000).toISOString()
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-sky-700">
            <Boxes className="h-4 w-4" /> Складские данные
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Интеграции CM Expert</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Единый снимок CM Business обновляет автомобили выбранных салонов. Можно подключить полный каталог или только подтверждённые опции по VIN, не меняя основной фид.
          </p>
        </div>
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || data?.running} className="shrink-0 bg-[#0070b8] text-white hover:bg-[#005a96]">
          <RefreshCw className={`mr-2 h-4 w-4 ${data?.running ? "animate-spin" : ""}`} />
          {data?.running ? "Обновление…" : "Обновить сейчас"}
        </Button>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(error as Error).message}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Подключение CM Expert</p>
          <p className={`mt-2 font-semibold ${data?.connection === "credentials_configured" ? "text-emerald-700" : "text-red-700"}`}>
            {isLoading ? "Проверка…" : data?.connection === "credentials_configured" ? "Учётные данные настроены" : "Учётные данные не настроены"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Значения секретов не отображаются. Успешность API подтверждает последняя синхронизация.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <label htmlFor="cm-stock-interval" className="text-xs font-medium uppercase tracking-wide text-slate-400">Период обновления</label>
          <select
            id="cm-stock-interval"
            value={data?.intervalMinutes ?? 30}
            onChange={event => intervalMutation.mutate(Number(event.target.value))}
            disabled={intervalMutation.isPending || isLoading}
            className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
          >
            <option value={30}>Каждые 30 минут</option>
            <option value={60}>Каждый час</option>
            <option value={120}>Каждые 2 часа</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Текущий стандарт — 30 минут. Ручное обновление запускает внеплановый полный снимок.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Последний снимок</p>
          <p className="mt-2 font-semibold text-slate-800">{formatDate(lastRun?.completed_at)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {lastRun ? `${lastRun.pages_fetched} страниц · ${lastRun.rows_scanned} записей · ${formatDuration(lastRun.duration_ms)}` : "История появится после первого запуска"}
          </p>
          {nextRunAt && <p className="mt-1 text-xs text-slate-500">Следующая проверка не позднее {formatDate(nextRunAt)}</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Салоны и состояние данных</h2>
            <p className="mt-1 text-xs text-slate-500">ID CM привязан к названию салона. Полный каталог заменяет источник автомобилей; режим опций дополняет текущий каталог по VIN.</p>
          </div>
          <Button variant="outline" onClick={() => setFormOpen(value => !value)} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Добавить салон
          </Button>
        </div>

        {formOpen && (
          <form onSubmit={submitIntegration} className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-[1fr_1.2fr_1.5fr_auto] sm:items-end">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              ID салона CM
              <Input value={dealerId} onChange={e => setDealerId(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="20556" required />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Название салона в каталоге
              <Input value={dealerName} onChange={e => setDealerName(e.target.value)} placeholder="Например, Haval Pro" required maxLength={80} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Источник автомобилей
              <select value={mode} onChange={e => setMode(e.target.value as "catalog" | "options_only")} className="block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="catalog">Весь каталог CM</option>
                <option value="options_only">Только опции по VIN</option>
              </select>
            </label>
            <Button type="submit" disabled={addMutation.isPending || dealerId.length < 3 || dealerName.trim().length < 2}>
              {addMutation.isPending ? "Добавление…" : "Добавить"}
            </Button>
            <p className="text-xs text-slate-500 sm:col-span-4">
              {mode === "catalog"
                ? "В режиме полного каталога CM становится источником цены, фото, комплектации и наличия. Отключите прежний XML-фид для этого салона."
                : "В режиме опций существующий каталог сохраняется; CM подтверждает комплектацию автомобиля только при совпадении VIN."}
            </p>
          </form>
        )}

        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Загружаю состояние интеграций…</p>
        ) : !data?.integrations.length ? (
          <p className="p-6 text-sm text-slate-500">Салоны пока не настроены.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.integrations.map(integration => (
              <article key={integration.dealerId} className="grid gap-4 p-5 lg:grid-cols-[minmax(180px,1.1fr)_minmax(200px,1.3fr)_minmax(230px,1.4fr)_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{integration.dealerName}</h3>
                    <Status integration={integration} running={Boolean(data.running)} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">CM ID: <span className="font-mono">{integration.dealerId}</span></p>
                  <p className="mt-1 text-xs text-slate-500">{integration.mode === "catalog" ? "Склад CM — каталог сайта" : "Опции CM поверх каталога сайта"}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <span className="text-slate-500">Машин в CM</span><b className="text-right text-slate-800">{integration.stockCount}</b>
                  <span className="text-slate-500">Сопоставлено</span><b className="text-right text-slate-800">{integration.matchedCount}</b>
                  <span className="text-slate-500">С опциями</span><b className="text-right text-slate-800">{integration.carsWithOptions}</b>
                  <span className="text-slate-500">Всего опций</span><b className="text-right text-slate-800">{integration.optionsCount}</b>
                </div>
                <div className="text-xs">
                  <p className="text-slate-500">Последняя проверка: <span className="text-slate-700">{formatDate(integration.lastCompletedAt)}</span></p>
                  {integration.lastError
                    ? <p className="mt-1 break-words text-red-600">{integration.lastError}</p>
                    : <p className="mt-1 text-slate-400">{integration.lastSuccessAt ? `Длительность ${formatDuration(integration.durationMs)} · ${integration.pagesFetched} страниц общего снимка` : "Ожидает первого запуска"}</p>}
                  {integration.enabled && integration.mode === "options_only" && integration.stockCount > integration.matchedCount && (
                    <p className="mt-1 text-amber-700">Не сопоставлено по VIN: {integration.stockCount - integration.matchedCount}</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={integration.enabled}
                    onChange={event => enabledMutation.mutate({ id: integration.dealerId, enabled: event.target.checked })}
                    disabled={enabledMutation.isPending || data.running}
                    className="h-4 w-4 accent-sky-700"
                  />
                  Активна
                </label>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">История обновлений</h2>
          <p className="mt-1 text-xs text-slate-500">Показываются завершённые общие сканирования CM и результат по каждому салону.</p>
        </div>
        {!data?.recentRuns.length ? (
          <p className="p-5 text-sm text-slate-500">Запусков пока нет.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recentRuns.map(run => (
              <details key={run.id} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    {run.status === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : run.status === "running" ? <RefreshCw className="h-4 w-4 animate-spin text-sky-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {formatDate(run.started_at)} · {run.trigger === "manual" ? "вручную" : run.trigger === "startup" ? "при запуске" : "по расписанию"}
                  </span>
                  <span className="text-xs text-slate-500">{run.pages_fetched} стр. · {run.rows_scanned} записей · {formatDuration(run.duration_ms)}</span>
                </summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {run.dealers.map(dealer => (
                    <div key={`${run.id}-${dealer.dealer_id}`} className="rounded-lg bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 font-medium text-slate-800">
                        <span>{dealer.dealer_name}</span>
                        <span className={dealer.status === "success" ? "text-emerald-700" : dealer.status === "disabled" ? "text-slate-400" : "text-red-700"}>
                          {dealer.status === "success" ? "OK" : dealer.status === "disabled" ? "выключена" : "ошибка"}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-500">CM: {dealer.stock_count} · совпало: {dealer.matched_count}</p>
                      <p className="text-slate-500">с опциями: {dealer.cars_with_options} · опций: {dealer.options_count}</p>
                      {dealer.error && <p className="mt-1 text-red-600">{dealer.error}</p>}
                    </div>
                  ))}
                </div>
                {run.error && <p className="mt-2 text-xs text-red-600">{run.error}</p>}
              </details>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-slate-400">
        Опции извлекаются только из разрешённых полей конкретной записи CM. Для салонов в режиме «Опции CM поверх каталога сайта» сопоставление выполняется по VIN;
        неполный снимок не публикуется, а существующие данные не очищаются при ошибке источника.
      </p>
    </div>
  );
}