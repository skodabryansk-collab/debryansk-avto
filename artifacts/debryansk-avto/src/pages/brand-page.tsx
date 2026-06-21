import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Phone, Clock, ArrowRight, Car, Wrench,
  ChevronLeft, ChevronRight, Calendar, Palette,
  Sparkles, CheckCircle, ExternalLink, X, User,
  Shield, Settings, Star, ChevronDown, Navigation,
} from "lucide-react";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { normalizePhone, phoneHref } from "@/lib/normalizePhone";

/* ─── Types ──────────────────────────────────────────────── */
interface BrandPageData {
  brand: {
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    bgColor: string | null;
    subName: string | null;
    isServiceOnly: boolean;
  };
  content: {
    description: string | null;
    serviceText: string | null;
    promoText: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
  } | null;
  locations: Array<{
    id: number;
    title: string;
    address: string;
    phone: string | null;
    hours: string | null;
    map_x: number | null;
    map_y: number | null;
    is_service: boolean;
  }>;
  cars: Array<{
    id: string;
    mark: string;
    model: string;
    modification: string;
    complectation: string;
    year: number;
    price: number;
    color: string;
    body_type: string;
    availability: string;
    url: string;
    images: string[];
    dealer: string;
    max_discount: number;
    credit_discount: number;
    tradein_discount: number;
  }>;
  news: Array<{
    id: number;
    title: string;
    excerpt: string | null;
    category: string | null;
    image: string | null;
    published_at: string | null;
    slug: string;
  }>;
}

async function fetchBrandPage(slug: string): Promise<BrandPageData> {
  const r = await fetch(`/api/brands/${slug}`);
  if (!r.ok) throw new Error("Brand not found");
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Error");
  return json.data as BrandPageData;
}

/* ─── Static HAVAL model catalog ────────────────────────── */
const HAVAL_SLUGS = ["haval-city", "haval-pro"];

const HAVAL_CATALOG: Array<{ name: string; bodyType: string; photo: string; noBrand?: boolean }> = [
  { name: "M6",                bodyType: "Кроссовер",      photo: "/brands/haval/m6.png" },
  { name: "Jolion",            bodyType: "Кроссовер",      photo: "/brands/haval/jolion.png" },
  { name: "Dargo",             bodyType: "Внедорожник",    photo: "/brands/haval/dargo.png" },
  { name: "Dargo X",           bodyType: "Внедорожник",    photo: "/brands/haval/dargo_x.png" },
  { name: "F7",                bodyType: "Кроссовер",      photo: "/brands/haval/f7.png" },
  { name: "F7x",               bodyType: "Купе-кроссовер", photo: "/brands/haval/f7x.png" },
  { name: "Poer",              bodyType: "Пикап",          photo: "/brands/haval/gwm_poer.png",          noBrand: true },
  { name: "Poer King Kong",    bodyType: "Пикап",          photo: "/brands/haval/gwm_poer_kingkong.png", noBrand: true },
];

/* ─── Model photo mapping (for non-HAVAL fallback) ──────── */
function getModelPhotoFromCars(brandSlug: string, modelName: string, fallback: string): string {
  if (!HAVAL_SLUGS.includes(brandSlug)) return fallback;
  const m = modelName.toLowerCase();
  if (m.includes("kingkong")) return "/brands/haval/gwm_poer_kingkong.png";
  if (m.includes("dargo x") || m.includes("dargo_x")) return "/brands/haval/dargo_x.png";
  if (m.includes("dargo")) return "/brands/haval/dargo.png";
  if (m.includes("f7x")) return "/brands/haval/f7x.png";
  if (m.includes("f7")) return "/brands/haval/f7.png";
  if (m.includes("jolion")) return "/brands/haval/jolion.png";
  if (m.includes("m6")) return "/brands/haval/m6.png";
  if (m.includes("poer")) return "/brands/haval/gwm_poer.png";
  return fallback;
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtPrice(p: number) {
  return p.toLocaleString("ru-RU") + " ₽";
}

function cleanModelName(raw: string): string {
  return raw.replace(/,\s*[IVX]+.*$/, "").trim();
}

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Section label ──────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-2">
      {children}
    </p>
  );
}

/* ─── Service CTA Modal ──────────────────────────────────── */
function ServiceModal({
  brandName,
  onClose,
}: {
  brandName: string;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(phone)) return;
    setSending(true);
    setError(false);
    try {
      const fd = new FormData();
      fd.append("type", "service");
      fd.append("phone", phone);
      fd.append("source", `Брендовая страница ${brandName}`);
      const r = await fetch("/api/send-email", { method: "POST", body: fd });
      if (!r.ok) {
        setError(true);
        setSending(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError(true);
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-[#0070b8] to-[#87b63c]" />
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
          {submitted ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
              <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
              <p className="text-slate-500 text-sm">
                Мы перезвоним и согласуем удобное время.
              </p>
              <button
                onClick={onClose}
                className="mt-6 w-full bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90"
              >
                Закрыть
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold mb-1">Запись на ТО</h2>
              <p className="text-slate-500 text-sm mb-5">
                {brandName} — Дебрянск Авто, Брянск
              </p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                    Ваш телефон
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="tel"
                      maxLength={18}
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="+7 (___) ___-__-__"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-red-500 text-center">
                    Не удалось отправить заявку. Попробуйте ещё раз.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {sending ? "Отправляем…" : "Записаться на ТО"}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Нажимая кнопку, вы соглашаетесь с{" "}
                  <Link href="/privacy" className="underline">
                    политикой конфиденциальности
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Anchor nav ─────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "about", label: "О бренде" },
  { id: "models", label: "Модельный ряд" },
  { id: "stock", label: "В наличии" },
  { id: "service", label: "Сервис" },
  { id: "contacts", label: "Контакты" },
] as const;

function AnchorNav({
  hasCars,
  hasAbout,
  hasService,
}: {
  hasCars: boolean;
  hasAbout: boolean;
  hasService: boolean;
}) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(`section-${id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const visibleItems = NAV_ITEMS.filter(({ id }) => {
    if (id === "about" && !hasAbout) return false;
    if (id === "service" && !hasService) return false;
    return true;
  });

  function scrollTo(id: string) {
    document.getElementById(`section-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="sticky top-[64px] z-30 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide -mx-1">
          {visibleItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`shrink-0 px-4 py-3.5 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${
                active === id
                  ? "border-[#0070b8] text-[#0070b8]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Model card ─────────────────────────────────────────── */
function ModelCard({
  brandName,
  displayBrand,
  noBrand,
  modelName,
  bodyType,
  minPrice,
  photo,
  index,
}: {
  brandName: string;
  displayBrand?: string;
  noBrand?: boolean;
  modelName: string;
  bodyType: string;
  minPrice: number | null;
  photo: string;
  index: number;
}) {
  const [, navigate] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.07 }}
      className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
      onClick={() =>
        navigate(`/new-cars?dealer=${encodeURIComponent(brandName)}&model=${encodeURIComponent(modelName)}`)
      }
    >
      <div className="relative bg-slate-50 overflow-hidden h-[120px] sm:h-[160px]">
        {photo ? (
          <img
            src={photo}
            alt={`${brandName} ${modelName}`}
            className="w-full h-full object-contain p-3 sm:p-4 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200">
            <Car className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <h3 className="font-extrabold text-sm sm:text-base leading-tight mb-0.5 line-clamp-2">
          {noBrand ? "" : (displayBrand ?? brandName) + " "}{modelName}
        </h3>
        {bodyType && (
          <p className="text-[11px] text-slate-400 mb-2">{bodyType}</p>
        )}
        <div className="mt-auto">
          {minPrice ? (
            <div className="mb-1.5">
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">от</div>
              <div className="text-[11px] sm:text-sm font-extrabold text-[#0070b8] leading-tight">{fmtPrice(minPrice)}</div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-medium mb-1.5">Уточнить цену</div>
          )}
          <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#0070b8] group-hover:gap-2 transition-all">
            Смотреть <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Car card ───────────────────────────────────────────── */
function BrandCarCard({ car }: { car: BrandPageData["cars"][number] }) {
  const [, navigate] = useLocation();
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = (car.images ?? []).filter(Boolean);
  const img = imgs[imgIdx] ?? "";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col cursor-pointer"
      onClick={() => navigate(`/new-cars/${encodeURIComponent(car.id)}`)}
    >
      <div className="relative bg-slate-50 overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {img ? (
          <img
            src={img}
            alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-12 h-12" />
          </div>
        )}
        {imgs.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImgIdx((i) => (i - 1 + imgs.length) % imgs.length);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImgIdx((i) => (i + 1) % imgs.length);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </>
        )}
        <span className="absolute top-2 left-2 bg-[#0070b8] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> НОВЫЙ
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-extrabold text-sm leading-snug mb-0.5">
          {car.mark} {car.model}
        </h3>
        {car.modification && (
          <p className="text-xs text-slate-400 mb-2 line-clamp-1">
            {car.modification}
          </p>
        )}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          <span className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700">
            <Calendar className="w-3 h-3 text-[#0070b8]" />
            {car.year}
          </span>
          {car.body_type && (
            <span className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700">
              <Palette className="w-3 h-3 text-[#87b63c]" />
              {car.body_type}
            </span>
          )}
        </div>
        <div className="mt-auto">
          {car.max_discount > 0 ? (
            <>
              <div className="text-base font-extrabold text-[#0070b8]">
                {fmtPrice(car.price - car.max_discount)}
              </div>
              <div className="text-xs text-slate-400 line-through">
                {fmtPrice(car.price)}
              </div>
            </>
          ) : (
            <div className="text-base font-extrabold text-slate-900">
              {fmtPrice(car.price)}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function BrandPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [serviceModal, setServiceModal] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["brand-page", slug],
    queryFn: () => fetchBrandPage(slug),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#0070b8] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <SEO title="Бренд не найден" description="Страница бренда не существует" />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <Car className="w-16 h-16 text-slate-300" />
          <h1 className="text-2xl font-extrabold text-slate-700">
            Бренд не найден
          </h1>
          <Link href="/" className="text-[#0070b8] font-bold hover:underline">
            ← На главную
          </Link>
        </div>
      </Layout>
    );
  }

  const { brand, content, locations, cars } = data;
  const brandName = brand.name;
  const territory = brand.subName?.trim() || `Территория ${brandName}`;
  const metaTitle =
    content?.metaTitle ??
    `${brandName} в Брянске — официальный дилер | Дебрянск Авто`;
  const metaDesc =
    content?.metaDescription ??
    `Купите ${brandName} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`;

  const jsonLd = {
    "@type": "AutoDealer",
    name: `${brandName} — Дебрянск Авто`,
    description: metaDesc,
    url: `https://debryansk-auto.ru/brands/${slug}`,
    brand: { "@type": "Brand", name: brandName },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Брянск",
      addressRegion: "Брянская область",
      addressCountry: "RU",
    },
    telephone: "+74832631000",
    areaServed: "Брянск",
  };

  const hasAbout = !!content?.description;
  const hasService = true;
  const loc = locations[0];

  const uniqueModels = (() => {
    if (HAVAL_SLUGS.includes(slug)) {
      const priceByModel = new Map<string, number>();
      for (const car of cars) {
        const key = cleanModelName(car.model).toLowerCase();
        const carPrice = car.max_discount > 0 ? car.price - car.max_discount : car.price;
        const existing = priceByModel.get(key);
        if (!existing || carPrice < existing) priceByModel.set(key, carPrice);
      }
      return HAVAL_CATALOG.map((m) => ({
        name: m.name,
        bodyType: m.bodyType,
        photo: m.photo,
        noBrand: m.noBrand ?? false,
        minPrice: priceByModel.get(m.name.toLowerCase()) ?? null,
      }));
    }
    const seen = new Map<string, { bodyType: string; minPrice: number; fallbackImg: string }>();
    for (const car of cars) {
      const key = cleanModelName(car.model);
      const existing = seen.get(key);
      const carPrice = car.max_discount > 0 ? car.price - car.max_discount : car.price;
      if (!existing) {
        seen.set(key, { bodyType: car.body_type, minPrice: carPrice, fallbackImg: car.images?.[0] ?? "" });
      } else if (carPrice < existing.minPrice) {
        seen.set(key, { ...existing, minPrice: carPrice });
      }
    }
    return Array.from(seen.entries()).map(([name, v]) => ({
      name,
      bodyType: v.bodyType,
      photo: getModelPhotoFromCars(slug, name, v.fallbackImg),
      noBrand: false,
      minPrice: v.minPrice,
    }));
  })();

  const featuredCars = (() => {
    const withDiscount = cars.filter(c => c.max_discount > 0).sort((a, b) => b.max_discount - a.max_discount);
    const withoutDiscount = cars.filter(c => c.max_discount === 0);
    const seen = new Set<string>();
    const result: typeof cars = [];
    for (const car of [...withDiscount, ...withoutDiscount]) {
      const model = cleanModelName(car.model);
      if (seen.has(model)) continue;
      seen.add(model);
      result.push(car);
      if (result.length >= 6) break;
    }
    return result;
  })();

  const mapLink =
    loc?.map_x && loc?.map_y
      ? `https://yandex.ru/maps/?ll=${loc.map_y},${loc.map_x}&pt=${loc.map_y},${loc.map_x}&z=16`
      : null;

  return (
    <Layout>
      <SEO
        title={metaTitle}
        description={metaDesc}
        canonical={`/brands/${slug}`}
        jsonLd={jsonLd}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Бренды", url: "/#brands" },
          { name: brandName, url: `/brands/${slug}` },
        ]}
      />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pt-20 pb-16 sm:pt-28 sm:pb-24">
        {/* Decorative gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,112,184,0.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(135,182,60,0.12),transparent_55%)]" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <Link
            href="/#brands"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Все бренды
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 sm:gap-12">
            {brand.logoUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-28 h-20 sm:w-36 sm:h-24 bg-white/10 rounded-2xl flex items-center justify-center p-4 border border-white/10 shrink-0 backdrop-blur-sm"
              >
                <img
                  src={brand.logoUrl}
                  alt={brandName}
                  className="w-full h-full object-contain"
                  loading="eager"
                  decoding="async"
                />
              </motion.div>
            )}
            <div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-2"
              >
                Официальный дилер в Брянске
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-none mb-3 tracking-tight"
              >
                {brandName}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.16 }}
                className="text-lg sm:text-xl font-bold text-[#0070b8]"
              >
                {territory}
              </motion.p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="flex flex-col sm:flex-row flex-wrap gap-3 mt-10"
          >
            <button
              onClick={() =>
                document
                  .getElementById("section-models")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="inline-flex items-center justify-center gap-2 bg-[#0070b8] hover:bg-[#005a94] text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-[#0070b8]/30"
            >
              Смотреть модели <ChevronDown className="w-4 h-4" />
            </button>
            <a
              href={`/new-cars?dealer=${encodeURIComponent(brandName)}`}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors border border-white/20"
            >
              Все авто в наличии <ArrowRight className="w-4 h-4" />
            </a>
            {brand.websiteUrl && (
              <a
                href={brand.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold px-5 py-3.5 rounded-xl text-sm transition-colors border border-white/10"
              >
                Сайт бренда <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Anchor nav ────────────────────────────────────── */}
      <AnchorNav
        hasCars={cars.length > 0}
        hasAbout={hasAbout}
        hasService={hasService}
      />

      {/* ── О бренде ──────────────────────────────────────── */}
      {hasAbout && (
        <section id="section-about" className="scroll-mt-24 py-14 sm:py-20 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <FadeIn>
              <SectionLabel>О бренде</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-5 text-slate-900">
                {brandName} в Брянске
              </h2>
              <p className="text-slate-600 leading-relaxed text-base sm:text-lg whitespace-pre-line">
                {content!.description}
              </p>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ── Модельный ряд ─────────────────────────────────── */}
      <section id="section-models" className="scroll-mt-24 py-14 sm:py-20 bg-slate-50 border-b border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-3">
            <div>
              <SectionLabel>Модельный ряд</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {territory}
              </h2>
            </div>
            {uniqueModels.length > 0 && (
              <a
                href={`/new-cars?dealer=${encodeURIComponent(brandName)}`}
                className="flex items-center gap-2 text-[#0070b8] font-bold hover:gap-3 transition-all text-sm whitespace-nowrap"
              >
                Все в каталоге <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </FadeIn>

          {uniqueModels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {uniqueModels.map((m, i) => (
                <ModelCard
                  key={m.name}
                  brandName={brandName}
                  displayBrand={HAVAL_SLUGS.includes(slug) ? "HAVAL" : undefined}
                  noBrand={m.noBrand}
                  modelName={m.name}
                  bodyType={m.bodyType}
                  minPrice={m.minPrice}
                  photo={m.photo}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <FadeIn className="text-center py-12">
              <Car className="w-14 h-14 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                Информация о модельном ряде обновляется
              </p>
            </FadeIn>
          )}
        </div>
      </section>

      {/* ── Спецпредложения ───────────────────────────────── */}
      {cars.length > 0 ? (
        <section id="section-stock" className="scroll-mt-24 py-14 sm:py-20 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3">
              <div>
                <SectionLabel>Спецпредложения</SectionLabel>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Выгодные предложения
                  {cars.filter(c => c.max_discount > 0).length > 0 && (
                    <span className="ml-3 text-base font-bold text-[#87b63c]">
                      со скидкой {cars.filter(c => c.max_discount > 0).length} авт.
                    </span>
                  )}
                </h2>
              </div>
              <a
                href={`/new-cars?dealer=${encodeURIComponent(brandName)}`}
                className="flex items-center gap-2 text-[#0070b8] font-bold hover:gap-3 transition-all text-sm whitespace-nowrap"
              >
                Все {cars.length} авт. <ArrowRight className="w-4 h-4" />
              </a>
            </FadeIn>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {featuredCars.map((car) => (
                <BrandCarCard key={car.id} car={car} />
              ))}
            </div>

            <FadeIn className="text-center mt-8">
              <a
                href={`/new-cars?dealer=${encodeURIComponent(brandName)}`}
                className="inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005a94] text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors"
              >
                Смотреть все {cars.length} автомобилей <ArrowRight className="w-4 h-4" />
              </a>
            </FadeIn>
          </div>
        </section>
      ) : (
        <section id="section-stock" className="scroll-mt-24 py-14 sm:py-20 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="text-center py-8">
              <Car className="w-14 h-14 text-slate-200 mx-auto mb-4" />
              <SectionLabel>В наличии</SectionLabel>
              <h2 className="text-xl font-extrabold text-slate-700 mb-2">
                Уточните наличие
              </h2>
              <p className="text-slate-500 mb-6">
                Актуальные предложения по {brandName} — свяжитесь с нами
              </p>
              <a
                href={`tel:+74832631000`}
                className="inline-flex items-center gap-2 bg-[#0070b8] text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-[#005a94] transition-colors"
              >
                <Phone className="w-4 h-4" /> Узнать наличие
              </a>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ── Сервис ────────────────────────────────────────── */}
      <section id="section-service" className="scroll-mt-24 py-14 sm:py-20 bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn>
            <SectionLabel>Сервис</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Гарантийное обслуживание {brandName}
            </h2>
            {content?.serviceText && (
              <p className="text-slate-400 mb-8 leading-relaxed max-w-2xl">
                {content.serviceText}
              </p>
            )}
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                icon: <Shield className="w-6 h-6 text-[#87b63c]" />,
                title: "Оригинальные запчасти",
                desc: "Только сертифицированные детали от производителя",
              },
              {
                icon: <Star className="w-6 h-6 text-[#87b63c]" />,
                title: "Гарантия на работы",
                desc: "Полная гарантия на все виды сервисных работ",
              },
              {
                icon: <Settings className="w-6 h-6 text-[#87b63c]" />,
                title: "Онлайн-запись",
                desc: "Запишитесь на ТО в удобное время, без очередей",
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="w-11 h-11 rounded-xl bg-[#87b63c]/15 flex items-center justify-center mb-3">
                    {item.icon}
                  </div>
                  <h3 className="font-extrabold text-white text-sm mb-1">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn>
            <button
              onClick={() => setServiceModal(true)}
              className="inline-flex items-center gap-2 bg-[#87b63c] hover:bg-[#6a9a28] text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-[#87b63c]/25"
            >
              <Wrench className="w-4 h-4" /> Записаться на ТО
            </button>
          </FadeIn>
        </div>
      </section>

      {/* ── Контакты ──────────────────────────────────────── */}
      <section id="section-contacts" className="scroll-mt-24 py-14 sm:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <FadeIn>
            <SectionLabel>Контакты</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8">
              Дилерский центр {brandName}
            </h2>
          </FadeIn>

          {loc ? (
            <FadeIn delay={0.1}>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 sm:p-8">
                <h3 className="font-extrabold text-lg mb-5 text-slate-900">
                  {loc.title}
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-[#0070b8]" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                        Адрес
                      </div>
                      <span className="text-slate-700 font-medium">
                        {loc.address}
                      </span>
                    </div>
                  </div>

                  {loc.phone && (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-[#0070b8]" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                          Телефон
                        </div>
                        <a
                          href={phoneHref(loc.phone)}
                          className="font-extrabold text-[#0070b8] hover:underline text-base"
                        >
                          {normalizePhone(loc.phone)}
                        </a>
                      </div>
                    </div>
                  )}

                  {loc.hours && (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-[#0070b8]" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                          График работы
                        </div>
                        <span className="text-slate-700 font-medium">
                          {loc.hours}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {mapLink && (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005a94] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    <Navigation className="w-4 h-4" /> Построить маршрут
                  </a>
                )}
              </div>
            </FadeIn>
          ) : (
            <FadeIn delay={0.1}>
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-center text-slate-400">
                <MapPin className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                <p>Информация о дилерском центре обновляется</p>
              </div>
            </FadeIn>
          )}
        </div>
      </section>

      {/* ── Service modal ─────────────────────────────────── */}
      <AnimatePresence>
        {serviceModal && (
          <ServiceModal
            brandName={brandName}
            onClose={() => setServiceModal(false)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
