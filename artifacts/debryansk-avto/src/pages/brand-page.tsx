import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MapPin, Phone, Clock, ArrowRight, Car, Wrench,
  ChevronLeft, ChevronRight, Calendar, Palette,
  Sparkles, CheckCircle, ExternalLink, X, User,
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

/* ─── Helpers ────────────────────────────────────────────── */
function fmtPrice(p: number) {
  return p.toLocaleString("ru-RU") + " ₽";
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
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

/* ─── CTA Modal ──────────────────────────────────────────── */
function CTAModal({ title, brandName, onClose }: { title: string; brandName: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !isPhoneValid(phone)) return;
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-[#0070b8] to-[#87b63c]" />
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="p-6 sm:p-8">
          <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
          {submitted ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
              <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
              <p className="text-slate-500 text-sm">Менеджер перезвонит вам в ближайшее время.</p>
              <button onClick={onClose} className="mt-6 w-full bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90">Закрыть</button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold mb-1">{title}</h2>
              <p className="text-slate-500 text-sm mb-5">{brandName} — Дебрянск Авто, Брянск</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Ваше имя</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Телефон</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="tel" inputMode="tel" maxLength={18} value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                      placeholder="+7 (___) ___-__-__" required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity mt-1">
                  Отправить заявку
                </button>
                <p className="text-[10px] text-slate-400 text-center">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности</p>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
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
      <div className="relative h-44 bg-slate-100 overflow-hidden">
        {img ? (
          <img src={img} alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-12 h-12" />
          </div>
        )}
        {imgs.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + imgs.length) % imgs.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % imgs.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </>
        )}
        <span className="absolute top-2 left-2 bg-[#0070b8] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> НОВЫЙ
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-extrabold text-sm leading-snug mb-0.5">{car.mark} {car.model}</h3>
        {car.modification && <p className="text-xs text-slate-400 mb-2 line-clamp-1">{car.modification}</p>}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          <span className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700">
            <Calendar className="w-3 h-3 text-[#0070b8]" />{car.year}
          </span>
          {car.body_type && (
            <span className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700">
              <Palette className="w-3 h-3 text-[#87b63c]" />{car.body_type}
            </span>
          )}
        </div>
        <div className="mt-auto">
          {car.max_discount > 0 ? (
            <>
              <div className="text-base font-extrabold text-[#0070b8]">{fmtPrice(car.price - car.max_discount)}</div>
              <div className="text-xs text-slate-400 line-through">{fmtPrice(car.price)}</div>
            </>
          ) : (
            <div className="text-base font-extrabold text-slate-900">{fmtPrice(car.price)}</div>
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
  const [modal, setModal] = useState<"testdrive" | "callback" | null>(null);

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
          <h1 className="text-2xl font-extrabold text-slate-700">Бренд не найден</h1>
          <Link href="/" className="text-[#0070b8] font-bold hover:underline">← На главную</Link>
        </div>
      </Layout>
    );
  }

  const { brand, content, locations, cars, news } = data;
  const brandName = brand.name;
  const metaTitle = content?.metaTitle ?? `${brandName} в Брянске — официальный дилер | Дебрянск Авто`;
  const metaDesc = content?.metaDescription ?? `Купите ${brandName} у официального дилера в Брянске. Широкий выбор в наличии, кредит, trade-in, гарантийный сервис. Дебрянск Авто.`;

  const jsonLd = {
    "@type": "AutoDealer",
    "name": `${brandName} — Дебрянск Авто`,
    "description": metaDesc,
    "url": `https://debryansk-auto.ru/brands/${slug}`,
    "brand": { "@type": "Brand", "name": brandName },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Брянск",
      "addressRegion": "Брянская область",
      "addressCountry": "RU",
    },
    "telephone": "+74832631000",
    "areaServed": "Брянск",
  };

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
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,112,184,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(135,182,60,0.1),transparent_60%)]" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <Link href="/#brands" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Все бренды
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
            {brand.logoUrl && (
              <div className="w-32 h-20 sm:w-40 sm:h-24 bg-white/10 rounded-2xl flex items-center justify-center p-4 border border-white/10 shrink-0">
                <img src={brand.logoUrl} alt={brandName} className="w-full h-full object-contain" loading="eager" decoding="async" />
              </div>
            )}
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-2">
                Официальный дилер в Брянске
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-3">
                {brandName}
              </h1>
              {brand.subName && (
                <p className="text-slate-400 text-sm sm:text-base font-medium">{brand.subName}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => setModal("testdrive")}
              className="inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005a94] text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-[#0070b8]/30"
            >
              <Car className="w-4 h-4" /> Тест-драйв
            </button>
            <button
              onClick={() => setModal("callback")}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors border border-white/20"
            >
              <Phone className="w-4 h-4" /> Заказать звонок
            </button>
            {brand.websiteUrl && (
              <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors border border-white/10">
                Сайт бренда <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Description ──────────────────────────────────── */}
      {content?.description && (
        <section className="py-12 sm:py-16 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <FadeIn>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-3">О бренде</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-5">{brandName} в Брянске</h2>
              <p className="text-slate-600 leading-relaxed text-base sm:text-lg">{content.description}</p>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ── Locations ────────────────────────────────────── */}
      {locations.length > 0 && (
        <section className="py-12 sm:py-16 bg-slate-50 border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn>
              <p className="text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Где нас найти</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-8">Дилерские центры {brandName}</h2>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {locations.map((loc, i) => (
                <FadeIn key={loc.id} delay={i * 0.08}>
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-[#0070b8]" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm leading-snug">{loc.title}</h3>
                        {loc.is_service && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#87b63c] bg-[#87b63c]/10 rounded-md px-1.5 py-0.5">Сервис</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <span>{loc.address}</span>
                      </div>
                      {loc.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <a href={phoneHref(loc.phone)} className="font-bold text-[#0070b8] hover:underline">
                            {normalizePhone(loc.phone)}
                          </a>
                        </div>
                      )}
                      {loc.hours && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-500">{loc.hours}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Cars in stock ────────────────────────────────── */}
      {cars.length > 0 && (
        <section className="py-12 sm:py-16 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">В наличии</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold">Новые {brandName}</h2>
              </div>
              <Link
                href={`/new-cars?brand=${encodeURIComponent(brandName)}`}
                className="flex items-center gap-2 text-[#0070b8] font-bold hover:gap-3 transition-all text-sm whitespace-nowrap"
              >
                Все автомобили <ArrowRight className="w-4 h-4" />
              </Link>
            </FadeIn>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-5">
              {cars.map(car => (
                <BrandCarCard key={car.id} car={car} />
              ))}
            </div>
          </div>
        </section>
      )}

      {cars.length === 0 && (
        <section className="py-12 sm:py-16 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="text-center py-8">
              <Car className="w-14 h-14 text-slate-200 mx-auto mb-4" />
              <h2 className="text-xl font-extrabold text-slate-700 mb-2">Уточните наличие</h2>
              <p className="text-slate-500 mb-6">Актуальные предложения по {brandName} — свяжитесь с нами</p>
              <button onClick={() => setModal("callback")}
                className="inline-flex items-center gap-2 bg-[#0070b8] text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-[#005a94] transition-colors">
                <Phone className="w-4 h-4" /> Узнать наличие
              </button>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ── Promo ────────────────────────────────────────── */}
      {content?.promoText && (
        <section className="py-12 sm:py-16 bg-gradient-to-br from-[#0070b8]/5 to-[#87b63c]/5 border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
            <FadeIn>
              <p className="text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-3">Акции</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-5">Специальные предложения</h2>
              <p className="text-slate-600 leading-relaxed text-base">{content.promoText}</p>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ── Service ──────────────────────────────────────── */}
      {content?.serviceText && (
        <section className="py-12 sm:py-16 bg-slate-900 border-b border-slate-800">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-8 items-start">
              <FadeIn className="shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-[#87b63c]/20 flex items-center justify-center">
                  <Wrench className="w-7 h-7 text-[#87b63c]" />
                </div>
              </FadeIn>
              <FadeIn delay={0.1}>
                <p className="text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-3">Сервис</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-5">Обслуживание {brandName}</h2>
                <p className="text-slate-400 leading-relaxed text-base mb-6">{content.serviceText}</p>
                <button onClick={() => setModal("callback")}
                  className="inline-flex items-center gap-2 bg-[#87b63c] hover:bg-[#6d9a2e] text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                  <Wrench className="w-4 h-4" /> Записаться на сервис
                </button>
              </FadeIn>
            </div>
          </div>
        </section>
      )}

      {/* ── News ─────────────────────────────────────────── */}
      {news.length > 0 && (
        <section className="py-12 sm:py-16 bg-white border-b border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Актуально</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold">Новости {brandName}</h2>
              </div>
              <Link href="/news" className="flex items-center gap-2 text-[#0070b8] font-bold hover:gap-3 transition-all text-sm whitespace-nowrap">
                Все новости <ArrowRight className="w-4 h-4" />
              </Link>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {news.map((n, i) => (
                <FadeIn key={n.id} delay={i * 0.1}>
                  <Link href={`/news/${n.slug}`}
                    className="block bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
                    {n.image && (
                      <div className="h-44 overflow-hidden">
                        <img src={n.image} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                      </div>
                    )}
                    <div className="p-5">
                      {n.published_at && (
                        <p className="text-xs font-semibold text-slate-400 mb-2">
                          {new Date(n.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      )}
                      <h3 className="font-extrabold text-sm leading-snug group-hover:text-[#0070b8] transition-colors">{n.title}</h3>
                      {n.excerpt && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{n.excerpt}</p>}
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA block ────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-gradient-to-br from-[#0070b8] to-[#005a94]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            {brand.logoUrl && (
              <div className="w-20 h-12 bg-white/20 rounded-xl flex items-center justify-center p-2 mx-auto mb-6">
                <img src={brand.logoUrl} alt={brandName} className="w-full h-full object-contain" loading="lazy" decoding="async" />
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-4">
              Интересует {brandName}?
            </h2>
            <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto mb-8">
              Оставьте заявку — менеджер подберёт автомобиль, рассчитает кредит и запишет на тест-драйв.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={() => setModal("testdrive")}
                className="inline-flex items-center gap-2 bg-white text-[#0070b8] font-bold px-8 py-4 rounded-xl text-base hover:bg-slate-50 transition-colors shadow-xl">
                <Car className="w-5 h-5" /> Тест-драйв
              </button>
              <button onClick={() => setModal("callback")}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors border border-white/30">
                <Phone className="w-5 h-5" /> Перезвоните мне
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Modal ────────────────────────────────────────── */}
      {modal && (
        <CTAModal
          title={modal === "testdrive" ? "Записаться на тест-драйв" : "Заказать звонок"}
          brandName={brandName}
          onClose={() => setModal(null)}
        />
      )}
    </Layout>
  );
}
