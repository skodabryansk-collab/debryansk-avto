import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLocations, getBrands, createLocation, updateLocation, deleteLocation,
  addBrandToLocation, toggleBrandService, removeBrandFromLocation,
  type Location, type Brand, type LocationBrandItem,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, MapPin, Phone, Clock, Plus, Trash2, X, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LocationsPage() {
  const [editItem, setEditItem] = React.useState<Location | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);

  const { data: locations = [], isLoading } = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: getBrands });
  const qc = useQueryClient();
  const { toast } = useToast();

  const delMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      setDeleteId(null);
      toast({ title: "Локация удалена" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Локации</h1>
          <p className="text-sm text-slate-500 mt-0.5">Дилерские центры и бренды в них</p>
        </div>
        <Button size="sm" className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => setIsCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Загрузка...</div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Локаций не найдено</div>
        ) : locations.map((loc, idx) => (
          <LocationCard
            key={loc.id}
            location={loc}
            index={idx + 1}
            brands={brands}
            onEdit={() => setEditItem(loc)}
            onDelete={() => setDeleteId(loc.id)}
          />
        ))}
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить локацию?</DialogTitle>
            <DialogDescription>Это удалит локацию и все связи с брендами. Действие нельзя отменить.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={() => deleteId && delMutation.mutate(deleteId)} disabled={delMutation.isPending}>
              {delMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editItem && <LocationFormDialog item={editItem} onClose={() => setEditItem(null)} />}
      {isCreate && <LocationFormDialog item={null} onClose={() => setIsCreate(false)} />}
    </div>
  );
}

function LocationCard({ location, index, brands, onEdit, onDelete }: {
  location: Location; index: number; brands: Brand[];
  onEdit: () => void; onDelete: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addingBrand, setAddingBrand] = React.useState(false);
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("");
  const [isService, setIsService] = React.useState(false);

  const existingBrandIds = new Set(location.brands.map(b => b.id));
  const availableBrands = brands.filter(b => !existingBrandIds.has(b.id));

  const addMutation = useMutation({
    mutationFn: () => addBrandToLocation(location.id, Number(selectedBrandId), isService, location.brands.length),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      setSelectedBrandId("");
      setIsService(false);
      setAddingBrand(false);
      toast({ title: "Бренд добавлен" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ brandId, isService }: { brandId: number; isService: boolean }) =>
      toggleBrandService(location.id, brandId, isService),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (brandId: number) => removeBrandFromLocation(location.id, brandId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Бренд удалён" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const dealerBrands = location.brands.filter(b => !b.isService);
  const serviceBrands = location.brands.filter(b => b.isService);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0070b8] flex items-center justify-center shrink-0 font-bold text-white text-sm">
            {index}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-slate-900">{location.title}</h3>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5 text-slate-400" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </Button>
            </div>

            <div className="space-y-1 text-sm text-slate-600 mb-3">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {location.address}
              </div>
              {location.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {location.phone}
                </div>
              )}
              {location.hours && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {location.hours}
                </div>
              )}
              {location.mapX != null && location.mapY != null && (
                <div className="text-xs text-slate-400">
                  Координаты: {location.mapX?.toFixed(6)}, {location.mapY?.toFixed(6)}
                </div>
              )}
            </div>

            {/* Dealer brands */}
            {dealerBrands.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Дилерские</p>
                <div className="flex flex-wrap gap-1.5">
                  {dealerBrands.map(b => (
                    <BrandChip key={b.id} brand={b}
                      onToggle={() => toggleMutation.mutate({ brandId: b.id, isService: true })}
                      onRemove={() => removeMutation.mutate(b.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Service brands */}
            {serviceBrands.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Сервис</p>
                <div className="flex flex-wrap gap-1.5">
                  {serviceBrands.map(b => (
                    <BrandChip key={b.id} brand={b}
                      onToggle={() => toggleMutation.mutate({ brandId: b.id, isService: false })}
                      onRemove={() => removeMutation.mutate(b.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add brand */}
            {addingBrand ? (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Выбрать бренд" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBrands.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={isService}
                    onCheckedChange={setIsService}
                    className="scale-75"
                  />
                  <span className="text-xs text-slate-500">Сервис</span>
                </div>
                <Button
                  size="sm" className="h-8 bg-[#0070b8] hover:bg-[#005a94] text-xs"
                  disabled={!selectedBrandId || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                >
                  {addMutation.isPending ? "..." : "Добавить"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingBrand(false)}>
                  Отмена
                </Button>
              </div>
            ) : (
              <Button
                variant="outline" size="sm"
                className="mt-2 h-7 text-xs border-dashed"
                onClick={() => setAddingBrand(true)}
                disabled={availableBrands.length === 0}
              >
                <Plus className="w-3 h-3 mr-1" />
                Добавить бренд
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BrandChip({ brand, onToggle, onRemove }: {
  brand: LocationBrandItem; onToggle: () => void; onRemove: () => void;
}) {
  return (
    <span className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-semibold border ${
      brand.isService
        ? "bg-orange-50 text-orange-700 border-orange-200"
        : "bg-blue-50 text-blue-700 border-blue-200"
    }`}>
      {brand.isService && <Wrench className="w-3 h-3 opacity-60" />}
      {brand.name}
      <button
        className="ml-0.5 hover:opacity-70 transition-opacity"
        title="Переключить сервис/дилер"
        onClick={onToggle}
      >
        <Wrench className={`w-3 h-3 ${brand.isService ? "text-orange-400" : "text-slate-300"}`} />
      </button>
      <button className="ml-0.5 hover:text-red-500 transition-colors" onClick={onRemove}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function LocationFormDialog({ item, onClose }: { item: Location | null; onClose: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = React.useState({
    title: item?.title ?? "",
    address: item?.address ?? "",
    phone: item?.phone ?? "",
    hours: item?.hours ?? "",
    mapX: item?.mapX != null ? String(item.mapX) : "",
    mapY: item?.mapY != null ? String(item.mapY) : "",
    sortOrder: item?.sortOrder != null ? String(item.sortOrder) : "0",
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        address: form.address,
        phone: form.phone || undefined,
        hours: form.hours || undefined,
        mapX: form.mapX ? Number(form.mapX) : undefined,
        mapY: form.mapY ? Number(form.mapY) : undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (isEdit) return updateLocation(item!.id, payload);
      return createLocation(payload as Parameters<typeof createLocation>[0]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      onClose();
      toast({ title: isEdit ? "Локация обновлена" : "Локация добавлена" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать локацию" : "Новая локация"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название <span className="text-red-500">*</span></Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Например: Советская" />
          </div>
          <div>
            <Label>Адрес <span className="text-red-500">*</span></Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="г. Брянск, ул. ..." />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 (4832) 63-10-00" />
          </div>
          <div>
            <Label>Часы работы</Label>
            <Input value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="Ежедневно 9:00–21:00" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Широта (mapX)</Label>
              <Input value={form.mapX} onChange={e => setForm(f => ({ ...f, mapX: e.target.value }))} placeholder="53.256552" />
            </div>
            <div>
              <Label>Долгота (mapY)</Label>
              <Input value={form.mapY} onChange={e => setForm(f => ({ ...f, mapY: e.target.value }))} placeholder="34.345028" />
            </div>
          </div>
          <div>
            <Label>Порядок сортировки</Label>
            <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} placeholder="1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            className="bg-[#0070b8] hover:bg-[#005a94]"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title || !form.address}
          >
            {mutation.isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
