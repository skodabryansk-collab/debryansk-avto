import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Newspaper, Phone, LogOut,
  Menu, X, Tag, Settings, Bot, Star, Megaphone, RefreshCw,
  HelpCircle, FileText, Gift, Wrench, TrendingUp, PhoneCall,
  UserCog, FileSpreadsheet, Plus, Zap, Activity, Wand2,
  Palette, MapPin, Users, UserCircle, Inbox, Briefcase,
} from "lucide-react";
import { rebuildCache, getRebuildStatus, runPrerender, getPrerenderStatus } from "@/lib/api";

/* ── Nav groups ─────────────────────────────────────────────── */
const navGroups = [
  {
    label: null,
    items: [
      { path: "/",         label: "Дашборд",    icon: LayoutDashboard },
    ],
  },
  {
    label: "Контент",
    items: [
      { path: "/news",         label: "Новости",               icon: Newspaper  },
      { path: "/promotions",   label: "Акции",                 icon: Megaphone  },
      { path: "/faq",          label: "FAQ",                   icon: HelpCircle },
      { path: "/disclaimers",  label: "Дисклеймеры",           icon: FileText   },
      { path: "/bonus-program",label: "Бонусная программа",    icon: Gift       },
      { path: "/corporate",    label: "Корпоративные клиенты", icon: Briefcase  },
      { path: "/to-catalog",   label: "Каталог ТО",            icon: Wrench     },
    ],
  },
  {
    label: "Аналитика",
    items: [
      { path: "/leads",    label: "Заявки",      icon: Inbox     },
      { path: "/calltouch",label: "Звонки",      icon: PhoneCall },
      { path: "/visitors", label: "Посетители",  icon: Users     },
      { path: "/reviews",  label: "Отзывы",      icon: Star      },
    ],
  },
  {
    label: "AI & SEO",
    items: [
      { path: "/navigator",        label: "Навигатор",         icon: Bot      },
      { path: "/seo",              label: "SEO Центр",         icon: Zap      },
      { path: "/ai-images",        label: "AI‑студия",         icon: Wand2    },
      { path: "/brand-guidelines", label: "Гайдлайны бренда",  icon: Palette  },
      { path: "/prerender-monitor",label: "Prerender",         icon: Activity },
    ],
  },
  {
    label: "Сайт",
    items: [
      { path: "/locations", label: "Локации",       icon: MapPin     },
      { path: "/brands",    label: "Бренды",        icon: Tag        },
      { path: "/users",     label: "Пользователи",  icon: UserCircle },
      { path: "/settings",  label: "Настройки",     icon: Settings   },
    ],
  },
  {
    label: "КП",
    items: [
      { path: "/managers",       label: "Менеджеры КП",        icon: UserCog       },
      { path: "/sales-managers", label: "Рук. отдела продаж",  icon: TrendingUp    },
      { path: "/quotes",         label: "КП менеджеров",       icon: FileSpreadsheet},
      { path: "/manager/quotes", label: "Создать КП",          icon: Plus          },
    ],
  },
] as const;

/* ── Rebuild / Prerender buttons ────────────────────────────── */
type ActionState = "idle" | "running" | "success" | "error";

function useActionButton(
  start: () => Promise<unknown>,
  poll: () => Promise<{ status: string }>,
  pollInterval = 3000,
  maxWait = 10 * 60 * 1000,
) {
  const [state, setState] = React.useState<ActionState>("idle");
  const pollRef  = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearTimeout(timerRef.current);  timerRef.current = null; }
  };

  const run = async () => {
    if (state === "running") return;
    try {
      await start();
      setState("running");
      pollRef.current = setInterval(async () => {
        try {
          const { status } = await poll();
          if (status === "idle") {
            stop(); setState("success");
            setTimeout(() => setState("idle"), 3000);
          }
        } catch { stop(); setState("error"); setTimeout(() => setState("idle"), 3000); }
      }, pollInterval);
      timerRef.current = setTimeout(() => {
        stop(); setState("success"); setTimeout(() => setState("idle"), 4000);
      }, maxWait);
    } catch { setState("error"); setTimeout(() => setState("idle"), 3000); }
  };

  React.useEffect(() => () => stop(), []);
  return { state, run };
}

function BottomAction({ icon: Icon, label, loadingLabel, successLabel, errorLabel, state, onClick }: {
  icon: React.ElementType;
  label: string;
  loadingLabel: string;
  successLabel: string;
  errorLabel: string;
  state: ActionState;
  onClick: () => void;
}) {
  const colorMap: Record<ActionState, string> = {
    idle:    "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
    running: "text-slate-400 cursor-default",
    success: "text-emerald-600",
    error:   "text-red-500",
  };
  const textMap: Record<ActionState, string> = {
    idle: label, running: loadingLabel, success: successLabel, error: errorLabel,
  };

  return (
    <button
      onClick={onClick}
      disabled={state === "running"}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-100 ${colorMap[state]}`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${state === "running" ? "animate-spin" : ""}`} />
      <span>{textMap[state]}</span>
    </button>
  );
}

/* ── Nav item ────────────────────────────────────────────────── */
type NavItemDef = { path: string; label: string; icon: React.ElementType };

function NavItem({ path, label, icon: Icon, onClick }: NavItemDef & { onClick?: () => void }) {
  const [location] = useLocation();
  const active = path === "/"
    ? location === "/"
    : location === path || location.startsWith(path + "/");

  return (
    <Link href={path}>
      <a
        onClick={onClick}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-100 ${
          active
            ? "bg-[#0070b8]/[0.08] text-[#0070b8] font-semibold"
            : "text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-100/80"
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#0070b8]" : "text-slate-400"}`} />
        <span className="truncate">{label}</span>
      </a>
    </Link>
  );
}

/* ── Section label ───────────────────────────────────────────── */
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-5 pb-1">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

/* ── Sidebar content (shared between desktop + mobile) ───────── */
function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { logout } = useAuth();

  const rebuild  = useActionButton(rebuildCache,  getRebuildStatus,  3000,  10 * 60 * 1000);
  const prerender = useActionButton(runPrerender, getPrerenderStatus, 5000, 15 * 60 * 1000);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-[57px] shrink-0">
        <svg viewBox="0 0 34 34" className="w-6 h-6 shrink-0 text-[#0070b8]" fill="currentColor">
          <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z"/>
        </svg>
        <div>
          <div className="text-sm font-bold text-slate-800 leading-tight">Дебрянск Авто</div>
          <div className="text-[10px] text-slate-400 leading-tight">Админ‑панель</div>
        </div>
      </div>

      <div className="h-px bg-slate-100 shrink-0" />

      {/* Nav */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="px-2 py-2 pb-4">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && <SectionLabel label={group.label} />}
              {(group.items as readonly NavItemDef[]).map(item => (
                <NavItem key={item.path} {...item} onClick={onNavClick} />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="h-px bg-slate-100 shrink-0" />

      {/* Bottom actions */}
      <div className="px-2 py-2 space-y-0.5 shrink-0">
        <BottomAction
          icon={RefreshCw}
          state={rebuild.state}
          onClick={rebuild.run}
          label="Обновить кэш сайта"
          loadingLabel="Обновляется…"
          successLabel="Кэш обновлён ✓"
          errorLabel="Ошибка обновления"
        />
        <BottomAction
          icon={RefreshCw}
          state={prerender.state}
          onClick={prerender.run}
          label="Запустить пририндер"
          loadingLabel="Пририндер (~10 мин)…"
          successLabel="Пририндер завершён ✓"
          errorLabel="Ошибка пририндера"
        />
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-900 hover:bg-slate-100/80 transition-colors duration-100"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────── */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close drawer on route change
  const [location] = useLocation();
  React.useEffect(() => { setMobileOpen(false); }, [location]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2f5f8]">

      {/* ── Desktop sidebar ─────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-slate-100 shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile header ───────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 34 34" className="w-5 h-5 text-[#0070b8]" fill="currentColor">
            <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z"/>
          </svg>
          <span className="text-sm font-bold text-slate-800">Дебрянск Авто</span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors duration-100"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Mobile drawer ───────────────────────────── */}
      {mobileOpen && (
        <div
          className="sidebar-overlay md:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="sidebar-drawer absolute left-0 top-14 bottom-0 w-60 bg-white border-r border-slate-100 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent onNavClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden md:pt-0 pt-14">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto min-w-0">
          {children}
        </div>
      </main>

    </div>
  );
}
