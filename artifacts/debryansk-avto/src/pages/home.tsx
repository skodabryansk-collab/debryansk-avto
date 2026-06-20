import React, { useState, useEffect, useRef, useCallback } from "react";
import { normalizePhone, phoneHref } from "@/lib/normalizePhone";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { Link } from "wouter";
import { motion, useInView, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { YandexMap, type YandexMapHandle } from "@/components/YandexMap";
import {
  Car, RotateCcw, ArrowLeftRight, CreditCard, FileText, Shield,
  Wrench, Hammer, Building2, MapPin, Phone, Clock, Search,
  Menu, X, ArrowRight, ChevronRight, ChevronDown, Sparkles, ChevronLeft,
  Package, Users, Banknote, Navigation, MapPinned, ArrowUpRight,
  Heart, Scale
} from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import { HomeActionBtn } from "@/components/HomeActionBtn";
import { TradeInModal } from "@/components/modals/TradeInModal";
import SEO from "@/components/SEO";
import { SiVk, SiTelegram } from "react-icons/si";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

import logoPng from "@/assets/logo-optimized.webp";
import ChatWidget from "@/components/ChatWidget";
import { ReviewsSection } from "@/components/ReviewsSection";
import logoWhiteSvg from "@/assets/logo-white.svg";
import miniLogo from "@/assets/mini-logo.webp";
import heroDynamic from "../assets/hero-isometric.webp";
import heroMobile from "../assets/hero-showroom-1-mobile.webp";
import dealerChery from "../assets/dealer-chery.webp";
import dealerOmoda from "../assets/dealer-omoda.webp";
import dealerJaecoo from "../assets/dealer-jaecoo.webp";
import dealerHaval from "../assets/dealer-haval.webp";
import dealerTenet from "../assets/dealer-tenet.webp";
import dealerMb from "../assets/dealer-mb.webp";
import dealerUsed from "../assets/dealer-used.webp";

import logoOmoda from "../assets/logos/logo-omoda-nobg.webp";
import logoJaecoo from "../assets/logos/logo-jaecoo-nobg.webp";
import logoHaval from "../assets/logos/logo-haval-nobg.webp";
import logoHavalOfficial from "../assets/logos/logo-haval-official.svg";
import logoTenet from "../assets/logos/logo-tenet.webp";
import logoMercedes from "../assets/logos/logo-mercedes-nobg.webp";
import logoJetour from "../assets/logos/logo-jetour.svg";

/* ── Fallback photos for DealerMap (used when photoUrl not set in DB) ── */
const DEALER_FALLBACK_PHOTOS = [dealerTenet, dealerOmoda, dealerMb, dealerHaval];
const DEALER_COLORS = ["#0070b8", "#87b63c", "#0070b8", "#87b63c"];

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

interface ApiNewsItem {
  id: number;
  title: string;
  excerpt: string | null;
  category: string | null;
  image: string | null;
  publishedAt: string | null;
  slug: string;
}

async function fetchPublicNews(): Promise<ApiNewsItem[]> {
  const r = await fetch("/api/news");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

interface ApiBrand {
  id: number;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  bgColor: string | null;
  subName: string | null;
  isServiceOnly?: boolean;
  carCount?: number;
}

async function fetchBrands(): Promise<ApiBrand[]> {
  const r = await fetch("/api/brands");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

/* ── Reviews — moved to shared component ReviewsSection ───── */

/* ── Form schema ─────────────────────────────────────────── */
const formSchema = z.object({
  name: z.string().min(2, "Введите ваше имя"),
  phone: z.string().refine(v => isPhoneValid(v), "Введите корректный номер (+7 ...)"),
  message: z.string().optional(),
});

/* ── Used Cars ───────────────────────────────────────────── */
interface HomeCar {
  id: string; mark: string; model: string; modification: string;
  year: number; price: number; run: number; color: string;
  availability: string; url: string; images: string[];
  bodyType?: string;
  extras?: string;
  complectation?: string;
  vin?: string;
}
async function fetchHomeCars(): Promise<HomeCar[]> {
  const r = await fetch("/api/cars/used");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  const all: HomeCar[] = json.ok ? json.data : [];
  return [...all].sort((a, b) => b.year - a.year || b.price - a.price).slice(0, 8);
}
function fmtPrice(p: number) { return p.toLocaleString("ru-RU") + " ₽"; }
function fmtRun(km: number) { return km < 1000 ? km + " км" : Math.round(km / 1000) + " тыс. км"; }

/* ── Featured Cars ───────────────────────────────────────── */
interface FeaturedCar {
  id: string; mark: string; model: string; modification: string; year: number;
  price: number; color: string; bodyType: string; maxDiscount: number; creditDiscount: number;
  tradeinDiscount: number; availability: string; url: string; images: string[]; dealer: string;
  extras?: string;
  complectation?: string;
  vin?: string;
}
async function fetchFeaturedCars(): Promise<FeaturedCar[]> {
  const r = await fetch("/api/cars/featured");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

/* ── Modal types ─────────────────────────────────────────── */
type ModalType = "callback" | "buy" | "service" | "tradein" | "credit" | "offer";
interface ModalConfig { title: string; subtitle: string; placeholder?: string; }
const modalConfigs: Record<ModalType, ModalConfig> = {
  callback: { title: "Заказать звонок",      subtitle: "Перезвоним в удобное для вас время" },
  buy:      { title: "Купить автомобиль",    subtitle: "Подберём оптимальный вариант для вас", placeholder: "Интересующая модель или бренд" },
  service:  { title: "Записаться на сервис", subtitle: "Онлайн-запись в удобное время",          placeholder: "Марка и модель автомобиля" },
  tradein:  { title: "Trade-in",             subtitle: "Оценим ваш автомобиль за 30 минут",       placeholder: "Марка, модель, год, пробег" },
  credit:   { title: "Кредит от 0%",         subtitle: "Одобрение от 15 банков-партнёров",        placeholder: "Интересующая модель" },
  offer:    { title: "Узнать подробнее",      subtitle: "Расскажем об актуальных предложениях",   placeholder: "Ваш вопрос" },
};

/* ── Modal component ─────────────────────────────────────── */
function Modal({ type, onClose }: { type: ModalType; onClose: () => void }) {
  const cfg = modalConfigs[type];
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", message: "" },
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(type, values);
    toast({ title: "Заявка отправлена", description: "Мы свяжемся с вами в ближайшее время." });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Sheet */}
        <motion.div
          className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top accent */}
          <div className="h-1 brand-gradient" />
          {/* Handle (mobile) */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="p-6 sm:p-8">
            <button onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <h2 className="text-2xl font-extrabold mb-1">{cfg.title}</h2>
            <p className="text-slate-500 text-sm mb-6">{cfg.subtitle}</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600 font-semibold">Имя</FormLabel>
                    <FormControl>
                      <Input placeholder="Ваше имя" {...field}
                        className="bg-slate-50 border-slate-200 rounded-xl h-12 focus-visible:ring-[#0070b8]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-600 font-semibold">Телефон</FormLabel>
                    <FormControl>
                      <Input placeholder="+7 (___) ___-__-__" {...field}
                        type="tel" inputMode="tel" maxLength={18}
                        onChange={e => field.onChange(formatPhone(e.target.value))}
                        className="bg-slate-50 border-slate-200 rounded-xl h-12 focus-visible:ring-[#0070b8]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {cfg.placeholder && (
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-600 font-semibold">Комментарий</FormLabel>
                      <FormControl>
                        <Textarea placeholder={cfg.placeholder} {...field}
                          className="bg-slate-50 border-slate-200 rounded-xl min-h-[80px] focus-visible:ring-[#0070b8] resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <Button type="submit" size="lg"
                  className="w-full brand-gradient border-0 text-white font-bold rounded-xl text-base hover:opacity-90 shadow-lg mt-2">
                  Отправить заявку
                </Button>
                <p className="text-[11px] text-slate-400 text-center leading-snug">
                  Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
                </p>
              </form>
            </Form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Utility components ──────────────────────────────────── */
const HomeNewsSection = () => {
  const { data: articles = [] } = useQuery({
    queryKey: ["home-news"],
    queryFn: fetchPublicNews,
    staleTime: 60 * 1000,
  });
  return (
    <section id="news" className="py-16 sm:py-20 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4 sm:px-6">
        <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-3">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Будьте в курсе</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Новости</h2>
          </div>
          <Link href="/news" className="flex items-center gap-2 text-[#0070b8] font-bold hover:gap-3 transition-all text-sm whitespace-nowrap">
            Все новости <ArrowRight className="w-4 h-4" />
          </Link>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.slice(0, 3).map((n, i) => (
            <FadeIn key={n.id} delay={i * 0.1}>
              <Link href={`/news/${n.slug}`} className="block bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
                <div className="h-44 sm:h-48 overflow-hidden relative">
                  {n.image && <img src={n.image} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />}
                  {n.category && <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#0070b8] text-white text-[11px] font-bold rounded-full">{n.category}</span>}
                </div>
                <div className="p-5">
                  {n.publishedAt && <p className="text-xs font-semibold text-slate-400 mb-2">{new Date(n.publishedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>}
                  <h3 className="font-extrabold text-base leading-snug mb-2 group-hover:text-[#0070b8] transition-colors">{n.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{n.excerpt ?? ""}</p>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}>
      {children}
    </motion.div>
  );
};

const StatCounter = ({ value, label, suffix = "", color = "text-[#0070b8]" }: { value: number; label: string; suffix?: string; color?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = value / (1800 / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, value]);
  return (
    <div ref={ref} className="bg-white/5 border border-white/10 p-5 sm:p-7 rounded-2xl hover:bg-white/10 transition-colors">
      <div className={`text-3xl sm:text-4xl font-black mb-1 ${color}`}>{count.toLocaleString("ru-RU")}{suffix}</div>
      <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider leading-snug">{label}</div>
    </div>
  );
};

const AboutStat = ({ value, suffix = "", label, sub, color, className = "" }: { value: number; suffix?: string; label: string; sub?: string; color: string; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = value / (1600 / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, value]);
  return (
    <div ref={ref} className={className}>
      <div className="text-3xl sm:text-4xl font-extrabold mb-1" style={{ color }}>
        {count.toLocaleString("ru-RU")}{suffix}
      </div>
      <div className="text-sm sm:text-base font-bold text-white mb-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
};

/* ── Offers data ─────────────────────────────────────────── */
const offers = [
  { brand: "OMODA C5",          label: "от 2 190 000 ₽", badge: "Горячее",    img: dealerOmoda,  tag: "Хит" },
  { brand: "HAVAL Jolion",      label: "от 2 350 000 ₽", badge: "Trade-in",   img: dealerHaval,  tag: "Выгода" },
  { brand: "JAECOO J7",         label: "от 2 450 000 ₽", badge: "В наличии",  img: dealerJaecoo, tag: "Новый" },
  { brand: "TENET Tingo",       label: "от 1 990 000 ₽", badge: "Кредит 0%",  img: dealerTenet,  tag: "Акция" },
  { brand: "МБ-Брянск",         label: "Премиум класс",  badge: "По запросу", img: dealerMb,     tag: "Премиум" },
];

/* ── Services data (split by category) ──────────────────── */
const serviceCategories = [
  {
    key: "sale",
    label: "Продажа",
    subtitle: "Новые и подержанные автомобили",
    cta: "Подобрать автомобиль",
    ctaModal: "buy" as ModalType,
    icon: Car,
    color: "#0070b8",
    items: [
      { icon: Car,            title: "Новые автомобили",       desc: "Официальные дилеры 9 брендов. Широкий выбор в наличии и под заказ.",          modal: "buy" as ModalType },
      { icon: RotateCcw,      title: "Автомобили с пробегом",  desc: "Проверенные авто с юридической чистотой и историей обслуживания.",             modal: "buy" as ModalType },
      { icon: ArrowLeftRight, title: "Trade-in",               desc: "Оценим ваш автомобиль за 30 минут и зачтём стоимость в счёт новой машины.",    modal: "tradein" as ModalType },
      { icon: Building2,      title: "Корпоративным клиентам", desc: "Специальные условия для юридических лиц, ИП и корпоративных автопарков.",      modal: "callback" as ModalType },
    ],
  },
  {
    key: "service",
    label: "Сервис",
    subtitle: "Техническое обслуживание и ремонт",
    cta: "Записаться на сервис",
    ctaModal: "service" as ModalType,
    icon: Wrench,
    color: "#87b63c",
    items: [
      { icon: Wrench,   title: "ТО и ремонт",     desc: "Официальное обслуживание по стандартам производителя. Только сертифицированные мастера.", modal: "service" as ModalType },
      { icon: Hammer,   title: "Кузовной ремонт", desc: "Восстановление геометрии кузова, рихтовка и покраска любой сложности.",                   modal: "service" as ModalType },
      { icon: Sparkles, title: "Детейлинг",       desc: "Химчистка салона, полировка кузова, нанесение защитных покрытий и бронирование плёнкой.",  modal: "callback" as ModalType },
      { icon: Package,  title: "Запасные части",  desc: "Оригинальные и сертифицированные запчасти для всех марок, которые мы обслуживаем.",        modal: "callback" as ModalType },
    ],
  },
  {
    key: "finance",
    label: "Финансирование",
    subtitle: "Кредит, лизинг и страхование",
    cta: "Рассчитать условия",
    ctaModal: "credit" as ModalType,
    icon: Banknote,
    color: "#0a5fa0",
    items: [
      { icon: CreditCard, title: "Автокредит",             desc: "Одобрение от 15 банков-партнёров. Ставки от 0% годовых, решение за 1 час.",       modal: "credit" as ModalType },
      { icon: FileText,   title: "Лизинг",                 desc: "Выгодное решение для бизнеса: НДС к вычету, ускоренная амортизация, гибкий график.", modal: "credit" as ModalType },
      { icon: Shield,     title: "ОСАГО и КАСКО",          desc: "Оформление полиса прямо в салоне. Лучшие тарифы от ведущих страховых компаний.",    modal: "callback" as ModalType },
      { icon: Users,      title: "Финансовые услуги F&I",  desc: "Комплексные страховые и финансовые продукты: GAP, защита от потери работы, ДМС.",   modal: "callback" as ModalType },
    ],
  },
];

/* ── UsedCarsSection ─────────────────────────────────────── */
function UsedCarsSection() {
  const { data: cars = [], isLoading } = useQuery({
    queryKey: ["home-used-cars"],
    queryFn: fetchHomeCars,
    staleTime: 5 * 60 * 1000,
  });
  const { isFavorite, isInCompare, toggleFavorite, toggleCompare } = useCarStorage();

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  const skeletons = Array.from({ length: 4 });

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-end justify-between mb-8 sm:mb-10"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-1.5 sm:mb-2">
              Авто с пробегом
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
              Свежие поступления
            </h2>
            <p className="text-slate-500 mt-1 text-sm">Проверенные авто с историей обслуживания</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-2">
              <button onClick={() => scroll("left")}
                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#0070b8] hover:text-[#0070b8] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => scroll("right")}
                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#0070b8] hover:text-[#0070b8] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <Link href="/cars"
              className="hidden sm:flex items-center gap-1.5 text-[#0070b8] font-bold text-sm hover:gap-2.5 transition-all">
              Все авто <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Carousel */}
        <div ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "none" }}>

          {isLoading
            ? skeletons.map((_, i) => (
                <div key={i} className="snap-start shrink-0 w-[240px] sm:w-[272px] bg-slate-50 rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-40 bg-slate-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-5 bg-slate-200 rounded w-2/3 mt-3" />
                  </div>
                </div>
              ))
            : cars.map((car) => {
                const stored = {
                  id: car.id, mark: car.mark, model: car.model, year: car.year, price: car.price,
                  run: car.run, color: car.color, bodyType: car.bodyType || "", modification: car.modification,
                  images: car.images, availability: car.availability, url: car.url, type: "used" as const,
                  extras: car.extras, complectation: car.complectation, vin: car.vin,
                };
                return (
                  <div key={car.id}
                    className="snap-start shrink-0 w-[240px] sm:w-[272px] bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-[#0070b8]/20 transition-all group cursor-pointer"
                    onClick={() => window.location.href = `/cars/${encodeURIComponent(car.id)}`}>

                    {/* Photo */}
                    <div className="relative h-40 bg-slate-100 overflow-hidden">
                      {car.images[0] ? (
                        <img src={car.images[0]} alt={`${car.mark} ${car.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Car className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      {car.availability && (
                        <span className="absolute top-2.5 left-2.5 bg-[#87b63c] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {car.availability}
                        </span>
                      )}
                      {car.images.length > 1 && (
                        <span className="absolute bottom-2 right-2.5 text-white text-[10px] font-bold opacity-80">
                          {car.images.length} фото
                        </span>
                      )}
                      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
                        <HomeActionBtn icon={<Heart className="w-3.5 h-3.5" />} active={isFavorite(car.id)} activeClass="bg-red-500 text-white" onClick={() => toggleFavorite(stored)} />
                        <HomeActionBtn icon={<Scale className="w-3.5 h-3.5" />} active={isInCompare(car.id)} activeClass="bg-[#0070b8] text-white" onClick={() => toggleCompare(stored)} />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="font-extrabold text-sm leading-snug text-slate-900 mb-0.5 group-hover:text-[#0070b8] transition-colors">
                        {car.mark} {car.model}
                      </p>
                      {car.modification && (
                        <p className="text-[11px] text-slate-400 leading-snug mb-2 line-clamp-1">{car.modification}</p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold mb-3">
                        <span>{car.year}</span>
                        <span className="text-slate-300">·</span>
                        <span>{fmtRun(car.run)}</span>
                        <span className="text-slate-300">·</span>
                        <span>{car.color}</span>
                      </div>
                      <p className="text-base font-extrabold text-slate-900">{fmtPrice(car.price)}</p>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Mobile CTA */}
        <div className="flex justify-center mt-5 sm:hidden">
          <Link href="/cars"
            className="flex items-center gap-2 bg-[#0070b8] text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#005a9a] transition-colors">
            Все автомобили с пробегом <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Swipe hint */}
        <p className="text-center text-xs text-slate-400 mt-2 sm:hidden">Листайте в сторону →</p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [carsDropdown, setCarsDropdown] = useState(false);
  const [modal, setModal] = useState<ModalType | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const yandexMapRef = useRef<YandexMapHandle>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const { favorites, compare, isFavorite, isInCompare, toggleFavorite, toggleCompare } = useCarStorage();
  const reducedMotion = useReducedMotion();

  // Play stagger only on first visit per session; repeat visits get instant show
  const heroAlreadySeen = React.useRef(
    typeof sessionStorage !== "undefined" && sessionStorage.getItem("homeHeroSeen") === "1"
  );
  React.useEffect(() => {
    if (!heroAlreadySeen.current) {
      sessionStorage.setItem("homeHeroSeen", "1");
    }
  }, []);

  const skipAnimation = reducedMotion || heroAlreadySeen.current;

  const heroHeadlineContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: skipAnimation ? 0 : 0.13,
        delayChildren: skipAnimation ? 0 : 0.22,
      },
    },
  };
  const heroHeadlineLine = {
    hidden: skipAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 38 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: skipAnimation ? 0 : 0.62, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
  };

  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()).then(j => j.data as Record<string, string>),
    staleTime: 5 * 60 * 1000,
  });
  const headerPhone = siteSettings?.header_phone ?? "+7 (4832) 77 77 70";
  const headerPhoneTel = "tel:+" + (siteSettings?.header_phone ?? "+7 (4832) 77 77 70").replace(/\D/g, "");

  const { data: apiLocations = [] } = useQuery({
    queryKey: ["public-locations"],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000,
  });

  const { data: apiNews = [] } = useQuery({
    queryKey: ["public-news"],
    queryFn: fetchPublicNews,
    staleTime: 5 * 60 * 1000,
  });

  const { data: apiBrands = [] } = useQuery({
    queryKey: ["public-brands"],
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000,
  });

  /* ── 4 unique locations on Yandex map ── */
  const dealerMapLocations = React.useMemo(() => {
    if (apiLocations.length === 0) return [];
    return apiLocations
      .filter(loc => loc.mapX != null && loc.mapY != null)
      .map((loc, idx) => ({
        id: loc.id,
        address: loc.address,
        short: loc.title,
        brands: loc.brands.filter(b => !b.isService).map(b => b.name),
        serviceBrands: loc.brands.filter(b => b.isService).map(b => b.name),
        lat: loc.mapX as number,
        lng: loc.mapY as number,
        color: DEALER_COLORS[idx % DEALER_COLORS.length],
        phone: loc.phone ?? undefined,
        hours: loc.hours ?? undefined,
      }));
  }, [apiLocations]);

  const dealerLocations = React.useMemo(() =>
    apiLocations.map((loc, i) => ({
      id: loc.id,
      address: loc.address,
      short: loc.title,
      brands: loc.brands.filter(b => !b.isService).map(b => b.name),
      serviceBrands: loc.brands.filter(b => b.isService).map(b => b.name),
      color: DEALER_COLORS[i % DEALER_COLORS.length],
      phone: loc.phone,
      hours: loc.hours,
    })), [apiLocations]);

  const organizationSchema = {
    "@type": "Organization",
    "name": "Дебрянск Авто",
    "url": "https://debryansk-auto.ru",
    "logo": "https://debryansk-auto.ru/favicon.svg",
    "description": "Группа компаний по продаже, сервису и финансированию автомобилей в Брянске.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Брянск",
      "addressRegion": "Брянская область",
      "addressCountry": "RU"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+7-4832-000-000",
      "contactType": "sales"
    },
    "sameAs": [
      "https://vk.com/debryanskavto",
      "https://t.me/debryanskavto"
    ]
  };

  const localBusinessSchema = {
    "@type": "AutoDealer",
    "name": "Дебрянск Авто",
    "image": "https://debryansk-auto.ru/opengraph.jpg",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "ул. Курганская, 10",
      "addressLocality": "Брянск",
      "addressRegion": "Брянская область",
      "postalCode": "241050",
      "addressCountry": "RU"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "53.243562",
      "longitude": "34.363408"
    },
    "telephone": "+7-4832-000-000",
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "opens": "09:00",
        "closes": "21:00"
      }
    ],
    "priceRange": "$$₽",
    "paymentAccepted": "Наличные, кредит"
  };

  const webSiteSchema = {
    "@type": "WebSite",
    "url": "https://debryansk-auto.ru",
    "name": "Дебрянск Авто",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://debryansk-auto.ru/cars?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };
  const favCount = favorites.length;
  const compCount = compare.length;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: featuredCars = [] } = useQuery<FeaturedCar[]>({
    queryKey: ["featured-cars"],
    queryFn: fetchFeaturedCars,
    staleTime: 5 * 60 * 1000,
  });

  const openModal = useCallback((type: ModalType) => setModal(type), []);
  const closeModal = useCallback(() => setModal(null), []);

  // Contacts form (inline, not modal)
  const contactForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", message: "" },
  });
  const { toast } = useToast();
  const onContactSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
    toast({ title: "Заявка отправлена", description: "Мы свяжемся с вами в ближайшее время." });
    contactForm.reset();
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollCarousel = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans text-slate-900">

      <SEO
        title="Дебрянск Авто — Территория Автомобилей"
        description="Группа компаний 9 брендов в Брянске. Продажа, сервис и финансирование с 2011 года. Новые автомобили и авто с пробегом."
        canonical="/"
        jsonLd={[
          organizationSchema,
          localBusinessSchema,
          webSiteSchema
        ]}
        breadcrumbs={[
          { name: "Главная", url: "/" },
        ]}
      />

      {/* ── Modal ──────────────────────────────────────────── */}
      {modal && modal !== "tradein" && <Modal type={modal} onClose={closeModal} />}
      {modal === "tradein" && <TradeInModal onClose={closeModal} />}

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111317] text-white">
        {/* Top info bar */}
        <div className="border-b border-white/[0.07]">
          <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-10">
            <div className="flex items-center gap-4 text-[11px] font-medium text-white/40">
              <span>г. Брянск</span>
            </div>
            <div className="flex items-center gap-3">
              <a href={headerPhoneTel}
                className="text-xs sm:text-sm font-bold text-white/70 hover:text-white transition-colors">
                {headerPhone}
              </a>
              <Button size="sm"
                className="h-7 sm:h-8 px-3 sm:px-4 brand-gradient border-0 text-white font-bold rounded-lg text-[11px] sm:text-xs hover:opacity-90"
                onClick={() => openModal("callback")}>
                Заказать звонок
              </Button>
            </div>
          </div>
        </div>

        {/* Main nav row */}
        <div className="container mx-auto px-4 sm:px-6 flex items-center gap-4 sm:gap-6 h-[3.75rem]">
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="shrink-0 relative h-8 flex items-center overflow-hidden"
            animate={{ width: scrolled ? 40 : 140 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <motion.img
              src={miniLogo}
              alt="Д"
              className="h-8 w-8 object-contain absolute left-0"
              animate={{ opacity: scrolled ? 1 : 0, scale: scrolled ? 1 : 0.6 }}
              transition={{ duration: 0.25 }}
            />
            <motion.img
              src={logoWhiteSvg}
              alt="Дебрянск Авто"
              className="h-7 sm:h-8 w-auto"
              animate={{ opacity: scrolled ? 0 : 1, x: scrolled ? -10 : 0 }}
              transition={{ duration: 0.25 }}
            />
          </motion.button>

          <nav className="hidden lg:flex items-center gap-0.5 ml-2">
            {/* Автомобили dropdown */}
            <div className="relative" onMouseLeave={() => setCarsDropdown(false)}>
              <button
                onMouseEnter={() => setCarsDropdown(true)}
                onClick={() => setCarsDropdown(v => !v)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
                Автомобили <ChevronDown className={`w-3.5 h-3.5 transition-transform ${carsDropdown ? "rotate-180" : ""}`} />
              </button>
              {carsDropdown && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#1a1d23] border border-white/10 rounded-xl shadow-xl py-1 z-50">
                  <Link href="/new-cars" onClick={() => setCarsDropdown(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/8 transition-colors">
                    <Car className="w-4 h-4 text-[#0070b8]" /> Новые автомобили
                  </Link>
                  <Link href="/cars" onClick={() => setCarsDropdown(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/8 transition-colors">
                    <RotateCcw className="w-4 h-4 text-[#0070b8]" /> С пробегом
                  </Link>
                </div>
              )}
            </div>
            {[["О группе","about","/about"],["Дилеры","dealers","#dealers"],["Услуги","services","/service"],["Выкуп","buyout","/buyout"],["Контакты","contacts","/contacts"]].map(([label, id, href]) => (
              href.startsWith("/") ? (
                <Link key={id} href={href}
                  className="px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
                  {label}
                </Link>
              ) : (
                <button key={id} onClick={() => scrollTo(id)}
                  className="px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
                  {label}
                </button>
              )
            ))}
            <Link href="/vacancies"
              className="px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
              Вакансии
            </Link>
            <Link href="/news"
              className="px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
              Новости
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 mr-3">
            <Link href="/favorites"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
              <Heart className="w-4 h-4" />
              <span>Избранное</span>
              {favCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{favCount}</span>
              )}
            </Link>
            <Link href="/compare"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
              <Scale className="w-4 h-4" />
              <span>Сравнить</span>
              {compCount > 0 && (
                <span className="bg-[#0070b8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{compCount}</span>
              )}
            </Link>
          </div>

          <button className="lg:hidden p-1.5 text-white/60 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.07] bg-[#111317]">
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <Link href="/new-cars" onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors flex items-center gap-2">
                  <Car className="w-4 h-4 text-[#0070b8]" /> Новые автомобили
                </Link>
                <Link href="/cars" onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#0070b8]" /> Автомобили с пробегом
                </Link>
                {[["О группе","about","/about"],["Дилеры","dealers","#dealers"],["Услуги","services","/service"],["Выкуп","buyout","/buyout"],["Контакты","contacts","/contacts"]].map(([label, id, href]) => (
                  href.startsWith("/") ? (
                    <Link key={id} href={href}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                      {label}
                    </Link>
                  ) : (
                    <button key={id} onClick={() => scrollTo(id)}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors">
                      {label}
                    </button>
                  )
                ))}
                <Link href="/vacancies"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                  Вакансии
                </Link>
                <Link href="/news"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                  Новости
                </Link>
                <Link href="/favorites"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Избранное {favCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{favCount}</span>}
                </Link>
                <Link href="/compare"
                  className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block flex items-center gap-2">
                  <Scale className="w-4 h-4" /> Сравнить {compCount > 0 && <span className="bg-[#0070b8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{compCount}</span>}
                </Link>
                <div className="pt-3 flex items-center justify-between">
                  <a href={headerPhoneTel} className="text-base font-bold text-[#0070b8]">{headerPhone}</a>
                  <div className="flex gap-2">
                    <a href="#" className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center hover:bg-[#0070b8] transition-colors">
                      <SiVk size={14} />
                    </a>
                    <a href="#" className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center hover:bg-[#0070b8] transition-colors">
                      <SiTelegram size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero — full screen ─────────────────────────────── */}
      <section className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: "100dvh" }}>
        {/* Background */}
        <div className="absolute inset-0">
          <picture>
            <source media="(max-width: 640px)" srcSet={heroMobile} />
            <img
              src={heroDynamic}
              alt="Автосалон Дебрянск Авто"
              className="w-full h-full object-cover object-center"
              loading="eager"
              decoding="async"
              onError={e => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1567818735868-e71b99932e29?auto=format&fit=crop&q=85&w=1920";
              }}
            />
          </picture>
          {/* Dark overlay — heavier at top (under header) and bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Centred content */}
        <div className="relative z-10 w-full pt-[6rem] pb-8 sm:pt-[5.5rem] sm:pb-0">
          <div className="container mx-auto px-4 sm:px-6 flex flex-col items-center text-center">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase text-white/70 mb-5 sm:mb-7 border border-white/15"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#87b63c] shrink-0 animate-pulse" />
              Группа компаний
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroHeadlineContainer}
              initial="hidden"
              animate="visible"
              className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white mb-4 sm:mb-5 max-w-3xl"
            >
              <span className="block overflow-hidden sm:inline-block">
                <motion.span variants={heroHeadlineLine} className="inline-block sm:block">
                  Дебрянск Авто
                </motion.span>
              </span>{" "}
              <span className="block overflow-hidden sm:inline-block">
                <motion.span variants={heroHeadlineLine} className="inline-block sm:block">
                  <span className="brand-gradient-text">Территория Автомобилей.</span>
                </motion.span>
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-sm sm:text-base md:text-lg text-white/55 leading-relaxed max-w-md font-medium mb-8 sm:mb-10"
            >
              {apiBrands.length} брендов · 4 дилерских центра · Брянск.<br className="hidden sm:block" />{" "}
              Продажа, сервис и финансирование с 2011 года.
            </motion.p>

            {/* Quick-action tiles */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.55 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-2xl"
            >
              {[
                { icon: Car,            label: "Новые авто",    sub: "В наличии и под заказ", type: null, href: "/new-cars" },
                { icon: RotateCcw,      label: "С пробегом",   sub: "Проверенные авто",       type: null, href: "/cars" },
                { icon: Wrench,         label: "Сервис",        sub: "Запись онлайн",          type: null, href: "/service" },
                { icon: Banknote,       label: "Выкуп авто",   sub: "Честная цена",           type: null, href: "/buyout" },
              ].map(({ icon: Icon, label, sub, type, href }) => {
                const cls = "bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-white/18 hover:border-white/28 transition-all group active:scale-[0.98]";
                const inner = (
                  <>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#0070b8] mb-2 group-hover:text-[#87b63c] transition-colors" />
                    <div className="font-bold text-white text-xs sm:text-sm leading-tight">{label}</div>
                    <div className="text-white/40 text-[10px] sm:text-xs mt-0.5 leading-snug">{sub}</div>
                  </>
                );
                return href
                  ? <Link key={label} href={href} className={cls}>{inner}</Link>
                  : <button key={label} onClick={() => type && openModal(type)} className={cls}>{inner}</button>;
              })}
            </motion.div>

          </div>
        </div>

        {/* Scroll cue */}
        <motion.div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-white/25"
          animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
          <ChevronRight className="rotate-90 w-5 h-5" />
        </motion.div>
      </section>

      {/* ── Category tab bar ───────────────────────────────── */}
      <section className="bg-white border-b border-slate-100 sticky top-[6.25rem] z-40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex overflow-x-auto gap-0" style={{ scrollbarWidth: "none" }}>
            {[
              { label: "Новые авто",    modal: null,                     href: "/new-cars" },
              { label: "С пробегом",   modal: null,                     href: "/cars" },
              { label: "Сервис",       modal: null,                     href: "/service" },
            ].map(({ label, modal, href }) => {
              const cls = "shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-slate-500 hover:text-[#0070b8] hover:border-b-2 hover:border-[#0070b8] border-b-2 border-transparent transition-all whitespace-nowrap";
              return href
                ? <Link key={label} href={href} className={cls}>{label}</Link>
                : <button key={label} onClick={() => modal && openModal(modal)} className={cls}>{label}</button>;
            })}
          </div>
        </div>
      </section>

      {/* ── Brand logo tiles ───────────────────────────────── */}
      <section id="brands" className="py-12 sm:py-16 md:py-20 bg-white border-b border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6">
            {apiBrands.map((b, i) => {
              const brandHref = b.slug && b.slug !== "s-probegom" ? `/brands/${b.slug}` : (b.websiteUrl ?? "#");
              const isExternal = !b.slug || b.slug === "s-probegom";
              return (
                <FadeIn key={`${b.name}-${b.subName ?? i}`} delay={i * 0.05}>
                  <a
                    href={brandHref}
                    {...(isExternal && b.websiteUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group relative w-full block rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1"
                    style={{ aspectRatio: "5/3" }}
                  >
                    {/* Card base */}
                    <div className="absolute inset-0 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] border border-slate-200/60 group-hover:shadow-[0_12px_40px_rgba(0,112,184,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] group-hover:border-[#0070b8]/20 transition-all duration-500" />
                    {/* Gradient sheen */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30" />
                    {/* Hover glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0070b8]/5 via-transparent to-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    {/* Top accent line */}
                    <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#0070b8]/30 to-transparent rounded-full opacity-60 group-hover:opacity-100 group-hover:via-[#0070b8]/50 transition-all duration-500" />
                    {/* Content */}
                    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 sm:p-5">
                      {b.logoUrl ? (
                        <>
                          <img
                            src={b.logoUrl}
                            alt={b.name}
                            className="w-full object-contain transition-all duration-500 group-hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.08)]"
                            style={{ maxWidth: "85%", maxHeight: "70%" }}
                            loading="lazy"
                            decoding="async"
                            onError={e => { e.currentTarget.style.display = "none"; }}
                          />
                          {b.subName && (
                            <span className="mt-1 text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-500 group-hover:text-[#0070b8] transition-colors duration-300">
                              {b.subName}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <Car className="w-8 h-8 sm:w-10 sm:h-10 text-[#0070b8]/70 mb-1.5 group-hover:text-[#0070b8] group-hover:scale-110 transition-all duration-300" />
                          <span className="text-xs sm:text-sm font-bold text-slate-600 group-hover:text-[#0070b8] text-center leading-tight transition-colors duration-300">{b.name}</span>
                        </div>
                      )}
                      {/* Arrow */}
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#0070b8]/0 group-hover:bg-[#0070b8]/10 flex items-center justify-center transition-all duration-300">
                        <ArrowUpRight className="w-4 h-4 text-[#0070b8] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0" />
                      </div>
                      {/* Service badge */}
                      {b.isServiceOnly && (
                        <span className="absolute bottom-2.5 left-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#0070b8] bg-[#0070b8]/10 border border-[#0070b8]/20 rounded-md px-1.5 py-0.5 leading-none">
                          Сервис
                        </span>
                      )}
                      {/* Car count badge */}
                      {!b.isServiceOnly && !!b.carCount && b.carCount > 0 && (
                        <span className="absolute bottom-2.5 right-3 text-[9px] sm:text-[10px] font-semibold text-slate-400 group-hover:text-[#0070b8] transition-colors duration-300 leading-none">
                          {b.carCount} авто
                        </span>
                      )}
                    </div>
                  </a>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Offers carousel ────────────────────────────────── */}
      <section className="py-12 sm:py-16 md:py-20 bg-slate-50">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="flex items-end justify-between mb-8 sm:mb-10">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-1.5 sm:mb-2">Актуально сейчас</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Спецпредложения</h2>
            </div>
            <div className="hidden sm:flex gap-2">
              <button onClick={() => scrollCarousel("left")}
                className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#0070b8] hover:text-[#0070b8] transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => scrollCarousel("right")}
                className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#0070b8] hover:text-[#0070b8] transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </FadeIn>

          <div ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {featuredCars.length > 0 ? featuredCars.map((car) => {
              const img = car.images.filter(Boolean)[0] ?? "";
              const salePrice = car.maxDiscount > 0 ? car.price - car.maxDiscount : car.price;
              const stored = {
                id: car.id, mark: car.mark, model: car.model, year: car.year, price: car.price,
                run: 0, color: car.color, bodyType: car.bodyType, modification: car.modification,
                images: car.images, availability: car.availability, url: car.url, type: "new" as const,
                extras: car.extras, complectation: car.complectation, vin: car.vin,
              };
              return (
                <div key={car.id}
                  className="snap-start shrink-0 w-[260px] sm:w-[300px] bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer"
                  onClick={() => window.location.href = `/new-cars/${encodeURIComponent(car.id)}`}>
                  <div className="relative h-40 sm:h-44 overflow-hidden bg-slate-100">
                    {img ? (
                      <img src={img} alt={`${car.mark} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Car className="w-12 h-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                    {car.maxDiscount > 0 && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-[#0070b8]/90">
                        Скидка {fmtPrice(car.maxDiscount)}
                      </span>
                    )}
                    <span className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 rounded-full text-[11px] font-bold text-slate-800">
                      {car.availability}
                    </span>
                    <div className="absolute top-14 right-3 flex flex-col gap-1.5 z-10">
                      <HomeActionBtn icon={<Heart className="w-3.5 h-3.5" />} active={isFavorite(car.id)} activeClass="bg-red-500 text-white" onClick={() => toggleFavorite(stored)} />
                      <HomeActionBtn icon={<Scale className="w-3.5 h-3.5" />} active={isInCompare(car.id)} activeClass="bg-[#0070b8] text-white" onClick={() => toggleCompare(stored)} />
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-extrabold text-sm leading-tight drop-shadow">
                        {car.mark} {car.model}
                      </p>
                      <p className="text-white/70 text-[11px]">{car.dealer} · {car.year}</p>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    {car.maxDiscount > 0 ? (
                      <>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">от</span>
                          <span className="text-[#0070b8] font-extrabold text-lg">{fmtPrice(salePrice)}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-through mb-3">{fmtPrice(car.price)}</p>
                      </>
                    ) : (
                      <p className="text-[#0070b8] font-extrabold text-lg mb-3">{fmtPrice(car.price)}</p>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); openModal("offer"); }}
                      className="w-full py-2 sm:py-2.5 rounded-xl border-2 border-slate-200 text-xs sm:text-sm font-bold text-slate-600 hover:border-[#0070b8] hover:text-[#0070b8] transition-colors">
                      Оставить заявку
                    </button>
                  </div>
                </div>
              );
            }) : offers.map((o, i) => (
              <div key={i}
                className="snap-start shrink-0 w-[260px] sm:w-[300px] bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer"
                onClick={() => openModal("offer")}>
                <div className="relative h-40 sm:h-44 overflow-hidden">
                  <img src={o.img} alt={o.brand} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-[#0070b8]/85">{o.tag}</span>
                  <span className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 rounded-full text-[11px] font-bold text-slate-800">{o.badge}</span>
                </div>
                <div className="p-4 sm:p-5">
                  <h3 className="font-extrabold text-base sm:text-lg mb-1 leading-tight">{o.brand}</h3>
                  <p className="text-[#0070b8] font-bold text-base sm:text-lg mb-4">{o.label}</p>
                  <button className="w-full py-2 sm:py-2.5 rounded-xl border-2 border-slate-200 text-xs sm:text-sm font-bold text-slate-600 hover:border-[#0070b8] hover:text-[#0070b8] transition-colors">
                    Узнать подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile swipe hint */}
          <p className="text-center text-xs text-slate-400 mt-3 sm:hidden">Листайте в сторону →</p>
        </div>
      </section>

      {/* ── Used Cars showcase ─────────────────────────────── */}
      <UsedCarsSection />

      {/* ── About ── Apple Bento Glass ─────────────────────── */}
      <section id="about" className="relative overflow-hidden py-20 sm:py-28 md:py-32">
        {/* Градиентный темный фон */}
        <div className="absolute inset-0 bg-[#0a0c10]">
          <div className="absolute inset-0 opacity-40"
            style={{
              background: `
                radial-gradient(ellipse 60% 50% at 20% 80%, rgba(0,112,184,0.15) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 80% 20%, rgba(135,182,60,0.10) 0%, transparent 70%),
                radial-gradient(ellipse 40% 60% at 50% 50%, rgba(0,112,184,0.05) 0%, transparent 60%)
              `
            }} />
          <div className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(10,12,16,0) 0%, rgba(0,112,184,0.03) 50%, rgba(10,12,16,0) 100%)`
            }} />
        </div>

        {/* Сетка сверху */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-14 items-center">

            {/* Левая колонка — логотип + слоган + описание */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={logoWhiteSvg}
                alt="Дебрянск Авто"
                className="h-[47px] sm:h-[78px] w-auto mb-6 sm:mb-7"
              />
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-4 sm:mb-5 text-white"
                style={{ textShadow: '0 2px 30px rgba(0,0,0,0.6)' }}>
                Территория автомобилей
                <br />
                <span className="text-[#87b63c]">в Брянске с 2011 года</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                Группа компаний с {apiBrands.length} официальными брендами.
                Продажа новых автомобилей, авто с пробегом,
                сервис и финансирование — всё в одном холдинге.
              </p>
              <button
                onClick={() => openModal("callback")}
                className="inline-flex items-center gap-2 brand-gradient text-white font-bold rounded-xl px-6 py-3 text-sm hover:opacity-90 transition-opacity"
              >
                Связаться с нами <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Правая колонка — Apple Glass tiles */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Широкая карточка — 15 лет */}
                <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                  bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                  backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,112,184,0.12) 0%, transparent 60%)` }} />
                  <div className="relative p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#0070b8]/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[#0070b8]" />
                      </div>
                      <div className="text-sm text-slate-400">С 2011 года в Брянске</div>
                    </div>
                    <div className="text-4xl sm:text-5xl font-extrabold text-white mb-2">
                      15<span className="text-[#0070b8]">+</span>
                    </div>
                    <div className="text-base font-bold text-white">лет на рынке</div>
                  </div>
                </div>

                {/* Две узкие карточки */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                    bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                    backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(135,182,60,0.12) 0%, transparent 60%)` }} />
                    <div className="relative p-5 sm:p-6">
                      <div className="w-10 h-10 rounded-xl bg-[#87b63c]/20 flex items-center justify-center mb-3">
                        <Car className="w-5 h-5 text-[#87b63c]" />
                      </div>
                      <div className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
                        25 000<span className="text-[#87b63c]">+</span>
                      </div>
                      <div className="text-sm font-bold text-white">автомобилей</div>
                      <div className="text-xs text-slate-400">продано за 15 лет</div>
                    </div>
                  </div>

                  <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                    bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                    backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,112,184,0.12) 0%, transparent 60%)` }} />
                    <div className="relative p-5 sm:p-6">
                      <div className="w-10 h-10 rounded-xl bg-[#0070b8]/20 flex items-center justify-center mb-3">
                        <Sparkles className="w-5 h-5 text-[#0070b8]" />
                      </div>
                      <div className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
                        9
                      </div>
                      <div className="text-sm font-bold text-white">брендов</div>
                      <div className="text-xs text-slate-400">официально</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────── */}
      <section id="services" className="py-16 sm:py-24 md:py-32 bg-[#f8f9fb]">
        <div className="container mx-auto px-4 sm:px-6">

          {/* Section header */}
          <FadeIn className="mb-10 sm:mb-14">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2 sm:mb-3">Что мы предлагаем</p>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                Наши услуги
              </h2>
              <p className="text-sm sm:text-base text-slate-500 max-w-sm sm:text-right leading-relaxed">
                Всё для вашего автомобиля —<br className="hidden sm:block" /> от покупки до обслуживания и финансирования.
              </p>
            </div>
          </FadeIn>

          {/* 3-column category panels */}
          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {serviceCategories.map((cat, ci) => (
              <FadeIn key={cat.key} delay={ci * 0.1} className="flex flex-col">
                <div className="bg-white rounded-3xl overflow-hidden flex flex-col h-full shadow-sm border border-slate-100">

                  {/* Category header band */}
                  <div className="px-6 pt-6 pb-5"
                    style={{ borderBottom: `1px solid ${cat.color}18` }}>
                    <div className="flex items-center gap-3.5 mb-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + "14" }}>
                        <cat.icon className="w-6 h-6" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{cat.label}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{cat.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Service items list */}
                  <div className="flex-1 flex flex-col gap-0 divide-y divide-slate-50">
                    {cat.items.map((item, ii) => (
                      <button
                        key={ii}
                        onClick={() => openModal(item.modal)}
                        className="group flex items-start gap-3.5 px-5 py-4 text-left hover:bg-slate-50 transition-colors active:scale-[0.99]"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: cat.color + "14" }}>
                          <item.icon className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-900 leading-snug mb-0.5">{item.title}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 mt-1 text-slate-200 group-hover:text-slate-400 transition-colors" />
                      </button>
                    ))}
                  </div>

                  {/* Category CTA */}
                  <div className="p-5 pt-4">
                    <button
                      onClick={() => openModal(cat.ctaModal)}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{ background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}cc 100%)` }}
                    >
                      {cat.cta}
                    </button>
                  </div>

                </div>
              </FadeIn>
            ))}
          </div>

          {/* CTA banner */}
          <FadeIn delay={0.35} className="mt-6 sm:mt-8">
            <div className="bg-[#0d0f14] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div>
                <p className="font-extrabold text-white text-lg sm:text-xl mb-1">Не нашли нужную услугу?</p>
                <p className="text-slate-400 text-sm">Позвоните или оставьте заявку — ответим в течение 5 минут</p>
              </div>
              <Button
                className="brand-gradient text-white font-bold rounded-2xl px-8 py-3 hover:opacity-90 shrink-0 border-0 text-sm"
                onClick={() => openModal("callback")}
              >
                Оставить заявку
              </Button>
            </div>
          </FadeIn>

        </div>
      </section>

      {/* ── Territory of centers ───────────────────────────── */}
      <section id="dealers" className="py-16 sm:py-24 md:py-32 bg-slate-50">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2 sm:mb-3">Где мы находимся</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Территория центров в городе</h2>
            <p className="text-slate-500 mt-2 text-sm sm:text-base">4 локации в Брянске — более 11 торгово-сервисных точек</p>
          </FadeIn>

          <div ref={mapSectionRef} className="w-full h-[400px] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
            <YandexMap ref={yandexMapRef} locations={dealerMapLocations} />
          </div>

          {/* Dealer list below map */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 sm:mt-10">
            {dealerLocations.map((loc) => {
              const isActive = activeCardId === loc.id;
              return (
                <FadeIn key={loc.id} delay={loc.id * 0.08}>
                  <button
                    onClick={() => {
                      setActiveCardId(loc.id);
                      yandexMapRef.current?.openLocation(loc.id);
                      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`w-full text-left bg-white rounded-2xl border p-4 sm:p-5 transition-all ${
                      isActive
                        ? "border-[#0070b8] shadow-[0_0_0_2px_rgba(0,112,184,0.18)] shadow-md"
                        : "border-slate-100 hover:shadow-md hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-sm transition-transform ${isActive ? "scale-110" : ""}`}
                        style={{ background: loc.color }}>
                        {loc.id}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 leading-snug">{loc.short}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{loc.address}</p>
                        {loc.hours && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            {loc.hours}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {loc.brands.map(b => (
                            <span key={b} className="inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-700">
                              {b}
                            </span>
                          ))}
                          {(loc.serviceBrands ?? []).map(b => (
                            <span key={`svc-${b}`} className="inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-orange-100 text-orange-700">
                              {b} Сервис
                            </span>
                          ))}
                        </div>
                        {loc.phone && (
                          <a href={phoneHref(loc.phone)}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0070b8] hover:text-[#0058a0] transition-colors mt-3">
                            <Phone className="w-3.5 h-3.5" />
                            {normalizePhone(loc.phone)}
                          </a>
                        )}
                      </div>
                    </div>
                  </button>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Contacts ───────────────────────────────────────── */}
      <section id="contacts" className="relative overflow-hidden py-20 sm:py-28 md:py-32">
        <div className="absolute inset-0 bg-[#0a0c10]">
          <div className="absolute inset-0 opacity-40"
            style={{
              background: `
                radial-gradient(ellipse 60% 50% at 80% 80%, rgba(0,112,184,0.15) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 20% 20%, rgba(135,182,60,0.10) 0%, transparent 70%),
                radial-gradient(ellipse 40% 60% at 50% 50%, rgba(0,112,184,0.05) 0%, transparent 60%)
              `
            }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0c10]/80" />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6">
          <motion.div
            className="mb-10 sm:mb-14"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-2 sm:mb-3">Обратная связь</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">Свяжитесь с нами</h2>
          </motion.div>

          <div className="lg:grid lg:grid-cols-2 gap-10">
            {/* Left — Contact info cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex flex-col gap-3 sm:gap-4 mb-8 lg:mb-0">
                {/* Phone card */}
                <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                  bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                  backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,112,184,0.12) 0%, transparent 60%)` }} />
                  <div className="relative p-6 sm:p-8 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#0070b8]/20 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-[#0070b8]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Телефон</div>
                      <a href={headerPhoneTel} className="text-xl sm:text-2xl font-extrabold text-white hover:text-[#0070b8] transition-colors">{headerPhone}</a>
                    </div>
                  </div>
                </div>

                {/* Hours card */}
                <div className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                  bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                  backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(135,182,60,0.12) 0%, transparent 60%)` }} />
                  <div className="relative p-6 sm:p-8 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#87b63c]/20 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-[#87b63c]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1">Режим работы</div>
                      <div className="text-xl sm:text-2xl font-extrabold text-white">Ежедневно 9:00–21:00</div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>

            {/* Right — Form in glass card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="relative group overflow-hidden rounded-3xl border border-white/[0.12]
                bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
                backdrop-blur-xl hover:border-white/[0.18] transition-all duration-500"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(135,182,60,0.12) 0%, transparent 60%)` }} />
              <div className="relative p-6 sm:p-8 md:p-10">
                <h3 className="text-lg sm:text-xl font-extrabold text-white mb-5 sm:mb-6">Оставить заявку</h3>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-3 sm:space-y-4">
                    <FormField control={contactForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm font-semibold">Имя</FormLabel>
                        <FormControl>
                          <Input placeholder="Ваше имя" {...field}
                            className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 rounded-xl h-11 sm:h-12 focus-visible:ring-[#0070b8] focus-visible:ring-offset-0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={contactForm.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm font-semibold">Телефон</FormLabel>
                        <FormControl>
                          <Input placeholder="+7 (___) ___-__-__" {...field}
                            type="tel" inputMode="tel" maxLength={18}
                            onChange={e => field.onChange(formatPhone(e.target.value))}
                            className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 rounded-xl h-11 sm:h-12 focus-visible:ring-[#0070b8] focus-visible:ring-offset-0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={contactForm.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm font-semibold">Сообщение (необязательно)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Ваш вопрос или пожелание" {...field}
                            className="bg-white/10 border-white/15 text-white placeholder:text-slate-500 rounded-xl min-h-[80px] sm:min-h-[90px] focus-visible:ring-[#0070b8] focus-visible:ring-offset-0 resize-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" size="lg" data-testid="btn-submit-contact"
                      className="w-full brand-gradient border-0 text-white font-bold rounded-xl text-base hover:opacity-90 shadow-md">
                      Жду звонка
                    </Button>
                    <p className="text-[11px] text-slate-500 text-center leading-snug">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности</p>
                  </form>
                </Form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Reviews ─────────────────────────────────────────── */}
      <ReviewsSection />

      {/* ── News ───────────────────────────────────────────── */}
      <HomeNewsSection />

      {/* ── Newsletter ─────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-slate-50 border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Подпишитесь на рассылку</h2>
              <p className="text-slate-500 mb-6 text-sm sm:text-base">Узнавайте первыми об акциях, новинках и специальных предложениях</p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Ваш email"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0070b8]/50 transition-colors"
                />
                <Button className="brand-gradient border-0 text-white font-bold rounded-xl px-6 hover:opacity-90 shrink-0">
                  Подписаться
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-snug">
                Нажимая кнопку, вы соглашаетесь на получение рассылки и обработку персональных данных
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-[#0d0f14] text-slate-400 pt-12 sm:pt-14 pb-8 border-t border-white/[0.07]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <img src={logoPng} alt="Дебрянск Авто" className="h-8 sm:h-9 w-auto mb-4 sm:mb-5 opacity-50 hover:opacity-100 transition-opacity" />
              <p className="text-sm text-slate-500 mb-4 sm:mb-5 leading-relaxed">
                Территория Автомобилей. Группа компаний с 9 брендами в Брянске с 2011 года.
              </p>
              <div className="flex gap-2.5">
                <a href="#" aria-label="ВКонтакте" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#0070b8] transition-colors group">
                  <SiVk className="text-white/40 group-hover:text-white" size={15} />
                </a>
                <a href="#" aria-label="Telegram" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#0070b8] transition-colors group">
                  <SiTelegram className="text-white/40 group-hover:text-white" size={15} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Каталог</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/new-cars" className="hover:text-[#0070b8] transition-colors">Новые автомобили</a></li>
                <li><a href="/cars" className="hover:text-[#0070b8] transition-colors">Автомобили с пробегом</a></li>
                <li><a href="/buyout" className="hover:text-[#0070b8] transition-colors">Выкуп и комиссия</a></li>
                <li><a href="/compare" className="hover:text-[#0070b8] transition-colors">Сравнение авто</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Услуги</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/service" className="hover:text-[#0070b8] transition-colors">Сервис и ТО</a></li>
                <li><a href="/about" className="hover:text-[#0070b8] transition-colors">О группе</a></li>
                {["CHERY", "OMODA", "JAECOO", "HAVAL"].map(b => (
                  <li key={b}>
                    <a href={`/new-cars?brand=${encodeURIComponent(b)}`} className="hover:text-[#0070b8] transition-colors">{b}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Компания</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/contacts" className="hover:text-[#0070b8] transition-colors">Контакты</a></li>
                <li><a href="/vacancies" className="hover:text-[#0070b8] transition-colors">Вакансии</a></li>
                <li><a href="/news" className="hover:text-[#0070b8] transition-colors">Новости</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} Дебрянск Авто — Территория Автомобилей</p>
            <a href="/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</a>
          </div>
        </div>
      </footer>

      <ChatWidget onOpenCallback={() => setModal("callback")} />
    </div>
  );
}
