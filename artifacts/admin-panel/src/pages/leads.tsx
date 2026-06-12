import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeads, exportLeads } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, Phone, Mail, MessageSquare } from "lucide-react";

const typeLabels: Record<string, string> = {
  callback: "Звонок", testdrive: "Тест-драйв", credit: "Кредит",
  tradein: "Trade-in", vacancy: "Вакансия", openresume: "Резюме", feedback: "Связь",
};

const typeColors: Record<string, string> = {
  callback: "bg-blue-50 text-blue-700", testdrive: "bg-emerald-50 text-emerald-700",
  credit: "bg-violet-50 text-violet-700", tradein: "bg-amber-50 text-amber-700",
  vacancy: "bg-pink-50 text-pink-700", openresume: "bg-slate-50 text-slate-700",
  feedback: "bg-cyan-50 text-cyan-700",
};

export default function LeadsPage() {
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: getLeads });

  const filtered = React.useMemo(() => {
    if (!data) return [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(l =>
      (l.name || "").toLowerCase().includes(q) ||
      (l.phone || "").includes(q) ||
      (l.type || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Заявки клиентов</h1>
        <Button variant="outline" size="sm" onClick={exportLeads}>
          <Download className="w-4 h-4 mr-1" />
          CSV
        </Button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Поиск по имени, телефону, типу..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Контакты</TableHead>
                  <TableHead>Авто</TableHead>
                  <TableHead>Сообщение</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Загрузка...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Заявок не найдено</TableCell></TableRow>
                ) : filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge className={typeColors[l.type] || "bg-slate-50 text-slate-700"} variant="secondary">
                        {typeLabels[l.type] || l.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{l.name || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-sm">
                        {l.phone && <div className="flex items-center gap-1 text-slate-600"><Phone className="w-3 h-3" />{l.phone}</div>}
                        {l.email && <div className="flex items-center gap-1 text-slate-600"><Mail className="w-3 h-3" />{l.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">{l.car || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-xs truncate">{l.message || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {l.createdAt ? new Date(l.createdAt).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
