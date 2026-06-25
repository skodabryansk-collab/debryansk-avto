import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBrands, createBrand, updateBrand, deleteBrand, uploadFile,
  getBrandPageContent, updateBrandPageContent, getBrandCatalogModels,
  type Brand, type BrandPageContent, type BrandAdvantage, type BrandFaqItem, type BrandPromotion,
  type BrandModel, type BrandService, type CatalogModel,
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
import { Plus, Pencil, Trash2, ExternalLink, Upload, X, Globe, Loader2, GripVertical, ChevronUp, ChevronDown, Wrench, Settings, Shield, Car, Gauge, Zap, Clock, Star, FileText, Package, CheckCircle, RefreshCw } from "lucide-react";
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

/* ── Advantages editor ───────────────────────────────────────── */
function AdvantagesEditor({
  value,
  onChange,
}: {
  value: BrandAdvantage[];
  onChange: (v: BrandAdvantage[]) => void;
}) {
  const add = () => onChange([...value, { icon: "✓", text: "" }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof BrandAdvantage, v: string) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [field]: v } : item));

  return (
    <div className="space-y-2">
      {value.map((adv, i) => (
        <div key={i} className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
          <Input
            className="w-16 shrink-0 text-center font-medium"
            value={adv.icon}
            onChange={e => update(i, "icon", e.target.value)}
            placeholder="✓"
            title="Иконка (эмодзи или символ)"
          />
          <Input
            className="flex-1"
            value={adv.text}
            onChange={e => update(i, "text", e.target.value)}
            placeholder="Текст преимущества..."
          />
          <Button
            variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-red-500 hover:text-red-600"
            onClick={() => remove(i)}
            type="button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} type="button" className="mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить преимущество
      </Button>
    </div>
  );
}

/* ── Features editor ─────────────────────────────────────────── */
function FeaturesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const add = () => onChange([...value, ""]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) =>
    onChange(value.map((item, idx) => idx === i ? v : item));

  return (
    <div className="space-y-2">
      {value.map((feat, i) => (
        <div key={i} className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
          <Input
            className="flex-1"
            value={feat}
            onChange={e => update(i, e.target.value)}
            placeholder="Особенность или характеристика бренда..."
          />
          <Button
            variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-red-500 hover:text-red-600"
            onClick={() => remove(i)}
            type="button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} type="button" className="mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить особенность
      </Button>
    </div>
  );
}

/* ── FAQ editor ──────────────────────────────────────────────── */
function FaqEditor({
  value,
  onChange,
}: {
  value: BrandFaqItem[];
  onChange: (v: BrandFaqItem[]) => void;
}) {
  const reindex = (arr: BrandFaqItem[]) => arr.map((item, idx) => ({ ...item, sort_order: idx }));
  const add = () => onChange(reindex([...value, { question: "", answer: "", is_published: true, include_in_schema: true }]));
  const remove = (i: number) => onChange(reindex(value.filter((_, idx) => idx !== i)));
  const updateText = (i: number, field: "question" | "answer", v: string) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  const updateBool = (i: number, field: "is_published" | "include_in_schema", v: boolean) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...value];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(reindex(next));
  };
  const moveDown = (i: number) => {
    if (i === value.length - 1) return;
    const next = [...value];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(reindex(next));
  };

  return (
    <div className="space-y-3">
      {value.map((item, i) => {
        const isPublished = item.is_published !== false;
        const inSchema = item.include_in_schema !== false;
        return (
          <div key={i} className={`border rounded-lg p-3 space-y-2 ${isPublished ? "border-slate-200 bg-slate-50/50" : "border-slate-200 bg-slate-100/60 opacity-70"}`}>
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                <Button
                  variant="ghost" size="icon" className="w-6 h-6 text-slate-400 hover:text-slate-600"
                  onClick={() => moveUp(i)} type="button" disabled={i === 0}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="w-6 h-6 text-slate-400 hover:text-slate-600"
                  onClick={() => moveDown(i)} type="button" disabled={i === value.length - 1}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </div>
              <span className="text-xs text-slate-400 font-semibold mt-2.5 shrink-0 w-4">{i + 1}.</span>
              <div className="flex-1 space-y-2">
                <Input
                  value={item.question}
                  onChange={e => updateText(i, "question", e.target.value)}
                  placeholder="Вопрос..."
                  className="font-medium"
                />
                <Textarea
                  rows={2}
                  value={item.answer}
                  onChange={e => updateText(i, "answer", e.target.value)}
                  placeholder="Ответ..."
                  className="text-sm resize-none"
                />
                <div className="flex items-center gap-5 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`faq-pub-${i}`}
                      checked={isPublished}
                      onCheckedChange={v => updateBool(i, "is_published", v)}
                    />
                    <Label htmlFor={`faq-pub-${i}`} className="text-xs text-slate-500 cursor-pointer">
                      Опубликован
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`faq-schema-${i}`}
                      checked={inSchema}
                      onCheckedChange={v => updateBool(i, "include_in_schema", v)}
                      disabled={!isPublished}
                    />
                    <Label htmlFor={`faq-schema-${i}`} className="text-xs text-slate-500 cursor-pointer">
                      В FAQPage JSON-LD
                    </Label>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost" size="icon" className="w-8 h-8 shrink-0 text-red-500 hover:text-red-600 mt-0.5"
                onClick={() => remove(i)}
                type="button"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={add} type="button" className="mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить вопрос
      </Button>
    </div>
  );
}

/* ── Promotions editor ───────────────────────────────────────── */
function PromotionEditor({
  value,
  onChange,
}: {
  value: BrandPromotion[];
  onChange: (v: BrandPromotion[]) => void;
}) {
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pendingIdxRef = React.useRef<number>(-1);
  const valueRef = React.useRef(value);
  React.useEffect(() => { valueRef.current = value; }, [value]);
  const [uploadingIdx, setUploadingIdx] = React.useState<number | null>(null);

  const add = () => onChange([...value, { title: "", description: "", isActive: true }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = <K extends keyof BrandPromotion>(i: number, field: K, v: BrandPromotion[K]) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [field]: v } : item));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const idx = pendingIdxRef.current;
    if (idx < 0) return;
    setUploadingIdx(idx);
    e.target.value = "";
    try {
      const url = await uploadFile(file);
      onChange(valueRef.current.map((item, i) => i === idx ? { ...item, image: url } : item));
      toast({ title: "Изображение загружено" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {value.map((item, i) => (
        <div key={i} className={`border rounded-lg p-3 space-y-2 ${item.isActive !== false ? "border-slate-200 bg-slate-50/50" : "border-slate-200 bg-slate-100/60 opacity-60"}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold shrink-0">{i + 1}.</span>
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-2">
                <Switch id={`promo-active-${i}`} checked={item.isActive !== false}
                  onCheckedChange={v => update(i, "isActive", v)} />
                <Label htmlFor={`promo-active-${i}`} className="text-xs text-slate-500 cursor-pointer">Активна</Label>
              </div>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:text-red-600" type="button" onClick={() => remove(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Input value={item.title} onChange={e => update(i, "title", e.target.value)}
            placeholder="Заголовок акции..." className="font-medium" />
          <Textarea rows={2} value={item.description} onChange={e => update(i, "description", e.target.value)}
            placeholder="Описание акции..." className="text-sm resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={item.badge ?? ""} onChange={e => update(i, "badge", e.target.value)}
              placeholder="Бейдж: Выгода до 200 000 ₽" className="text-sm" />
            <div className="space-y-0.5">
              <Input type="date" value={item.expiresAt ?? ""}
                onChange={e => update(i, "expiresAt", e.target.value)}
                className="text-sm" />
              <p className="text-[10px] text-slate-400 pl-1">Срок действия (до)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={item.buttonText ?? ""} onChange={e => update(i, "buttonText", e.target.value)}
              placeholder='Кнопка: "Оставить заявку"' className="text-sm" />
            <Input value={item.buttonUrl ?? ""} onChange={e => update(i, "buttonUrl", e.target.value)}
              placeholder="Ссылка «Узнать подробнее»" className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button"
              disabled={uploadingIdx === i}
              onClick={() => { pendingIdxRef.current = i; fileRef.current?.click(); }}>
              {uploadingIdx === i
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Загрузка...</>
                : <><Upload className="w-3.5 h-3.5 mr-1" />Фото</>}
            </Button>
            {item.image && (
              <>
                <img src={item.image} alt="" className="w-16 h-10 object-cover rounded border" />
                <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" type="button"
                  onClick={() => update(i, "image", "")}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} type="button" className="mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить акцию
      </Button>
    </div>
  );
}

/* ── Model editor ────────────────────────────────────────────── */
function ModelEditor({
  value,
  onChange,
  catalogModels,
  catalogLoading,
}: {
  value: BrandModel[];
  onChange: (v: BrandModel[]) => void;
  catalogModels: CatalogModel[];
  catalogLoading: boolean;
}) {
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pendingIdxRef = React.useRef<number>(-1);
  const valueRef = React.useRef(value);
  React.useEffect(() => { valueRef.current = value; }, [value]);
  const [uploadingIdx, setUploadingIdx] = React.useState<number | null>(null);
  const [catalogSearch, setCatalogSearch] = React.useState("");

  const add = () => onChange([...value, {
    id: Math.random().toString(36).slice(2),
    feedDealer: "",
    feedModel: "",
    displayName: "",
    isActive: true,
    sort: value.length,
  }]);

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const update = <K extends keyof BrandModel>(i: number, field: K, v: BrandModel[K]) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [field]: v } : item));

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...value];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next.map((m, idx) => ({ ...m, sort: idx })));
  };

  const moveDown = (i: number) => {
    if (i === value.length - 1) return;
    const next = [...value];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next.map((m, idx) => ({ ...m, sort: idx })));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const idx = pendingIdxRef.current;
    if (idx < 0) return;
    setUploadingIdx(idx);
    e.target.value = "";
    try {
      const url = await uploadFile(file);
      onChange(valueRef.current.map((item, i) => i === idx ? { ...item, image: url } : item));
      toast({ title: "Изображение загружено" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleCatalogSelect = (i: number, key: string) => {
    if (!key) return;
    const sep = key.indexOf("::");
    const dealer = key.slice(0, sep);
    const model = key.slice(sep + 2);
    onChange(value.map((item, idx) => idx === i ? {
      ...item,
      feedDealer: dealer,
      feedModel: model,
      displayName: item.displayName || model,
    } : item));
  };

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {catalogLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загружаем каталог...
        </div>
      )}

      {value.map((item, i) => (
        <div key={i} className={`border rounded-lg p-3 space-y-2 ${item.isActive !== false ? "border-slate-200 bg-slate-50/50" : "border-slate-200 bg-slate-100/60 opacity-60"}`}>
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-0 shrink-0">
              <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400" type="button"
                onClick={() => moveUp(i)} disabled={i === 0}>
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400" type="button"
                onClick={() => moveDown(i)} disabled={i === value.length - 1}>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
            <span className="text-xs text-slate-400 font-semibold shrink-0">{i + 1}.</span>
            <div className="flex items-center gap-2 ml-auto">
              <Switch id={`model-active-${i}`} checked={item.isActive !== false}
                onCheckedChange={v => update(i, "isActive", v)} />
              <Label htmlFor={`model-active-${i}`} className="text-xs text-slate-500 cursor-pointer">Активна</Label>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:text-red-600"
                type="button" onClick={() => remove(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Catalog selector */}
          <div>
            <p className="text-[10px] text-slate-400 mb-1 font-medium">Модель из каталога — для фильтров и цены «от»</p>
            <Input
              placeholder="Поиск по названию модели..."
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              className="mb-1 text-sm"
            />
            <select
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0070b8]"
              value={item.feedDealer && item.feedModel ? `${item.feedDealer}::${item.feedModel}` : ""}
              onChange={e => { handleCatalogSelect(i, e.target.value); setCatalogSearch(""); }}
              size={catalogSearch ? Math.min(catalogModels.filter(cm => cm.model.toLowerCase().includes(catalogSearch.toLowerCase())).length + 1, 6) : 1}
            >
              <option value="">— Выберите модель из каталога —</option>
              {catalogModels
                .filter(cm => !catalogSearch || cm.model.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map((cm, ci) => (
                  <option key={ci} value={`${cm.dealer}::${cm.model}`}>
                    {cm.model} — от {Number(cm.min_price).toLocaleString("ru-RU")} ₽ ({cm.count} шт.)
                  </option>
                ))}
              {item.feedDealer && item.feedModel && !catalogModels.some(cm => cm.dealer === item.feedDealer && cm.model === item.feedModel) && (
                <option value={`${item.feedDealer}::${item.feedModel}`}>
                  {item.feedModel} — нет в наличии
                </option>
              )}
            </select>
            {item.feedDealer && (
              <p className="text-[10px] text-slate-400 mt-0.5 pl-1">
                Дилер: <span className="font-medium text-slate-600">{item.feedDealer}</span>
                {" · "}Модель в фиде: <span className="font-medium text-slate-600">{item.feedModel}</span>
              </p>
            )}
          </div>

          {/* Display name */}
          <Input value={item.displayName} onChange={e => update(i, "displayName", e.target.value)}
            placeholder="Отображаемое название (напр: Jolion, F7, Dargo X...)"
            className="font-medium" />

          {/* Badge */}
          <Input value={item.badge ?? ""} onChange={e => update(i, "badge", e.target.value)}
            placeholder="Бейдж: Новинка / Хит продаж (необязательно)"
            className="text-sm" />

          {/* Description */}
          <Textarea rows={2} value={item.description ?? ""}
            onChange={e => update(i, "description", e.target.value)}
            placeholder="Краткое описание модели (необязательно)..."
            className="text-sm resize-none" />

          {/* Image */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" type="button" disabled={uploadingIdx === i}
              onClick={() => { pendingIdxRef.current = i; fileRef.current?.click(); }}>
              {uploadingIdx === i
                ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Загрузка...</>
                : <><Upload className="w-3.5 h-3.5 mr-1" />Фото модели</>}
            </Button>
            {item.image ? (
              <>
                <img src={item.image} alt="" className="w-20 h-12 object-contain rounded border bg-slate-50" />
                <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" type="button"
                  onClick={() => update(i, "image", undefined)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <span className="text-xs text-slate-400">PNG с прозрачным фоном, 800×500 px</span>
            )}
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={add} type="button" className="mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить модель
      </Button>
    </div>
  );
}

/* ── Service editor ──────────────────────────────────────────── */
const SERVICE_ICON_OPTIONS = [
  { value: "Wrench",       label: "🔧 Ремонт / ТО",       Icon: Wrench },
  { value: "Settings",     label: "⚙️ Настройка",          Icon: Settings },
  { value: "Shield",       label: "🛡️ Гарантия",           Icon: Shield },
  { value: "Car",          label: "🚗 Кузовной",           Icon: Car },
  { value: "Gauge",        label: "📊 Диагностика",        Icon: Gauge },
  { value: "Zap",          label: "⚡ Электрика",          Icon: Zap },
  { value: "Clock",        label: "⏰ Срочный ремонт",     Icon: Clock },
  { value: "Star",         label: "⭐ Сервис качества",    Icon: Star },
  { value: "FileText",     label: "📋 Акт / Документы",   Icon: FileText },
  { value: "Package",      label: "📦 Запчасти",           Icon: Package },
  { value: "CheckCircle",  label: "✅ Постгарантийный",    Icon: CheckCircle },
  { value: "RefreshCw",    label: "🔄 Шиномонтаж",         Icon: RefreshCw },
];

function ServicesEditor({ value, onChange }: { value: BrandService[]; onChange: (v: BrandService[]) => void }) {
  const add = () => onChange([...value, {
    id: Math.random().toString(36).slice(2),
    icon: "Wrench",
    title: "",
    description: "",
    sort: value.length,
  }]);

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const update = <K extends keyof BrandService>(i: number, field: K, v: BrandService[K]) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [field]: v } : item));

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...value];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next.map((s, idx) => ({ ...s, sort: idx })));
  };

  const moveDown = (i: number) => {
    if (i === value.length - 1) return;
    const next = [...value];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next.map((s, idx) => ({ ...s, sort: idx })));
  };

  return (
    <div className="space-y-3">
      {value.map((item, i) => {
        const selectedIcon = SERVICE_ICON_OPTIONS.find(o => o.value === item.icon) ?? SERVICE_ICON_OPTIONS[0];
        const PreviewIcon = selectedIcon.Icon;
        return (
          <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
            <div className="flex items-center gap-1">
              <div className="flex flex-col gap-0 shrink-0">
                <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400" type="button"
                  onClick={() => moveUp(i)} disabled={i === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-slate-400" type="button"
                  onClick={() => moveDown(i)} disabled={i === value.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
              <span className="text-xs text-slate-400 font-semibold shrink-0">{i + 1}.</span>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:text-red-600 ml-auto" type="button"
                onClick={() => remove(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                <PreviewIcon className="w-4 h-4 text-[#0070b8]" />
              </div>
              <select
                className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0070b8]"
                value={item.icon}
                onChange={e => update(i, "icon", e.target.value)}
              >
                {SERVICE_ICON_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <Input
              value={item.title}
              onChange={e => update(i, "title", e.target.value)}
              placeholder="Название услуги (напр: Техническое обслуживание)"
              className="font-medium"
            />
            <Textarea
              rows={2}
              value={item.description ?? ""}
              onChange={e => update(i, "description", e.target.value)}
              placeholder="Краткое описание услуги (необязательно)..."
              className="text-sm resize-none"
            />
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={add} type="button" className="mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить услугу
      </Button>
    </div>
  );
}

/* ── Section heading helper ──────────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{children}</p>
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

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["brand-catalog-models", brand.id],
    queryFn: () => getBrandCatalogModels(brand.id),
    staleTime: 5 * 60 * 1000,
  });
  const catalogModels = catalogData ?? [];

  const [form, setForm] = React.useState<{
    description: string;
    serviceText: string;
    promoText: string;
    advantages: BrandAdvantage[];
    features: string[];
    faq: BrandFaqItem[];
    promotions: BrandPromotion[];
    models: BrandModel[];
    services: BrandService[];
    heroImageUrl: string;
    heroImageMobileUrl: string;
    metaTitle: string;
    metaDescription: string;
  }>({
    description: "",
    serviceText: "",
    promoText: "",
    advantages: [],
    features: [],
    faq: [],
    promotions: [],
    models: [],
    services: [],
    heroImageUrl: "",
    heroImageMobileUrl: "",
    metaTitle: "",
    metaDescription: "",
  });
  const [heroUploading, setHeroUploading] = React.useState(false);
  const [heroMobileUploading, setHeroMobileUploading] = React.useState(false);
  const heroFileRef = React.useRef<HTMLInputElement>(null);
  const heroMobileFileRef = React.useRef<HTMLInputElement>(null);

  const handleHeroUpload = async (file: File) => {
    setHeroUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(f => ({ ...f, heroImageUrl: url }));
      toast({ title: "Обложка загружена" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setHeroUploading(false);
    }
  };

  const handleHeroMobileUpload = async (file: File) => {
    setHeroMobileUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(f => ({ ...f, heroImageMobileUrl: url }));
      toast({ title: "Мобильная обложка загружена" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setHeroMobileUploading(false);
    }
  };

  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (data?.content && !hydrated) {
      setForm({
        description: data.content.description ?? "",
        serviceText: data.content.serviceText ?? "",
        promoText: data.content.promoText ?? "",
        advantages: data.content.advantages ?? [],
        features: data.content.features ?? [],
        faq: data.content.faq ?? [],
        promotions: data.content.promotions ?? [],
        models: data.content.models ?? [],
        services: data.content.services ?? [],
        heroImageUrl: data.content.heroImageUrl ?? "",
        heroImageMobileUrl: data.content.heroImageMobileUrl ?? "",
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
      advantages: form.advantages,
      features: form.features,
      faq: form.faq,
      promotions: form.promotions,
      models: form.models,
      services: form.services,
      heroImageUrl: form.heroImageUrl || null,
      heroImageMobileUrl: form.heroImageMobileUrl || null,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
    }),
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
          <div className="space-y-5">
            {/* Hero cover images */}
            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Обложка hero-секции</p>

              {/* Desktop */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Десктоп — 1920×600 px, JPEG/WebP, до 300 КБ</p>
                  <div className="flex items-center gap-1.5">
                    <input ref={heroFileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handleHeroUpload(e.target.files[0])} />
                    <Button variant="outline" size="sm" type="button" disabled={heroUploading}
                      onClick={() => heroFileRef.current?.click()}>
                      {heroUploading
                        ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Загрузка...</>
                        : <><Upload className="w-4 h-4 mr-1" />Загрузить</>}
                    </Button>
                    {form.heroImageUrl && (
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:text-red-600" type="button"
                        onClick={() => setForm(f => ({ ...f, heroImageUrl: "" }))}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {form.heroImageUrl ? (
                  <div className="relative rounded-md overflow-hidden bg-slate-800" style={{ aspectRatio: "16/5" }}>
                    <img src={form.heroImageUrl} alt="hero desktop preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-md border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-xs" style={{ aspectRatio: "16/5" }}>
                    Нет обложки — градиентный фон
                  </div>
                )}
              </div>

              {/* Mobile */}
              <div className="space-y-1.5 border-t pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Моб — 750×960 px (portrait), JPEG/WebP, до 200 КБ</p>
                  <div className="flex items-center gap-1.5">
                    <input ref={heroMobileFileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && handleHeroMobileUpload(e.target.files[0])} />
                    <Button variant="outline" size="sm" type="button" disabled={heroMobileUploading}
                      onClick={() => heroMobileFileRef.current?.click()}>
                      {heroMobileUploading
                        ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Загрузка...</>
                        : <><Upload className="w-4 h-4 mr-1" />Загрузить</>}
                    </Button>
                    {form.heroImageMobileUrl && (
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 hover:text-red-600" type="button"
                        onClick={() => setForm(f => ({ ...f, heroImageMobileUrl: "" }))}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {form.heroImageMobileUrl ? (
                  <div className="flex justify-center">
                    <div className="relative rounded-md overflow-hidden bg-slate-800" style={{ width: 120, aspectRatio: "750/960" }}>
                      <img src={form.heroImageMobileUrl} alt="hero mobile preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-xs py-3">
                    {form.heroImageUrl ? "Не задана — будет использоваться десктопная" : "Не задана"}
                  </div>
                )}
              </div>
            </div>

            {/* Basic text fields */}
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

            {/* Advantages */}
            <div className="border-t pt-4">
              <SectionHeading>Преимущества</SectionHeading>
              <p className="text-xs text-slate-400 mb-3">
                Иконка — эмодзи или символ (например: ✓ ★ 🚗). Отображаются в виде списка на странице бренда.
              </p>
              <AdvantagesEditor
                value={form.advantages}
                onChange={advantages => setForm(f => ({ ...f, advantages }))}
              />
            </div>

            {/* Features */}
            <div className="border-t pt-4">
              <SectionHeading>Особенности бренда</SectionHeading>
              <p className="text-xs text-slate-400 mb-3">
                Краткие характеристики или ключевые факты о бренде.
              </p>
              <FeaturesEditor
                value={form.features}
                onChange={features => setForm(f => ({ ...f, features }))}
              />
            </div>

            {/* FAQ */}
            <div className="border-t pt-4">
              <SectionHeading>FAQ — Вопросы и ответы</SectionHeading>
              <p className="text-xs text-slate-400 mb-3">
                Часто задаваемые вопросы о бренде и ответы на них.
              </p>
              <FaqEditor
                value={form.faq}
                onChange={faq => setForm(f => ({ ...f, faq }))}
              />
            </div>

            {/* Services */}
            <div className="border-t pt-4">
              <SectionHeading>Услуги сервиса</SectionHeading>
              <p className="text-xs text-slate-400 mb-3">
                Отображаются на странице бренда в секции «Услуги». Актуально для сервисных брендов (SKODA, VW, MB, Exeed). Добавьте услуги с иконкой и описанием.
              </p>
              <ServicesEditor
                value={form.services}
                onChange={services => setForm(f => ({ ...f, services }))}
              />
            </div>

            {/* Models */}
            <div className="border-t pt-4">
              <SectionHeading>Модельный ряд</SectionHeading>
              <p className="text-xs text-slate-400 mb-3">
                Модели, которые отображаются в секции «Модельный ряд» на странице бренда. Привяжите каждую модель к каталогу авто, чтобы автоматически показывать цену «от» и работали фильтры при переходе в каталог.
              </p>
              <ModelEditor
                value={form.models}
                onChange={models => setForm(f => ({ ...f, models }))}
                catalogModels={catalogModels}
                catalogLoading={catalogLoading}
              />
            </div>

            {/* Promotions */}
            <div className="border-t pt-4">
              <SectionHeading>Акции</SectionHeading>
              <p className="text-xs text-slate-400 mb-3">
                Акции здесь сохраняются в глобальный раздел и привязываются к этому бренду.
                Для управления всеми акциями используйте{" "}
                <a href="/promotions" className="text-[#0070b8] hover:underline font-medium">
                  раздел Акции
                </a>.
              </p>
              <PromotionEditor
                value={form.promotions}
                onChange={promotions => setForm(f => ({ ...f, promotions }))}
              />
            </div>

            {/* SEO */}
            <div className="border-t pt-4">
              <SectionHeading>SEO</SectionHeading>
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
