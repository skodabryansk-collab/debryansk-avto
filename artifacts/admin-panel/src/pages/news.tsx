import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getNews, deleteNews, uploadFile, getBrands, type NewsItem, type Brand } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NewsPage() {
  const [search, setSearch] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [editItem, setEditItem] = React.useState<NewsItem | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["news"], queryFn: getNews });

  const delMutation = useMutation({
    mutationFn: deleteNews,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setDeleteId(null);
      toast({ title: "Статья удалена" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const filtered = React.useMemo(() => {
    if (!data) return [];
    if (!search) return data;
    return data.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.category.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Новости</h1>
        <Button size="sm" className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => setIsCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Поиск по заголовку или категории..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заголовок</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Загрузка...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Ничего не найдено</TableCell></TableRow>
              ) : filtered.map(n => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {n.image && <img src={n.image} alt="" className="w-8 h-8 rounded object-cover hidden sm:block" />}
                      {n.title}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{n.category}</Badge></TableCell>
                  <TableCell className="text-slate-500 text-sm">{n.publishedAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setEditItem(n)}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setDeleteId(n.id)}>
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
            <DialogTitle>Удалить статью?</DialogTitle>
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

      {/* Edit / Create */}
      {(editItem || isCreate) && (
        <NewsFormDialog item={editItem} onClose={() => { setEditItem(null); setIsCreate(false); }} />
      )}
    </div>
  );
}

function NewsFormDialog({ item, onClose }: { item: NewsItem | null; onClose: () => void }) {
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: getBrands });
  const [form, setForm] = React.useState({
    title: item?.title ?? "",
    excerpt: item?.excerpt ?? "",
    content: item?.content ?? "",
    category: item?.category ?? "",
    image: item?.image ?? "",
    imageMobile: item?.imageMobile ?? "",
    slug: item?.slug ?? "",
    publishedAt: item?.publishedAt ?? "",
    readTime: item?.readTime ?? 3,
    brandIds: item?.brandIds ?? [] as number[],
  });
  const [uploading, setUploading] = React.useState(false);
  const imageRef = React.useRef<HTMLInputElement>(null);
  const imageMobileRef = React.useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!item;

  const handleFile = async (field: "image" | "imageMobile", file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(f => ({ ...f, [field]: url }));
      toast({ title: "Изображение загружено" });
    } catch {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { createNews, updateNews } = await import("@/lib/api");
      if (isEdit) return updateNews(item!.id, form);
      return createNews(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onClose();
      toast({ title: isEdit ? "Статья обновлена" : "Статья создана" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать статью" : "Новая статья"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Заголовок</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Категория</Label>
            <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div>
            <Label>Анонс</Label>
            <Textarea rows={2} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} />
          </div>
          <div>
            <Label>Содержание</Label>
            <Textarea rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          </div>

          {/* Desktop image */}
          <div>
            <Label>Изображение для десктопа</Label>
            <p className="text-xs text-slate-500 mb-1">Рекомендуемый размер: <strong>1200 × 675 px</strong> (16:9), макс. 2 MB, формат JPG/WebP</p>
            <div className="flex items-center gap-2">
              <Input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="URL изображения" />
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile("image", e.target.files[0])} />
              <Button variant="outline" size="sm" type="button" disabled={uploading} className="whitespace-nowrap"
                onClick={() => imageRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />{uploading ? "Загр..." : "Загрузить"}
              </Button>
            </div>
            {form.image && (
              <div className="mt-2 relative inline-block">
                <img src={form.image} alt="preview" className="h-24 rounded border object-cover" />
                <button className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" onClick={() => setForm(f => ({ ...f, image: "" }))}><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>

          {/* Mobile image */}
          <div>
            <Label>Изображение для мобильных</Label>
            <p className="text-xs text-slate-500 mb-1">Рекомендуемый размер: <strong>800 × 1000 px</strong> (4:5), макс. 1.5 MB, формат JPG/WebP</p>
            <div className="flex items-center gap-2">
              <Input value={form.imageMobile} onChange={e => setForm(f => ({ ...f, imageMobile: e.target.value }))} placeholder="URL мобильного изображения" />
              <input ref={imageMobileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile("imageMobile", e.target.files[0])} />
              <Button variant="outline" size="sm" type="button" disabled={uploading} className="whitespace-nowrap"
                onClick={() => imageMobileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />{uploading ? "Загр..." : "Загрузить"}
              </Button>
            </div>
            {form.imageMobile && (
              <div className="mt-2 relative inline-block">
                <img src={form.imageMobile} alt="preview" className="h-24 rounded border object-cover" />
                <button className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" onClick={() => setForm(f => ({ ...f, imageMobile: "" }))}><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <Label>Дата публикации</Label>
              <Input type="date" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Время чтения (мин)</Label>
            <Input type="number" value={form.readTime} onChange={e => setForm(f => ({ ...f, readTime: Number(e.target.value) }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Бренды (опционально)</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-[#0070b8] hover:underline"
                  onClick={() => setForm(f => ({ ...f, brandIds: (brands ?? []).map(b => b.id) }))}
                >
                  Выбрать все
                </button>
                <span className="text-xs text-slate-300">|</span>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:underline"
                  onClick={() => setForm(f => ({ ...f, brandIds: [] }))}
                >
                  Снять все
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">Новость появится на странице каждого выбранного бренда. Без выбора — только на главной.</p>
            <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 bg-slate-50">
              {(brands ?? []).map(b => {
                const checked = form.brandIds.includes(b.id);
                return (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        setForm(f => ({
                          ...f,
                          brandIds: e.target.checked
                            ? [...f.brandIds, b.id]
                            : f.brandIds.filter(id => id !== b.id),
                        }));
                      }}
                      className="accent-[#0070b8]"
                    />
                    <span className="text-sm text-slate-700">
                      {b.name}
                      {b.isServiceOnly && <span className="ml-1 text-xs text-slate-400">(сервис)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {form.brandIds.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">Выбрано: {form.brandIds.length}</p>
            )}
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
