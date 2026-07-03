import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Newspaper, Phone, LogOut,
  ChevronRight, Menu, X, Tag, Users, Building2, Settings, Bot, Star, Megaphone, RefreshCw, HelpCircle, FileText, Gift
} from "lucide-react";
import { rebuildCache, getRebuildStatus, runPrerender, getPrerenderStatus } from "@/lib/api";

const navItems = [
  { path: "/", label: "Дашборд", icon: LayoutDashboard },
  { path: "/news", label: "Новости", icon: Newspaper },
  { path: "/promotions", label: "Акции", icon: Megaphone },
  { path: "/faq", label: "FAQ", icon: HelpCircle },
  { path: "/disclaimers", label: "Дисклеймеры", icon: FileText },
  { path: "/bonus-program", label: "Бонусная программа", icon: Gift },
  { path: "/leads", label: "Заявки", icon: Phone },
  { path: "/reviews", label: "Отзывы", icon: Star },
  { path: "/locations", label: "Локации", icon: Building2 },
  { path: "/brands", label: "Бренды", icon: Tag },
  { path: "/users", label: "Пользователи", icon: Users },
  { path: "/settings", label: "Настройки", icon: Settings },
  { path: "/navigator", label: "Навигатор", icon: Bot },
];

type RebuildState = "idle" | "running" | "success" | "error";

function RebuildCacheButton() {
  const [state, setState] = React.useState<RebuildState>("idle");
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const handleClick = async () => {
    if (state === "running") return;
    try {
      await rebuildCache();
      setState("running");

      pollRef.current = setInterval(async () => {
        try {
          const { status } = await getRebuildStatus();
          if (status === "idle") {
            stopPolling();
            setState("success");
            setTimeout(() => setState("idle"), 3000);
          }
        } catch {
          stopPolling();
          setState("error");
          setTimeout(() => setState("idle"), 3000);
        }
      }, 3000);

      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }, 10 * 60 * 1000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  React.useEffect(() => () => stopPolling(), []);

  if (state === "success") {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600">
        <RefreshCw className="w-4 h-4" />
        Кэш обновлён ✓
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500">
        <RefreshCw className="w-4 h-4" />
        Ошибка обновления
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start text-slate-600"
      onClick={handleClick}
      disabled={state === "running"}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${state === "running" ? "animate-spin" : ""}`} />
      {state === "running" ? "Обновляется..." : "Обновить кэш сайта"}
    </Button>
  );
}

function PrerenderButton() {
  const [state, setState] = React.useState<RebuildState>("idle");
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const handleClick = async () => {
    if (state === "running") return;
    try {
      await runPrerender();
      setState("running");

      pollRef.current = setInterval(async () => {
        try {
          const { status } = await getPrerenderStatus();
          if (status === "idle") {
            stopPolling();
            setState("success");
            setTimeout(() => setState("idle"), 4000);
          }
        } catch {
          stopPolling();
          setState("error");
          setTimeout(() => setState("idle"), 3000);
        }
      }, 5000);

      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setState("success");
        setTimeout(() => setState("idle"), 4000);
      }, 15 * 60 * 1000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  React.useEffect(() => () => stopPolling(), []);

  if (state === "success") {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600">
        <RefreshCw className="w-4 h-4" />
        Пририндер завершён ✓
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500">
        <RefreshCw className="w-4 h-4" />
        Ошибка пририндера
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start text-slate-600"
      onClick={handleClick}
      disabled={state === "running"}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${state === "running" ? "animate-spin" : ""}`} />
      {state === "running" ? "Пририндер (~10 мин)..." : "Запустить пририндер"}
    </Button>
  );
}

function SidebarItem({ path, label, icon: Icon }: typeof navItems[0]) {
  const [location] = useLocation();
  const active = location === path || location.startsWith(path + "/");
  return (
    <Link href={path}>
      <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-[#0070b8]/10 text-[#0070b8]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}>
        <Icon className="w-4 h-4" />
        <span className="flex-1">{label}</span>
        {active && <ChevronRight className="w-3.5 h-3.5" />}
      </a>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-[#f2f5f8]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4">
          <svg viewBox="0 0 200 33" className="h-6 text-[#0070b8]" fill="currentColor">
            <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z"/>
            <text x="50" y="22" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" fill="#1a2332">Дебрянск Авто</text>
          </svg>
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="space-y-1">
            {navItems.map(item => <SidebarItem key={item.path} {...item} />)}
          </nav>
        </ScrollArea>
        <Separator />
        <div className="p-3 space-y-1">
          <RebuildCacheButton />
          <PrerenderButton />
          <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 200 33" className="h-5 text-[#0070b8]" fill="currentColor">
            <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z"/>
            <text x="50" y="22" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif" fill="#1a2332">Дебрянск Авто</text>
          </svg>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/20" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-14 bottom-0 w-64 bg-white border-r border-slate-200 shadow-xl" onClick={e => e.stopPropagation()}>
            <nav className="p-3 space-y-1">
              {navItems.map(item => <SidebarItem key={item.path} {...item} />)}
            </nav>
            <Separator className="my-2" />
            <div className="px-3 space-y-1">
              <RebuildCacheButton />
              <PrerenderButton />
              <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-900" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
