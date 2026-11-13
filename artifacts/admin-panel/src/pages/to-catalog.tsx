import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Database, CheckCircle, AlertCircle, Loader2, Tag,
  Link2, Plus, Trash2, RefreshCw, Pencil, X, Check, Rss, ChevronDown,
} from "lucide-react";
import {
  getToCatalogFeeds, addToCatalogFeed, updateToCatalogFeed,
  deleteToCatalogFeed, syncToCatalogFeed, syncAllToCatalogFeeds,
  getBrands,
} from "@/lib/api";
import type { ToCatalogFeed, Brand } from "@/lib/api";
import { processSessionResponse } from "@/lib/session-client";

function getToken() { return localStorage.getItem("admin_token"); }
function authHeaders(t = getToken()): Record<string, string> {
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface CatalogMeta {
  count: number;
  brands: string[];
  updatedAt: string | null;
}

async function fetchMeta(): Promise<CatalogMeta> {
  const token = getToken();
  const r = await fetch("/api/admin/to-catalog", { headers: authHeaders(token) });
  processSessionResponse(r, token, "admin_token");
  const j = await r.json();
  if (!j.ok) throw new Error(j.error ?? "Ошибка");
  return { count: j.count, brands: j.brands, updatedAt: j.updatedAt };
}

async function uploadFile(file: File): Promise<CatalogMeta> {
  const fd = new FormData();
  fd.append("file", file, "upload.json");
  const token = getToken();
  const r = await fetch("/api/admin/to-catalog/upload", {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  processSessionResponse(r, token, "admin_token");
  const j = await r.json().catch(() => ({ ok: false, error: `Сервер вернул не JSON (HTTP ${r.status})` }));
  if (!j.ok) throw new Error(j.error ?? "Ошибка загрузки");
  return { count: j.count, brands: j.brands, updatedAt: j.updatedAt };
}

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

/* ── Brand multi-select ── */
function BrandMultiSelect({
  value,
  onChange,
  brands,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  brands: Brand[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (name: string) => {
    onChange(value.includes(name) ? value.filter(v => v !== name) : [...value, name]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left min-h-[38px]"
      >
        <span className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {value.length === 0 ? (
            <span className="text-slate-400">Выберите бренды...</span>
          ) : (
            value.map(b => (
              <span
                key={b}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 rounded-md px-2 py-0.5 text-xs font-medium"
              >
                {b}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggle(b); }}
                  className="hover:text-blue-900 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 ml-2 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {brands.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400">Нет брендов</div>
          ) : (
            brands.map(brand => {
              const selected = value.includes(brand.name);
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => toggle(brand.name)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${selected ? "text-blue-700 font-medium" : "text-slate-700"}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {brand.name}
                  {brand.subName && <span className="text-slate-400 text-xs">{brand.subName}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ── Feed row ── */
function FeedRow({
  feed,
  brands,
  onSynced,
}: {
  feed: ToCatalogFeed;
  brands: Brand[];
  onSynced: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(feed.url);
  const [editBrands, setEditBrands] = useState<string[]>(feed.brandNames);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const updateMut = useMutation({
    mutationFn: () => updateToCatalogFeed(feed.id, editUrl, editBrands),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-to-catalog-feeds"] });
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteToCatalogFeed(feed.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-to-catalog-feeds"] });
    },
  });

  const syncMut = useMutation({
    mutationFn: () => syncToCatalogFeed(feed.id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-to-catalog-feeds"] });
      qc.invalidateQueries({ queryKey: ["admin-to-catalog"] });
      setSyncMsg({ ok: true, text: `Загружено ${data.count.toLocaleString("ru-RU")} записей` });
      onSynced();
      setTimeout(() => setSyncMsg(null), 5000);
    },
    onError: (err: Error) => {
      setSyncMsg({ ok: false, text: err.message });
      setTimeout(() => setSyncMsg(null), 6000);
    },
  });

  if (editing) {
    return (
      <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40">
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Бренды</label>
            <BrandMultiSelect value={editBrands} onChange={setEditBrands} brands={brands} />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">URL фида</label>
            <input
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !editUrl || editBrands.length === 0}
              className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Сохранить
            </button>
            <button
              onClick={() => { setEditing(false); setEditUrl(feed.url); setEditBrands(feed.brandNames); }}
              className="flex items-center gap-1.5 bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-200"
            >
              <X className="w-3.5 h-3.5" /> Отмена
            </button>
          </div>
          {updateMut.isError && (
            <p className="text-xs text-red-600">{(updateMut.error as Error).message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Rss className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          {/* Brand tags */}
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {feed.brandNames.map(b => (
              <span key={b} className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-2 py-0.5 text-xs font-semibold">
                {b}
              </span>
            ))}
          </div>
          {/* URL */}
          <a
            href={feed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-blue-600 hover:underline break-all flex items-center gap-1"
          >
            <Link2 className="w-3 h-3 flex-shrink-0" />
            {feed.url}
          </a>
          {/* Sync info */}
          {feed.lastSyncedAt && (
            <div className="text-[11px] text-slate-400 mt-1">
              последняя синхр.: {fmtDate(feed.lastSyncedAt)}
              {feed.lastCount != null && ` · ${feed.lastCount.toLocaleString("ru-RU")} записей`}
            </div>
          )}
          {syncMsg && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${syncMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {syncMsg.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {syncMsg.text}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            title="Синхронизировать"
            className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-medium disabled:opacity-50 transition-colors"
          >
            {syncMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Синхр.
          </button>
          <button onClick={() => setEditing(true)} title="Редактировать"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`Удалить фид?`)) deleteMut.mutate(); }}
            disabled={deleteMut.isPending}
            title="Удалить"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add feed form ── */
function AddFeedForm({ brands }: { brands: Brand[] }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => addToCatalogFeed(url, selectedBrands),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-to-catalog-feeds"] });
      setUrl("");
      setSelectedBrands([]);
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded-xl px-4 py-3 w-full hover:bg-blue-50/50 transition-colors"
      >
        <Plus className="w-4 h-4" /> Добавить фид
      </button>
    );
  }

  return (
    <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40">
      <p className="text-sm font-semibold text-slate-700 mb-3">Новый фид</p>
      <div className="flex flex-col gap-2.5">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Бренды</label>
          <BrandMultiSelect value={selectedBrands} onChange={setSelectedBrands} brands={brands} />
          <p className="text-[11px] text-slate-400 mt-1">При синхронизации эти бренды будут удалены из каталога и заменены данными фида</p>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">URL фида (.json)</label>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
            placeholder="https://xml.example.com/ServiceCalculator/Brand.json"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>
        {mut.isError && (
          <p className="text-xs text-red-600">{(mut.error as Error).message}</p>
        )}
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !url || selectedBrands.length === 0}
            className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Добавить
          </button>
          <button
            onClick={() => { setOpen(false); setUrl(""); setSelectedBrands([]); }}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function ToCatalogPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [syncAllMsg, setSyncAllMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: meta, isLoading } = useQuery({
    queryKey: ["admin-to-catalog"],
    queryFn: fetchMeta,
    retry: false,
  });

  const { data: feedsData, isLoading: feedsLoading } = useQuery({
    queryKey: ["admin-to-catalog-feeds"],
    queryFn: getToCatalogFeeds,
    retry: false,
  });

  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
    staleTime: 5 * 60_000,
  });

  const feeds: ToCatalogFeed[] = feedsData?.feeds ?? [];
  const brands: Brand[] = Array.isArray(brandsData) ? brandsData : [];

  const uploadMut = useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-to-catalog"] });
      setUploadSuccess(true);
      setUploadError("");
      setTimeout(() => setUploadSuccess(false), 4000);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
      setUploadSuccess(false);
    },
  });

  const syncAllMut = useMutation({
    mutationFn: syncAllToCatalogFeeds,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-to-catalog-feeds"] });
      qc.invalidateQueries({ queryKey: ["admin-to-catalog"] });
      const ok = data.results.filter(r => !r.error).length;
      const fail = data.results.filter(r => r.error).length;
      const total = data.results.reduce((s, r) => s + (r.count ?? 0), 0);
      setSyncAllMsg({
        ok: fail === 0,
        text: fail === 0
          ? `Все ${ok} фидов синхронизированы · ${total.toLocaleString("ru-RU")} записей`
          : `${ok} успешно, ${fail} ошибок · ${total.toLocaleString("ru-RU")} записей`,
      });
      setTimeout(() => setSyncAllMsg(null), 6000);
    },
    onError: (err: Error) => {
      setSyncAllMsg({ ok: false, text: err.message });
      setTimeout(() => setSyncAllMsg(null), 6000);
    },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploadSuccess(false);
    uploadMut.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Каталог ТО</h1>
          <p className="text-sm text-slate-500">Прайс-лист технического обслуживания из 1С</p>
        </div>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Текущий каталог</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
          </div>
        ) : meta ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Записей в каталоге</span>
              <span className="font-bold text-slate-900">{meta.count.toLocaleString("ru-RU")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Последнее обновление</span>
              <span className="font-medium text-slate-700">{fmtDate(meta.updatedAt)}</span>
            </div>
            <div className="pt-1">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Бренды в каталоге</div>
              <div className="flex flex-wrap gap-2">
                {meta.brands.map(b => (
                  <span key={b} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-3 py-1 text-xs font-semibold">
                    <Tag className="w-3 h-3" />{b}
                  </span>
                ))}
                {meta.brands.length === 0 && <span className="text-slate-400 text-sm">Нет данных</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-400" /> Файл ещё не загружен
          </div>
        )}
      </div>

      {/* Feeds section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">XML/JSON Фиды</h2>
            <p className="text-xs text-slate-400 mt-0.5">Автоматическое обновление каталога из внешних URL</p>
          </div>
          {feeds.length > 0 && (
            <button
              onClick={() => syncAllMut.mutate()}
              disabled={syncAllMut.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 disabled:opacity-50 transition-colors"
            >
              {syncAllMut.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Синхронизация...</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Синхр. все</>}
            </button>
          )}
        </div>

        {syncAllMsg && (
          <div className={`mb-4 flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl ${syncAllMsg.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {syncAllMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {syncAllMsg.text}
          </div>
        )}

        <div className="space-y-3">
          {feedsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
            </div>
          ) : feeds.length === 0 ? (
            <p className="text-sm text-slate-400 py-1">Фиды не добавлены</p>
          ) : (
            feeds.map(feed => (
              <FeedRow
                key={feed.id}
                feed={feed}
                brands={brands}
                onSynced={() => qc.invalidateQueries({ queryKey: ["admin-to-catalog"] })}
              />
            ))
          )}
          <AddFeedForm brands={brands} />
        </div>
      </div>

      {/* Manual upload */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Загрузить файл вручную</h2>
        <p className="text-sm text-slate-500 mb-5">
          Загрузите выгрузку из 1С в формате JSON. Файл должен содержать массив объектов с полями{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">Brand</code>,{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">Model</code>,{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">Maintenance</code>,{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">TO</code>,{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">TotalSum</code> и др.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          className="hidden"
          id="to-catalog-upload"
        />

        <label
          htmlFor="to-catalog-upload"
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-colors
            ${uploadMut.isPending ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          onClick={e => uploadMut.isPending && e.preventDefault()}
        >
          {uploadMut.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Загружаем...</>
            : <><Upload className="w-4 h-4" /> Выбрать JSON-файл</>}
        </label>

        {uploadSuccess && (
          <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            Файл успешно загружен и кэш обновлён.
          </div>
        )}
        {uploadError && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            {uploadError}
          </div>
        )}
      </div>
    </div>
  );
}
