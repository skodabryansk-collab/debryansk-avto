import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { processSessionResponse } from "@/lib/session-client";
function getToken() { return localStorage.getItem("admin_token"); }

interface SalesHeadManager {
  id: number;
  name: string;
  position: string;
  phone: string | null;
  email: string | null;
  brands: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

async function adminApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  processSessionResponse(res, token, "admin_token");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const fetchManagers = () => adminApi<{ ok: boolean; data: SalesHeadManager[] }>("GET", "/sales-managers");

const EMPTY_FORM = { name: "", position: "Руководитель отдела продаж", phone: "", email: "", brands: [] as string[], sortOrder: 0, isActive: true };

const USED_BRAND = "С пробегом";

function ManagerForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<typeof EMPTY_FORM>;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof typeof EMPTY_FORM, v: string | number | boolean | string[]) =>
    setForm(f => ({ ...f, [k]: v }));

  const { data: brandsData } = useQuery({
    queryKey: ["brands-list-managers"],
    queryFn: async () => {
      const res = await fetch("/api/brands");
      return res.json() as Promise<{ ok: boolean; data: Array<{ id: number; name: string; carMark: string | null }> }>;
    },
    staleTime: 0,
  });
  const brandOptions = [
    ...(brandsData?.data ?? []).map(b => b.name).filter(Boolean).sort(),
    USED_BRAND,
  ];

  function toggleBrand(brand: string) {
    setForm(f => ({
      ...f,
      brands: f.brands.includes(brand)
        ? f.brands.filter(b => b !== brand)
        : [...f.brands, brand],
    }));
  }

  const valid = form.name.trim().length > 0 && form.brands.length > 0;

  return (
    <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">ФИО *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Иванов Иван Иванович" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Должность</Label>
          <Input value={form.position} onChange={e => set("position", e.target.value)} placeholder="Руководитель отдела продаж" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Телефон</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+7 (4832) 00-00-00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">E-mail</Label>
          <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="manager@debryansk-auto.ru" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Порядок сортировки</Label>
          <Input type="number" value={String(form.sortOrder)} onChange={e => set("sortOrder", Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Бренды * (можно несколько)</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-white min-h-[44px]">
          {brandOptions.map(b => (
            <button
              key={b}
              type="button"
              onClick={() => toggleBrand(b)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                form.brands.includes(b)
                  ? b === USED_BRAND
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-[#0070b8] text-white border-[#0070b8]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        {form.brands.length === 0 && (
          <p className="text-xs text-red-500">Выберите хотя бы один бренд</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="sm-active"
          checked={form.isActive}
          onChange={e => set("isActive", e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="sm-active" className="text-sm cursor-pointer">Активен</Label>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => { if (valid) onSave(form); }}
          className="bg-[#0070b8] hover:bg-[#005a94] text-white"
          disabled={!valid}
        >
          <Check className="h-3.5 w-3.5 mr-1.5" /> Сохранить
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1.5" /> Отмена
        </Button>
      </div>
    </div>
  );
}

export default function AdminSalesManagersPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sales-managers"],
    queryFn: fetchManagers,
    staleTime: 10_000,
  });

  const createMut = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) =>
      adminApi("POST", "/sales-managers", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sales-managers"] }); setAdding(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof EMPTY_FORM }) =>
      adminApi("PUT", `/sales-managers/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sales-managers"] }); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi("DELETE", `/sales-managers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sales-managers"] }),
  });

  const managers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Руководители отдела продаж</h1>
          <p className="text-sm text-slate-500 mt-0.5">Данные отображаются в КП — в блоке руководителя (привязка к бренду)</p>
        </div>
        <Button
          onClick={() => setAdding(true)}
          disabled={adding}
          className="bg-[#0070b8] hover:bg-[#005a94] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Добавить
        </Button>
      </div>

      {adding && (
        <ManagerForm
          onSave={form => createMut.mutate(form)}
          onCancel={() => setAdding(false)}
        />
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-500 py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
        </div>
      )}

      {!isLoading && managers.length === 0 && !adding && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 text-center py-4">
              Руководителей нет. Добавьте первого — нажмите «Добавить».
            </p>
          </CardContent>
        </Card>
      )}

      {managers.map(m => (
        <Card key={m.id} className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {(m.brands ?? []).map(b => (
                <Badge
                  key={b}
                  className={b === USED_BRAND
                    ? "bg-orange-100 text-orange-700 border-orange-200"
                    : "bg-blue-100 text-blue-700 border-blue-200"
                  }
                  variant="outline"
                >
                  {b}
                </Badge>
              ))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editId === m.id ? (
              <ManagerForm
                initial={{ name: m.name, position: m.position, phone: m.phone ?? "", email: m.email ?? "", brands: m.brands ?? [], sortOrder: m.sortOrder ?? 0, isActive: m.isActive ?? true }}
                onSave={form => updateMut.mutate({ id: m.id, body: form })}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-3 border border-slate-100 rounded-lg px-4 py-3 bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{m.name}</span>
                    {!m.isActive && <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500">неактивен</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{m.position}</div>
                  {(m.phone || m.email) && (
                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                      {m.phone && <div>{m.phone}</div>}
                      {m.email && <div>{m.email}</div>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(m.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => { if (confirm("Удалить?")) deleteMut.mutate(m.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
