import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminReviews, syncReviews } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Star, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SOURCE_COLORS: Record<string, string> = {
  "Яндекс":  "bg-red-50 text-red-700",
  "Google":  "bg-blue-50 text-blue-700",
  "Авито":   "bg-sky-50 text-sky-700",
  "2ГИС":    "bg-emerald-50 text-emerald-700",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"}`} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", page],
    queryFn: () => getAdminReviews(page),
  });

  const syncMut = useMutation({
    mutationFn: ({ type, days }: { type: "full" | "recent" | "custom"; days?: number }) =>
      syncReviews(type, days),
    onSuccess: (res) => {
      toast({
        title: "Синхронизация завершена",
        description: `Загружено: ${res.upserted}, пропущено: ${res.skipped} (${(res.durationMs / 1000).toFixed(1)} с)`,
      });
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка синхронизации", description: err.message, variant: "destructive" });
    },
  });

  const filtered = React.useMemo(() => {
    if (!data?.data) return [];
    if (!search) return data.data;
    const q = search.toLowerCase();
    return data.data.filter(r =>
      r.author.toLowerCase().includes(q) ||
      (r.text || "").toLowerCase().includes(q) ||
      (r.source || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const lastSync = data?.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString("ru-RU")
    : "никогда";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Отзывы</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              В базе: <strong>{data.total}</strong> · Средний рейтинг: <strong>{data.avg.toFixed(1)}</strong> ·
              Всего на площадках: <strong>{data.overallCount.toLocaleString("ru-RU")}</strong> · Последняя синхронизация: {lastSync}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMut.mutate({ type: "recent" })}
            disabled={syncMut.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            1 день
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMut.mutate({ type: "custom", days: 15 })}
            disabled={syncMut.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            15 дней
          </Button>
          <Button
            size="sm"
            onClick={() => syncMut.mutate({ type: "full" })}
            disabled={syncMut.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            90 дней
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Поиск по автору, тексту, источнику..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Автор</TableHead>
                  <TableHead>Рейтинг</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="max-w-md">Текст</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-12">
                      {search ? "Ничего не найдено" : "Отзывов нет — нажмите «Полная (90 дней)» для загрузки"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium whitespace-nowrap">{r.author}</TableCell>
                      <TableCell><StarRow rating={r.rating} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className={`text-xs ${SOURCE_COLORS[r.source ?? ""] ?? "bg-slate-50 text-slate-600"}`}>
                            {r.source ?? "—"}
                          </Badge>
                          {r.source_url && (
                            <a href={r.source_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 text-slate-400 hover:text-[#0070b8]" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {r.date ? new Date(r.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-slate-600 line-clamp-2">{r.text}</p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.pages > 1 && !search && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Назад
          </Button>
          <span className="text-sm text-slate-500">Страница {page} из {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
            Вперёд
          </Button>
        </div>
      )}
    </div>
  );
}
