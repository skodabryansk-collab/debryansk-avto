import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDealers, getBrands, createDealer, updateDealer, deleteDealer, type Dealer, type Brand } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Pencil, MapPin, Phone, Clock, Mail, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DealersPage() {
  const [editItem, setEditItem] = React.useState<Dealer | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["dealers"], queryFn: getDealers });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: getBrands });
  const qc = useQueryClient();
  const { toast } = useToast();

  const brandMap = React.useMemo(() => {
    const map = new Map<number, Brand>();
    brands?.forEach(b => map.set(b.id, b));
    return map;
  }, [brands]);

  const delMutation = useMutation({
    mutationFn: deleteDealer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setDeleteId(null);
      toast({ title: "Дилер удалён" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Дилеры</h1>
        <Button size="sm" className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => setIsCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Загрузка...</div>
        ) : data?.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Дилеров не найдено</div>
        ) : data?.map(d => {
          const selectedIds = d.brandIds ? d.brandIds.split(",").map(s => Number(s.trim())).filter(Boolean) : [];
          const selectedBrands = selectedIds.map(id => brandMap.get(id)).filter(Boolean) as Brand[];
          return (
            <Card key={d.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{d.shortName}</h3>
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditItem(d)}>
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setDeleteId(d.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />{d.address}</div>
                      {d.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />{d.phone}</div>}
                      {d.hours && <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />{d.hours}</div>}
                      {d.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a href={`mailto:${d.email}`} className="text-[#0070b8] hover:underline">{d.email}</a>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedBrands.length > 0 ? selectedBrands.map(b => (
                        <Badge key={b.id} variant="secondary" className="text-xs">{b.name}</Badge>
                      )) : d.brands ? (
                        <span className="text-sm text-slate-500">{d.brands}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить дилера?</DialogTitle>
            <DialogDescription>Это действие нельзя отменить.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={() => deleteId && delMutation.mutate(deleteId)} disabled={delMutation.isPending}>
              {delMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editItem && (
        <DealerFormDialog item={editItem} brands={brands || []} onClose={() => setEditItem(null)} />
      )}
      {isCreate && (
        <DealerFormDialog item={null} brands={brands || []} onClose={() => setIsCreate(false)} />
      )}
    </div>
  );
}

function DealerFormDialog({ item, brands, onClose }: { item: Dealer | null; brands: Brand[]; onClose: () => void }) {
  const isEdit = !!item;
  const selectedIds = item?.brandIds ? item.brandIds.split(",").map(s => Number(s.trim())).filter(Boolean) : [];
  const [selected, setSelected] = React.useState<Set<number>>(new Set(selectedIds));
  const [form, setForm] = React.useState({
    address: item?.address ?? "",
    shortName: item?.shortName ?? "",
    phone: item?.phone ?? "",
    hours: item?.hours ?? "",
    photoUrl: item?.photoUrl ?? "",
    email: item?.email ?? "",
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const toggleBrand = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const brandIds = Array.from(selected).join(",");
      const brandNames = Array.from(selected).map(id => brands.find(b => b.id === id)?.name).filter(Boolean);
      const payload = {
        ...form,
        email: form.email || null,
        brandIds: brandIds || null,
        brands: brandNames.length ? brandNames : undefined,
      };
      if (isEdit) return updateDealer(item!.id, payload as Partial<Dealer>);
      return createDealer(payload as unknown as Parameters<typeof createDealer>[0]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealers"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onClose();
      toast({ title: isEdit ? "Дилер обновлён" : "Дилер добавлен" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать дилера" : "Новый дилер"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название <span className="text-red-500">*</span></Label>
            <Input value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))} placeholder="Например: Haval City" />
          </div>
          <div>
            <Label>Адрес <span className="text-red-500">*</span></Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="г. Брянск, ул. ..." />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 (483) ..." />
          </div>
          <div>
            <Label>Часы работы</Label>
            <Input value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="Пн–Вс: 9:00–20:00" />
          </div>
          <div>
            <Label>Email для заявок</Label>
            <p className="text-xs text-slate-500 mb-1">На этот адрес будут отправляться заявки от клиентов</p>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="dealer@example.ru"
            />
          </div>
          <div>
            <Label>Бренды</Label>
            <div className="mt-2 space-y-2 border rounded-lg p-3 bg-slate-50 max-h-48 overflow-y-auto">
              {brands.length === 0 ? (
                <p className="text-sm text-slate-500">Бренды не добавлены. Добавьте их в справочнике.</p>
              ) : brands.map(b => (
                <div key={b.id} className="flex items-center gap-2">
                  <Checkbox id={`brand-${b.id}`} checked={selected.has(b.id)} onCheckedChange={() => toggleBrand(b.id)} />
                  <label htmlFor={`brand-${b.id}`} className="text-sm cursor-pointer select-none flex items-center gap-2">
                    {b.logoUrl && <img src={b.logoUrl} alt="" className="h-4 w-auto object-contain" />}
                    {b.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>URL фото</Label>
            <Input value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            className="bg-[#0070b8] hover:bg-[#005a94]"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.shortName || !form.address}
          >
            {mutation.isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
