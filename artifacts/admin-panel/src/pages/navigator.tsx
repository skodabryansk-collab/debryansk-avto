import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getChats, getChatDetail, exportChatsJsonl, syncCars, getSyncStatus,
  type ChatListItem, type ChatDetail,
} from "@/lib/api";
import {
  RefreshCw, Download, MessageSquare, Car, Star, ThumbsUp, ThumbsDown,
  Trash2, Info
} from "lucide-react";

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function RatingBadge({ val }: { val: number | null }) {
  if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
  const avg = Number(val);
  if (avg >= 0.8) return <Badge className="bg-emerald-100 text-emerald-700">👍 {avg.toFixed(1)}</Badge>;
  if (avg <= -0.5) return <Badge className="bg-red-100 text-red-700">👎 {avg.toFixed(1)}</Badge>;
  return <Badge variant="outline">{avg.toFixed(1)}</Badge>;
}

/* ── Chat detail modal ─────────────────────────── */
function ChatDetailModal({ convId, open, onClose }: { convId: number | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["chat-detail", convId],
    queryFn: () => getChatDetail(convId!),
    enabled: open && convId !== null,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Диалог</DialogTitle>
          <DialogDescription>История переписки пользователя с Навигатором</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-2 space-y-3">
          {isLoading && <p className="text-slate-400 text-sm">Загрузка…</p>}
          {data?.messages?.map((m: any) => (
            <div key={m.id} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-slate-100" : "bg-blue-50"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">
                  {m.role === "user" ? "Клиент" : "Навигатор"}
                </span>
                <div className="flex items-center gap-2">
                  {m.rating === 1 && <span className="text-xs text-emerald-600"><ThumbsUp size={12} className="inline" /> +1</span>}
                  {m.rating === -1 && <span className="text-xs text-red-500"><ThumbsDown size={12} className="inline" /> -1</span>}
                  <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.car_ids && (
                <p className="text-xs text-slate-400 mt-1">Авто: {m.car_ids}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ──────────────────────────────────── */
export default function NavigatorPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ftModalOpen, setFtModalOpen] = useState(false);

  const { data: chats = [], isLoading: chatsLoading } = useQuery<ChatListItem[]>({
    queryKey: ["chats"],
    queryFn: getChats,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ["sync-status"],
    queryFn: getSyncStatus,
    refetchInterval: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: syncCars,
    onSuccess: (data) => {
      toast({
        title: "Синхронизация завершена",
        description: `Добавлено: ${data.added}, обновлено: ${data.updated}, удалено: ${data.removed}. Всего: ${data.total} авто.`,
      });
      qc.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка синхронизации", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/navigator/chats/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Диалог удалён" });
      qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const openDetail = (id: number) => { setSelectedId(id); setDetailOpen(true); };

  const handleExport = async () => {
    try {
      await exportChatsJsonl();
      toast({ title: "JSONL скачан" });
    } catch (err: any) {
      toast({ title: "Ошибка экспорта", description: err.message, variant: "destructive" });
    }
  };

  const ratedPositive = chats.filter((c: any) => Number(c.rated_count) > 0 && Number(c.avg_rating) === 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Навигатор</h1>
      </div>

      {/* ── Sync block ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Car size={18} /> Каталог автомобилей
          </CardTitle>
          <CardDescription>
            Синхронизация XML-фидов с таблицей cars. После синхронизации Навигатор будет использовать данные из БД (с комплектацией и опциями).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-[#0070b8] hover:bg-[#005a99]"
          >
            <RefreshCw size={16} className={`mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Синхронизация…" : "Синхронизировать сейчас"}
          </Button>
          {syncStatus && (
            <div className="text-sm text-slate-600 w-full">
              <div className="mb-3">
                <span className="font-medium">{syncStatus.total} авто</span> в базе
                {syncStatus.lastSynced && (
                  <span className="ml-2 text-slate-400">· последний раз: {formatDate(syncStatus.lastSynced)}</span>
                )}
              </div>
              {syncStatus.byDealer && syncStatus.byDealer.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {(syncStatus.byDealer as { dealer: string; type: string; cnt: number }[])
                    .filter(r => r.type === "new")
                    .map(r => (
                      <div key={r.dealer} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium border ${r.cnt > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                        <span>{r.dealer}</span>
                        <span className="font-bold ml-2">{r.cnt}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Chat history block ─────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare size={18} /> История диалогов
          </CardTitle>
          <CardDescription>
            Сохраняются только диалоги с согласия пользователя. Оценки 👍/👎 выставляются клиентом.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Button variant="outline" onClick={handleExport}>
              <Download size={16} className="mr-2" />
              Скачать JSONL{ratedPositive.length > 0 && ` (${ratedPositive.length} диал.)`}
            </Button>
            <Button variant="outline" onClick={() => setFtModalOpen(true)}>
              <Star size={16} className="mr-2" />
              Дообучение
            </Button>
          </div>

          {chatsLoading ? (
            <p className="text-slate-400 text-sm">Загрузка…</p>
          ) : chats.length === 0 ? (
            <p className="text-slate-400 text-sm">Диалогов пока нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сессия</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-center">Сообщений</TableHead>
                  <TableHead className="text-center">Оценка</TableHead>
                  <TableHead className="text-center">Согласие</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {chats.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c.id)}>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {(c.session_id ?? "—").slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(c.created_at)}</TableCell>
                    <TableCell className="text-center text-sm">{c.msg_count}</TableCell>
                    <TableCell className="text-center">
                      <RatingBadge val={c.rated_count > 0 ? c.avg_rating : null} />
                    </TableCell>
                    <TableCell className="text-center">
                      {c.consented_at ? (
                        <span className="text-emerald-600 text-xs">✓</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Chat detail modal */}
      <ChatDetailModal
        convId={selectedId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* Fine-tuning info modal */}
      <Dialog open={ftModalOpen} onOpenChange={setFtModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info size={18} /> Дообучение модели
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-3 text-slate-700">
            <p>Для запуска fine-tuning нужен прямой доступ к OpenAI API.</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Скачайте JSONL-файл кнопкой «Скачать JSONL» (только диалоги, где все оценки 👍).</li>
              <li>Перейдите в <strong>platform.openai.com/finetune</strong>.</li>
              <li>Создайте новый Fine-tuning Job, выберите модель <code>gpt-4o-mini-2024-07-18</code> и загрузите JSONL.</li>
              <li>После обучения (обычно 15–30 мин) скопируйте ID модели и установите его как <code>MODEL</code> в переменных окружения API-сервера.</li>
            </ol>
            <p className="text-slate-500 text-xs">
              Экспорт включает только диалоги, где ВСЕ оценённые ответы Навигатора получили 👍.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
