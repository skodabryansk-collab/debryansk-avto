import React, { useState, useCallback, useEffect, useRef } from "react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { ymGoal } from "@/lib/ym";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Heart, Scale, ArrowLeft, Phone, User, CheckCircle, Car, ChevronDown, Wrench, Gift } from "lucide-react";
import { normalizePhone, phoneHref } from "@/lib/normalizePhone";
import { CTPhone } from "@/components/CTPhone";
import { useCarStorage } from "@/hooks/useCarStorage";
import { SiVk, SiTelegram } from "react-icons/si";
import { Helmet } from "react-helmet-async";
import miniLogo from "@/assets/mini-logo.webp";
import logoWhiteSvg from "@/assets/logo-white.svg";
import logoPng from "@/assets/logo-optimized.webp";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ChatWidget from "@/components/ChatWidget";
import { MOBILE_STICKY_SCROLL_Y, StickyMobileBar } from "@/components/StickyMobileBar";

function parseHoursSpec(raw: string | null | undefined): object[] | null {
  if (!raw) return null;
  const m = /ежедневно\s+(\d{1,2}:\d{2})[–\-](\d{1,2}:\d{2})/i.exec(raw);
  if (m) {
    const pad = (t: string) => t.length < 5 ? "0" + t : t;
    return [{
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      "opens": pad(m[1]),
      "closes": pad(m[2]),
    }];
  }
  return null;
}

/* ── Nav links ──────────────────────────────────────────── */
const NAV_LINKS: [string, string, string][] = [
  ["О группе", "about", "/about"],
  ["Для бизнеса", "corporate", "/corporate"],
  ["Выкуп", "buyout", "/buyout"],
  ["Контакты", "contacts", "/contacts"],
];

/* ── Callback modal ────────────────────────────────────────── */
function CallbackModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isPhoneValid(phone)) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("type", "callback");
      fd.append("name", name);
      fd.append("phone", phone);
      const res = await fetch("/api/send-email", { method: "POST", body: fd });
      if (res.ok) ymGoal("callback_submit");
    } catch (_) {}
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-slate-600" />
        </button>
        {sent ? (
          <div className="p-10 text-center">
            <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
            <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
            <p className="text-slate-500 text-sm">Менеджер свяжется с вами в ближайшее время.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <h3 className="text-xl font-extrabold mb-1">Заказать звонок</h3>
            <p className="text-sm text-slate-500 mb-5">Оставьте контакты и мы перезвоним вам в ближайшее время.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Имя</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <input
                    type="text" required value={name} onChange={e => setName(e.target.value)}
                    className="bg-transparent flex-1 text-sm outline-none placeholder:text-slate-400"
                    placeholder="Ваше имя"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Телефон</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <input
                    type="tel" required value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                    className="bg-transparent flex-1 text-sm outline-none placeholder:text-slate-400"
                    placeholder="+7 (___) ___-__-__"
                    maxLength={18} inputMode="tel"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full brand-gradient border-0 text-white font-bold rounded-xl h-12 hover:opacity-90">
                Отправить заявку
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────── */
export default function Layout({ children, overridePhone }: { children: React.ReactNode; overridePhone?: string | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileStickyVisible, setMobileStickyVisible] = useState(false);
  const [carsDropdownOpen, setCarsDropdownOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const servicesDropdownRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const { favorites, compare } = useCarStorage();
  const favCount = favorites.length;
  const compCount = compare.length;
  const { toast } = useToast();

  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()).then(j => j.data as Record<string, string>),
    staleTime: 5 * 60 * 1000,
  });
  const headerPhone = (overridePhone ? normalizePhone(overridePhone) : null)
    || normalizePhone(siteSettings?.header_phone)
    || "+7 (4832) 77-77-70";
  const headerPhoneTel = (overridePhone ? phoneHref(overridePhone) : null)
    || phoneHref(siteSettings?.header_phone)
    || "tel:+74832777770";

  const { data: locationsData = [] } = useQuery<Array<{ id: number; title: string; address: string; phone: string | null; hours: string | null; mapX: number | null; mapY: number | null }>>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations").then(r => r.json()).then(d => d.ok ? d.data : []),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });
  const { data: reviewStats } = useQuery<{ avg: number; total: number; overallCount: number }>({
    queryKey: ["reviews-aggregate"],
    queryFn: () => fetch("/api/reviews/aggregate").then(r => r.json()),
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });
  const { data: brandsData = [] } = useQuery<Array<{ id: number }>>({
    queryKey: ["public-brands"],
    queryFn: () => fetch("/api/brands").then(r => r.json()).then(j => j.ok ? j.data : []),
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });
  const brandsCount = brandsData.length || 13;

  const globalDealerLd = React.useMemo(() => {
    const firstHours = locationsData.find(l => l.hours)?.hours ?? null;
    const commonHoursSpec = parseHoursSpec(firstHours);
    const commonOHStr = (() => {
      if (!firstHours) return "Mo-Su 09:00-21:00";
      const mm = /ежедневно\s+(\d{1,2}:\d{2})[–\-](\d{1,2}:\d{2})/i.exec(firstHours);
      if (mm) { const pad = (t: string) => t.length < 5 ? "0" + t : t; return `Mo-Su ${pad(mm[1])}-${pad(mm[2])}`; }
      return "Mo-Su 09:00-21:00";
    })();
    const departments = locationsData.map(loc => {
      const hoursSpec = parseHoursSpec(loc.hours);
      return {
        "@type": "AutoDealer",
        "name": `Дебрянск Авто — ${loc.title}`,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": loc.address,
          "addressLocality": "Брянск",
          "addressRegion": "Брянская область",
          "addressCountry": "RU",
        },
        ...(loc.mapX != null && loc.mapY != null ? { "geo": { "@type": "GeoCoordinates", "latitude": loc.mapX, "longitude": loc.mapY } } : {}),
        ...(loc.phone ? { "telephone": phoneHref(loc.phone).replace("tel:", "") } : {}),
        ...(hoursSpec ? { "openingHoursSpecification": hoursSpec } : { "openingHours": "Mo-Su 09:00-21:00" }),
      };
    });
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      "name": "Дебрянск Авто",
      "alternateName": "Территория Автомобилей",
      "url": "https://debryansk-auto.ru",
      "telephone": "+74832777770",
      "description": `Группа автодилеров в Брянске. ${brandsCount} брендов новых авто: OMODA, JAECOO, HAVAL, Tenet, Jetour, Soueast и другие. Автомобили с пробегом, сервис, выкуп.`,
      "image": "https://debryansk-auto.ru/opengraph.jpg",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Брянск",
        "addressRegion": "Брянская область",
        "addressCountry": "RU",
      },
      "geo": { "@type": "GeoCoordinates", "latitude": 53.2434, "longitude": 34.3647 },
      "openingHours": commonOHStr,
      ...(commonHoursSpec ? { "openingHoursSpecification": commonHoursSpec } : {}),
      "sameAs": ["https://vk.com/debryansk_avto"],
      "foundingDate": "2011",
      ...(departments.length > 0 ? { "department": departments } : {}),
      ...(reviewStats && reviewStats.overallCount > 0 ? {
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": reviewStats.avg.toFixed(1),
          "reviewCount": reviewStats.overallCount,
          "bestRating": "5",
          "worstRating": "1",
        },
      } : {}),
    });
  }, [locationsData, reviewStats, brandsCount]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
      setMobileStickyVisible(window.scrollY >= MOBILE_STICKY_SCROLL_Y);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCarsDropdownOpen(false);
      }
      if (servicesDropdownRef.current && !servicesDropdownRef.current.contains(e.target as Node)) {
        setServicesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNav = useCallback((href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith("/#")) {
      window.location.href = href;
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif] flex flex-col">
      <Helmet>
        <script type="application/ld+json">{globalDealerLd}</script>
      </Helmet>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111317] text-white">
        {/* Top info bar */}
        <div className="border-b border-white/[0.07]">
          <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-10">
            <div className="flex items-center gap-4 text-[11px] font-medium text-white/40">
              <span>г. Брянск</span>
            </div>
            <div className="flex items-center gap-3">
              <CTPhone className="text-xs sm:text-sm font-bold text-white/70 hover:text-white transition-colors"
                phone={headerPhone} />
              <Button size="sm"
                data-callback-trigger
                className={`h-7 sm:h-8 px-3 sm:px-4 brand-gradient border-0 text-white font-bold rounded-lg text-[11px] sm:text-xs hover:opacity-90 ${
                  mobileStickyVisible ? "hidden sm:inline-flex" : ""
                }`}
                onClick={() => { setCallbackOpen(true); ymGoal("callback_open"); }}>
                Заказать звонок
              </Button>
            </div>
          </div>
        </div>

        {/* Main nav row */}
        <div className="container mx-auto px-4 sm:px-6 flex items-center gap-4 sm:gap-6 h-[3.75rem]">
          <motion.button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); window.location.href = "/"; }}
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
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setCarsDropdownOpen(o => !o)}
                className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  location === "/new-cars" || location === "/cars"
                    ? "text-white bg-white/10"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                }`}
              >
                Автомобили
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${carsDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {carsDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden min-w-[220px] z-50"
                  >
                    <Link href="/new-cars"
                      onClick={() => setCarsDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0070b8] transition-colors"
                    >
                      <Car className="w-4 h-4 text-[#0070b8]" />
                      Новые автомобили
                    </Link>
                    <div className="mx-4 border-t border-slate-100" />
                    <Link href="/cars"
                      onClick={() => setCarsDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0070b8] transition-colors"
                    >
                      <Car className="w-4 h-4 text-slate-400" />
                      Автомобили с пробегом
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Услуги dropdown */}
            <div className="relative" ref={servicesDropdownRef}>
              <button
                onClick={() => setServicesDropdownOpen(o => !o)}
                className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  location === "/service" || location === "/service/bonus"
                    ? "text-white bg-white/10"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                }`}
              >
                Услуги
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${servicesDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {servicesDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden min-w-[230px] z-50"
                  >
                    <Link href="/service"
                      onClick={() => setServicesDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0070b8] transition-colors"
                    >
                      <Wrench className="w-4 h-4 text-slate-400" />
                      Сервис и ТО
                    </Link>
                    <div className="mx-4 border-t border-slate-100" />
                    <Link href="/service/bonus"
                      onClick={() => setServicesDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0070b8] transition-colors"
                    >
                      <Gift className="w-4 h-4 text-[#0070b8]" />
                      Бонусная программа
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link href="/service/bonus"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/service/bonus" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              <Gift className="w-4 h-4" />
              <span>Бонусы</span>
            </Link>
            {NAV_LINKS.map(([label, id, href]) => (
              href.startsWith("/#") ? (
                <button key={id} onClick={() => handleNav(href)}
                  className="px-3 py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
                  {label}
                </button>
              ) : (
                <Link key={id} href={href}
                  className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                    location === href
                      ? "text-white bg-white/10"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  }`}>
                  {label}
                </Link>
              )
            ))}
            <Link href="/vacancies"
              className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/vacancies" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              Вакансии
            </Link>
            <Link href="/news"
              className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/news" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              Новости
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 mr-3">
            <Link href="/favorites"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/favorites" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
              <Heart className="w-4 h-4" />
              <span>Избранное</span>
              {favCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{favCount}</span>
              )}
            </Link>
            <Link href="/compare"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                location === "/compare" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"
              }`}>
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

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.07] bg-[#111317]">
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <Link href="/new-cars" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors">
                  <Car className="w-4 h-4" /> Новые автомобили
                </Link>
                <Link href="/cars" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors">
                  <Car className="w-4 h-4 opacity-60" /> Автомобили с пробегом
                </Link>
                {NAV_LINKS.map(([label, id, href]) => (
                  href.startsWith("/#") ? (
                    <button key={id} onClick={() => handleNav(href)}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors">
                      {label}
                    </button>
                  ) : (
                    <Link key={id} href={href} onClick={() => setMobileMenuOpen(false)}
                      className="text-left text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors block">
                      {label}
                    </Link>
                  )
                ))}
                <Link href="/service" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-base font-semibold py-3 border-b border-white/[0.07] text-white/60 hover:text-white transition-colors">
                  <Wrench className="w-4 h-4 opacity-60" /> Сервис и ТО
                </Link>
                <Link href="/service/bonus" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-base font-semibold py-3 border-b border-white/[0.07] text-[#0070b8] hover:text-white transition-colors">
                  <Gift className="w-4 h-4" /> Бонусы
                </Link>
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
                  <CTPhone className="text-base font-bold text-[#0070b8]" phone={headerPhone} />
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

      {/* Spacer for fixed header */}
      <div className="h-[6.25rem]" />

      {/* Main content — extra bottom padding on mobile so sticky bar never covers content */}
      <main className="flex-1 pb-[68px] md:pb-0">
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#0d0f14] text-slate-400 pt-12 sm:pt-14 pb-8 border-t border-white/[0.07]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">

            {/* О компании */}
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <img src={logoPng} alt="Дебрянск Авто" className="h-8 sm:h-9 w-auto mb-4 sm:mb-5 opacity-50 hover:opacity-100 transition-opacity" />
              <p className="text-sm text-slate-500 mb-1 leading-relaxed">
                Территория Автомобилей.
              </p>
              <p className="text-sm text-slate-500 mb-4 sm:mb-5 leading-relaxed">
                Официальный мультибрендовый дилер в Брянске с&nbsp;2011&nbsp;года.
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

            {/* Каталог */}
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Каталог</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/new-cars" className="hover:text-[#0070b8] transition-colors">Новые автомобили</Link></li>
                <li><Link href="/cars" className="hover:text-[#0070b8] transition-colors">Автомобили с пробегом</Link></li>
                <li><Link href="/buyout" className="hover:text-[#0070b8] transition-colors">Выкуп и комиссия</Link></li>
                <li><Link href="/favorites" className="hover:text-[#0070b8] transition-colors">Избранное</Link></li>
                <li><Link href="/compare" className="hover:text-[#0070b8] transition-colors">Сравнение авто</Link></li>
              </ul>
            </div>

            {/* Бренды */}
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Бренды</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/brands/omoda" className="hover:text-[#0070b8] transition-colors">OMODA</Link></li>
                <li><Link href="/brands/jaecoo" className="hover:text-[#0070b8] transition-colors">JAECOO</Link></li>
                <li><Link href="/brands/tenet" className="hover:text-[#0070b8] transition-colors">Tenet</Link></li>
                <li><Link href="/brands/jetour" className="hover:text-[#0070b8] transition-colors">Jetour</Link></li>
                <li><Link href="/brands/soueast" className="hover:text-[#0070b8] transition-colors">Soueast</Link></li>
                <li><Link href="/brands/haval-city" className="hover:text-[#0070b8] transition-colors">HAVAL City</Link></li>
                <li><Link href="/brands/haval-pro" className="hover:text-[#0070b8] transition-colors">HAVAL Pro</Link></li>
              </ul>
            </div>

            {/* Компания */}
            <div>
              <h4 className="font-bold mb-4 text-[10px] sm:text-xs tracking-widest uppercase text-white/70">Компания</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-[#0070b8] transition-colors">О группе</Link></li>
                <li><Link href="/contacts" className="hover:text-[#0070b8] transition-colors">Контакты</Link></li>
                <li><Link href="/news" className="hover:text-[#0070b8] transition-colors">Новости</Link></li>
                <li><Link href="/vacancies" className="hover:text-[#0070b8] transition-colors">Вакансии</Link></li>
                <li><Link href="/service" className="hover:text-[#0070b8] transition-colors">Сервис и ТО</Link></li>
                <li><Link href="/service/bonus" className="hover:text-[#0070b8] transition-colors">Бонусная программа</Link></li>
                <li><Link href="/corporate" className="hover:text-[#0070b8] transition-colors">Корпоративным клиентам</Link></li>
              </ul>
            </div>

          </div>

          {/* Bottom bar */}
          <div className="pt-6 sm:pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} ООО «Дебрянск Авто» — Территория Автомобилей</p>
            <div className="flex items-center gap-4">
              <Link href="/legal" className="hover:text-white transition-colors">Юридическая информация</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Callback modal */}
      <AnimatePresence>
        {callbackOpen && <CallbackModal onClose={() => setCallbackOpen(false)} />}
      </AnimatePresence>

      {/* Navigator AI chat widget */}
      <ChatWidget mobileStickyBar onOpenCallback={() => setCallbackOpen(true)} />

      {/* Sticky mobile CTA bar */}
      <StickyMobileBar
        phone={headerPhone}
        onCallbackOpen={() => setCallbackOpen(true)}
      />

    </div>
  );
}
