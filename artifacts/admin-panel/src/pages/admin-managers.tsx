import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCheck, UserX, UserPlus, LogIn, FileText, Clock, BookOpen,
  ChevronDown, ChevronUp, Plus, Loader2, Mail, Pencil, ShieldCheck,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getManagers, createManager, toggleManager, activateManager,
  resendManagerEmail, getBrands, updateManagerBrands, type ManagerItem,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase();
}

const COLORS = [
  "bg-[#0070b8]/10 text-[#0070b8]",
  "bg-violet-100 text-violet-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function Avatar({ name, src, size = 10, pending = false }: {
  name: string; src?: string | null; size?: number; pending?: boolean;
}) {
  const cls = `w-${size} h-${size} rounded-full flex-none flex items-center justify-center text-sm font-bold overflow-hidden border-2 ${
    pending ? "border-amber-200" : "border-white shadow-sm"
  }`;
  return src ? (
    <div className={cls}><img src={src} alt={name} className="w-full h-full object-cover" /></div>
  ) : (
    <div className={`${cls} ${avatarColor(name)}`}>{initials(name)}</div>
  );
}

function BrandPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium
                     bg-slate-100 text-slate-600 border border-slate-200/80 select-none">
      {name}
    </span>
  );
}

// ─── Btn with Emil press feel ─────────────────────────────────────────────────

const pressClass = `transition-[background-color,border-color,transform,opacity] duration-150
  [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]`;

// ─── EditBrandsDialog ─────────────────────────────────────────────────────────

function EditBrandsDialog({
  manager, open, onClose,
}: { manager: ManagerItem | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (manager) setSelected(manager.brands ?? []);
  }, [manager]);

  const { data: brandsData, isLoading: brandsLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (brands: string[]) => updateManagerBrands(manager!.id, brands),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-managers"] }); onClose(); },
  });

  const allBrands = brandsData?.map((b: { name: string }) => b.name) ?? [];
  function toggle(brand: string) {
    setSelected(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Бренды — {manager?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-slate-400 mb-4">
            Без выбора — менеджер видит все автомобили.
          </p>
          {brandsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {allBrands.map((brand: string) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => toggle(brand)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${pressClass} ${
                    selected.includes(brand)
                      ? "bg-[#0070b8] text-white border-[#0070b8] shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#0070b8]/40 hover:text-[#0070b8]"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">
            {selected.length === 0 ? "Выбрано: все бренды" : `Выбрано: ${selected.join(", ")}`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={pressClass}>Отмена</Button>
          <Button
            className={`bg-[#0070b8] hover:bg-[#005a94] ${pressClass}`}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(selected)}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── KP Instructions accordion ────────────────────────────────────────────────

const KP_STEPS = [
  {
    icon: UserPlus, title: "Регистрация", color: "text-[#0070b8]", bg: "bg-blue-50/80",
    content: (
      <div className="space-y-1.5 text-sm text-slate-500">
        <p>Менеджер самостоятельно регистрируется по ссылке:</p>
        <a href="https://debryansk-auto.ru/admin/manager/register" target="_blank" rel="noreferrer"
           className="inline-block text-[#0070b8] hover:underline font-medium break-all transition-opacity duration-100 hover:opacity-80">
          debryansk-auto.ru/admin/manager/register
        </a>
        <p>Нужно заполнить: имя, телефон, e-mail, пароль, фото профиля и выбрать бренды.</p>
      </div>
    ),
  },
  {
    icon: UserCheck, title: "Активация", color: "text-amber-600", bg: "bg-amber-50/80",
    content: (
      <div className="space-y-1.5 text-sm text-slate-500">
        <p>Заявка появляется в блоке <span className="font-medium text-slate-700">«Ожидают активации»</span> вверху страницы.</p>
        <p>Нажмите <span className="font-medium text-slate-700">«Активировать»</span> — менеджер получит письмо со своими данными для входа.</p>
      </div>
    ),
  },
  {
    icon: LogIn, title: "Вход в систему", color: "text-emerald-600", bg: "bg-emerald-50/80",
    content: (
      <div className="space-y-1.5 text-sm text-slate-500">
        <p>Менеджер входит по ссылке:</p>
        <a href="https://debryansk-auto.ru/admin/manager/login" target="_blank" rel="noreferrer"
           className="inline-block text-[#0070b8] hover:underline font-medium break-all transition-opacity duration-100 hover:opacity-80">
          debryansk-auto.ru/admin/manager/login
        </a>
      </div>
    ),
  },
  {
    icon: FileText, title: "Создание КП", color: "text-violet-600", bg: "bg-violet-50/80",
    content: (
      <ol className="list-decimal list-inside space-y-1 text-sm text-slate-500">
        <li>Находит нужный автомобиль из каталога</li>
        <li>Вводит данные клиента (имя, телефон)</li>
        <li>Настраивает цену, скидки и условия</li>
        <li>Нажимает <span className="font-medium text-slate-700">«Сгенерировать PDF»</span> — КП скачивается</li>
      </ol>
    ),
  },
  {
    icon: Clock, title: "История КП", color: "text-slate-500", bg: "bg-slate-100/80",
    content: (
      <p className="text-sm text-slate-500">
        Во вкладке «История КП» — таблица всех предложений. Можно открыть, отредактировать и перегенерировать PDF.
      </p>
    ),
  },
];

function KpInstructionsCard() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left
                    hover:bg-slate-50/80 ${pressClass} rounded-xl`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0070b8]/8 flex items-center justify-center flex-none">
            <BookOpen className="h-4 w-4 text-[#0070b8]" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">Как работать с КП</div>
            <div className="text-xs text-slate-400">Пошаговая инструкция для менеджеров</div>
          </div>
        </div>
        <div className={`transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${open ? "rotate-180" : ""}`}>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4"
             style={{ animation: "fadeUp 200ms cubic-bezier(0.23,1,0.32,1) both" }}>
          {KP_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="flex gap-4"
                   style={{ animation: `fadeUp 200ms cubic-bezier(0.23,1,0.32,1) ${idx * 40}ms both` }}>
                <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center flex-none mt-0.5`}>
                  <Icon className={`h-4 w-4 ${step.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm mb-1">{idx + 1}. {step.title}</div>
                  {step.content}
                </div>
              </div>
            );
          })}
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            {[
              "КП доступно для всех новых автомобилей в базе (обновление стока раз в 30 минут)",
              "КП доступно для всех автомобилей с пробегом в статусе «В продаже» (обновление стока раз в 30 минут)",
              "Инструкция доступна также в личном кабинете менеджера",
            ].map((note, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-[#0070b8] font-bold mt-0.5 flex-none">—</span>
                {note}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pending manager row ──────────────────────────────────────────────────────

function PendingRow({
  m, onActivate, isPending,
}: { m: ManagerItem; onActivate: () => void; isPending: boolean }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <Avatar name={m.name} src={m.photoUrl} size={10} pending />
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-sm leading-tight">{m.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 space-y-0.5">
            {m.email && <div>{m.email}</div>}
            {m.phone && <div>{m.phone}</div>}
          </div>
          {m.brands && m.brands.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {m.brands.map(b => <BrandPill key={b} name={b} />)}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onActivate}
        disabled={isPending}
        className={`flex-none inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2
                    text-xs font-semibold border
                    text-emerald-700 border-emerald-200 bg-emerald-50
                    hover:bg-emerald-100 hover:border-emerald-300
                    disabled:opacity-50 disabled:pointer-events-none
                    ${pressClass}`}
      >
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <UserCheck className="h-3.5 w-3.5" />}
        Активировать
      </button>
    </div>
  );
}

// ─── Active manager row ───────────────────────────────────────────────────────

function ManagerRow({
  m, onEditBrands, toggleMutation, resendMutation,
}: {
  m: ManagerItem;
  onEditBrands: () => void;
  toggleMutation: { mutate: (args: { id: number; isActive: boolean }) => void; isPending: boolean };
  resendMutation: { mutate: (id: number) => void; isPending: boolean };
}) {
  const lastLogin = m.lastLoginAt
    ? new Date(m.lastLoginAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const lastQuote = m.lastQuoteAt
    ? new Date(m.lastQuoteAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="px-5 py-4 flex gap-4 group hover:bg-slate-50/60
                    transition-colors duration-100">
      {/* Avatar */}
      <Avatar name={m.name} src={m.photoUrl} size={10} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 text-sm leading-tight">{m.name}</span>
          {m.isActive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                             bg-emerald-100 text-emerald-700 border border-emerald-200/60 uppercase tracking-wide">
              <ShieldCheck className="w-2.5 h-2.5" />Активен
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                             bg-red-100 text-red-600 border border-red-200/60 uppercase tracking-wide">
              <UserX className="w-2.5 h-2.5" />Деактивирован
            </span>
          )}
        </div>

        {/* Contact / meta */}
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400">
            <span className="font-mono text-slate-500">{m.login}</span>
            {m.email && <span>{m.email}</span>}
            {m.phone && <span>{m.phone}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <LogIn className="h-3 w-3 flex-none" />
              {lastLogin ? `Вход ${lastLogin}` : <em>Ещё не входил</em>}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 flex-none" />
              {m.quotesCount > 0
                ? <><span className="font-medium text-slate-600">{m.quotesCount}</span> КП{lastQuote && <>, посл. {lastQuote}</>}</>
                : <em>КП не создавались</em>}
            </span>
          </div>
        </div>

        {/* Brands */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {m.brands && m.brands.length > 0
            ? m.brands.map(b => <BrandPill key={b} name={b} />)
            : <span className="text-xs text-slate-400 italic">все бренды</span>}
          <button
            onClick={onEditBrands}
            className={`inline-flex items-center gap-0.5 text-xs text-[#0070b8]/70
                        hover:text-[#0070b8] ml-0.5 ${pressClass}`}
          >
            <Pencil className="h-2.5 w-2.5" />изменить
          </button>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {m.email && (
            <button
              onClick={() => {
                if (confirm(`Отправить новое письмо с доступом на ${m.email}?\nБудет сгенерирован новый пароль.`))
                  resendMutation.mutate(m.id);
              }}
              disabled={resendMutation.isPending}
              title="Переотправить письмо"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium
                          text-[#0070b8] border-[#0070b8]/20 bg-[#0070b8]/5
                          hover:bg-[#0070b8]/10 hover:border-[#0070b8]/30
                          disabled:opacity-50 disabled:pointer-events-none ${pressClass}`}
            >
              {resendMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Mail className="h-3.5 w-3.5" />}
              Письмо
            </button>
          )}
          <button
            onClick={() => toggleMutation.mutate({ id: m.id, isActive: !m.isActive })}
            disabled={toggleMutation.isPending}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium
                        disabled:opacity-50 disabled:pointer-events-none ${pressClass} ${
              m.isActive
                ? "text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                : "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            }`}
          >
            {toggleMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : m.isActive
                ? <><UserX className="h-3.5 w-3.5" />Деактивировать</>
                : <><UserCheck className="h-3.5 w-3.5" />Активировать</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Manager dialog ────────────────────────────────────────────────────

function CreateManagerDialog({
  open, onClose, onSuccess,
}: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = React.useState({ name: "", phone: "", email: "", login: "", password: "" });
  const [formError, setFormError] = React.useState("");

  const mutation = useMutation({
    mutationFn: createManager,
    onSuccess: () => {
      setForm({ name: "", phone: "", email: "", login: "", password: "" });
      setFormError("");
      onSuccess();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function handleClose() {
    setFormError("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Новый менеджер</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {formError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5"
                 style={{ animation: "fadeUp 150ms cubic-bezier(0.23,1,0.32,1) both" }}>
              {formError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Имя *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                   placeholder="Алексей Смирнов"
                   className="focus:ring-[#0070b8]/20 focus:border-[#0070b8]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Телефон</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                     placeholder="+7 (999) 000-00-00"
                     className="focus:ring-[#0070b8]/20 focus:border-[#0070b8]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                     placeholder="manager@da.ru" type="email"
                     className="focus:ring-[#0070b8]/20 focus:border-[#0070b8]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Логин *</Label>
              <Input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                     placeholder="manager1"
                     className="font-mono focus:ring-[#0070b8]/20 focus:border-[#0070b8]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Пароль *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                     className="focus:ring-[#0070b8]/20 focus:border-[#0070b8]" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className={pressClass}>Отмена</Button>
          <Button
            className={`bg-[#0070b8] hover:bg-[#005a94] ${pressClass}`}
            disabled={mutation.isPending}
            onClick={() => {
              if (!form.name || !form.login || !form.password) {
                setFormError("Заполните обязательные поля: Имя, Логин, Пароль");
                return;
              }
              mutation.mutate(form);
            }}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminManagersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = React.useState(false);
  const [editBrandsManager, setEditBrandsManager] = React.useState<ManagerItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-managers"],
    queryFn: getManagers,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => toggleManager(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-managers"] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => activateManager(id),
    onSuccess: (data: { emailSent?: boolean; emailError?: string }) => {
      qc.invalidateQueries({ queryKey: ["admin-managers"] });
      if (!data.emailSent) {
        alert(`Менеджер активирован, но письмо не отправлено${data.emailError ? ": " + data.emailError : " (email не указан)"}.`);
      }
    },
    onError: (err: Error) => alert(`Ошибка активации: ${err.message}`),
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) => resendManagerEmail(id),
    onSuccess: () => alert("Письмо отправлено. Пароль менеджера обновлён."),
    onError: (err: Error) => alert(`Ошибка отправки: ${err.message}`),
  });

  const allManagers: ManagerItem[] = data?.data ?? [];
  const pending = allManagers.filter(m => m.registrationPending && !m.isActive);
  const active = allManagers.filter(m => !m.registrationPending);

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Менеджеры</h1>
          <p className="text-sm text-slate-400 mt-0.5">Учётные записи для формирования КП</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold
                      bg-[#0070b8] text-white shadow-sm hover:bg-[#005a94]
                      self-start sm:self-auto ${pressClass}`}
        >
          <Plus className="h-4 w-4" />
          Добавить менеджера
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2.5 text-slate-400 py-8 justify-center text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />Загрузка...
        </div>
      )}

      {!isLoading && (
        <>
          {/* Pending queue */}
          {pending.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden shadow-sm"
                 style={{ animation: "fadeUp 200ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-100">
                <Clock className="h-4 w-4 text-amber-600 flex-none" />
                <span className="text-sm font-semibold text-amber-700">
                  Ожидают активации · {pending.length}
                </span>
              </div>
              <div className="divide-y divide-amber-100/60">
                {pending.map(m => (
                  <PendingRow key={m.id} m={m}
                    onActivate={() => activateMutation.mutate(m.id)}
                    isPending={activateMutation.isPending} />
                ))}
              </div>
            </div>
          )}

          {/* Active managers list */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {active.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 select-none">
                <UserPlus className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">Нет менеджеров</p>
                <p className="text-xs mt-1 opacity-70">Создайте первого, нажав кнопку выше</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {active.map((m, i) => (
                  <div key={m.id}
                       style={{ animation: `fadeUp 200ms cubic-bezier(0.23,1,0.32,1) ${i * 40}ms both` }}>
                    <ManagerRow
                      m={m}
                      onEditBrands={() => setEditBrandsManager(m)}
                      toggleMutation={toggleMutation}
                      resendMutation={resendMutation}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Instructions accordion */}
      <KpInstructionsCard />

      {/* Dialogs */}
      <EditBrandsDialog
        manager={editBrandsManager}
        open={!!editBrandsManager}
        onClose={() => setEditBrandsManager(null)}
      />

      <CreateManagerDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["admin-managers"] });
          setShowCreate(false);
        }}
      />
    </div>
  );
}
