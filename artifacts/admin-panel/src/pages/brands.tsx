import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBrands, createBrand, updateBrand, deleteBrand, uploadFile,
  getBrandPageContent, updateBrandPageContent,
  type Brand, type BrandPageContent,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ExternalLink, Upload, X, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BrandsPage() {
  const [editItem, setEditItem] = React.useState<Brand | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [pageEditBrand, setPageEditBrand] = React.useState<Brand | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["brands"], queryFn: getBrands });
  const qc = useQueryClient();
  const { toast } = useToast();

  const delMutation = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setDeleteId(null);
      toast({ title: "Бренд удалён" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Справочник брендов</h1>
        <Button size="sm" className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => setIsCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Лого</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Сайт</TableHead>
                <TableHead className="w-32">Только сервис</TableHead>
                <TableHead className="w-36">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Загрузка...</TableCell></TableRow>
              ) : !data?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Брендов не найдено</TableCell></TableRow>
              ) : data.map(b => (
                <TableRow key={b.id}>
                  <TableCell>
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="w-10 h-10 object-contain rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">нет</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{b.name}</div>
                    {b.slug && (
                      <div className="text-xs text-slate-400 font-mono">{b.slug}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {b.websiteUrl ? (
                      <a href={b.websiteUrl} target="_blank" rel="noreferrer" className="text-[#0070b8] hover:underline flex items-center gap-1 text-sm">
                        <ExternalLink className="w-3 h-3" />
                        {b.websiteUrl.replace(/^https?:\/\//, "").slice(0, 40)}
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${b.isServiceOnly ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {b.isServiceOnly ? "Сервис" : "Дилер"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm" className="h-8 px-2 text-xs"
                        title={b.slug ? "Редактировать страницу бренда" : "Назначьте slug бренду, чтобы создать страницу"}
                        onClick={() => setPageEditBrand(b)}
                      >
                        <Globe className="w-3.5 h-3.5 mr-1 text-[#0070b8]" />
                        <span className="text-[#0070b8]">Страница</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditItem(b)}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setDeleteId(b.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить бренд?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={() => deleteId && delMutation.mutate(deleteId)} disabled={delMutation.isPending}>
              {delMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create brand */}
      {(editItem || isCreate) && (
        <BrandFormDialog item={editItem} onClose={() => { setEditItem(null); setIsCreate(false); }} />
      )}

      {/* Brand page content editor */}
      {pageEditBrand && (
        <BrandPageDialog brand={pageEditBrand} onClose={() => setPageEditBrand(null)} />
      )}
    </div>
  );
}

/* ── Brand form dialog (create / edit basic brand info) ─────── */
function BrandFormDialog({ item, onClose }: { item: Brand | null; onClose: () => void }) {
  const [form, setForm] = React.useState({
    name: item?.name ?? "",
    slug: item?.slug ?? "",
    websiteUrl: item?.websiteUrl ?? "",
    logoUrl: item?.logoUrl ?? "",
    isServiceOnly: item?.isServiceOnly ?? false,
  });
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!item;

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(f => ({ ...f, logoUrl: url }));
      toast({ title: "Логотип загружен" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) return updateBrand(item!.id, form);
      return createBrand(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onClose();
      toast({ title: isEdit ? "Бренд обновлён" : "Бренд создан" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать бренд" : "Новый бренд"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Slug (URL страницы бренда)</Label>
            <Input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              placeholder="например: jetour, haval, volkswagen"
            />
            <p className="text-xs text-slate-400 mt-1">
              {form.slug ? `Страница будет доступна по адресу /brands/${form.slug}` : "Оставьте пустым, если страница бренда не нужна"}
            </p>
          </div>
          <div>
            <Label>Сайт</Label>
            <Input value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <Label>Логотип</Label>
            <p className="text-xs text-slate-500 mb-1">PNG или SVG с прозрачным фоном, рекомендуем 200×100 px</p>
            <div className="flex items-center gap-2">
              <Input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="URL логотипа или загрузите файл" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
              <Button variant="outline" size="sm" type="button" disabled={uploading} className="whitespace-nowrap"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />{uploading ? "Загр..." : "Файл"}
              </Button>
            </div>
            {form.logoUrl && (
              <div className="mt-2 relative inline-flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
                <img src={form.logoUrl} alt="logo preview" className="h-10 object-contain max-w-[120px]" />
                <button
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  onClick={() => setForm(f => ({ ...f, logoUrl: "" }))}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 bg-slate-50">
            <div>
              <p className="text-sm font-semibold text-slate-700">Только сервис</p>
              <p className="text-xs text-slate-400">Бренд без дилерских продаж — отображается после дилеров</p>
            </div>
            <Switch
              checked={form.isServiceOnly}
              onCheckedChange={checked => setForm(f => ({ ...f, isServiceOnly: checked }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Brand page content dialog ──────────────────────────────── */
function BrandPageDialog({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["brand-page-content", brand.id],
    queryFn: () => getBrandPageContent(brand.id),
  });

  const [form, setForm] = React.useState<{
    description: string;
    serviceText: string;
    promoText: string;
    metaTitle: string;
    metaDescription: string;
  }>({
    description: "",
    serviceText: "",
    promoText: "",
    metaTitle: "",
    metaDescription: "",
  });

  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (data?.content && !hydrated) {
      setForm({
        description: data.content.description ?? "",
        serviceText: data.content.serviceText ?? "",
        promoText: data.content.promoText ?? "",
        metaTitle: data.content.metaTitle ?? "",
        metaDescription: data.content.metaDescription ?? "",
      });
      setHydrated(true);
    } else if (data && !data.content && !hydrated) {
      setHydrated(true);
    }
  }, [data, hydrated]);

  const mutation = useMutation({
    mutationFn: () => updateBrandPageContent(brand.id, {
      description: form.description || null,
      serviceText: form.serviceText || null,
      promoText: form.promoText || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
    } as Parameters<typeof updateBrandPageContent>[1]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-page-content", brand.id] });
      toast({ title: "Страница обновлена" });
      onClose();
    },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>Страница бренда: {brand.name}</span>
            {brand.slug ? (
              <a
                href={`/brands/${brand.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-normal text-[#0070b8] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Открыть страницу
              </a>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Нет slug — страница недоступна
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {!brand.slug && (
          <div className="text-sm text-slate-500 bg-slate-50 border rounded-lg p-3">
            Назначьте slug этому бренду в настройках (кнопка карандаша), чтобы активировать публичную страницу. Контент можно заполнить заранее.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Описание бренда</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Основное описание бренда для раздела «О бренде»..."
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Текст о сервисе</Label>
              <Textarea
                rows={3}
                value={form.serviceText}
                onChange={e => setForm(f => ({ ...f, serviceText: e.target.value }))}
                placeholder="Описание сервисного обслуживания для данного бренда..."
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Промо-текст</Label>
              <Textarea
                rows={2}
                value={form.promoText}
                onChange={e => setForm(f => ({ ...f, promoText: e.target.value }))}
                placeholder="Акционное предложение или спецусловия покупки..."
              />
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">SEO</p>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block">Meta Title</Label>
                  <Input
                    value={form.metaTitle}
                    onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))}
                    placeholder={`${brand.name} в Брянске — официальный дилер Дебрянск Авто`}
                    maxLength={120}
                  />
                  <p className="text-xs text-slate-400 mt-1">{form.metaTitle.length} / 120 символов</p>
                </div>
                <div>
                  <Label className="mb-1.5 block">Meta Description</Label>
                  <Textarea
                    rows={2}
                    value={form.metaDescription}
                    onChange={e => setForm(f => ({ ...f, metaDescription: e.target.value }))}
                    placeholder={`Купить ${brand.name} в Брянске. Официальный дилер...`}
                    maxLength={320}
                  />
                  <p className="text-xs text-slate-400 mt-1">{form.metaDescription.length} / 320 символов</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            className="bg-[#0070b8] hover:bg-[#005a94]"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || isLoading}
          >
            {mutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
