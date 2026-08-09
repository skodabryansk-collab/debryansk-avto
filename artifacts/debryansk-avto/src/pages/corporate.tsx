import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Phone, Mail, Building2, Users, Briefcase,
  User, MessageSquare, Car, Coins, TrendingDown, Zap,
  RefreshCw, Shield, BarChart3, FileText, Clock,
  Wrench, Calculator, Globe, Percent, Receipt,
  ArrowRight, Sparkles, Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import FaqBlock from "@/components/FaqBlock";
import { useFaq } from "@/hooks/useFaq";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { normalizePhone, phoneHref } from "@/lib/normalizePhone";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface AdvantageItem { title: string; description: string }
interface AdvantageGroup { groupTitle: string; items: AdvantageItem[] }
interface Step { title: string; description: string }
interface CorporateData {
  hero_title: string;
  hero_subtitle: string;
  advantages: AdvantageGroup[];
  steps: Step[];
  sales_manager_name: string | null;
  sales_manager_role: string | null;
  sales_manager_phone: string | null;
  sales_manager_email: string | null;
  sales_manager_photo: string | null;
  service_manager_name: string | null;
  service_manager_role: string | null;
  service_manager_phone: string | null;
  service_manager_email: string | null;
  service_manager_photo: string | null;
}
interface Brand { id: number; name: string }
interface NewCar {
  id: string;
  mark: string;
  model: string;
  modification: string;
  year: number;
  price: number;
  maxDiscount: number;
  images: string[];
  bodyType: string;
  dealer: string;
}

/* ── Icon palette for advantage items ───────────────────────────────────── */
const ITEM_ICONS: { icon: React.ElementType; bg: string; color: string }[] = [
  { icon: Coins,       bg: "bg-amber-50",   color: "text-amber-500"   },
  { icon: TrendingDown,bg: "bg-emerald-50", color: "text-emerald-600" },
  { icon: Zap,         bg: "bg-blue-50",    color: "text-blue-500"    },
  { icon: RefreshCw,   bg: "bg-violet-50",  color: "text-violet-500"  },
  { icon: Shield,      bg: "bg-slate-100",  color: "text-slate-600"   },
  { icon: BarChart3,   bg: "bg-orange-50",  color: "text-orange-500"  },
  { icon: FileText,    bg: "bg-sky-50",     color: "text-sky-600"     },
  { icon: Clock,       bg: "bg-rose-50",    color: "text-rose-500"    },
  { icon: Wrench,      bg: "bg-teal-50",    color: "text-teal-600"    },
  { icon: Calculator,  bg: "bg-indigo-50",  color: "text-indigo-500"  },
  { icon: Globe,       bg: "bg-cyan-50",    color: "text-cyan-600"    },
  { icon: Percent,     bg: "bg-green-50",   color: "text-green-600"   },
];

const GROUP_ICONS = [Briefcase, Building2, Users, BarChart3, Shield, Globe];

/* ── Utilities ───────────────────────────────────────────────────────────── */
function fmtPrice(p: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(p);
}

function isValidInn(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 10 || d.length === 12;
}

/* ── CTA inline block ────────────────────────────────────────────────────── */
function CtaBlock({ text, phone }: { text: string; phone?: string | null }) {
  return (
    <div className="mt-10 bg-gradient-to-r from-primary/8 to-[#87b63c]/8 border border-primary/15 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-slate-700 font-semibold text-base text-center sm:text-left">{text}</p>
      <a href="#corporate-form" className="shrink-0">
        <Button className="brand-gradient border-0 text-white font-bold px-7 h-11 rounded-xl hover:opacity-90">
          Оставить заявку
        </Button>
      </a>
    </div>
  );
}

/* ── Manager card ────────────────────────────────────────────────────────── */
function ManagerCard({
  role, name, phone, email, photo, generalPhone,
}: {
  role: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  generalPhone: string;
}) {
  const hasMgr = !!name;
  const displayPhone = hasMgr && phone ? normalizePhone(phone) : normalizePhone(generalPhone);
  const tel = hasMgr && phone ? phoneHref(phone) : phoneHref(generalPhone);
  const initials = (hasMgr && name ? name : role)
    .split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Photo area */}
      <div className="relative w-full bg-slate-100" style={{ aspectRatio: "4/3" }}>
        {hasMgr && photo ? (
          <img
            src={photo}
            alt={name!}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-[#005a94] flex items-center justify-center">
            <span className="text-white font-extrabold text-5xl opacity-80">{initials}</span>
          </div>
        )}
        {/* Role badge overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-3 px-4">
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{role}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="font-extrabold text-slate-800 text-xl leading-tight">
          {hasMgr ? name : "Дебрянск Авто"}
        </div>

        <div className="text-sm text-slate-400 font-medium">{displayPhone}</div>

        <div className="flex gap-2 mt-auto">
          <a
            href={tel}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold rounded-xl h-11 text-sm transition-colors"
          >
            <Phone className="w-4 h-4" /> Позвонить
          </a>
          {hasMgr && email && (
            <a
              href={`mailto:${email}`}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl h-11 text-sm transition-colors"
            >
              <Mail className="w-4 h-4" /> Написать
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Car showcase card ───────────────────────────────────────────────────── */
function CorporateCarCard({ car }: { car: NewCar }) {
  const img = car.images?.[0] ?? "";
  const finalPrice = car.maxDiscount > 0 ? car.price - car.maxDiscount : car.price;
  return (
    <a href={`/new-cars/${encodeURIComponent(car.id)}`}
      className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col shrink-0 w-[260px] sm:w-auto">
      <div className="relative bg-slate-50 overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {img ? (
          <img src={img} alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-12 h-12" />
          </div>
        )}
        {/* НДС badge */}
        <span className="absolute top-2 left-2 flex items-center gap-1 bg-[#87b63c] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
          <Receipt className="w-2.5 h-2.5" /> Полный НДС
        </span>
        {/* NEW badge */}
        <span className="absolute top-2 right-2 flex items-center gap-1 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          <Sparkles className="w-2.5 h-2.5" /> НОВЫЙ
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-extrabold text-sm leading-snug mb-0.5">{car.mark} {car.model}</h3>
        {car.modification && (
          <p className="text-xs text-slate-400 mb-2 line-clamp-1">{car.modification}</p>
        )}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <span className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700">
            <Calendar className="w-3 h-3 text-primary" />{car.year}
          </span>
          {car.bodyType && (
            <span className="bg-slate-50 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700">
              {car.bodyType}
            </span>
          )}
        </div>
        <div className="mt-auto">
          {car.maxDiscount > 0 ? (
            <>
              <div className="text-base font-extrabold text-primary">{fmtPrice(finalPrice)}</div>
              <div className="text-xs text-slate-400 line-through">{fmtPrice(car.price)}</div>
            </>
          ) : (
            <div className="text-base font-extrabold text-primary">{fmtPrice(car.price)}</div>
          )}
        </div>
      </div>
    </a>
  );
}

/* ── Car showcase section ────────────────────────────────────────────────── */
const SHOWCASE_SIZE = 4;

function CorporateCarShowcase({ cars }: { cars: NewCar[] }) {
  const prefersReduced = useReducedMotion();
  const [page, setPage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPages = Math.max(1, Math.ceil(cars.length / SHOWCASE_SIZE));

  useEffect(() => {
    if (cars.length <= SHOWCASE_SIZE) return;
    timerRef.current = setInterval(() => {
      setPage(p => (p + 1) % totalPages);
    }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [totalPages, cars.length]);

  function go(dir: 1 | -1) {
    if (timerRef.current) clearInterval(timerRef.current);
    setPage(p => (p + dir + totalPages) % totalPages);
  }

  const visible = cars.slice(page * SHOWCASE_SIZE, page * SHOWCASE_SIZE + SHOWCASE_SIZE);

  return (
    <div>
      {/* desktop grid */}
      <div className="hidden sm:block">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={page}
            initial={prefersReduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {visible.map(car => <CorporateCarCard key={car.id} car={car} />)}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* mobile horizontal scroll */}
      <div className="sm:hidden flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
        {cars.map(car => (
          <div key={car.id} className="snap-start shrink-0 w-[260px]">
            <CorporateCarCard car={car} />
          </div>
        ))}
      </div>
      {/* pagination dots + arrows (desktop) */}
      {totalPages > 1 && (
        <div className="hidden sm:flex items-center justify-center gap-3 mt-6">
          <button onClick={() => go(-1)}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setPage(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === page ? "bg-primary w-5" : "bg-slate-300 hover:bg-slate-400"}`} />
          ))}
          <button onClick={() => go(1)}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function CorporatePage() {
  const prefersReduced = useReducedMotion();
  const { toast } = useToast();
  const [scrollY, setScrollY] = useState(0);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    company: "", inn: "", name: "", phone: "", email: "",
    carCount: "1", brands: [] as string[], comment: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: pageData, isLoading: isLoadingPage } = useQuery<CorporateData>({
    queryKey: ["corporate-page"],
    queryFn: async () => {
      const r = await fetch("/api/corporate-page");
      if (!r.ok) throw new Error("Failed to load");
      const j = await r.json();
      return j.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: brandsData = [], isLoading: isLoadingBrands } = useQuery<Brand[]>({
    queryKey: ["public-brands"],
    queryFn: () => fetch("/api/brands").then(r => r.json()).then(j => j.ok ? j.data : []),
    staleTime: 60 * 60 * 1000,
  });

  const { isLoading: isLoadingFaq } = useFaq("corporate");

  /* New cars for showcase — grab random selection across brands */
  const { data: rawNewCars = [] } = useQuery<NewCar[]>({
    queryKey: ["new-cars-corporate"],
    queryFn: () => fetch("/api/cars/new").then(r => r.json()).then(j => j.data ?? []),
    staleTime: 10 * 60 * 1000,
  });

  /* Shuffle once when data loads — useMemo prevents re-shuffle on every scroll re-render */
  const allNewCars = useMemo(() => {
    if (!rawNewCars.length) return [];
    const byBrand: Record<string, NewCar[]> = {};
    for (const c of rawNewCars) {
      if (!byBrand[c.mark]) byBrand[c.mark] = [];
      if (byBrand[c.mark].length < 2) byBrand[c.mark].push(c);
    }
    const picked = Object.values(byBrand).flat();
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return picked.slice(0, 16);
  }, [rawNewCars]);

  const { data: siteSettings } = useQuery<Record<string, string>>({
    queryKey: ["site-settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()).then(j => j.data),
    staleTime: 5 * 60 * 1000,
  });
  const generalPhone = siteSettings?.header_phone || "+74832777770";

  const allLoaded = !isLoadingPage && !isLoadingBrands && !isLoadingFaq;

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function toggleBrand(name: string) {
    setForm(f => ({
      ...f,
      brands: f.brands.includes(name) ? f.brands.filter(b => b !== name) : [...f.brands, name],
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.company.trim()) e.company = "Укажите название компании";
    if (!isValidInn(form.inn)) e.inn = "ИНН должен содержать 10 или 12 цифр";
    if (!form.name.trim()) e.name = "Укажите контактное лицо";
    if (!isPhoneValid(form.phone)) e.phone = "Укажите корректный номер телефона";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("type", "corporate");
      fd.append("company", form.company);
      fd.append("inn", form.inn);
      fd.append("name", form.name);
      fd.append("phone", form.phone);
      fd.append("email", form.email);
      fd.append("carCount", form.carCount);
      if (form.brands.length > 0) {
        fd.append("brands", form.brands.join(", "));
        fd.append("brand", form.brands[0]);
      } else {
        fd.append("location", "Советская");
      }
      if (form.comment) fd.append("comment", form.comment);
      const r = await fetch("/api/send-email", { method: "POST", body: fd });
      if (!r.ok) throw new Error("send error");
      setSent(true);
    } catch {
      toast({ title: "Ошибка отправки", description: "Попробуйте позвонить по телефону.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const heroTitle = pageData?.hero_title || "Автомобили для бизнеса";
  const heroSubtitle = pageData?.hero_subtitle || "Лизинг от ведущих лизинговых компаний России, выгодные условия и отдельное сервисное обслуживание для корпоративных клиентов";
  const advantages: AdvantageGroup[] = pageData?.advantages ?? [];
  const steps: Step[] = pageData?.steps ?? [];
  const saleTel = pageData?.sales_manager_phone ? phoneHref(pageData.sales_manager_phone) : phoneHref(generalPhone);

  return (
    <Layout>
      {allLoaded && <div data-prerender-ready="true" style={{ display: "none" }} />}

      <h1 className="sr-only">Корпоративное обслуживание в Дебрянск Авто</h1>

      <SEO
        title="Корпоративным клиентам — лизинг и автопарк для бизнеса | Дебрянск Авто"
        description="Лизинг автомобилей для юридических лиц и ИП в Брянске. Работаем с ведущими лизинговыми компаниями России, trade-in для автопарка, отдельное сервисное обслуживание. Дебрянск Авто."
        canonical="/corporate"
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Корпоративным клиентам", url: "/corporate" },
        ]}
      />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-[#0d1117] text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-[#87b63c]/10 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative container mx-auto px-4 sm:px-6 py-20 sm:py-28 max-w-5xl">
          <motion.div initial={prefersReduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-widest text-white/60">
              <Building2 className="w-3.5 h-3.5" /> Корпоративным клиентам
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-5 max-w-3xl">
              {heroTitle}
            </h1>
            <p className="text-lg text-white/65 leading-relaxed max-w-2xl mb-8">
              {heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#corporate-form">
                <Button className="brand-gradient border-0 text-white font-bold px-7 h-12 rounded-xl hover:opacity-90 text-base">
                  Оставить заявку
                </Button>
              </a>
              <a href={saleTel}>
                <Button variant="outline"
                  className="border-white/20 text-white bg-white/8 hover:bg-white/15 font-bold px-7 h-12 rounded-xl text-base">
                  <Phone className="w-4 h-4 mr-2" /> Позвонить менеджеру
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ADVANTAGES ───────────────────────────────────────────────────── */}
      {advantages.length > 0 && (
        <section className="py-16 sm:py-20 bg-slate-50">
          <div className="container mx-auto px-4 sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2 text-center">Преимущества</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-12">
              Почему корпоративные клиенты выбирают нас
            </h2>
            <div className="space-y-12">
              {advantages.map((group, gi) => {
                const GroupIcon = GROUP_ICONS[gi % GROUP_ICONS.length];
                /* offset palette so each group starts at a different icon */
                const offset = gi * 4;
                return (
                  <div key={gi}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <GroupIcon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-800">{group.groupTitle}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {group.items.map((item, ii) => {
                        const palette = ITEM_ICONS[(offset + ii) % ITEM_ICONS.length];
                        const ItemIcon = palette.icon;
                        return (
                          <motion.div key={ii}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: ii * 0.05 }}
                            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className={`w-9 h-9 rounded-xl ${palette.bg} flex items-center justify-center mb-3`}>
                              <ItemIcon className={`w-5 h-5 ${palette.color}`} />
                            </div>
                            <div className="font-extrabold text-slate-800 text-sm mb-1.5">{item.title}</div>
                            <div className="text-xs text-slate-500 leading-relaxed">{item.description}</div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <CtaBlock
              text="Готовы обсудить условия для вашего автопарка?"
              phone={pageData?.sales_manager_phone}
            />
          </div>
        </section>
      )}

      {/* ── CAR SHOWCASE ─────────────────────────────────────────────────── */}
      {allNewCars.length > 0 && (
        <section className="py-16 sm:py-20 bg-white border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#87b63c] mb-2">Автомобили в наличии</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Для корпоративного лизинга
                </h2>
                <p className="text-sm text-slate-500 mt-1.5 max-w-md">
                  Все автомобили с полным НДС — для юридических лиц и ИП. Разные марки в одном автопарке.
                </p>
              </div>
              <a href="/new-cars"
                className="shrink-0 flex items-center gap-2 text-primary font-bold text-sm hover:underline">
                Весь каталог <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <CorporateCarShowcase cars={allNewCars} />
          </div>
        </section>
      )}

      {/* ── STEPS ────────────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <section className="py-16 sm:py-20 bg-slate-50 border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2 text-center">Как это работает</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-12">Четыре шага до вашего автопарка</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {steps.map((step, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -16 : 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="relative bg-white rounded-2xl border border-slate-100 p-6 overflow-hidden shadow-sm"
                >
                  <div className="absolute -top-3 -right-3 text-[80px] font-black text-slate-100 leading-none select-none">
                    {i + 1}
                  </div>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center text-white font-extrabold text-sm mb-3 shadow-sm">
                      {i + 1}
                    </div>
                    <h3 className="font-extrabold text-slate-800 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <CtaBlock
              text="Начните с заявки — дальше всё возьмёт на себя персональный менеджер"
              phone={pageData?.sales_manager_phone}
            />
          </div>
        </section>
      )}

      {/* ── FORM ─────────────────────────────────────────────────────────── */}
      <section id="corporate-form" className="scroll-mt-24 py-16 sm:py-20 bg-gradient-to-br from-slate-900 to-[#0d1117] text-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#87b63c] mb-2 text-center">Заявка</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-2">Оставить заявку</h2>
          <p className="text-white/50 text-center text-sm mb-10">
            Оставьте контакты — персональный менеджер свяжется с вами и подберёт условия
          </p>
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="success"
                initial={prefersReduced ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/8 border border-white/15 rounded-2xl p-10 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#87b63c]/20 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-[#87b63c]" />
                </div>
                <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
                <p className="text-white/50 text-sm">Персональный менеджер свяжется с вами в ближайшее время.</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSubmit}
                initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
              >
                {/* Company + INN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-1.5 block">
                      Название компании <span className="text-red-400">*</span>
                    </label>
                    <div className={`flex items-center gap-2 bg-white/8 border rounded-xl px-3 py-2.5 ${errors.company ? "border-red-400" : "border-white/15"}`}>
                      <Building2 className="w-4 h-4 text-white/40 shrink-0" />
                      <input
                        value={form.company}
                        onChange={e => { setForm(f => ({ ...f, company: e.target.value })); setErrors(er => ({ ...er, company: "" })); }}
                        className="bg-transparent flex-1 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="ООО «Ваша компания»"
                      />
                    </div>
                    {errors.company && <p className="text-red-400 text-xs mt-1">{errors.company}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-1.5 block">
                      ИНН <span className="text-red-400">*</span>
                    </label>
                    <div className={`flex items-center gap-2 bg-white/8 border rounded-xl px-3 py-2.5 ${errors.inn ? "border-red-400" : "border-white/15"}`}>
                      <Briefcase className="w-4 h-4 text-white/40 shrink-0" />
                      <input
                        value={form.inn}
                        onChange={e => { setForm(f => ({ ...f, inn: e.target.value.replace(/\D/g, "") })); setErrors(er => ({ ...er, inn: "" })); }}
                        className="bg-transparent flex-1 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="1234567890"
                        inputMode="numeric" maxLength={12}
                      />
                    </div>
                    {errors.inn && <p className="text-red-400 text-xs mt-1">{errors.inn}</p>}
                  </div>
                </div>

                {/* Contact + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-1.5 block">
                      Контактное лицо <span className="text-red-400">*</span>
                    </label>
                    <div className={`flex items-center gap-2 bg-white/8 border rounded-xl px-3 py-2.5 ${errors.name ? "border-red-400" : "border-white/15"}`}>
                      <User className="w-4 h-4 text-white/40 shrink-0" />
                      <input
                        value={form.name}
                        onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: "" })); }}
                        className="bg-transparent flex-1 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="Иванов Иван"
                      />
                    </div>
                    {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-1.5 block">
                      Телефон <span className="text-red-400">*</span>
                    </label>
                    <div className={`flex items-center gap-2 bg-white/8 border rounded-xl px-3 py-2.5 ${errors.phone ? "border-red-400" : "border-white/15"}`}>
                      <Phone className="w-4 h-4 text-white/40 shrink-0" />
                      <input
                        type="tel" value={form.phone}
                        onChange={e => { setForm(f => ({ ...f, phone: formatPhone(e.target.value) })); setErrors(er => ({ ...er, phone: "" })); }}
                        className="bg-transparent flex-1 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="+7 (___) ___-__-__" maxLength={18} inputMode="tel"
                      />
                    </div>
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>
                </div>

                {/* Email + Car count */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-1.5 block">Email</label>
                    <div className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-xl px-3 py-2.5">
                      <Mail className="w-4 h-4 text-white/40 shrink-0" />
                      <input
                        type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="bg-transparent flex-1 text-sm text-white outline-none placeholder:text-white/30"
                        placeholder="company@example.ru"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-1.5 block">Количество автомобилей</label>
                    <div className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-xl px-3 py-2.5">
                      <Car className="w-4 h-4 text-white/40 shrink-0" />
                      <select
                        value={form.carCount}
                        onChange={e => setForm(f => ({ ...f, carCount: e.target.value }))}
                        className="bg-transparent flex-1 text-sm text-white outline-none [&>option]:text-slate-800"
                      >
                        <option value="1">1 автомобиль</option>
                        <option value="2-5">2–5 автомобилей</option>
                        <option value="5-10">5–10 автомобилей</option>
                        <option value="более 10">Более 10 автомобилей</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Brands */}
                {brandsData.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-white/60 mb-2 block">Интересующие бренды</label>
                    <div className="flex flex-wrap gap-2">
                      {brandsData.filter(b => b.name && !["С пробегом", "МБ-Брянск"].includes(b.name)).map(b => (
                        <button key={b.id} type="button"
                          onClick={() => toggleBrand(b.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            form.brands.includes(b.name)
                              ? "bg-primary border-primary text-white"
                              : "bg-white/8 border-white/15 text-white/60 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comment */}
                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">Комментарий</label>
                  <div className="flex gap-2 bg-white/8 border border-white/15 rounded-xl px-3 py-2.5">
                    <MessageSquare className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                    <textarea
                      value={form.comment}
                      onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                      className="bg-transparent flex-1 text-sm text-white outline-none placeholder:text-white/30 resize-none"
                      placeholder="Дополнительные пожелания или вопросы..."
                      rows={3}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading}
                  className="w-full brand-gradient border-0 text-white font-bold h-12 rounded-xl hover:opacity-90 text-base">
                  {loading ? "Отправляем..." : "Отправить заявку"}
                </Button>
                <p className="text-center text-xs text-white/30">
                  Нажимая кнопку, вы соглашаетесь с{" "}
                  <Link href="/privacy" className="underline hover:text-white/60 transition-colors">политикой конфиденциальности</Link>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <FaqBlock pageSlug="corporate" title="Вопросы о корпоративном обслуживании" />

      {/* ── MANAGERS ─────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-slate-50 border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2 text-center">Контакты</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">Ваши менеджеры</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ManagerCard
              role={pageData?.sales_manager_role || "Менеджер по продажам"}
              name={pageData?.sales_manager_name}
              phone={pageData?.sales_manager_phone}
              email={pageData?.sales_manager_email}
              photo={pageData?.sales_manager_photo}
              generalPhone={generalPhone}
            />
            <ManagerCard
              role={pageData?.service_manager_role || "Менеджер по сервису"}
              name={pageData?.service_manager_name}
              phone={pageData?.service_manager_phone}
              email={pageData?.service_manager_email}
              photo={pageData?.service_manager_photo}
              generalPhone={generalPhone}
            />
          </div>
          <p className="text-center text-sm text-slate-400 mt-6">
            Не нашли ответ на свой вопрос?{" "}
            <a href="#corporate-form" className="text-primary font-semibold hover:underline">
              Оставьте заявку
            </a>{" "}
            и мы свяжемся с вами.
          </p>
        </div>
      </section>

      {/* ── STICKY MOBILE CTA ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {scrollY > 400 && (
          <motion.div
            initial={prefersReduced ? false : { y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 flex gap-2 shadow-2xl"
          >
            <a href="#corporate-form" className="flex-1">
              <Button className="w-full brand-gradient border-0 text-white font-bold h-11 rounded-xl hover:opacity-90">
                Оставить заявку
              </Button>
            </a>
            <a href={saleTel}
              className="w-12 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 hover:bg-slate-200 transition-colors">
              <Phone className="w-5 h-5 text-slate-600" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
