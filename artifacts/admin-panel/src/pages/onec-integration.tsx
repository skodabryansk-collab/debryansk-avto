import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOneCAdminLogs,
  useGetOneCAdminMappings,
  useGetOneCAdminStatus,
  useUpdateOneCDepartmentMapping,
  useUpdateOneCOrganizationMapping,
  getGetOneCAdminLogsQueryKey,
  getGetOneCAdminMappingsQueryKey,
  getGetOneCAdminStatusQueryKey,
  type GetOneCAdminLogsParams,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import {
  Activity,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Tag,
} from "lucide-react";

const PAGE_SIZE = 25;

type EventTypeFilter = "all" | "api_request" | "settings_change";
type OutcomeFilter = "all" | "success" | "error" | "settings_updated";

type MappingDraft = {
  entity: "organization" | "department";
  id: number;
  label: string;
  code: string | null;
  confirmed: boolean;
  locationNames?: string[];
  locationCount?: number;
};

type MappingFormValues = {
  code: string;
  confirmed: boolean;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeLabel(outcome: string): string {
  if (outcome === "success") return "Ответ выдан";
  if (outcome === "error") return "Ошибка";
  if (outcome === "settings_updated") return "Настройки изменены";
  return outcome;
}

function StatusPill({ good, children }: { good: boolean; children: string }) {
  return (
    <Badge
      variant="outline"
      className={good
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-800"}
    >
      {good ? <Check className="mr-1 h-3 w-3" /> : <CircleAlert className="mr-1 h-3 w-3" />}
      {children}
    </Badge>
  );
}

export default function OneCIntegrationPage() {
  const [activeTab, setActiveTab] = useState<"journal" | "settings">("journal");
  const [eventType, setEventType] = useState<EventTypeFilter>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<MappingDraft | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const logParams = useMemo<GetOneCAdminLogsParams>(() => ({
    page,
    page_size: PAGE_SIZE,
    ...(eventType === "all" ? {} : { event_type: eventType }),
    ...(outcome === "all" ? {} : { outcome }),
  }), [eventType, outcome, page]);

  const statusQuery = useGetOneCAdminStatus({
    query: { refetchInterval: 30_000, queryKey: getGetOneCAdminStatusQueryKey() },
  });
  const logsQuery = useGetOneCAdminLogs(logParams);
  const mappingsQuery = useGetOneCAdminMappings({
    query: { enabled: activeTab === "settings", queryKey: getGetOneCAdminMappingsQueryKey() },
  });
  const organizationMutation = useUpdateOneCOrganizationMapping();
  const departmentMutation = useUpdateOneCDepartmentMapping();
  const saving = organizationMutation.isPending || departmentMutation.isPending;

  const refreshAll = () => {
    void statusQuery.refetch();
    void logsQuery.refetch();
    if (activeTab === "settings") void mappingsQuery.refetch();
  };

  const saveMapping = async (values: MappingFormValues) => {
    if (!draft) return;
    const code = values.code.trim() || null;
    const confirmed = Boolean(code && values.confirmed && !code.startsWith("TMP1C-"));
    try {
      if (draft.entity === "organization") {
        await organizationMutation.mutateAsync({
          locationId: draft.id,
          data: { code, confirmed },
        });
      } else {
        await departmentMutation.mutateAsync({
          brandId: draft.id,
          data: { code, confirmed },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetOneCAdminMappingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetOneCAdminLogsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetOneCAdminStatusQueryKey() }),
      ]);
      setDraft(null);
      toast({ title: "Код интеграции сохранён" });
    } catch (error) {
      toast({
        title: "Не удалось сохранить код",
        description: error instanceof Error ? error.message : "Проверьте значение и повторите попытку.",
        variant: "destructive",
      });
    }
  };

  const logs = logsQuery.data;
  const status = statusQuery.data;
  const mappings = mappingsQuery.data;

  return (
    <div className="space-y-5" data-testid="page-onec-integration">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#0070b8]" />
            Системная интеграция
          </p>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Интеграция с 1С</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Обмен рабочими листами, доступ и коды организаций и подразделений.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={statusQuery.isFetching || logsQuery.isFetching}
          data-testid="button-refresh-onec"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${statusQuery.isFetching || logsQuery.isFetching ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={KeyRound}
          label="Токен доступа"
          loading={statusQuery.isLoading}
          value={status?.token_configured ? "Настроен" : "Не настроен"}
          detail={status?.token_active
            ? "Bearer-проверка включена в production"
            : status?.token_configured ? "В dev обмен отключён" : "Секрет на сервере не задан"}
          good={status?.token_active === true}
        />
        <SummaryCard
          icon={Activity}
          label="Запросы за 24 часа"
          loading={statusQuery.isLoading}
          value={status ? String(status.requests_24h) : "—"}
          detail={status ? `${status.failures_24h} с ошибкой` : "Сводка журнала"}
          good={status?.failures_24h === 0}
        />
        <SummaryCard
          icon={Clock3}
          label="Последний запрос"
          loading={statusQuery.isLoading}
          value={status?.last_request_at ? formatDate(status.last_request_at) : "Пока не было"}
          detail="Все попытки доступа к API"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Последний успешный ответ"
          loading={statusQuery.isLoading}
          value={status?.last_success_at ? formatDate(status.last_success_at) : "Пока не было"}
          detail="Это подтверждает выдачу ответа, не создание документа в 1С"
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="Разделы интеграции">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "journal"}
          onClick={() => setActiveTab("journal")}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "journal" ? "border-[#0070b8] text-[#0067a9]" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          data-testid="tab-onec-journal"
        >
          Журнал обмена
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "settings" ? "border-[#0070b8] text-[#0067a9]" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          data-testid="tab-onec-settings"
        >
          Настройки
        </button>
      </div>

      {activeTab === "journal" ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">События интеграции</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Храним технические сведения 90 дней. Содержимое РЛ и токен в журнал не попадают.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  Событие
                  <select
                    value={eventType}
                    onChange={event => {
                      setEventType(event.target.value as EventTypeFilter);
                      setPage(1);
                    }}
                    className="mt-1 block h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800"
                    data-testid="select-onec-event-type"
                  >
                    <option value="all">Все события</option>
                    <option value="api_request">Запросы 1С</option>
                    <option value="settings_change">Изменения настроек</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Результат
                  <select
                    value={outcome}
                    onChange={event => {
                      setOutcome(event.target.value as OutcomeFilter);
                      setPage(1);
                    }}
                    className="mt-1 block h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800"
                    data-testid="select-onec-outcome"
                  >
                    <option value="all">Все результаты</option>
                    <option value="success">Ответ выдан</option>
                    <option value="error">Ошибка</option>
                    <option value="settings_updated">Настройки изменены</option>
                  </select>
                </label>
              </div>
            </div>

            {logsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : logsQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                Не удалось загрузить журнал. Проверьте соединение и повторите попытку.
              </div>
            ) : logs?.items.length ? (
              <>
                <div className="space-y-3 md:hidden">
                  {logs.items.map(entry => (
                    <article
                      key={entry.id}
                      className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
                      data-testid={`card-onec-log-${entry.id}`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">{formatDate(entry.created_at)}</p>
                          <p className="mt-1 font-medium text-slate-800">
                            {entry.event_type === "settings_change" ? "Настройки интеграции" : "Запрос 1С"}
                          </p>
                        </div>
                        <Badge className="shrink-0" variant={entry.outcome === "error" ? "destructive" : "secondary"}>
                          {entry.http_status ? `${entry.http_status} · ` : ""}
                          {outcomeLabel(entry.outcome)}
                        </Badge>
                      </div>
                      <p className="mt-2 break-all text-xs text-slate-500">{entry.endpoint ?? entry.entity_name ?? "—"}</p>
                      {entry.event_type === "api_request" ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                          {entry.entity_type === "client_card" ? (
                            <span className="col-span-2">Рабочий лист: №{entry.entity_id ?? "—"}</span>
                          ) : (
                            <>
                              <span>Листов: <b className="text-slate-800">{entry.item_count}</b></span>
                              <span className="col-span-2">Курсор: {entry.after_id ?? "—"} → {entry.next_cursor ?? "—"}</span>
                            </>
                          )}
                          <span>Время: {entry.duration_ms == null ? "—" : `${entry.duration_ms} мс`}</span>
                          {entry.error_code && <span className="col-span-2 break-all font-medium text-red-700">{entry.error_code}</span>}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                          <p>{entry.entity_type === "organization" ? "Организация" : "Подразделение"}</p>
                          <p className="break-all">{entry.previous_code || "пусто"} → {entry.new_code || "пусто"}</p>
                          {entry.actor_login && <p>Изменил: {entry.actor_login}</p>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Время</th>
                        <th className="px-3 py-3 font-semibold">Событие</th>
                        <th className="px-3 py-3 font-semibold">Результат</th>
                        <th className="px-3 py-3 font-semibold">Данные обмена</th>
                        <th className="px-3 py-3 font-semibold">Подробности</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.items.map(entry => (
                        <tr key={entry.id} className="align-top hover:bg-slate-50/70" data-testid={`row-onec-log-${entry.id}`}>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(entry.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-800">
                              {entry.event_type === "settings_change" ? "Настройки интеграции" : "Запрос 1С"}
                            </div>
                            <div className="mt-1 break-all text-xs text-slate-500">
                              {entry.endpoint ?? entry.entity_name ?? "—"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={entry.outcome === "error" ? "destructive" : "secondary"}>
                              {entry.http_status ? `${entry.http_status} · ` : ""}
                              {outcomeLabel(entry.outcome)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {entry.event_type === "api_request" ? (
                              <div className="space-y-1">
                                {entry.entity_type === "client_card" ? (
                                  <div>Рабочий лист: №{entry.entity_id ?? "—"}</div>
                                ) : (
                                  <>
                                    <div>Листов: <span className="font-semibold text-slate-800">{entry.item_count}</span></div>
                                    <div>Курсор: {entry.after_id ?? "—"} → {entry.next_cursor ?? "—"}</div>
                                  </>
                                )}
                                <div>Время: {entry.duration_ms == null ? "—" : `${entry.duration_ms} мс`}</div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>{entry.entity_type === "organization" ? "Организация" : "Подразделение"}</div>
                                <div className="max-w-48 break-all">{entry.previous_code || "пусто"} → {entry.new_code || "пусто"}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {entry.error_code ? (
                              <span className="font-medium text-red-700">{entry.error_code}</span>
                            ) : entry.actor_login ? (
                              <>Изменил: {entry.actor_login}</>
                            ) : entry.event_type === "api_request" ? (
                              <>{entry.method}{entry.has_more ? " · есть следующая страница" : ""}</>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>Всего событий: {logs.total}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(current => Math.max(1, current - 1))}
                      disabled={page <= 1 || logsQuery.isFetching}
                      data-testid="button-onec-prev-page"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Назад
                    </Button>
                    <span className="min-w-20 text-center">Страница {logs.page} из {Math.max(1, logs.pages)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(current => current + 1)}
                      disabled={page >= logs.pages || logsQuery.isFetching}
                      data-testid="button-onec-next-page"
                    >
                      Далее <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
                <Activity className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <h3 className="font-medium text-slate-800">Пока нет событий обмена</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Здесь появятся запросы 1С и изменения кодов после первого обращения к API.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-[#0070b8]"><KeyRound className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Токен и доступ</h2>
                    <p className="mt-1 max-w-xl text-sm text-slate-500">
                      API принимает запросы только с Bearer-токеном. Значение токена хранится в серверном секрете и не показывается в админке.
                    </p>
                  </div>
                </div>
                <StatusPill good={status?.token_configured === true}>
                  {status?.token_configured ? "Секрет настроен" : "Секрет не найден"}
                </StatusPill>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoBlock label="Секрет сервера" value={status?.secret_name ?? "ONEC_CLIENT_CARDS_TOKEN"} />
                <InfoBlock label="Авторизация" value={status?.authentication ?? "Bearer"} />
                <InfoBlock label="Выгрузка рабочих листов" value={status?.feed_path ?? "/api/integrations/1c/v1/client-cards"} />
                <InfoBlock label="Первичная настройка курсора" value={status?.initial_cursor_path ?? "/api/integrations/1c/v1/client-cards/initial-cursor"} />
                <InfoBlock label="Обратное обновление из 1С" value="PATCH /api/integrations/1c/v1/client-cards/{id}/onec-data" />
              </div>
              <p className="mt-4 rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                Для смены токена обновите серверный секрет и защищённую конфигурацию VPS, затем передайте новый токен в 1С.
                Журнал записывает обращения и статусы, но никогда не сохраняет токен или полный ответ с данными клиента.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="font-semibold text-slate-900">Коды 1С</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Локация сопоставляется с организацией, марка — с подразделением. Внешний обмен блокируется, пока коды не подтверждены.
                </p>
              </div>

              {mappingsQuery.isLoading ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <Skeleton className="h-52 w-full" />
                  <Skeleton className="h-52 w-full" />
                </div>
              ) : mappingsQuery.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                  Не удалось загрузить сопоставления кодов.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  <MappingList
                    title="Организации по локациям"
                    icon={MapPin}
                    rows={mappings?.organizations ?? []}
                    codeField="organization_code"
                    onEdit={item => setDraft({
                      entity: "organization",
                      id: item.id,
                      label: item.title,
                      code: item.organization_code,
                      confirmed: item.confirmed,
                    })}
                  />
                  <MappingList
                    title="Подразделения по маркам"
                    icon={Tag}
                    rows={mappings?.departments ?? []}
                    codeField="department_code"
                    onEdit={item => setDraft({
                      entity: "department",
                      id: item.id,
                      label: item.brand_name,
                      code: item.department_code,
                      confirmed: item.confirmed,
                      locationNames: item.location_names,
                      locationCount: item.location_count,
                    })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <MappingEditor
        draft={draft}
        saving={saving}
        onOpenChange={open => { if (!open && !saving) setDraft(null); }}
        onSubmit={saveMapping}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  loading,
  good,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  loading: boolean;
  good?: boolean;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex min-h-28 items-start gap-3 p-4">
        <div className={`rounded-lg p-2 ${good === false ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-[#0070b8]"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {loading ? <Skeleton className="mt-2 h-5 w-28" /> : (
            <p className="mt-1 break-words text-base font-semibold text-slate-900" data-testid={`summary-${label}`}>
              {value}
            </p>
          )}
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-slate-800" data-testid={`value-${label}`}>{value}</p>
    </div>
  );
}

function MappingList<T extends {
  id: number;
  confirmed: boolean;
  organization_code?: string | null;
  department_code?: string | null;
  title?: string;
  brand_name?: string;
  location_names?: string[];
  location_count?: number;
}>({
  title,
  icon: Icon,
  rows,
  codeField,
  onEdit,
}: {
  title: string;
  icon: typeof MapPin;
  rows: T[];
  codeField: "organization_code" | "department_code";
  onEdit: (item: T) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <Badge variant="secondary" className="ml-auto">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">Нет записей.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map(item => {
            const label = item.title ?? item.brand_name ?? "Без названия";
            const code = item[codeField] ?? null;
            const temporary = code?.startsWith("TMP1C-") === true;
            const isMapped = item.location_count === undefined || item.location_count === 1;
            return (
              <div key={item.id} className="flex min-w-0 items-start gap-3 p-3" data-testid={`mapping-row-${codeField}-${item.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-medium text-slate-800">{label}</p>
                    {temporary ? <Badge variant="outline" className="border-amber-200 text-amber-800">Временный код</Badge>
                      : item.confirmed ? <Badge variant="outline" className="border-emerald-200 text-emerald-700">Подтверждён</Badge>
                        : <Badge variant="outline" className="border-slate-200 text-slate-500">Не подтверждён</Badge>}
                  </div>
                  {item.location_names && (
                    <p className={`mt-1 text-xs ${isMapped ? "text-slate-500" : "text-amber-700"}`}>
                      {item.location_names.length ? item.location_names.join(", ") : "Локация не назначена"}
                      {!isMapped && item.location_count !== undefined ? ` · локаций: ${item.location_count}` : ""}
                    </p>
                  )}
                  <p className="mt-1 break-all font-mono text-xs text-slate-600">{code || "Код не задан"}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => onEdit(item)}
                  data-testid={`button-edit-mapping-${codeField}-${item.id}`}
                  aria-label={`Изменить код: ${label}`}
                >
                  <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Изменить</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MappingEditor({
  draft,
  saving,
  onOpenChange,
  onSubmit,
}: {
  draft: MappingDraft | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MappingFormValues) => Promise<void>;
}) {
  const form = useForm<MappingFormValues>({
    defaultValues: { code: draft?.code ?? "", confirmed: draft?.confirmed ?? false },
  });
  useEffect(() => {
    form.reset({ code: draft?.code ?? "", confirmed: draft?.confirmed ?? false });
  }, [draft, form]);
  const code = form.watch("code").trim();
  const isTemporary = code.startsWith("TMP1C-");
  const canConfirm = Boolean(code) && !isTemporary;

  return (
    <Dialog open={Boolean(draft)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.entity === "organization" ? "Код организации 1С" : "Код подразделения 1С"}</DialogTitle>
          <DialogDescription>
            {draft?.label}
            {draft?.locationNames?.length ? ` · ${draft.locationNames.join(", ")}` : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async values => {
              const trimmed = values.code.trim();
              if (trimmed.length > 128) {
                form.setError("code", { message: "Не более 128 символов." });
                return;
              }
              if (!trimmed && values.confirmed) {
                form.setError("confirmed", { message: "Сначала укажите код 1С." });
                return;
              }
              await onSubmit(values);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Внешний код 1С</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={128}
                      placeholder="Например, код из справочника 1С"
                      autoComplete="off"
                      data-testid="input-onec-mapping-code"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isTemporary && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                Это временный код сайта. Он не принимается для выгрузки и не может быть подтверждён.
              </p>
            )}
            <FormField
              control={form.control}
              name="confirmed"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={value => field.onChange(value === true)}
                      disabled={!canConfirm}
                      data-testid="checkbox-onec-mapping-confirmed"
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="cursor-pointer">Подтверждаю, что код проверен в 1С</FormLabel>
                    <p className="text-xs text-slate-500">Без подтверждения API не передаст РЛ по этой марке или локации.</p>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#0070b8] hover:bg-[#005a94]" data-testid="button-save-onec-mapping">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
