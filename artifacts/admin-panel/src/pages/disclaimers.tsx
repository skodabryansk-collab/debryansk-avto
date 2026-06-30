import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDisclaimers, createDisclaimer, updateDisclaimer, deleteDisclaimer,
  getDisclaimerVersions, getBrands, getCarModels,
  type Disclaimer, type DisclaimerVersion, type Brand,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, Loader2, History, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SCOPE_LABELS: Record<string, string> = {
  price_from_used: "Цена «от» — б/у",
  price_from_new: "Цена «от» — новые",
  promotion: "Акция",
};

const SCOPES = Object.keys(SCOPE_LABELS);

/* ── helpers ──────────────────────────────────────────────────────────────── */
function useModelsForBrand(brands: Brand[], brandId: number | null) {
  const brand = brands.find(b => b.id === brandId);
  return useQuery<string[]>({
    queryKey: ["car-models", brand?.carMark ?? ""],
    queryFn: () => (brand?.carMark ? getCarModels(brand.carMark) : Promise.resolve([])),
    enabled: !!(brand?.carMark),
    staleTime: 5 * 60_000,
  });
}

/* ── Version History Dialog ─────────────────────────────────────────────── */
function VersionHistoryDialog({
  disclaimerId, open, onClose,
}: { disclaimerId: number; open: boolean; onClose: () => void }) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["disclaimer-versions", disclaimerId],
    queryFn: () => getDisclaimerVersions(disclaimerId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>История версий</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : !versions || versions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Нет предыдущих версий</p>
        ) : (
          <div className="space-y-3">
            {versions.map((v: DisclaimerVersion) => (
              <div key={v.id} className="border rounded-lg p-3 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Версия {v.version_number}</span>
                  <span className="text-xs text-slate-400">{new Date(v.changed_at).toLocaleString("ru-RU")}</span>
                </div>
                <p className="text-slate-600 whitespace-pre-wrap text-xs bg-slate-50 rounded p-2">{v.content}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Model dropdown (fetches from DB by brand's car_mark) ─────────────────── */
function ModelSelect({
  brands,
  brandId,
  value,
  onChange,
}: {
  brands: Brand[];
  brandId: number | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: models = [], isLoading } = useModelsForBrand(brands, brandId);
  const hasModels = models.length > 0;

  if (!brandId) {
    return (
      <Input value={value} onChange={e => onChange(e.target.value)}
        placeholder="Сначала выберите бренд" disabled className="h-8 text-sm" />
    );
  }

  return (
    <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="h-8 text-sm">
        {isLoading
          ? <span className="text-slate-400 text-xs">Загрузка...</span>
          : <SelectValue placeholder={hasModels ? "Все модели" : "Нет моделей в БД"} />
        }
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Все модели</SelectItem>
        {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ── Single Disclaimer Editor Card ─────────────────────────────────────── */
function DisclaimerCard({
  item, brands, onUpdate, onDelete, isBusy,
}: {
  item: Disclaimer;
  brands: Brand[];
  onUpdate: (id: number, data: Parameters<typeof updateDisclaimer>[1]) => void;
  onDelete: (id: number) => void;
  isBusy: boolean;
}) {
  const [draft, setDraft] = React.useState({
    title: item.title,
    content: item.content,
    brand_id: item.brand_id,
    model: item.model || "",
    is_active: item.is_active,
  });
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const changed =
    draft.title !== item.title ||
    draft.content !== item.content ||
    draft.brand_id !== item.brand_id ||
    draft.model !== (item.model || "") ||
    draft.is_active !== item.is_active;

  const scopeIsUsed = item.scope === "price_from_used";
  const brandName = item.brand_id ? (brands.find(b => b.id === item.brand_id)?.name ?? `#${item.brand_id}`) : null;

  return (
    <>
      <VersionHistoryDialog disclaimerId={item.id} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <div className={`border rounded-lg bg-white overflow-hidden ${!item.is_active ? "opacity-60" : ""}`}>
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50"
          onClick={() => setExpanded(e => !e)}
        >
          <Badge variant="outline" className="text-[10px] shrink-0">{SCOPE_LABELS[item.scope] ?? item.scope}</Badge>
          {brandName && <span className="text-xs text-slate-500 shrink-0">{brandName}</span>}
          {item.model && <span className="text-xs text-slate-400 shrink-0">{item.model}</span>}
          <span className="font-medium text-sm flex-1 truncate">{item.title}</span>
          {!item.is_active && <Badge variant="secondary" className="text-[10px] shrink-0">неактивен</Badge>}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
        </div>

        {/* Expanded editor */}
        {expanded && (
          <div className="border-t px-4 py-4 space-y-3">
            {item.scope === "price_from_new" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Бренд</Label>
                  <Select
                    value={draft.brand_id ? String(draft.brand_id) : "__none__"}
                    onValueChange={v => setDraft(d => ({ ...d, brand_id: v === "__none__" ? null : Number(v), model: "" }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Все бренды" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Все бренды</SelectItem>
                      {brands.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Модель</Label>
                  <ModelSelect
                    brands={brands}
                    brandId={draft.brand_id}
                    value={draft.model}
                    onChange={v => setDraft(d => ({ ...d, model: v }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Заголовок</Label>
              <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="Заголовок дисклеймера" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Текст</Label>
              <Textarea rows={4} value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                placeholder="Текст дисклеймера..." className="text-sm resize-none" />
            </div>

            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <Switch id={`active-${item.id}`} checked={draft.is_active}
                  onCheckedChange={v => setDraft(d => ({ ...d, is_active: v }))} />
                <Label htmlFor={`active-${item.id}`} className="text-xs text-slate-500 cursor-pointer">Активен</Label>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 text-xs h-8"
                  onClick={() => setHistoryOpen(true)}>
                  <History className="w-3.5 h-3.5 mr-1" />История
                </Button>
                {!scopeIsUsed && (
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400 hover:text-red-600"
                    onClick={() => onDelete(item.id)} disabled={isBusy}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                {changed && (
                  <Button size="sm" className="h-8"
                    onClick={() => onUpdate(item.id, {
                      title: draft.title, content: draft.content,
                      brandId: draft.brand_id ?? undefined,
                      model: draft.model || undefined,
                      isActive: draft.is_active,
                    })}
                    disabled={isBusy || !draft.title.trim() || !draft.content.trim()}>
                    <Save className="w-3.5 h-3.5 mr-1" />Сохранить
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── New Disclaimer Form ─────────────────────────────────────────────────── */
function NewDisclaimerForm({
  brands, onCreate, isPending,
}: {
  brands: Brand[];
  onCreate: (data: Parameters<typeof createDisclaimer>[0]) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = React.useState({
    scope: "price_from_new",
    brand_id: "",
    model: "",
    title: "",
    content: "",
  });

  const selectedBrandId = draft.brand_id ? Number(draft.brand_id) : null;

  const handleSubmit = () => {
    if (!draft.title.trim() || !draft.content.trim()) return;
    onCreate({
      scope: draft.scope,
      brandId: selectedBrandId ?? undefined,
      model: draft.model.trim() || undefined,
      title: draft.title.trim(),
      content: draft.content.trim(),
    });
    setDraft({ scope: "price_from_new", brand_id: "", model: "", title: "", content: "" });
  };

  return (
    <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новый дисклеймер</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Тип</Label>
          <Select value={draft.scope} onValueChange={v => setDraft(d => ({ ...d, scope: v, brand_id: "", model: "" }))}>
            <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCOPES.map(s => <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {draft.scope === "price_from_new" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Бренд</Label>
              <Select
                value={draft.brand_id || "__none__"}
                onValueChange={v => setDraft(d => ({ ...d, brand_id: v === "__none__" ? "" : v, model: "" }))}
              >
                <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="Все бренды" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Все бренды</SelectItem>
                  {brands.filter(b => b.carMark).map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Модель (необязательно)</Label>
              <ModelSelect
                brands={brands}
                brandId={selectedBrandId}
                value={draft.model}
                onChange={v => setDraft(d => ({ ...d, model: v }))}
              />
            </div>
          </>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Заголовок</Label>
        <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          placeholder="Заголовок дисклеймера" className="h-8 text-sm bg-white" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Текст</Label>
        <Textarea rows={3} value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
          placeholder="Полный текст дисклеймера..." className="text-sm resize-none bg-white" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit}
          disabled={isPending || !draft.title.trim() || !draft.content.trim()}>
          {isPending
            ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Создание...</>
            : <><Plus className="w-3.5 h-3.5 mr-1" />Добавить</>
          }
        </Button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function DisclaimersPage() {
  const [scopeFilter, setScopeFilter] = React.useState<string>("all");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
    staleTime: 60_000,
  });

  const { data: disclaimers, isLoading } = useQuery({
    queryKey: ["admin-disclaimers", scopeFilter],
    queryFn: () => getDisclaimers(scopeFilter === "all" ? undefined : scopeFilter),
  });

  const createMutation = useMutation({
    mutationFn: createDisclaimer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-disclaimers"] }); toast({ title: "Дисклеймер создан" }); },
    onError: () => toast({ title: "Ошибка создания", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateDisclaimer>[1] }) => updateDisclaimer(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-disclaimers"] }); toast({ title: "Сохранено" }); },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDisclaimer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-disclaimers"] }); toast({ title: "Удалено" }); },
    onError: (err: Error) => toast({
      title: err.message.includes("system") ? "Системный дисклеймер нельзя удалить" : "Ошибка удаления",
      variant: "destructive",
    }),
  });

  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Дисклеймеры</h1>

      <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
        <Label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Тип:</Label>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            {SCOPES.map(s => <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">
          {isLoading ? "Загрузка..." : `${disclaimers?.length ?? 0} записей`}
        </span>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : disclaimers && disclaimers.length > 0 ? (
          disclaimers.map(d => (
            <DisclaimerCard key={d.id} item={d} brands={brands}
              onUpdate={(id, data) => updateMutation.mutate({ id, data })}
              onDelete={id => deleteMutation.mutate(id)}
              isBusy={isBusy} />
          ))
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
            Нет дисклеймеров
          </div>
        )}
      </div>

      <NewDisclaimerForm
        brands={brands}
        onCreate={data => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
