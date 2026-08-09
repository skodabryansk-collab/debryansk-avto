import React, { useState, useMemo } from "react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { useLocation } from "wouter";
import { CTPhone } from "@/components/CTPhone";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Wrench, Hammer, Sparkles, Package, Car, Shield,
  MapPin, Phone, Clock, CheckCircle, Star, Settings, Gauge,
  Tag, ChevronRight, ChevronLeft, X, Calendar, ArrowRight, ExternalLink, Gift, Share2
} from "lucide-react";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";
import FaqBlock from "@/components/FaqBlock";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

/* ─── Types ──────────────────────────────────────────────────────── */
interface LocationBrandItem {
  id: number;
  name: string;
  logoUrl: string | null;
  bgColor: string | null;
  isService: boolean;
  sortOrder: number;
}

interface ApiLocation {
  id: number;
  title: string;
  address: string;
  mapX: number | null;
  mapY: number | null;
  phone: string | null;
  hours: string | null;
  sortOrder: number;
  brands: LocationBrandItem[];
}

async function fetchLocations(): Promise<ApiLocation[]> {
  const r = await fetch("/api/locations");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

/* ─── Services list ─────────────────────────────────────────────── */
const servicesList = [
  {
    icon: Wrench,
    title: "ТО и ремонт",
    desc: "Официальное обслуживание по стандартам производителя. Только сертифицированные мастера.",
    features: ["Гарантия на работы", "Оригинальные запчасти", "Экспресс-ТО за 1 час"],
  },
  {
    icon: Hammer,
    title: "Кузовной ремонт",
    desc: "Восстановление геометрии кузова, рихтовка и покраска любой сложности.",
    features: ["Локальная покраска", "Полная покраска", "Рихтовка без покраски"],
  },
  {
    icon: Sparkles,
    title: "Детейлинг",
    desc: "Химчистка салона, полировка кузова, нанесение защитных покрытий и бронирование плёнкой.",
    features: ["Керамическое покрытие", "Антигравийная плёнка", "Химчистка салона"],
  },
  {
    icon: Gauge,
    title: "Компьютерная диагностика",
    desc: "Полная диагностика всех систем автомобиля с использованием оригинального оборудования.",
    features: ["Двигатель", "Трансмиссия", "Электроника", "Ходовая"],
  },
  {
    icon: Settings,
    title: "Шиномонтаж и хранение",
    desc: "Профессиональный шиномонтаж, балансировка, сезонное хранение шин.",
    features: ["Шиномонтаж", "Балансировка", "Сезонное хранение", "Сход-развал"],
  },
  {
    icon: Package,
    title: "Запасные части",
    desc: "Оригинальные и сертифицированные запчасти для всех марок, которые мы обслуживаем.",
    features: ["Оригинальные запчасти", "Аналоги", "Быстрая доставка", "Гарантия"],
  },
];

/* ─── Advantages ────────────────────────────────────────────────── */
const advantages = [
  { icon: Shield,      title: "Гарантия производителя",  desc: "Все работы выполняются по стандартам производителя с сохранением гарантии" },
  { icon: Star,        title: "Сертифицированные мастера", desc: "Технические специалисты проходят регулярное обучение у производителей" },
  { icon: CheckCircle, title: "Оригинальные запчасти",    desc: "Только сертифицированные детали от официальных поставщиков" },
  { icon: Clock,       title: "Быстрая запись",           desc: "Запись на сервис в тот же день или на удобное время" },
  { icon: Car,         title: "Запасной автомобиль",      desc: "Предоставляем подменный автомобиль на время длительного ремонта" },
  { icon: MapPin,      title: "4 сервисных центра",       desc: "Удобное расположение по всему городу Брянск и области" },
];

/* ─── JSON-LD schema ────────────────────────────────────────────── */
const serviceSchema = {
  "@type": "AutoRepair",
  name: "Дебрянск Авто — Официальный сервис",
  description: "Официальный сервисный центр Haval, Omoda, Jaecoo, Jetour, Tenet, Soueast, Volkswagen, Skoda, Exeed, Mercedes-Benz в Брянске.",
  url: "https://debryansk-auto.ru/service",
  telephone: "+7 (4832) 77 77 70",
  areaServed: { "@type": "City", name: "Брянск" },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Услуги сервиса",
    itemListElement: servicesList.map((s, i) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.title },
      position: i + 1,
    })),
  },
};

/* ─── FadeIn helper ─────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Booking Form ──────────────────────────────────────────────── */
function BookingForm({ locations }: { locations: ApiLocation[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", phone: "", brand: "", model: "",
    mileage: "", service: "", center: "", date: "", comment: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const allBrands = useMemo(() => {
    const names = new Set<string>();
    locations.forEach(loc => loc.brands.forEach(b => names.add(b.name)));
    return Array.from(names).sort();
  }, [locations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !isPhoneValid(form.phone) || !form.service) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    if (!form.center) {
      toast({ title: "Выберите сервисный центр", variant: "destructive" });
      return;
    }
    try {
      const fd = new FormData();
      fd.append("type", "service");
      fd.append("name", form.name.trim());
      fd.append("phone", form.phone.trim());
      fd.append("service", form.service);
      const loc = locations.find(l => String(l.id) === form.center);
      fd.append("location", loc?.title || form.center);
      if (form.brand) fd.append("brand", form.brand);
      if (form.model) fd.append("model", form.model);
      if (form.mileage) fd.append("mileage", form.mileage);
      if (form.date) fd.append("preferredDate", form.date);
      if (form.comment) fd.append("comment", form.comment.trim());
      fd.append("source", "Форма на странице сервиса");
      const res = await fetch("/api/send-email", { method: "POST", body: fd });
      if (!res.ok) throw new Error("server");
      setSubmitted(true);
      toast({ title: "Заявка принята", description: "Перезвоним в течение 15 минут" });
    } catch {
      toast({ title: "Ошибка отправки", description: "Позвоните: +7 (4832) 77-77-70", variant: "destructive" });
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 text-center">
        <div className="w-16 h-16 bg-[#87b63c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#87b63c]" />
        </div>
        <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
        <p className="text-slate-500 mb-4">
          Мы перезвоним вам в течение 15 минут для уточнения деталей.
        </p>
        <button onClick={() => setSubmitted(false)} className="text-primary font-bold hover:underline">
          Отправить ещё одну
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100">
      <h3 className="text-lg font-extrabold mb-5">Онлайн-запись на сервис</h3>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Имя *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ваше имя"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Телефон *</label>
          <input
            type="tel" inputMode="tel" maxLength={18}
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
            placeholder="+7 (___) ___-__-__"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Марка авто</label>
          <select
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm bg-white"
          >
            <option value="">Выберите марку</option>
            {allBrands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Модель</label>
          <input
            value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
            placeholder="Например, Jolion"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Пробег, км</label>
          <input
            value={form.mileage}
            onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))}
            placeholder="Например, 45000"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Тип услуги *</label>
          <select
            value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm bg-white"
          >
            <option value="">Выберите услугу</option>
            <option value="to">Техническое обслуживание (ТО)</option>
            <option value="repair">Ремонт</option>
            <option value="body">Кузовной ремонт</option>
            <option value="diagnostics">Диагностика</option>
            <option value="detailing">Детейлинг</option>
            <option value="tires">Шиномонтаж</option>
            <option value="parts">Запчасти</option>
            <option value="other">Другое</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Сервисный центр *</label>
          <select
            value={form.center}
            onChange={e => setForm(f => ({ ...f, center: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm bg-white"
          >
            <option value="">Любой удобный</option>
            {locations.map(loc => (
              <option key={loc.id} value={String(loc.id)}>{loc.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Желаемая дата</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Комментарий</label>
        <textarea
          value={form.comment}
          onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
          placeholder="Опишите проблему или желаемую услугу"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm resize-none"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-primary hover:bg-[#005a94] text-white font-bold rounded-xl py-3 text-sm transition-colors"
      >
        Записаться на сервис
      </button>
      <p className="text-[10px] text-slate-400 mt-3 text-center">
        Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
      </p>
    </form>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
/* ── Types ─────────────────────────────────────────────────── */
interface PromoBrand { id: number; name: string; logoUrl: string | null; bgColor: string | null; }
interface ServicePromotion {
  id: number; slug?: string; title: string; description: string;
  image: string | null; badge: string | null; expiresAt: string | null;
  buttonText: string | null; buttonUrl: string | null;
  brands: PromoBrand[];
}

async function fetchServicePromotions(): Promise<ServicePromotion[]> {
  const r = await fetch("/api/promotions?type=service");
  if (!r.ok) return [];
  const j = await r.json();
  return j.data ?? [];
}

/* ── ServicePromoModal ─────────────────────────────────────── */
function ServicePromoModal({
  promo,
  onClose,
}: {
  promo: ServicePromotion;
  onClose: () => void;
}) {
  const prefersReduced = useReducedMotion();
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!promo.slug) return;
    const url = `${window.location.origin}/promotions/${promo.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: promo.title, url });
        return;
      } catch {
        /* user cancelled or unsupported, fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(phone)) return;
    setSending(true);
    setError(false);
    try {
      const fd = new FormData();
      fd.append("type", "promo");
      fd.append("phone", phone);
      fd.append("source", `Акция сервиса: ${promo.title}`);
      const r = await fetch("/api/send-email", { method: "POST", body: fd });
      if (!r.ok) { setError(true); setSending(false); return; }
      setSubmitted(true);
    } catch {
      setError(true);
      setSending(false);
    }
  }

  const btnText = promo.buttonText || "Оставить заявку";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={prefersReduced ? false : { y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-primary to-[#87b63c]" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-white/90 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors shadow-sm"
        >
          <X className="w-4 h-4 text-slate-600" />
        </button>
        {promo.slug && (
          <button
            onClick={handleShare}
            className="absolute top-4 right-14 z-20 h-8 px-3 bg-white/90 hover:bg-slate-100 rounded-full flex items-center gap-1.5 transition-colors shadow-sm text-xs font-semibold text-slate-600"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? "Скопировано" : "Поделиться"}
          </button>
        )}

        {promo.image && (
          <div className="w-full h-48 sm:h-56 shrink-0 overflow-hidden relative">
            <img src={promo.image} alt={promo.title} className="w-full h-full object-cover" loading="lazy" />
            {promo.brands.length > 0 && (
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
                {promo.brands.slice(0, 4).map(b => (
                  <div key={b.id} className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
                    {b.logoUrl && <img src={b.logoUrl} alt={b.name} className="w-4 h-3 object-contain" />}
                    <span className="text-[10px] font-bold text-slate-700">{b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-6 sm:p-8 overflow-y-auto">
          <div className="flex flex-wrap gap-2 mb-3">
            {promo.badge && (
              <span className="inline-flex items-center gap-1 bg-[#87b63c]/15 text-[#4a7a0f] text-xs font-bold px-3 py-1 rounded-full">
                {promo.badge}
              </span>
            )}
            {promo.expiresAt && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200">
                <Calendar className="w-3 h-3" />
                до {new Date(promo.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
              </span>
            )}
          </div>

          {/* Brand logos if no image */}
          {!promo.image && promo.brands.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {promo.brands.map(b => (
                <div key={b.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
                  {b.logoUrl && <img src={b.logoUrl} alt={b.name} className="w-10 h-5 object-contain" />}
                  <span className="text-xs font-semibold text-slate-600">{b.name}</span>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-3 leading-tight">
            {promo.title}
          </h2>
          <p className="text-slate-600 leading-relaxed whitespace-pre-line mb-6 text-sm sm:text-base">
            {promo.description}
          </p>

          {submitted ? (
            <div className="bg-[#87b63c]/10 border border-[#87b63c]/30 rounded-2xl p-5 text-center">
              <CheckCircle className="w-10 h-10 text-[#87b63c] mx-auto mb-2" />
              <p className="font-bold text-slate-900">Заявка отправлена!</p>
              <p className="text-sm text-slate-500 mt-1">Мы свяжемся с вами в ближайшее время</p>
            </div>
          ) : !showForm ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {promo.buttonUrl && (
                <a
                  href={promo.buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-5 py-3 rounded-xl text-sm transition-colors"
                >
                  Узнать подробнее <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={() => setShowForm(true)}
                className="flex-1 bg-gradient-to-r from-primary to-[#005a94] text-white font-bold px-5 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity"
              >
                {btnText}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                  Ваш телефон
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel" inputMode="tel" maxLength={18}
                    value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                    placeholder="+7 (___) ___-__-__" required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs">Ошибка отправки, попробуйте ещё раз</p>}
              <button
                type="submit"
                disabled={sending || !isPhoneValid(phone)}
                className="w-full bg-gradient-to-r from-primary to-[#005a94] text-white font-bold px-5 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {sending ? "Отправляем..." : "Отправить заявку"}
              </button>
              <p className="text-[10px] text-slate-400 text-center leading-tight">
                Нажимая кнопку, вы соглашаетесь с&nbsp;
                <a href="/privacy" className="underline hover:text-slate-600">политикой конфиденциальности</a>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const PROMOS_PER_PAGE = 6;

/* ── ServicePromotionsBlock ────────────────────────────────── */
function ServicePromotionsBlock() {
  const prefersReduced = useReducedMotion();
  const { data: allPromotions = [] } = useQuery<ServicePromotion[]>({
    queryKey: ["service-promotions"],
    queryFn: fetchServicePromotions,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedPromo, setSelectedPromo] = useState<ServicePromotion | null>(null);
  const [page, setPage] = useState(0);

  const promotions = useMemo(
    () => allPromotions.filter(p => !p.expiresAt || new Date(p.expiresAt) >= new Date()),
    [allPromotions]
  );

  const totalPages = Math.ceil(promotions.length / PROMOS_PER_PAGE);
  const pagePromos = promotions.slice(page * PROMOS_PER_PAGE, (page + 1) * PROMOS_PER_PAGE);

  if (!promotions.length) return null;

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <Tag className="w-[18px] h-[18px] text-primary" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Специальные предложения</p>
              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">Акции сервисного центра</h2>
            </div>
          </div>
          {promotions.length > PROMOS_PER_PAGE && (
            <p className="text-sm text-slate-400">
              {page * PROMOS_PER_PAGE + 1}–{Math.min((page + 1) * PROMOS_PER_PAGE, promotions.length)} из {promotions.length}
            </p>
          )}
        </div>

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pagePromos.map((promo, i) => (
            <motion.button
              key={promo.id}
              initial={prefersReduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.06 }}
              onClick={() => setSelectedPromo(promo)}
              className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col text-left w-full cursor-pointer"
            >
              {/* Image */}
              {promo.image ? (
                <div className="relative h-44 overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={promo.image} alt={promo.title}
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                    loading="lazy" decoding="async"
                  />
                  {promo.brands.length > 0 && (
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
                      {promo.brands.slice(0, 4).map(b => (
                        <div key={b.id} className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
                          {b.logoUrl && (
                            <img src={b.logoUrl} alt={b.name} className="w-4 h-3 object-contain" loading="lazy" decoding="async" />
                          )}
                          <span className="text-[10px] font-bold text-slate-700">{b.name}</span>
                        </div>
                      ))}
                      {promo.brands.length > 4 && (
                        <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-500">+{promo.brands.length - 4}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {promo.badge && (
                    <div className="absolute top-2 right-2 bg-[#87b63c] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                      {promo.badge}
                    </div>
                  )}
                </div>
              ) : (
                promo.brands.length > 0 && (
                  <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex flex-wrap gap-2 shrink-0">
                    {promo.brands.slice(0, 5).map(b => (
                      <div key={b.id} className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-100">
                        {b.logoUrl && (
                          <img src={b.logoUrl} alt={b.name} className="w-10 h-5 object-contain" loading="lazy" decoding="async" />
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Content */}
              <div className="flex flex-col flex-1 p-4 gap-2">
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 font-bold text-slate-900 text-sm leading-snug group-hover:text-primary transition-colors">
                    {promo.title}
                  </h3>
                  {promo.expiresAt && (
                    <span className="shrink-0 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                      до {new Date(promo.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                {promo.description && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{promo.description}</p>
                )}
                {!promo.image && promo.brands.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {promo.brands.map(b => (
                      <span key={b.id} className="text-[10px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">{b.name}</span>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-2 flex items-center gap-1.5 text-primary text-xs font-bold">
                  Подробнее <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>
            <div className="flex gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                    i === page
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Далее <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedPromo && (
          <ServicePromoModal
            promo={selectedPromo}
            onClose={() => setSelectedPromo(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

export default function ServicePage() {
  const prefersReduced = useReducedMotion();
  const [, navigate] = useLocation();
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["service-locations"],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
  });

  const totalBrands = useMemo(() => {
    const names = new Set<string>();
    locations.forEach(loc => loc.brands.forEach(b => names.add(b.name)));
    return names.size;
  }, [locations]);

  return (
    <Layout>
      {!isLoading && <div data-prerender-ready="true" style={{ display: "none" }} />}
      <SEO
        title="Официальный сервис — Дебрянск Авто"
        description="Официальный сервис Haval, Omoda, Jaecoo, Jetour, Tenet, Soueast, Volkswagen, Skoda, Exeed, Mercedes-Benz в Брянске. ТО, ремонт, кузовной, детейлинг, диагностика. Онлайн-запись."
        canonical="/service"
        jsonLd={serviceSchema}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Сервис", url: "/service" },
        ]}
      />

      <div>
        {/* ── Hero ── */}
        <div className="bg-[#0d0f14] text-white py-12 sm:py-16 md:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-3">
                Официальный сервис</p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Техническое обслуживание и ремонт в Брянске
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-xl mb-8">
                {totalBrands || 13} брендов, 4 сервисных центра, гарантия производителя.
                Сертифицированные мастера, оригинальные запчасти, современное оборудование.
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {[
                  { icon: Wrench, text: "ТО и ремонт" },
                  { icon: Shield, text: "Гарантия производителя" },
                  { icon: Clock, text: "Быстрая запись" },
                  { icon: MapPin, text: "4 центра в Брянске" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 bg-white/[0.07] border border-white/[0.1] rounded-full px-3 py-1.5 text-xs font-semibold text-white/80">
                    <Icon className="w-3.5 h-3.5 text-[#87b63c]" /> {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Services Grid ── */}
        <section className="py-12 sm:py-16 bg-[#f8f9fb]">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="mb-8 sm:mb-10">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2">Услуги</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Что мы делаем</h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {servicesList.map((s, i) => (
                <FadeIn key={s.title} delay={i * 0.08}>
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 hover:shadow-md transition-shadow h-full flex flex-col">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <s.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-extrabold text-base mb-2">{s.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">{s.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.features.map(f => (
                        <span key={f} className="text-[10px] font-semibold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Advantages ── */}
        <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="mb-8 sm:mb-10">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2">Почему мы</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Преимущества официального сервиса</h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {advantages.map((a, i) => (
                <FadeIn key={a.title} delay={i * 0.08}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#87b63c]/10 flex items-center justify-center shrink-0">
                      <a.icon className="w-5 h-5 text-[#87b63c]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm mb-1">{a.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{a.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Service Centers + Booking ── */}
        <section className="py-12 sm:py-16 bg-[#f8f9fb] border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-5 gap-6 sm:gap-8 items-start">
              {/* Left: centers */}
              <div className="lg:col-span-3">
                <FadeIn className="mb-5">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2">Центры</p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold">Сервисные центры в Брянске</h2>
                </FadeIn>

                {/* Legend */}
                <FadeIn className="flex items-center gap-4 mb-5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Дилер (продажи + сервис)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                    Только сервис
                  </span>
                </FadeIn>

                <div className="space-y-4">
                  {isLoading && (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 h-32${prefersReduced ? "" : " animate-pulse"}`} />
                    ))
                  )}
                  {locations.map((loc, i) => (
                    <FadeIn key={loc.id} delay={i * 0.08}>
                      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-extrabold text-primary text-lg">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-extrabold text-base mb-0.5">{loc.title}</h3>
                            <p className="text-sm text-slate-500 mb-3">{loc.address}</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {loc.brands.filter(b => !b.isService).map(b => (
                                <span key={b.id} className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                                  {b.name}
                                </span>
                              ))}
                              {loc.brands.filter(b => b.isService).map(b => (
                                <span key={b.id} className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full">
                                  {b.name} Сервис
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              {loc.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {loc.phone}
                                </span>
                              )}
                              {loc.hours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {loc.hours}
                                </span>
                              )}
                            </div>
                          </div>
                          {loc.phone && (
                            <div className="flex gap-2 shrink-0">
                              <CTPhone className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm hover:bg-[#005a94] transition-colors"
                                phone={loc.phone}>
                                Позвонить
                              </CTPhone>
                            </div>
                          )}
                        </div>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>

              {/* Right: booking form */}
              <div className="lg:col-span-2">
                <FadeIn>
                  <BookingForm locations={locations} />
                </FadeIn>
              </div>
            </div>
          </div>
        </section>

        <ServicePromotionsBlock />

        {/* ── Промо-растяжка: Бонусная программа ─────────────────── */}
        <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20 bg-[#07111f]">
          {/* Декоративные пятна */}
          <div className="absolute -right-24 -top-24 w-[480px] h-[480px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 bottom-0 w-72 h-72 rounded-full bg-[#0040a0]/10 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative container mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-14">

              {/* Иконка */}
              <div className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-primary/30 to-[#0040a0]/20 border border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)]">
                <Gift className="w-12 h-12 sm:w-14 sm:h-14 text-primary" />
              </div>

              {/* Текст */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-primary/15 border border-primary/25">
                  <span className={`w-1.5 h-1.5 rounded-full bg-primary${prefersReduced ? "" : " animate-pulse"}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Программа лояльности</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3 leading-tight">
                  Бонусная программа<br className="hidden sm:block" />
                  <span className="text-primary"> Дебрянск Авто</span>
                </h2>
                <p className="text-white/55 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 mb-5">
                  Получайте 10% от суммы каждого заказ-наряда на бонусный счёт и оплачивайте ими до 10% следующего визита.
                </p>
                <div className="flex flex-wrap justify-center lg:justify-start gap-2">
                  {["10% начисление за сервис", "Списание от 5% до 10%", "Накопительные уровни", "Действуют 12 месяцев"].map(b => (
                    <span key={b} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/65 text-xs font-medium">
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <a
                  href="/service/bonus"
                  className="inline-flex items-center gap-2.5 bg-primary hover:bg-[#005fa0] text-white font-bold px-8 py-4 rounded-2xl transition-all hover:shadow-[0_0_28px_rgba(var(--primary-rgb),0.45)] text-base whitespace-nowrap"
                >
                  <Gift className="w-5 h-5" />
                  Узнать подробнее
                </a>
                <p className="text-white/35 text-xs">Регистрация бесплатная</p>
              </div>

            </div>
          </div>
        </section>

        <FaqBlock pageSlug="service" />
      </div>
    </Layout>
  );
}
