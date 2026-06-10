import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Clock, Shield, BadgeCheck,
  Phone, User, MessageSquare, Car, Gauge, CheckCircle,
  ArrowRight, Banknote, Tag,
} from "lucide-react";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

/* ── Types ─────────────────────────────────────────────────── */
interface Brand { id: string; name: string; cyrillicName: string; isPopular: boolean }
interface CarModel { id: string; name: string }

/* ── API helpers ────────────────────────────────────────────── */
async function fetchBrands(): Promise<Brand[]> {
  const r = await fetch("/api/car-catalog/brands");
  if (!r.ok) throw new Error("Ошибка загрузки марок");
  const j = await r.json();
  return j.ok ? j.data : [];
}

async function fetchModels(brandId: string): Promise<CarModel[]> {
  if (!brandId) return [];
  const r = await fetch(`/api/car-catalog/models?brandId=${encodeURIComponent(brandId)}`);
  if (!r.ok) throw new Error("Ошибка загрузки моделей");
  const j = await r.json();
  return j.ok ? j.data : [];
}

/* ── FadeIn helper ──────────────────────────────────────────── */
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

/* ── Year range ─────────────────────────────────────────────── */
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i);

const bodyTypes = [
  "Седан", "Хэтчбек", "Универсал", "Кроссовер / SUV",
  "Внедорожник", "Минивэн", "Купе", "Кабриолет",
  "Пикап", "Фургон", "Другой",
];

/* ── Price helpers ───────────────────────────────────────────── */
function formatPriceRUB(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

interface PriceStats {
  marketMin: number; marketMedian: number; marketMax: number;
  buyoutMin: number; buyoutMax: number; sampleCount: number;
}

async function fetchPriceStats(params: { brandId: string; modelId?: string; year: string; mileage?: string }): Promise<PriceStats | null> {
  const qs = new URLSearchParams({ brandId: params.brandId, year: params.year });
  if (params.modelId) qs.append("modelId", params.modelId);
  if (params.mileage) qs.append("mileage", params.mileage);
  const r = await fetch(`/api/car-catalog/price-stats?${qs}`);
  if (!r.ok) throw new Error("Ошибка оценки");
  const j = await r.json();
  if (!j.ok || !j.data) return null;
  return j.data as PriceStats;
}

/* ── Buyout form ────────────────────────────────────────────── */
function BuyoutForm() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    brand: "", model: "", year: "", mileage: "",
    body: "", name: "", phone: "", comment: "",
  });
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["car-catalog-brands"],
    queryFn: fetchBrands,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["car-catalog-models", form.brand],
    queryFn: () => fetchModels(form.brand),
    enabled: !!form.brand,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    setForm(f => ({ ...f, model: "" }));
  }, [form.brand]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleCalculate = async () => {
    if (!form.brand || !form.year) {
      toast({ title: "Выберите марку и год", variant: "destructive" });
      return;
    }
    if (!form.mileage) {
      toast({ title: "Укажите пробег", description: "Пробег необходим для точного расчёта", variant: "destructive" });
      return;
    }
    setPriceLoading(true);
    try {
      const stats = await fetchPriceStats({
        brandId: form.brand,
        modelId: form.model || undefined,
        year: form.year,
        mileage: form.mileage || undefined,
      });
      if (!stats) {
        toast({ title: "Недостаточно данных", description: "Попробуйте другую модель или год", variant: "destructive" });
        return;
      }
      setPriceStats(stats);
      setStep(2);
    } catch (err: any) {
      toast({ title: "Ошибка расчёта", description: err.message, variant: "destructive" });
    } finally {
      setPriceLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast({ title: "Укажите имя и телефон", variant: "destructive" });
      return;
    }
    try {
      const fd = new FormData();
      fd.append("type", "buyout");
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (priceStats) {
        fd.append("estimatedBuyoutMin", String(priceStats.buyoutMin));
        fd.append("estimatedBuyoutMax", String(priceStats.buyoutMax));
      }
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}
    setSubmitted(true);
    toast({ title: "Заявка принята!", description: "Перезвоним в течение 15 минут" });
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm";
  const selectCls = `${inputCls} bg-white`;
  const labelCls = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5";

  const popularBrands = brands.filter(b => b.isPopular);
  const otherBrands = brands.filter(b => !b.isPopular);

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
        <div className="w-16 h-16 bg-[#87b63c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#87b63c]" />
        </div>
        <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
        <p className="text-slate-500 mb-4 text-sm">Наш менеджер перезвонит вам в течение 15 минут для обсуждения условий.</p>
        <button onClick={() => { setSubmitted(false); setStep(1); setPriceStats(null); setForm({ brand: "", model: "", year: "", mileage: "", body: "", name: "", phone: "", comment: "" }); }} className="text-[#0070b8] font-bold hover:underline text-sm">
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? "bg-[#0070b8] text-white" : "bg-[#87b63c] text-white"}`}>
          {step === 1 ? "1" : <CheckCircle className="w-4 h-4" />}
        </div>
        <div className="h-1 w-8 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${step === 2 ? "w-full bg-[#87b63c]" : "w-0"}`} />
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? "bg-[#0070b8] text-white" : "bg-slate-200 text-slate-400"}`}>2</div>
      </div>

      <h3 className="text-lg font-extrabold mb-1">
        {step === 1 ? "Рассчитайте стоимость" : "Отправьте заявку"}
      </h3>
      <p className="text-sm text-slate-500 mb-5">
        {step === 1
          ? "Заполните данные об автомобиле — покажем предварительную цену."
          : "Укажите контакты для подтверждения оценки."
        }
      </p>

      {/* ── Step 1: Car data ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Марка */}
            <div>
              <label className={labelCls}>Марка *</label>
              <select value={form.brand} onChange={set("brand")} className={selectCls} disabled={brandsLoading}>
                <option value="">{brandsLoading ? "Загрузка…" : "Выберите марку"}</option>
                {popularBrands.length > 0 && (
                  <optgroup label="Популярные">
                    {popularBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </optgroup>
                )}
                {otherBrands.length > 0 && (
                  <optgroup label="Все марки">
                    {otherBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Модель */}
            <div>
              <label className={labelCls}>Модель</label>
              <select value={form.model} onChange={set("model")} className={selectCls} disabled={!form.brand || modelsLoading}>
                <option value="">{!form.brand ? "Сначала марку" : modelsLoading ? "Загрузка…" : "Выберите модель"}</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {/* Год */}
            <div>
              <label className={labelCls}>Год *</label>
              <select value={form.year} onChange={set("year")} className={selectCls}>
                <option value="">Выберите год</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Пробег */}
            <div>
              <label className={labelCls}>Пробег, км *</label>
              <input type="number" min="0" value={form.mileage} onChange={set("mileage")} placeholder="Например, 75 000" className={inputCls} />
            </div>

            {/* Тип кузова */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Тип кузова</label>
              <select value={form.body} onChange={set("body")} className={selectCls}>
                <option value="">Выберите тип</option>
                {bodyTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={priceLoading}
            className="w-full bg-[#0070b8] hover:bg-[#005a94] text-white font-bold rounded-xl py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {priceLoading ? "Расчитываем…" : "Рассчитать стоимость"}
          </button>
        </div>
      )}

      {/* ── Price result + Step 2: Contacts ── */}
      {step === 2 && priceStats && (
        <div className="space-y-4">
          {/* Price card */}
          <div className="bg-[#0d0f14] rounded-2xl p-5 sm:p-6 border border-white/[0.07] mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#87b63c] mb-2">Предварительная оценка</p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{formatPriceRUB(priceStats.buyoutMin)}</span>
              <span className="text-sm text-white/40"> — </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{formatPriceRUB(priceStats.buyoutMax)}</span>
            </div>
            <div className="bg-[#87b63c]/10 border border-[#87b63c]/20 rounded-xl px-3 py-2.5 mb-3">
              <p className="text-[11px] font-semibold text-[#87b63c] leading-snug">
                ⚠ Расчёт предварительный. Точная цена определяется после осмотра автомобиля.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Имя */}
            <div>
              <label className={labelCls}>Ваше имя *</label>
              <input type="text" value={form.name} onChange={set("name")} placeholder="Как вас зовут?" className={inputCls} />
            </div>
            {/* Телефон */}
            <div>
              <label className={labelCls}>Телефон *</label>
              <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 (___) ___-__-__" className={inputCls} />
            </div>
          </div>

          {/* Комментарий */}
          <div>
            <label className={labelCls}>Комментарий</label>
            <textarea
              value={form.comment} onChange={set("comment")}
              placeholder="Состояние, особенности, пожелания по цене…"
              rows={3} className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep(1); setPriceStats(null); }}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Изменить
            </button>
            <button type="submit" className="flex-1 bg-[#0070b8] hover:bg-[#005a94] text-white font-bold rounded-xl py-3 text-sm transition-colors">
              Отправить заявку
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-3 text-center">
        Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
      </p>
    </form>
  );
}

/* ── Services comparison ────────────────────────────────────── */
const services = [
  {
    icon: Banknote,
    tag: "Быстро",
    tagColor: "bg-[#87b63c]/10 text-[#5a7d22]",
    title: "Срочный выкуп",
    subtitle: "Деньги в день обращения",
    desc: "Мы выкупаем автомобиль сами — в течение одного дня. Вы называете машину, мы называем цену. Договор, перевод, снятие с учёта — всё берём на себя.",
    pros: [
      "Деньги переводим в день сделки",
      "Оценка автомобиля — бесплатно",
      "Выезд нашего специалиста к вам",
      "Без скрытых комиссий",
      "Помощь в снятии с учёта",
    ],
    note: "Цена чуть ниже рыночной — это честная плата за скорость и нашу работу.",
    accentColor: "border-[#87b63c]",
    iconBg: "bg-[#87b63c]/10",
    iconColor: "text-[#87b63c]",
  },
  {
    icon: TrendingUp,
    tag: "Выгоднее",
    tagColor: "bg-[#0070b8]/10 text-[#0070b8]",
    title: "Комиссионная продажа",
    subtitle: "Максимальная цена — без хлопот",
    desc: "Выставляем автомобиль на нашей площадке и на Auto.ru по рыночной цене. Реклама, показы, переговоры, оформление — наша работа. Вы получаете деньги после сделки.",
    pros: [
      "Рыночная цена продажи",
      "Размещение на Auto.ru и нашем сайте",
      "Бесплатное хранение на охраняемой стоянке",
      "Мы проводим все переговоры",
      "Деньги сразу после продажи",
    ],
    note: "Наша комиссия фиксированная — озвучиваем сразу, без сюрпризов.",
    accentColor: "border-[#0070b8]",
    iconBg: "bg-[#0070b8]/10",
    iconColor: "text-[#0070b8]",
  },
];

/* ── Why us ─────────────────────────────────────────────────── */
const whyUs = [
  { icon: BadgeCheck, title: "Официальный дилер", desc: "Договор, юридическая чистота и гарантия оплаты" },
  { icon: Clock,      title: "Ответ за 15 минут",   desc: "Перезваниваем сами — вам не надо ждать" },
  { icon: Shield,     title: "Чистая сделка", desc: "Проверяем историю, оформляем все документы" },
  { icon: Gauge,      title: "Честная оценка", desc: "Без искусственного занижения — только реальная цена" },
];

/* ── JSON-LD ─────────────────────────────────────────────────── */
const schema = {
  "@type": "AutoDealer",
  name: "Дебрянск Авто — Выкуп и комиссия",
  description: "Срочный выкуп автомобилей и комиссионная продажа в Брянске. Оценка бесплатно, деньги в день сделки.",
  url: "https://debryansk-auto.ru/buyout",
  telephone: "+7 (4832) 000-000",
  areaServed: { "@type": "City", name: "Брянск" },
};

/* ── Sticky nav ─────────────────────────────────────────────── */
const navItems = [
  { id: "services", label: "Услуги" },
  { id: "process", label: "Процесс" },
  { id: "form", label: "Оценка" },
];

function BuyoutNav() {
  const [active, setActive] = useState("services");

  useEffect(() => {
    const sections = navItems.map(n => document.getElementById(n.id));
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach(s => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-[6.25rem] z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
          {navItems.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={e => {
                e.preventDefault();
                const el = document.getElementById(item.id);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActive(item.id);
                }
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                active === item.id
                  ? "bg-[#0070b8] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </a>
          ))}
          <Link href="/buyout" className="shrink-0 ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-[#87b63c] text-white shadow-sm">
            <Tag className="w-3.5 h-3.5" /> Выкуп
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function BuyoutPage() {
  return (
    <Layout>
      <SEO
        title="Выкуп и комиссия — Дебрянск Авто"
        description="Срочный выкуп автомобилей за наличные и комиссионная продажа в Брянске. Оценка бесплатно, деньги в день сделки. Официальный дилер."
        canonical="/buyout"
        jsonLd={schema}
      />

      <BuyoutNav />

      {/* ── Hero ── */}
      <div className="bg-[#0d0f14] text-white py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-3">
              Выкуп и комиссия
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              Продайте автомобиль на Территории автомобилей
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mb-8">
              Два пути — по честной цене. Срочный выкуп: деньги в тот же день. Комиссионная продажа: мы берём всё на себя и продаём по максимуму. За вами — решение, за нами — сделка.
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {[
                { icon: Banknote, text: "Деньги в день сделки" },
                { icon: BadgeCheck, text: "Официальный договор" },
                { icon: Clock, text: "Оценка за 15 минут" },
                { icon: Car, text: "Любая марка и год" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 bg-white/[0.07] border border-white/[0.1] rounded-full px-3 py-1.5 text-xs font-semibold text-white/80">
                  <Icon className="w-3.5 h-3.5 text-[#87b63c]" /> {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two services ── */}
      <section id="services" className="py-12 sm:py-16 bg-[#f8f9fb]">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Услуги</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Два пути. Одна цель — ваша выгода.</h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            {services.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.1}>
                <div className={`bg-white rounded-2xl border-t-4 ${s.accentColor} border border-slate-100 p-6 sm:p-8 h-full flex flex-col`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                      <s.icon className={`w-6 h-6 ${s.iconColor}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${s.tagColor}`}>
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold mb-0.5">{s.title}</h3>
                  <p className="text-xs font-semibold text-slate-400 mb-3">{s.subtitle}</p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">{s.desc}</p>
                  <ul className="space-y-2 mb-5 flex-1">
                    {s.pros.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-[#87b63c] shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-4">{s.note}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Почему мы</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Группа компаний с 15-летней историей</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {whyUs.map((w, i) => (
              <FadeIn key={w.title} delay={i * 0.08}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                    <w.icon className="w-5 h-5 text-[#0070b8]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm mb-1">{w.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{w.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="process" className="py-12 sm:py-16 bg-[#f8f9fb] border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Процесс</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Четыре шага — и автомобиль продан</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { n: "01", title: "Расскажите об авто", desc: "Заполните форму или позвоните — нам достаточно марки, года и пробега" },
              { n: "02", title: "Называем цену", desc: "Перезвоним в течение 15 минут с конкретной суммой — без расплывчатых ответов" },
              { n: "03", title: "Осмотр на месте", desc: "Выедем к вам или примем на нашей площадке — осмотр всегда бесплатный" },
              { n: "04", title: "Деньги в день сделки", desc: "Подписываем договор и переводим средства — в тот же день" },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1} className="relative">
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 h-full">
                  <span className="text-4xl font-extrabold text-slate-100 block mb-3">{step.n}</span>
                  <h3 className="font-extrabold text-sm mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden sm:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2">
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  </div>
                )}
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section id="form" className="py-12 sm:py-16 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-2">
              <FadeIn>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Заявка</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold mb-4">Рассчитайте стоимость вашего автомобиля</h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Заполните данные — система покажет диапазон цен, а наш специалист перезвонит и подтвердит предложение. Оценка бесплатно, без обязательств.
                </p>
                <div className="space-y-4">
                  <a href="tel:+74832000000" className="flex items-center gap-3 text-sm font-bold text-slate-700 hover:text-[#0070b8] transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-[#0070b8]/10 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-[#0070b8]" />
                    </div>
                    +7 (4832) 000-000
                  </a>
                  <p className="text-xs text-slate-400 pl-12">Ежедневно с 9:00 до 21:00</p>
                </div>
              </FadeIn>
            </div>
            <div className="lg:col-span-3">
              <FadeIn delay={0.1}>
                <BuyoutForm />
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
