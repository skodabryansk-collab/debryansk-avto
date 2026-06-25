import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPromotions, createPromotion, updatePromotion, deletePromotion, getBrands, uploadFile,
  type Promotion, type PromotionInput, type Brand,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, X, Loader2, Calendar, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ── helpers ─────────────────────────────────────────────────── */
function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

/* ── Page ────────────────────────────────────────────────────── */
export default function PromotionsPage() {
  const [editItem, setEditItem] = React.useState<Promotion | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [filterBrandId, setFilterBrandId] = React.useState<number | "">("");

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["promotions", filterBrandId || undefined],
    queryFn: () => getPromotions(filterBrandId ? Number(filterBrandId) : undefined),
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const delMutation = useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      setDeleteId(null);
      toast({ title: "Акция удалена" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const brandMap = React.useMemo(() => {
    const m: Record<number, Brand> = {};
    for (const b of brands) m[b.id] = b;
    return m;
  }, [brands]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-900">Акции</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0070b8]"
            value={filterBrandId}
            onChange={e => setFilterBrandId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Все бренды</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            className="bg-[#0070b8] hover:bg-[#005a94]"
            onClick={() => setIsCreate(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Загрузка...</div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="text-sm font-medium">Нет акций</p>
          <p className="text-xs mt-1">Нажмите «Добавить», чтобы создать первую акцию</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map(promo => {
            const expired = isExpired(promo.expiresAt);
            const linked = (promo.brandIds as number[]) ?? [];
            return (
              <Card key={promo.id} className={`border-0 shadow-sm overflow-hidden ${!promo.isActive || expired ? "opacity-60" : ""}`}>
                {promo.image && (
                  <div className="w-full h-36 overflow-hidden bg-slate-100">
                    <img src={promo.image} alt={promo.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{promo.title}</p>
                    </div>
                    <div className="shrink-0 flex flex-col gap-1 items-end">
                      {!promo.isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Откл</span>
                      )}
                      {promo.isActive && expired && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">Истекла</span>
                      )}
                      {promo.isActive && !expired && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Активна</span>
                      )}
                    </div>
                  </div>

                  {promo.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{promo.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {promo.badge && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#87b63c]/15 text-[#4a7a0f] px-2 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" />
                        {promo.badge}
                      </span>
                    )}
                    {promo.expiresAt && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${expired ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        <Calendar className="w-2.5 h-2.5" />
                        до {fmtDate(promo.expiresAt)}
                      </span>
                    )}
                  </div>

                  {linked.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {linked.slice(0, 3).map(id => (
                        <Badge key={id} variant="secondary" className="text-[10px] py-0">
                          {brandMap[id]?.name ?? `#${id}`}
                        </Badge>
                      ))}
                      {linked.length > 3 && (
                        <Badge variant="secondary" className="text-[10px] py-0">+{linked.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1 pt-1">
                    <Button
                      variant="outline" size="sm" className="flex-1 h-7 text-xs"
                      onClick={() => setEditItem(promo)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />Изменить
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="w-7 h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteId(promo.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить акцию?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && delMutation.mutate(deleteId)}
              disabled={delMutation.isPending}
            >
              {delMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit dialog */}
      {(isCreate || editItem) && (
        <PromotionFormDialog
          item={editItem}
          brands={brands}
          onClose={() => { setIsCreate(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

/* ── Promotion form dialog ───────────────────────────────────── */
function PromotionFormDialog({
  item,
  brands,
  onClose,
}: {
  item: Promotion | null;
  brands: Brand[];
  onClose: () => void;
}) {
  const isEdit = !!item;
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const toDateInput = (iso: string | null | undefined) => {
    if (!iso) return "";
    return iso.slice(0, 10);
  };

  const [form, setForm] = React.useState<PromotionInput & { id?: number }>({
    title: item?.title ?? "",
    description: item?.description ?? "",
    image: item?.image ?? null,
    badge: item?.badge ?? null,
    expiresAt: toDateInput(item?.expiresAt),
    isActive: item?.isActive !== false,
    buttonText: item?.buttonText ?? null,
    buttonUrl: item?.buttonUrl ?? null,
    brandIds: (item?.brandIds as number[]) ?? [],
  });

  const toggleBrand = (id: number) => {
    setForm(f => {
      const ids = (f.brandIds ?? []) as number[];
      return {
        ...f,
        brandIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
      };
    });
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(f => ({ ...f, image: url }));
      toast({ title: "Изображение загружено" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload: PromotionInput = {
        ...form,
        expiresAt: form.expiresAt || null,
        image: form.image || null,
        badge: form.badge || null,
        buttonText: form.buttonText || null,
        buttonUrl: form.buttonUrl || null,
        brandIds: (form.brandIds as number[]) ?? [],
      };
      if (isEdit) return updatePromotion(item!.id, payload);
      return createPromotion(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      onClose();
      toast({ title: isEdit ? "Акция обновлена" : "Акция создана" });
    },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  const selectedBrandIds = (form.brandIds ?? []) as number[];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать акцию" : "Новая акция"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label className="mb-1.5 block">Заголовок *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Выгода до 300 000 ₽ на новые автомобили"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1.5 block">Описание</Label>
            <Textarea
              rows={3}
              value={form.description ?? ""}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Подробное описание акции, условия получения скидки..."
              className="resize-none"
            />
          </div>

          {/* Badge & Expires */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Бейдж</Label>
              <Input
                value={form.badge ?? ""}
                onChange={e => setForm(f => ({ ...f, badge: e.target.value || null }))}
                placeholder="Хит / Выгода -15%"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Срок действия (до)</Label>
              <Input
                type="date"
                value={form.expiresAt ?? ""}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value || null }))}
              />
            </div>
          </div>

          {/* Button */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Текст кнопки</Label>
              <Input
                value={form.buttonText ?? ""}
                onChange={e => setForm(f => ({ ...f, buttonText: e.target.value || null }))}
                placeholder="Оставить заявку"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Ссылка кнопки</Label>
              <Input
                value={form.buttonUrl ?? ""}
                onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value || null }))}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Image */}
          <div>
            <Label className="mb-1.5 block">Изображение</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm" type="button" disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Загрузка...</>
                  : <><Upload className="w-3.5 h-3.5 mr-1" />Загрузить фото</>}
              </Button>
              {form.image && (
                <>
                  <img src={form.image} alt="" className="w-16 h-10 object-cover rounded border" />
                  <Button
                    variant="ghost" size="icon" className="w-7 h-7 text-red-500" type="button"
                    onClick={() => setForm(f => ({ ...f, image: null }))}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Is Active */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 bg-slate-50">
            <div>
              <p className="text-sm font-semibold text-slate-700">Активна</p>
              <p className="text-xs text-slate-400">Видна посетителям сайта</p>
            </div>
            <Switch
              checked={form.isActive !== false}
              onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
            />
          </div>

          {/* Brand multi-select */}
          <div>
            <Label className="mb-2 block">Бренды</Label>
            <p className="text-xs text-slate-400 mb-2">
              Акция отображается на страницах выбранных брендов
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
              {brands.map(b => {
                const checked = selectedBrandIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${checked ? "bg-[#0070b8]/10 text-[#0070b8]" : "hover:bg-slate-50 text-slate-700"}`}
                  >
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-[#0070b8]"
                      checked={checked}
                      onChange={() => toggleBrand(b.id)}
                    />
                    {b.logoUrl && (
                      <img src={b.logoUrl} alt="" className="w-5 h-4 object-contain shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{b.name}</span>
                    {b.isServiceOnly && (
                      <span className="ml-auto text-[9px] font-bold text-amber-600 shrink-0">СО</span>
                    )}
                  </label>
                );
              })}
            </div>
            {selectedBrandIds.length > 0 && (
              <p className="text-xs text-slate-500 mt-1.5">
                Выбрано: {selectedBrandIds.length} бренд{selectedBrandIds.length === 1 ? "" : selectedBrandIds.length < 5 ? "а" : "ов"}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            className="bg-[#0070b8] hover:bg-[#005a94]"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title?.trim()}
          >
            {mutation.isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
