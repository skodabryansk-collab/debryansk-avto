import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Database, CheckCircle, AlertCircle, Loader2, RefreshCw, Tag } from "lucide-react";
function getToken() { return localStorage.getItem("admin_token"); }
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface CatalogMeta {
  count: number;
  brands: string[];
  updatedAt: string | null;
}

async function fetchMeta(): Promise<CatalogMeta> {
  const r = await fetch(`${BASE}/api/admin/to-catalog`, { headers: authHeaders() });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error ?? "Ошибка");
  return { count: j.count, brands: j.brands, updatedAt: j.updatedAt };
}

async function uploadFile(file: File): Promise<CatalogMeta> {
  const fd = new FormData();
  fd.append("file", file, "upload.json");
  const r = await fetch(`${BASE}/api/admin/to-catalog/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error ?? "Ошибка загрузки");
  return { count: j.count, brands: j.brands, updatedAt: j.updatedAt };
}

export default function ToCatalogPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const { data: meta, isLoading } = useQuery({
    queryKey: ["admin-to-catalog"],
    queryFn: fetchMeta,
    retry: false,
  });

  const mutation = useMutation({
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploadSuccess(false);
    mutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

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
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Текущий файл</h2>
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

      {/* Upload card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Загрузить новый файл</h2>
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
            ${mutation.isPending
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          onClick={e => mutation.isPending && e.preventDefault()}
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Загружаем...</>
          ) : (
            <><Upload className="w-4 h-4" /> Выбрать JSON-файл</>
          )}
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
