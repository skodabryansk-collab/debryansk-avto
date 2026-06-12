import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Wrench, Hammer, Sparkles, Package, Car, Shield,
  MapPin, Phone, Clock, CheckCircle, Star, Settings, Gauge
} from "lucide-react";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";
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
  description: "Официальный сервисный центр Haval, Omoda, Jaecoo, Jetour, Tenet, Volkswagen, Skoda, Exeed, Mercedes-Benz в Брянске.",
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.service) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    setSubmitted(true);
    toast({ title: "Заявка принята", description: "Перезвоним в течение 15 минут" });
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
        <button onClick={() => setSubmitted(false)} className="text-[#0070b8] font-bold hover:underline">
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
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Телефон *</label>
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+7 (___) ___-__-__"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Марка авто</label>
          <select
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm bg-white"
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
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Пробег, км</label>
          <input
            value={form.mileage}
            onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))}
            placeholder="Например, 45000"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Тип услуги *</label>
          <select
            value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm bg-white"
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Сервисный центр</label>
          <select
            value={form.center}
            onChange={e => setForm(f => ({ ...f, center: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm bg-white"
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
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm"
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
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm resize-none"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-[#0070b8] hover:bg-[#005a94] text-white font-bold rounded-xl py-3 text-sm transition-colors"
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
export default function ServicePage() {
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
      <SEO
        title="Официальный сервис — Дебрянск Авто"
        description="Официальный сервис Haval, Omoda, Jaecoo, Jetour, Tenet, Volkswagen, Skoda, Exeed, Mercedes-Benz в Брянске. ТО, ремонт, кузовной, детейлинг, диагностика. Онлайн-запись."
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
                {totalBrands > 0 ? `${totalBrands} брендов` : "9 брендов"}, 4 сервисных центра, гарантия производителя.
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
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Услуги</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Что мы делаем</h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {servicesList.map((s, i) => (
                <FadeIn key={s.title} delay={i * 0.08}>
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 hover:shadow-md transition-shadow h-full flex flex-col">
                    <div className="w-11 h-11 rounded-xl bg-[#0070b8]/10 flex items-center justify-center mb-4">
                      <s.icon className="w-5 h-5 text-[#0070b8]" />
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
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Почему мы</p>
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
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Центры</p>
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
                      <div key={i} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 animate-pulse h-32" />
                    ))
                  )}
                  {locations.map((loc, i) => (
                    <FadeIn key={loc.id} delay={i * 0.08}>
                      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0 font-extrabold text-[#0070b8] text-lg">
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
                              <a href={`tel:${loc.phone}`}
                                className="px-4 py-2 bg-[#0070b8] text-white font-bold rounded-xl text-sm hover:bg-[#005a94] transition-colors">
                                Позвонить
                              </a>
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
      </div>
    </Layout>
  );
}
