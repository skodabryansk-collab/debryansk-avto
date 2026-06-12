import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNews, deleteNews, uploadFile, createNews, updateNews, type NewsItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VACANCY_CATEGORY = "Вакансии";

export default function VacanciesPage() {
  const [search, setSearch] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [editItem, setEditItem] = React.useState<NewsItem | null>(null);
  const [isCreate, setIsCreate] = React.useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allNews, isLoading } = useQuery({ queryKey: ["news"], queryFn: getNews });
  const data = React.useMemo(() => (allNews ?? []).filter(n => n.category === VACANCY_CATEGORY), [allNews]);

  const delMutation = useMutation({
    mutationFn: deleteNews,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setDeleteId(null);
      toast({ title: "Вакансия удалена" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const filtered = React.useMemo(() => {
    if (!search) return data;
    return data.filter(n => n.title.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Вакансии</h1>
        <Button size="sm" className="bg-[#0070b8] hover:bg-[#005a94]" onClick={() => setIsCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Поиск по заголовку..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название вакансии</TableHead>
                <TableHead>Дата публикации</TableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-400">Загрузка...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-400">Вакансий не найдено</TableCell></TableRow>
              ) : filtered.map(n => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {n.image && <img src={n.image} alt="" className="w-8 h-8 rounded object-cover hidden sm:block" />}
                      {n.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("ru-RU") : "—"}</TableCell>
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

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить вакансию?</DialogTitle>
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

      {(editItem || isCreate) && (
        <VacancyFormDialog item={editItem} onClose={() => { setEditItem(null); setIsCreate(false); }} />
      )}
    </div>
  );
}

function VacancyFormDialog({ item, onClose }: { item: NewsItem | null; onClose: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = React.useState({
    title: item?.title ?? "",
    excerpt: item?.excerpt ?? "",
    content: item?.content ?? "",
    category: VACANCY_CATEGORY,
    image: item?.image ?? "",
    imageMobile: item?.imageMobile ?? "",
    slug: item?.slug ?? "",
    publishedAt: item?.publishedAt ? item.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    readTime: item?.readTime ?? 3,
  });
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const handleFile = async (field: "image" | "imageMobile", file: File) => {
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

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[а-яё]/g, c => ({ а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" }[c] ?? c)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, category: VACANCY_CATEGORY, slug: form.slug || slugify(form.title) };
      if (isEdit) return updateNews(item!.id, payload);
      return createNews(payload as Parameters<typeof createNews>[0]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onClose();
      toast({ title: isEdit ? "Вакансия обновлена" : "Вакансия создана" });
    },
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать вакансию" : "Новая вакансия"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название вакансии</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Например: Менеджер по продажам" />
          </div>
          <div>
            <Label>Краткое описание</Label>
            <Textarea rows={2} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Требования, условия..." />
          </div>
          <div>
            <Label>Полное описание</Label>
            <Textarea rows={5} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Обязанности, условия работы, контакты..." />
          </div>
          <div>
            <Label>Изображение</Label>
            <div className="flex items-center gap-2">
              <Input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="URL или загрузите файл" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile("image", e.target.files[0])} />
              <Button variant="outline" size="sm" type="button" disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />{uploading ? "Загр..." : "Файл"}
              </Button>
            </div>
            {form.image && (
              <div className="mt-2 relative inline-block">
                <img src={form.image} alt="preview" className="h-20 rounded border object-cover" />
                <button className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center" onClick={() => setForm(f => ({ ...f, image: "" }))}><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto" />
            </div>
            <div>
              <Label>Дата публикации</Label>
              <Input type="date" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} />
            </div>
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
