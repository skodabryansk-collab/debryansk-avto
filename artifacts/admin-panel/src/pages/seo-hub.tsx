/**
 * SEO Центр — единый хаб, объединяющий 5 вкладок:
 * 1. Автопилот      — рекомендации GAP-анализа (перенесено из seo-autopilot.tsx)
 * 2. Позиции        — Яндекс.Вебмастер снапшоты (перенесено из seo-positions.tsx)
 * 3. Аудит кэша     — метатеги и prerender-кэш (перенесено из seo.tsx)
 * 4. Анкорные запросы — целевые позиции (новая вкладка)
 * 5. Петля Карпаты  — оценка применённых рекомендаций (новая вкладка)
 */
import React, { useState } from "react";
import {
  Zap, TrendingUp, Search, Link2, RotateCcw,
  Plus, Trash2, Edit3, CheckCircle2, X,
  ArrowUp, ArrowDown, Sparkles, FileText, ExternalLink, Eye,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import SeoAutopilotPage from "./seo-autopilot";
import SeoPositionsPage from "./seo-positions";
import SeoPage from "./seo";

import {
  getAnchorQueries, createAnchorQuery, deleteAnchorQuery,
  suggestAnchorQueries, getSeoAutopilotSuggestions,
  type AnchorQuery, type AnchorSuggestion, type SeoSuggestion,
} from "@/lib/api";

/* ── Tab definition ─────────────────────────────────────────────────── */
const TABS = [
  { id: "autopilot", label: "Автопилот",          icon: Zap,        badge: null },
  { id: "positions", label: "Позиции",             icon: TrendingUp, badge: null },
  { id: "cache",     label: "Аудит кэша",          icon: Search,     badge: null },
  { id: "anchors",   label: "Анкорные запросы",    icon: Link2,      badge: null },
  { id: "loop",      label: "Петля Карпаты",       icon: RotateCcw,  badge: null },
] as const;
type TabId = typeof TABS[number]["id"];

function TabBar({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  return (
    <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto">
      {TABS.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
              ${isActive
                ? "border-[#0070b8] text-[#0070b8]"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── AnchorQueriesTab ────────────────────────────────────────────────── */
function AnchorQueriesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [form, setForm] = useState({ query_text: "", page_url: "", target_position: "10", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["seo-anchor"],
    queryFn: getAnchorQueries,
  });
  const { data: suggestData, isLoading: suggestLoading } = useQuery({
    queryKey: ["seo-anchor-suggest"],
    queryFn: () => suggestAnchorQueries(20),
    enabled: showSuggest,
  });

  const createMut = useMutation({
    mutationFn: createAnchorQuery,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-anchor"] });
      setShowAdd(false);
      setForm({ query_text: "", page_url: "", target_position: "10", notes: "" });
      toast({ title: "Анкорный запрос добавлен" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAnchorQuery,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-anchor"] });
      toast({ title: "Запрос удалён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const addFromSuggest = (s: AnchorSuggestion) => {
    setForm({ query_text: s.query_text, page_url: "", target_position: String(Math.max(1, Math.round(s.avg_position) - 5)), notes: "" });
    setShowSuggest(false);
    setShowAdd(true);
  };

  const anchors = data?.data ?? [];
  const atTarget = anchors.filter(a => a.current_position !== null && a.current_position <= a.target_position).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Анкорные запросы</h2>
          <p className="text-sm text-slate-500 mt-0.5">Ключевые запросы с целевыми позициями для мониторинга роста</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSuggest(v => !v)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Предложить из Вебмастера
          </Button>
          <Button className="bg-[#0070b8] hover:bg-[#005fa0] text-white" onClick={() => setShowAdd(v => !v)}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить запрос
          </Button>
        </div>
      </div>

      {/* Stats */}
      {anchors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Всего запросов</div>
            <div className="text-2xl font-bold text-slate-800">{anchors.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Достигли цели</div>
            <div className="text-2xl font-bold text-green-600">{atTarget}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Требуют работы</div>
            <div className="text-2xl font-bold text-amber-600">{anchors.length - atTarget}</div>
          </div>
        </div>
      )}

      {/* Suggest panel */}
      {showSuggest && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-800 text-sm">Рекомендованные запросы из Вебмастера</h3>
            <button onClick={() => setShowSuggest(false)}><X className="w-4 h-4 text-blue-600" /></button>
          </div>
          {suggestLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 rounded" />)}</div>
          ) : (suggestData?.data ?? []).length === 0 ? (
            <p className="text-sm text-blue-600">Нет новых предложений</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-blue-600 font-semibold border-b border-blue-200">
                    <th className="text-left py-1.5">Запрос</th>
                    <th className="text-right py-1.5">Позиция</th>
                    <th className="text-right py-1.5">Показы</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {(suggestData?.data ?? []).map((s, i) => (
                    <tr key={i} className="border-b border-blue-100">
                      <td className="py-2 text-slate-700">{s.query_text}</td>
                      <td className="py-2 text-right text-slate-600">{s.avg_position.toFixed(1)}</td>
                      <td className="py-2 text-right text-slate-600">{s.total_shows.toLocaleString("ru-RU")}</td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-700"
                          onClick={() => addFromSuggest(s)}>
                          Добавить
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-slate-700 text-sm">Новый анкорный запрос</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Запрос *</label>
              <Input value={form.query_text} onChange={e => setForm(f => ({ ...f, query_text: e.target.value }))}
                placeholder="haval jolion брянск купить" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Целевая страница *</label>
              <Input value={form.page_url} onChange={e => setForm(f => ({ ...f, page_url: e.target.value }))}
                placeholder="/brands/haval-city" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Целевая позиция</label>
              <Input type="number" min={1} max={100} value={form.target_position}
                onChange={e => setForm(f => ({ ...f, target_position: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Заметки</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Опционально" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="bg-[#0070b8] hover:bg-[#005fa0] text-white" disabled={!form.query_text.trim() || !form.page_url.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ query_text: form.query_text, page_url: form.page_url, target_position: Number(form.target_position) || 10, notes: form.notes || undefined })}>
              {createMut.isPending ? "Сохраняю..." : "Сохранить"}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : anchors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Link2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Нет анкорных запросов. Добавьте ключевые запросы для мониторинга роста позиций.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Запрос</th>
                  <th className="px-4 py-3 text-left">Страница</th>
                  <th className="px-4 py-3 text-right">Цель</th>
                  <th className="px-4 py-3 text-right">Сейчас</th>
                  <th className="px-4 py-3 text-right">Клики</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anchors.map((a: AnchorQuery) => {
                  const atGoal = a.current_position !== null && a.current_position <= a.target_position;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{a.query_text}</td>
                      <td className="px-4 py-3">
                        <a href={`https://debryansk-auto.ru${a.page_url}`} target="_blank" rel="noopener noreferrer"
                          className="text-[#0070b8] font-mono text-xs hover:underline flex items-center gap-1">
                          {a.page_url}<ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">≤{a.target_position}</td>
                      <td className="px-4 py-3 text-right">
                        {a.current_position !== null ? (
                          <span className={`font-bold text-sm ${atGoal ? "text-green-600" : a.current_position > 20 ? "text-red-500" : "text-amber-600"}`}>
                            {a.current_position.toFixed(1)}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {a.total_clicks !== null ? a.total_clicks.toLocaleString("ru-RU") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {atGoal ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">✓ Достигнута</Badge>
                        ) : a.current_position !== null ? (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                            -{(a.current_position - a.target_position).toFixed(1)} поз.
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Нет данных</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteMut.mutate(a.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500">
            Всего: {anchors.length} · Достигли цели: {atTarget}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Verdict helpers ─────────────────────────────────────────────────── */
const VERDICT_CONFIG = {
  improved:   { label: "Улучшено",    color: "bg-green-100 text-green-700",  icon: ArrowUp,   dot: "bg-green-500" },
  stable:     { label: "Стабильно",   color: "bg-slate-100 text-slate-600",  icon: null,      dot: "bg-slate-400" },
  fell:       { label: "Упало",       color: "bg-red-100 text-red-700",      icon: ArrowDown, dot: "bg-red-500" },
  falsified:  { label: "Не сработало", color: "bg-orange-100 text-orange-700", icon: null,   dot: "bg-orange-500" },
} as const;

/* ── KarpathyLoopTab ─────────────────────────────────────────────────── */
function KarpathyLoopTab() {
  const [filter, setFilter] = useState<string>("all");
  const [tzSuggestion, setTzSuggestion] = useState<SeoSuggestion | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["seo-loop-evaluated"],
    queryFn: () => getSeoAutopilotSuggestions({ status: "applied", evaluated: true, limit: 100 }),
  });

  const evaluated = (data?.data ?? []) as SeoSuggestion[];
  const byVerdict = {
    improved:  evaluated.filter(s => s.evaluation_result === "improved").length,
    stable:    evaluated.filter(s => s.evaluation_result === "stable").length,
    fell:      evaluated.filter(s => s.evaluation_result === "fell").length,
    falsified: evaluated.filter(s => s.evaluation_result === "falsified").length,
  };

  const shown = filter === "all" ? evaluated : evaluated.filter(s => s.evaluation_result === filter);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Петля Карпаты</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Оценка применённых SEO-рекомендаций через 28 дней. Закрывает обратную связь — помогает системе учиться на результатах.
        </p>
      </div>

      {/* Stats cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(byVerdict) as [keyof typeof VERDICT_CONFIG, number][]).map(([v, count]) => {
            const cfg = VERDICT_CONFIG[v];
            return (
              <button key={v} onClick={() => setFilter(filter === v ? "all" : v)}
                className={`text-left bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${filter === v ? "border-[#0070b8] shadow-sm" : "border-slate-200"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <div className="text-xs text-slate-500">{cfg.label}</div>
                </div>
                <div className={`text-2xl font-bold ${v === "improved" ? "text-green-600" : v === "fell" || v === "falsified" ? "text-red-600" : "text-slate-700"}`}>{count}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Все ({evaluated.length})
        </button>
        {Object.entries(byVerdict).map(([v, count]) => count > 0 && (
          <button key={v} onClick={() => setFilter(filter === v ? "all" : v)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === v ? VERDICT_CONFIG[v as keyof typeof VERDICT_CONFIG].color + " ring-1 ring-current" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {VERDICT_CONFIG[v as keyof typeof VERDICT_CONFIG].label} ({count})
          </button>
        ))}
      </div>

      {/* ТЗ modal */}
      {tzSuggestion && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={() => setTzSuggestion(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">ТЗ для новой страницы — {tzSuggestion.page_url}</h3>
              <button onClick={() => setTzSuggestion(null)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh]">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                {tzSuggestion.content_draft ?? "(нет содержимого)"}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {evaluated.length === 0
              ? "Пока нет оценённых рекомендаций. Первая оценка пройдёт через 28 дней после применения."
              : "Нет записей с выбранным фильтром."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Страница</th>
                  <th className="px-4 py-3 text-left">Тип</th>
                  <th className="px-4 py-3 text-left">Вердикт</th>
                  <th className="px-4 py-3 text-right">Δ поз.</th>
                  <th className="px-4 py-3 text-left">Заметка</th>
                  <th className="px-4 py-3 text-left">Дата оценки</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((s: SeoSuggestion) => {
                  const verdict = s.evaluation_result as keyof typeof VERDICT_CONFIG | null;
                  const vcfg = verdict ? VERDICT_CONFIG[verdict] : null;
                  const delta = s.result_delta;
                  const Icon = vcfg?.icon ?? null;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <a href={`https://debryansk-auto.ru${s.page_url}`} target="_blank" rel="noopener noreferrer"
                          className="text-[#0070b8] font-mono text-xs hover:underline">{s.page_url}</a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">{s.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        {vcfg ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${vcfg.color}`}>
                            {Icon && <Icon className="w-3 h-3" />}
                            {vcfg.label}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {delta !== null ? (
                          <span className={`font-bold text-sm ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-slate-500"}`}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-slate-600 truncate" title={s.evaluation_note ?? ""}>{s.evaluation_note ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                        {s.evaluated_at ? new Date(s.evaluated_at).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.type === "new_page" && s.content_draft && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => setTzSuggestion(s)}>
                            <Eye className="w-3 h-3 mr-1" />ТЗ
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500">
            Оценено: {evaluated.length} · Показано: {shown.length}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SeoHubPage ──────────────────────────────────────────────────────── */
export default function SeoHubPage() {
  const [tab, setTab] = useState<TabId>("autopilot");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#0070b8]/10 flex items-center justify-center">
          <Zap className="w-4 h-4 text-[#0070b8]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">SEO Центр</h1>
          <p className="text-xs text-slate-500">Управление поисковым продвижением сайта debryansk-auto.ru</p>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar active={tab} onSelect={setTab} />

      {/* Tab content */}
      <div>
        {tab === "autopilot" && <SeoAutopilotPage />}
        {tab === "positions" && <SeoPositionsPage />}
        {tab === "cache"     && <SeoPage />}
        {tab === "anchors"   && <AnchorQueriesTab />}
        {tab === "loop"      && <KarpathyLoopTab />}
      </div>
    </div>
  );
}
