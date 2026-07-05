import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getCalltouchCalls, getCalltouchRecordingUrl, type CalltouchCall } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, PhoneOff, PhoneMissed, Play, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: React.ReactNode }> = {
  started:   { label: "Идёт",      variant: "secondary",   icon: <Phone className="w-3 h-3" /> },
  completed: { label: "Отвечен",   variant: "default",     icon: <Phone className="w-3 h-3" /> },
  missed:    { label: "Пропущен",  variant: "destructive", icon: <PhoneMissed className="w-3 h-3" /> },
};

function formatDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}м ${sec}с` : `${sec}с`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function RecordingButton({ call }: { call: CalltouchCall }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  if (!call.recordingStoredPath && !call.callRecordingUrl) return <span className="text-slate-300 text-xs">—</span>;

  const handlePlay = async () => {
    if (url) { setOpen(o => !o); return; }
    setLoading(true);
    try {
      const result = await getCalltouchRecordingUrl(call.id);
      setUrl(result.url);
      setOpen(true);
    } catch {
      alert("Запись недоступна");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant="outline" onClick={handlePlay} disabled={loading} className="h-7 text-xs gap-1">
        {loading ? "…" : <><Play className="w-3 h-3" /> Слушать</>}
      </Button>
      {open && url && (
        <audio controls src={url} className="w-48 h-8" />
      )}
    </div>
  );
}

export default function CalltouchPage() {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["calltouch-calls", page, status],
    queryFn: () => getCalltouchCalls(page, status),
  });

  const calls = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Звонки Calltouch</h1>
          <p className="text-sm text-slate-500 mt-1">Всего: {total}</p>
        </div>
        <div className="flex gap-2">
          {["all", "completed", "missed", "started"].map(s => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"}
              onClick={() => { setStatus(s); setPage(1); }}>
              {s === "all" ? "Все" : s === "completed" ? "Отвеченные" : s === "missed" ? "Пропущенные" : "Активные"}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Дата</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Номер клиента</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Источник</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Кампания</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Длительность</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Статус</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Запись</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                ))}
              </tr>
            ))}
            {!isLoading && calls.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Звонков пока нет</td></tr>
            )}
            {!isLoading && calls.map(call => {
              const cfg = STATUS_CONFIG[call.status] ?? STATUS_CONFIG["started"];
              return (
                <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(call.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{call.phoneNumber || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate" title={call.source ?? ""}>{call.source || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate" title={call.campaign ?? ""}>{call.campaign || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDuration(call.durationSeconds)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={cfg.variant} className="inline-flex items-center gap-1 text-xs">
                      {cfg.icon}{cfg.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3"><RecordingButton call={call} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Страница {page} из {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
