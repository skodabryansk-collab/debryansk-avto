import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MapPin, Phone, Clock, ArrowRight, Car, Wrench,
  ChevronLeft, Calendar, Palette,
  Sparkles, CheckCircle, ExternalLink, X, User,
  Shield, Settings, Star, ChevronDown, Navigation, Tag,
  Gauge, FileText, Package, Zap, RefreshCw, Share2,
} from "lucide-react";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import FaqBlock from "@/components/FaqBlock";
import ToCalculator from "@/components/ToCalculator";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { normalizePhone, phoneHref } from "@/lib/normalizePhone";
import { YandexMap, type DealerLocation } from "@/components/YandexMap";
import { CTPhone } from "@/components/CTPhone";

/* ─── Service icon map ───────────────────────────────────── */
const SERVICE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench, Settings, Shield, Car, Gauge, Zap, Clock, Star,
  FileText, Package, CheckCircle, RefreshCw,
};

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
    heroImageUrl: string | null;
    heroImageMobileUrl: string | null;
    faq: Array<{ question: string; answer: string; include_in_schema?: boolean }> | null;
    promotions: Array<{ slug?: string; title: string; description: string; image?: string; badge?: string; expiresAt?: string; buttonText?: string; buttonUrl?: string; isActive?: boolean }> | null;
    models: Array<{ id?: string; feedDealer: string; feedModel: string; displayName: string; image?: string; description?: string; badge?: string; isActive?: boolean; sort?: number }> | null;
    services: Array<{ id?: string; icon: string; title: string; description?: string; sort?: number }> | null;
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
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
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
    <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">
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
  const prefersReduced = useReducedMotion();
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
      fd.append("brand", brandName);
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
        initial={prefersReduced ? false : { y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-primary to-[#87b63c]" />
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
                className="mt-6 w-full bg-gradient-to-r from-primary to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90"
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
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
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
                  className="w-full bg-gradient-to-r from-primary to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
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

/* ─── Promo modal ────────────────────────────────────────── */
function PromoModal({
  promo,
  brandName,
  locationPhone,
  onClose,
}: {
  promo: { slug?: string; title: string; description: string; image?: string; badge?: string; expiresAt?: string; buttonText?: string; buttonUrl?: string };
  brandName: string;
  locationPhone?: string | null;
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
      fd.append("brand", brandName);
      fd.append("source", `Акция: ${promo.title} — ${brandName}`);
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
        <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 bg-white/90 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors shadow-sm">
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
          <div className="w-full h-48 sm:h-56 shrink-0 overflow-hidden">
            <img src={promo.image} alt={promo.title} className="w-full h-full object-cover" loading="lazy" />
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
            {locationPhone && (
              <CTPhone
                className="ml-auto inline-flex items-center gap-1.5 bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs hover:bg-primary/20 transition-colors"
                phone={normalizePhone(locationPhone) || locationPhone}>
                <Phone className="w-3 h-3" />
                {normalizePhone(locationPhone) || locationPhone}
              </CTPhone>
            )}
          </div>
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
                <a href={promo.buttonUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-5 py-3 rounded-xl text-sm transition-colors">
                  Узнать подробнее <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button onClick={() => setShowForm(true)}
                className="flex-1 bg-gradient-to-r from-primary to-[#005a94] text-white font-bold px-5 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity">
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
                  <input type="tel" inputMode="tel" maxLength={18}
                    value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                    placeholder="+7 (___) ___-__-__" required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 text-center">Не удалось отправить. Попробуйте ещё раз.</p>}
              <button type="submit" disabled={sending || !isPhoneValid(phone)}
                className="w-full bg-gradient-to-r from-primary to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {sending ? "Отправляем…" : "Отправить заявку"}
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Нажимая кнопку, вы соглашаетесь с{" "}
                <Link href="/privacy" className="underline">политикой конфиденциальности</Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Callback section ───────────────────────────────────── */
function CallbackSection({ brandName }: { brandName: string }) {
  const prefersReduced = useReducedMotion();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
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
      fd.append("type", "callback");
      fd.append("name", name);
      fd.append("phone", phone);
      fd.append("comment", comment);
      fd.append("brand", brandName);
      fd.append("source", `Форма обратной связи — ${brandName}`);
      const r = await fetch("/api/send-email", { method: "POST", body: fd });
      if (!r.ok) { setError(true); setSending(false); return; }
      setSubmitted(true);
    } catch { setError(true); }
    setSending(false);
  }

  return (
    <section id="section-callback" className="scroll-mt-24 py-16 sm:py-24 bg-gradient-to-br from-primary via-[#005a94] to-[#004a7a]">
      <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
        {submitted ? (
          <div className="text-center py-8">
            <motion.div
              initial={prefersReduced ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <CheckCircle className="w-16 h-16 text-[#87b63c] mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Заявка принята!</h2>
            <p className="text-white/70 text-sm">Менеджер {brandName} свяжется с вами в ближайшее время</p>
          </div>
        ) : (
          <>
            <FadeIn>
              <div className="text-center mb-8">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#87b63c] block mb-2">
                  Бесплатная консультация
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                  Остались вопросы?
                </h2>
                <p className="text-white/70 text-sm sm:text-base">
                  Оставьте контакты — менеджер {brandName} перезвонит в течение 15 минут
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 sm:p-8 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest block mb-1.5">
                    Ваше имя
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest block mb-1.5">
                    Телефон *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                      placeholder="+7 (___) ___-__-__"
                      maxLength={18}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest block mb-1.5">
                    Комментарий
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Какой автомобиль вас интересует, какие вопросы..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 transition-colors resize-none"
                  />
                </div>
                {error && (
                  <p className="text-red-300 text-xs text-center">
                    Не удалось отправить заявку. Попробуйте ещё раз.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-[#87b63c] hover:bg-[#6a9a28] text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-[#87b63c]/30 disabled:opacity-60"
                >
                  {sending ? "Отправляем…" : "Перезвоните мне"}
                </button>
                <p className="text-[10px] text-white/40 text-center">
                  Нажимая кнопку, вы соглашаетесь с{" "}
                  <Link href="/privacy" className="underline hover:text-white/60">
                    политикой конфиденциальности
                  </Link>
                </p>
              </form>
            </FadeIn>
          </>
        )}
      </div>
    </section>
  );
}

/* ─── Anchor nav ─────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "about", label: "О бренде" },
  { id: "services", label: "Услуги" },
  { id: "models", label: "Модельный ряд" },
  { id: "stock", label: "В наличии" },
  { id: "promotions", label: "Акции" },
  { id: "service", label: "Сервис" },
  { id: "callback", label: "Консультация" },
  { id: "contacts", label: "Контакты" },
] as const;

function AnchorNav({
  hasCars,
  hasAbout,
  hasService,
  hasPromotions,
  hasModels,
  hasServices,
  isServiceOnly,
}: {
  hasCars: boolean;
  hasAbout: boolean;
  hasService: boolean;
  hasPromotions: boolean;
  hasModels: boolean;
  hasServices: boolean;
  isServiceOnly: boolean;
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
    if (id === "services" && !hasServices) return false;
    if (id === "models" && (!hasModels || isServiceOnly)) return false;
    if (id === "stock" && (!hasCars || isServiceOnly)) return false;
    if (id === "service" && !hasService) return false;
    if (id === "promotions" && !hasPromotions) return false;
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
                  ? "border-primary text-primary"
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
  modelName,
  bodyType,
  description,
  badge,
  minPrice,
  photo,
  feedDealer,
  feedModel,
  index,
}: {
  brandName: string;
  modelName: string;
  bodyType?: string;
  description?: string;
  badge?: string;
  minPrice: number | null;
  photo: string;
  feedDealer: string;
  feedModel: string;
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
        navigate(`/new-cars?dealer=${encodeURIComponent(feedDealer)}&model=${encodeURIComponent(feedModel)}`)
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
        {badge && (
          <span className="absolute top-2 right-2 bg-[#87b63c]/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full leading-tight">
            {badge}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <h3 className="font-extrabold text-sm sm:text-base leading-tight mb-0.5 line-clamp-2">
          {brandName} {modelName}
        </h3>
        {bodyType && (
          <p className="text-[11px] text-slate-400 mb-1">{bodyType}</p>
        )}
        {description && (
          <p className="text-[10px] text-slate-500 line-clamp-2 mb-1 leading-snug">{description}</p>
        )}
        <div className="mt-auto">
          {minPrice ? (
            <div className="mb-1.5">
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">от</div>
              <div className="text-[11px] sm:text-sm font-extrabold text-primary leading-tight">{fmtPrice(minPrice)}</div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-medium mb-1.5">Уточнить цену</div>
          )}
          <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-primary group-hover:gap-2 transition-all">
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
  const imgs = (car.images ?? []).filter(Boolean);
  const img = imgs[0] ?? "";

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
        <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
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
            <Calendar className="w-3 h-3 text-primary" />
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
              <div className="text-base font-extrabold text-primary">
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

/* ─── Featured cars carousel (mobile scroll + dots, desktop grid) ─── */
function BrandStockCarousel({ cars }: { cars: BrandPageData["cars"] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const total = cars.length;
  const mobilePages = Math.max(1, Math.ceil(total / 2));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const cardW = first ? first.getBoundingClientRect().width : 0;
      const gap = parseFloat(getComputedStyle(el).gap) || 12;
      const step = (cardW + gap) * 2;
      if (step <= 0) return;
      const cur = Math.round(el.scrollLeft / step);
      setPage(Math.max(0, Math.min(cur, mobilePages - 1)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [mobilePages]);

  const goToPage = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const cardW = first ? first.getBoundingClientRect().width : 0;
    const gap = parseFloat(getComputedStyle(el).gap) || 12;
    el.scrollTo({ left: i * (cardW + gap) * 2, behavior: "smooth" });
    setPage(i);
  };

  return (
    <>
      {/* Mobile: horizontal scroll with dots */}
      <div className="md:hidden -mx-4 px-4">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {cars.map((car) => (
            <div key={car.id} className="snap-start shrink-0 w-[47%]">
              <BrandCarCard car={car} />
            </div>
          ))}
        </div>
        {mobilePages > 1 && (
          <div className="flex justify-center gap-2 mt-3">
            {Array.from({ length: mobilePages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className={`h-2 rounded-full transition-all ${
                  i === page
                    ? "w-[18px] bg-primary"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Страница ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 gap-5">
        {cars.map((car) => (
          <BrandCarCard key={car.id} car={car} />
        ))}
      </div>
    </>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function BrandPage() {
  const prefersReduced = useReducedMotion();
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [serviceModal, setServiceModal] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<{ title: string; description: string; image?: string; badge?: string; expiresAt?: string; buttonText?: string; buttonUrl?: string; isActive?: boolean } | null>(null);

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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
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
          <h2 className="text-2xl font-extrabold text-slate-700">
            Бренд не найден
          </h2>
          <Link href="/" className="text-primary font-bold hover:underline">
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
    (brand.isServiceOnly
      ? `Официальный сервис ${brandName} в Брянске — гарантийное и постгарантийное обслуживание, оригинальные запчасти. Дебрянск Авто${locations[0]?.address ? `, ${locations[0].address}` : ""}.`
      : `${brandName} в Брянске${cars.length > 0 ? ` — ${cars.length} автомобилей в наличии` : ""}. Официальный дилер Дебрянск Авто. Тест-драйв, trade-in, сервис.`
    );

  const autoDealer = {
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
    telephone: "+74832777770",
    areaServed: "Брянск",
  };

  const isServiceOnly = brand.isServiceOnly;
  const services = content?.services ?? [];
  const hasServices = isServiceOnly && services.length > 0;

  const cmsModels = (content?.models ?? []).filter(m => m.isActive !== false);
  const hasCmsModels = cmsModels.length > 0;

  const modelsWithPrice = hasCmsModels
    ? cmsModels.filter(m => {
        const matching = cars.filter(c =>
          c.dealer.toLowerCase() === m.feedDealer.toLowerCase() &&
          cleanModelName(c.model).toLowerCase() === cleanModelName(m.feedModel).toLowerCase()
        );
        return matching.length > 0;
      })
    : [];
  const modelsItemList = modelsWithPrice.length > 0
    ? {
        "@type": "ItemList",
        name: `Модельный ряд ${brandName}`,
        numberOfItems: modelsWithPrice.length,
        itemListElement: modelsWithPrice.map((m, idx) => {
          const matching = cars.filter(c =>
            c.dealer.toLowerCase() === m.feedDealer.toLowerCase() &&
            cleanModelName(c.model).toLowerCase() === cleanModelName(m.feedModel).toLowerCase()
          );
          const minP = Math.min(...matching.map(c => c.max_discount > 0 ? c.price - c.max_discount : c.price));
          return {
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "Product",
              name: `${brandName} ${m.displayName}`,
              brand: { "@type": "Brand", name: brandName },
              url: `https://debryansk-auto.ru/new-cars?dealer=${encodeURIComponent(m.feedDealer)}&model=${encodeURIComponent(m.feedModel)}`,
              offers: {
                "@type": "Offer",
                priceCurrency: "RUB",
                price: minP,
                availability: "https://schema.org/InStock",
                url: `https://debryansk-auto.ru/new-cars?dealer=${encodeURIComponent(m.feedDealer)}&model=${encodeURIComponent(m.feedModel)}`,
              },
            },
          };
        }),
      }
    : null;

  const jsonLdItems: Record<string, unknown>[] = [autoDealer as Record<string, unknown>];
  if (modelsItemList) jsonLdItems.push(modelsItemList as Record<string, unknown>);
  const jsonLd = jsonLdItems.length === 1 ? jsonLdItems[0] : jsonLdItems;

  const hasAbout = !!content?.description;
  const hasService = true;
  const today = new Date().toISOString().slice(0, 10);
  const activePromos = (content?.promotions ?? []).filter(p =>
    p.isActive !== false && (!p.expiresAt || p.expiresAt >= today)
  );
  const hasPromotions = activePromos.length > 0;
  const loc = locations[0];

  const uniqueModels = hasCmsModels
    ? [...cmsModels]
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .map(m => {
          const matchingCars = cars.filter(c =>
            c.dealer.toLowerCase() === m.feedDealer.toLowerCase() &&
            cleanModelName(c.model).toLowerCase() === cleanModelName(m.feedModel).toLowerCase()
          );
          const minPrice = matchingCars.length > 0
            ? Math.min(...matchingCars.map(c => c.max_discount > 0 ? c.price - c.max_discount : c.price))
            : null;
          const bodyType = matchingCars[0]?.body_type ?? "";
          return {
            name: m.displayName,
            bodyType: bodyType || undefined,
            photo: m.image ?? "",
            minPrice,
            feedDealer: m.feedDealer,
            feedModel: m.feedModel,
            description: m.description,
            badge: m.badge,
          };
        })
    : [];

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
      <div data-prerender-ready="true" style={{ display: "none" }} />
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

      {/* ── Hidden SEO H1 ─────────────────────────────────────── */}
      <h1 className="sr-only">
        {isServiceOnly
          ? `Официальный сервис ${brandName} в Брянске — Дебрянск Авто`
          : `Официальный дилер ${brandName} в Брянске — Дебрянск Авто`
        }
      </h1>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pt-20 pb-16 sm:pt-28 sm:pb-24">
        {/* Hero cover image */}
        {content?.heroImageUrl && (
          <div className="absolute inset-0">
            <picture className="block w-full h-full">
              {content.heroImageMobileUrl && (
                <source media="(max-width: 639px)" srcSet={content.heroImageMobileUrl} />
              )}
              <img
                src={content.heroImageUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-center"
                loading="eager"
                decoding="async"
              />
            </picture>
          </div>
        )}
        {/* Dark overlay (always present, stronger when image is set) */}
        <div className={`absolute inset-0 ${content?.heroImageUrl ? "bg-black/60" : "bg-transparent"}`} />
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
                initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
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
                initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-2"
              >
                {isServiceOnly ? "Авторизованный сервис в Брянске" : "Официальный дилер в Брянске"}
              </motion.p>
              <motion.h2
                initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-none mb-3 tracking-tight"
              >
                {brandName}
              </motion.h2>
              <motion.p
                initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.16 }}
                className="text-lg sm:text-xl font-bold text-primary"
              >
                {territory}
              </motion.p>
            </div>
          </div>

          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="flex flex-col sm:flex-row flex-wrap gap-3 mt-10"
          >
            {isServiceOnly ? (
              <>
                <button
                  onClick={() => setServiceModal(true)}
                  className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-primary/30"
                >
                  <Wrench className="w-4 h-4" /> Записаться на ТО
                </button>
                {locations[0]?.phone && (
                  <CTPhone
                    className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors border border-white/20"
                    phone={normalizePhone(locations[0].phone) || locations[0].phone}>
                    <Phone className="w-4 h-4" /> Позвонить
                  </CTPhone>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() =>
                    document
                      .getElementById("section-models")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-primary/30"
                >
                  Смотреть модели <ChevronDown className="w-4 h-4" />
                </button>
                <a
                  href={`/new-cars?dealer=${encodeURIComponent(brandName)}`}
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors border border-white/20"
                >
                  Все авто в наличии <ArrowRight className="w-4 h-4" />
                </a>
              </>
            )}
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
        hasPromotions={hasPromotions}
        hasModels={hasCmsModels}
        hasServices={hasServices}
        isServiceOnly={isServiceOnly}
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

      {/* ── Услуги ────────────────────────────────────────── */}
      {hasServices && (
        <section id="section-services" className="scroll-mt-24 py-14 sm:py-20 bg-slate-50 border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn>
              <SectionLabel>Услуги</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-10">
                Услуги {brandName}
              </h2>
            </FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {services.map((svc, i) => {
                const IconComponent = SERVICE_ICON_MAP[svc.icon] ?? Wrench;
                return (
                  <FadeIn key={i} delay={i * 0.06}>
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm mb-1.5">{svc.title}</h3>
                      {svc.description && (
                        <p className="text-slate-500 text-xs leading-relaxed">{svc.description}</p>
                      )}
                    </div>
                  </FadeIn>
                );
              })}
            </div>
            <FadeIn className="mt-10">
              <button
                onClick={() => setServiceModal(true)}
                className="inline-flex items-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-primary/30"
              >
                <Phone className="w-4 h-4" /> Записаться на обслуживание
              </button>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ── Модельный ряд ─────────────────────────────────── */}
      {hasCmsModels && !isServiceOnly && <section id="section-models" className="scroll-mt-24 py-14 sm:py-20 bg-slate-50 border-b border-slate-100">
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
                className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all text-sm whitespace-nowrap"
              >
                Все в каталоге <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </FadeIn>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {uniqueModels.map((m, i) => (
              <ModelCard
                key={m.name + i}
                brandName={brandName}
                modelName={m.name}
                bodyType={m.bodyType}
                description={m.description}
                badge={m.badge}
                minPrice={m.minPrice}
                photo={m.photo}
                feedDealer={m.feedDealer}
                feedModel={m.feedModel}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>}

      {/* ── Спецпредложения ───────────────────────────────── */}
      {!isServiceOnly && (cars.length > 0 ? (
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
                className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all text-sm whitespace-nowrap"
              >
                Все {cars.length} авт. <ArrowRight className="w-4 h-4" />
              </a>
            </FadeIn>

            <BrandStockCarousel cars={featuredCars} />

            <FadeIn className="text-center mt-8">
              <a
                href={`/new-cars?dealer=${encodeURIComponent(brandName)}`}
                className="inline-flex items-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors"
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
              <CTPhone
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-[#005a94] transition-colors"
                phone="+7 (4832) 63-10-00">
                <Phone className="w-4 h-4" /> Узнать наличие
              </CTPhone>
            </FadeIn>
          </div>
        </section>
      ))}

      {/* ── Акции ─────────────────────────────────────────── */}
      {hasPromotions && (
        <section id="section-promotions" className="scroll-mt-24 py-14 sm:py-20 bg-gradient-to-br from-primary/5 via-white to-[#87b63c]/5 border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn>
              <SectionLabel>Акции</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8">
                Специальные предложения
              </h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activePromos.map((promo, i) => (
                <FadeIn key={i} delay={i * 0.07}>
                  <button
                    onClick={() => setSelectedPromo(promo)}
                    className="group w-full bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 text-left flex flex-col"
                  >
                    {promo.image ? (
                      <div className="aspect-[16/9] overflow-hidden shrink-0">
                        <img src={promo.image} alt={promo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] bg-gradient-to-br from-primary/8 to-[#87b63c]/8 flex items-center justify-center shrink-0">
                        <Tag className="w-10 h-10 text-primary/25" />
                      </div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {promo.badge && (
                          <span className="inline-block bg-[#87b63c]/15 text-[#4a7a0f] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            {promo.badge}
                          </span>
                        )}
                        {promo.expiresAt && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                            <Calendar className="w-2.5 h-2.5" />
                            до {new Date(promo.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug mb-2 group-hover:text-primary transition-colors">
                        {promo.title}
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4 flex-1">
                        {promo.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                        Подробнее <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </button>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Сервис ────────────────────────────────────────── */}
      <section id="section-service" className="scroll-mt-24 py-14 sm:py-20 bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn>
            <SectionLabel>Сервис</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Официальный сервисный центр {brandName}
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

      {/* ── TO Calculator ─────────────────────────────────── */}
      <ToCalculator brandName={brandName} />

      {/* ── FAQ ───────────────────────────────────────────── */}
      <FaqBlock pageSlug={`brands/${brand.slug}`} />

      {/* ── Обратная связь ────────────────────────────────── */}
      <CallbackSection brandName={brandName} />

      {/* ── Новости ───────────────────────────────────────── */}
      {data.news && data.news.length > 0 && (
        <section id="section-news" className="scroll-mt-24 py-14 sm:py-20 bg-slate-50 border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn>
              <SectionLabel>Новости</SectionLabel>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8">
                Новости {brandName}
              </h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.news.map((item, i) => (
                <FadeIn key={item.id} delay={i * 0.07}>
                  <Link href={`/news/${item.slug}`} className="group flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                    {item.image && (
                      <div className="aspect-[16/9] overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="flex flex-col flex-1 p-4">
                      {item.category && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">
                          {item.category}
                        </span>
                      )}
                      <h3 className="font-extrabold text-slate-900 text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      {item.excerpt && (
                        <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-3">
                          {item.excerpt}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        {item.published_at && (
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

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
              {loc.map_x && loc.map_y && (
                <div className="relative isolate z-0 rounded-2xl overflow-hidden mb-6 border border-slate-100 h-[280px]">
                  <YandexMap
                    locations={[{
                      id: loc.id,
                      address: loc.address,
                      short: loc.title,
                      brands: [brandName],
                      lat: loc.map_x,
                      lng: loc.map_y,
                      color: "var(--color-primary)",
                      phone: loc.phone ?? undefined,
                      hours: loc.hours ?? undefined,
                    } satisfies DealerLocation]}
                    center={[loc.map_x, loc.map_y]}
                    zoom={16}
                  />
                </div>
              )}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 sm:p-8">
                <h3 className="font-extrabold text-lg mb-5 text-slate-900">
                  {loc.title}
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-primary" />
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
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                          Телефон
                        </div>
                        <CTPhone
                          className="font-extrabold text-primary hover:underline text-base"
                          phone={normalizePhone(loc.phone) || loc.phone} />
                      </div>
                    </div>
                  )}

                  {loc.hours && (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-primary" />
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
                    className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-[#005a94] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
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

      {/* ── Promo modal ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedPromo && (
          <PromoModal
            promo={selectedPromo}
            brandName={brandName}
            locationPhone={loc?.phone}
            onClose={() => setSelectedPromo(null)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
