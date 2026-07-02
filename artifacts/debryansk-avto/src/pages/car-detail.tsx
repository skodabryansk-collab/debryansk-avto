import React, { useState, useMemo } from "react";
import { CTPhoneDesktop, CTPhoneMobile } from "@/components/CTPhone";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, ChevronLeft, ChevronRight, Phone, User,
  CheckCircle, X, Calendar, Gauge, Palette, MapPin, Shield,
  Heart, Scale, CreditCard, ArrowLeftRight, Sparkles
} from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import SEO from "@/components/SEO";
import { CreditModal } from "@/components/modals/CreditModal";
import { TradeInModal } from "@/components/modals/TradeInModal";
import Layout from "@/components/Layout";
import DisclaimerBadge from "@/components/DisclaimerBadge";
import { PageCarProvider } from "@/context/PageCarContext";
import PhotoLightbox from "@/components/PhotoLightbox";

interface CarRecord {
  id: string;
  mark: string;
  model: string;
  modification: string;
  year: number;
  price: number;
  run: number;
  color: string;
  bodyType: string;
  availability: string;
  url: string;
  images: string[];
  ownersNumber: string;
  state: string;
  extras: string;
  description: string;
  vin: string;
  complectation: string;
  custom: string;
  doorsCount: number;
  wheel: string;
  armored: string;
  phone: string;
  maxDiscount: number;
  creditDiscount: number;
  tradeinDiscount: number;
}

function parseTransmission(mod: string): string {
  if (!mod) return "";
  if (mod.includes("AMT")) return "Робот";
  if (mod.includes("CVT")) return "Вариатор";
  if (mod.includes(" AT")) return "Автомат";
  if (mod.includes("MT")) return "Механика";
  return "";
}
function parseDrive(mod: string): string {
  if (!mod) return "";
  return mod.includes("4WD") ? "Полный" : "Передний/задний";
}
function parseEngine(mod: string): string {
  const m = mod.match(/(\d+\.\d+)\s*([\w]+)\s*\((\d+)\s*л\.с\.\)/);
  if (m) return `${m[1]} л, ${m[3]} л.с.`;
  const hp = mod.match(/\((\d+)\s*л\.с\.\)/);
  if (hp) return `${hp[1]} л.с.`;
  return "";
}
function parseFuelType(mod: string): string {
  if (!mod) return "";
  const l = mod.toLowerCase();
  if (l.includes("электр") || l.includes("ev") || l.includes("electric")) return "Electric";
  if (l.includes("гибрид") || l.includes("hybrid") || l.includes("phev") || l.includes("hev")) return "Hybrid";
  if (l.includes("дизель") || l.includes("diesel")) return "Diesel";
  return "Gasoline";
}
function formatPrice(p: number) {
  return p.toLocaleString("ru-RU") + " ₽";
}
function formatRun(km: number) {
  return km < 1000 ? km + " км" : Math.round(km / 1000) + " тыс. км";
}

interface NewCarRecord {
  id: string;
  mark: string;
  model: string;
  year: number;
  price: number;
  maxDiscount: number;
  images: string[];
}

const DEALER_BRANDS = ["Jaecoo", "OMODA", "Tenet", "Haval", "Jetour", "Soueast"];

async function fetchCars(): Promise<CarRecord[]> {
  const r = await fetch("/api/cars/used");
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Unknown error");
  return json.data as CarRecord[];
}

async function fetchNewCars(): Promise<NewCarRecord[]> {
  const r = await fetch("/api/cars/new");
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Unknown error");
  return json.data as NewCarRecord[];
}

async function fetchBrandLocations(): Promise<Record<string, { phone: string; locationTitle: string }>> {
  const r = await fetch("/api/brand-locations");
  if (!r.ok) return {};
  const json = await r.json();
  return json.ok ? json.data : {};
}

async function fetchReviewsAggregate(): Promise<{ avg: number; total: number; overallCount: number }> {
  try {
    const r = await fetch("/api/reviews/aggregate");
    if (!r.ok) return { avg: 4.9, total: 0, overallCount: 0 };
    const json = await r.json();
    return json.ok ? { avg: json.avg, total: json.total, overallCount: json.overallCount } : { avg: 4.9, total: 0, overallCount: 0 };
  } catch { return { avg: 4.9, total: 0, overallCount: 0 }; }
}

function LeadModal({ car, onClose }: { car: CarRecord; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !isPhoneValid(phone)) return;
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden"
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
          <X className="w-4 h-4 text-slate-600" />
        </button>
        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
            <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
            <p className="text-slate-500 text-sm">Менеджер свяжется с вами в ближайшее время.</p>
            <button onClick={onClose}
              className="mt-6 w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm">Закрыть</button>
          </div>
        ) : (
          <div className="p-6">
            <h3 className="text-lg font-extrabold mb-1">{car.mark} {car.model}</h3>
            {car.maxDiscount > 0 ? (
              <p className="text-[#0070b8] font-bold text-xl mb-5">
                от {formatPrice(car.price - car.maxDiscount)}
                <DisclaimerBadge type="price-from-used" />
              </p>
            ) : (
              <p className="text-[#0070b8] font-bold text-xl mb-5">{formatPrice(car.price)}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ваше имя" required
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8]" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="+7 (___) ___-__-__" required type="tel" inputMode="tel" maxLength={18}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8]" />
              </div>
              <button type="submit"
                className="w-full brand-gradient text-white font-bold rounded-xl py-3.5 text-sm">
                Отправить заявку
              </button>
              <p className="text-[10px] text-slate-400 text-center pb-2">
                Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
              </p>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Gallery({
  imgs, imgIdx, setImgIdx, availability
}: {
  imgs: string[];
  imgIdx: number;
  setImgIdx: React.Dispatch<React.SetStateAction<number>>;
  availability?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className="relative w-full bg-white overflow-hidden" style={{ aspectRatio: "16/9", maxHeight: "70vh" }}>
        {imgs.length > 0 ? (
          <img
            src={imgs[imgIdx]}
            alt="Фото автомобиля"
            className="absolute inset-0 w-full h-full object-contain cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
            <Car className="w-20 h-20" />
          </div>
        )}
        {availability && (
          <span className="absolute top-3 left-3 bg-[#87b63c] text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {availability}
          </span>
        )}
        {imgs.length > 1 && (
          <>
            <button
              onClick={() => setImgIdx(i => (i - 1 + imgs.length) % imgs.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setImgIdx(i => (i + 1) % imgs.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
            <span className="absolute bottom-3 right-3 bg-black/55 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {imgIdx + 1} / {imgs.length}
            </span>
          </>
        )}
      </div>
      {imgs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-white border-b border-slate-100" style={{ scrollbarWidth: "none" }}>
          {imgs.map((src, i) => (
            <button
              key={i}
              onClick={() => { setImgIdx(i); setLightboxOpen(true); }}
              className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                i === imgIdx ? "border-[#0070b8]" : "border-transparent opacity-55 hover:opacity-90"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      {lightboxOpen && imgs.length > 0 && (
        <PhotoLightbox
          images={imgs}
          initialIndex={imgIdx}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export default function UsedCarDetail() {
  const [, params] = useRoute("/cars/:id");
  const id = params?.id ?? "";

  const { data: cars = [], isLoading, isError } = useQuery<CarRecord[]>({
    queryKey: ["used-cars"],
    queryFn: fetchCars,
    staleTime: 5 * 60 * 1000,
  });

  const { data: newCars = [] } = useQuery<NewCarRecord[]>({
    queryKey: ["new-cars"],
    queryFn: fetchNewCars,
    staleTime: 5 * 60 * 1000,
  });

  const { data: brandLocations = {} } = useQuery<Record<string, { phone: string; locationTitle: string }>>({
    queryKey: ["brand-locations"],
    queryFn: fetchBrandLocations,
    staleTime: 10 * 60 * 1000,
  });

  const { data: reviewStats } = useQuery<{ avg: number; total: number; overallCount: number }>({
    queryKey: ["reviews-aggregate"],
    queryFn: fetchReviewsAggregate,
    staleTime: 60 * 60 * 1000,
  });

  const car = cars.find(c => c.id === id);

  const similarUsed = useMemo(() => {
    if (!car) return [];

    const sameBrand = cars
      .filter(c => c.id !== car.id && c.mark === car.mark && Math.abs(c.price - car.price) / car.price <= 0.40)
      .sort((a, b) => Math.abs(a.price - car.price) - Math.abs(b.price - car.price))
      .slice(0, 4);

    if (sameBrand.length >= 4) return sameBrand;

    const usedIds = new Set([car.id, ...sameBrand.map(c => c.id)]);
    const crossBrand = cars
      .filter(c => !usedIds.has(c.id) && Math.abs(c.price - car.price) / car.price <= 0.25)
      .sort((a, b) => Math.abs(a.price - car.price) - Math.abs(b.price - car.price))
      .slice(0, 4 - sameBrand.length);

    return [...sameBrand, ...crossBrand];
  }, [cars, car]);

  const sameNew = useMemo(() => {
    if (!car || !DEALER_BRANDS.some(b => b.toLowerCase() === car.mark.toLowerCase())) return [];
    const baseModel = (m: string) => m.split(",")[0].trim().toLowerCase();
    return newCars
      .filter(c =>
        c.mark.toLowerCase() === car.mark.toLowerCase() &&
        baseModel(c.model) === baseModel(car.model)
      )
      .sort((a, b) => (a.price - (a.maxDiscount || 0)) - (b.price - (b.maxDiscount || 0)))
      .slice(0, 3);
  }, [newCars, car]);
  const carMark = car?.mark?.toLowerCase() ?? "";
  /* Автомобили с пробегом: телефон из локации Супонево */
  const { data: allLocations = [] } = useQuery({
    queryKey: ["detail-locations"],
    queryFn: async () => {
      const r = await fetch("/api/locations");
      if (!r.ok) throw new Error("API error");
      const json = await r.json();
      return json.ok ? json.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const suponevo = allLocations.find((l: any) => l.title === "Супонево");
  const locationPhone = suponevo?.phone ?? "+7 (4832) 77 77 70";
  const locationPhoneTel = "tel:+" + locationPhone.replace(/\D/g, "");

  const [imgIdx, setImgIdx] = useState(0);
  const [showLead, setShowLead] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showTradeIn, setShowTradeIn] = useState(false);
  const imgs = car?.images.filter(Boolean) ?? [];
  const { favorites, compare, isFavorite, isInCompare, toggleFavorite, toggleCompare } = useCarStorage();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-slate-400">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-30 animate-pulse" />
            <p className="font-semibold">Загрузка...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !car) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-slate-400">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">Автомобиль не найден</p>
            <Link href="/cars" className="mt-3 inline-block text-sm font-bold text-[#0070b8] hover:underline">
              Вернуться в каталог
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const transmission = parseTransmission(car.modification);
  const drive = parseDrive(car.modification);
  const engine = parseEngine(car.modification);

  const specs = [
    { label: "Год выпуска", value: String(car.year), icon: <Calendar className="w-4 h-4 text-[#0070b8]" /> },
    { label: "Пробег", value: formatRun(car.run), icon: <Gauge className="w-4 h-4 text-[#0070b8]" /> },
    { label: "Кузов", value: car.bodyType, icon: <Car className="w-4 h-4 text-[#0070b8]" /> },
    { label: "Цвет", value: car.color, icon: <Palette className="w-4 h-4 text-[#0070b8]" /> },
    ...(transmission ? [{ label: "Коробка", value: transmission, icon: <span className="text-[10px] font-black text-[#0070b8]">КП</span> }] : []),
    ...(drive ? [{ label: "Привод", value: drive, icon: <span className="text-[10px] font-black text-[#0070b8]">4×</span> }] : []),
    ...(engine ? [{ label: "Двигатель", value: engine, icon: <span className="text-[10px] font-black text-[#0070b8]">ДВС</span> }] : []),
    ...(car.ownersNumber ? [{ label: "Владельцы", value: car.ownersNumber + " влад.", icon: <User className="w-4 h-4 text-[#0070b8]" /> }] : []),
  ].filter(s => s.value);

  const PriceCard = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0070b8] mb-1.5">С пробегом</p>
      <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 leading-tight mb-1">
        {car.mark} {car.model}
      </h1>
      {car.modification && (
        <p className="text-xs sm:text-sm text-slate-400 mb-3 leading-snug">{car.modification}</p>
      )}
      {car.maxDiscount > 0 ? (
        <div className="mb-1">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Цена от</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#0070b8]">{formatPrice(car.price - car.maxDiscount)}</span>
            <DisclaimerBadge type="price-from-used" />
          </div>
          <p className="text-sm text-slate-400 line-through mb-1">{formatPrice(car.price)}</p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {car.creditDiscount > 0 && (
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100">
                <CreditCard className="w-3 h-3" /> Кредит −{formatPrice(car.creditDiscount)}
              </span>
            )}
            {car.tradeinDiscount > 0 && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-100">
                <ArrowLeftRight className="w-3 h-3" /> Trade-in −{formatPrice(car.tradeinDiscount)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-1">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{formatPrice(car.price)}</span>
        </div>
      )}
      <p className="text-xs text-slate-400 mb-4">Цена окончательная, торг уместен</p>
      <div className="hidden lg:flex gap-2 mb-3">
        <button
          onClick={() => toggleFavorite({
            id: car.id, mark: car.mark, model: car.model, year: car.year, price: car.price,
            run: car.run, color: car.color, bodyType: car.bodyType, modification: car.modification,
            images: car.images, availability: car.availability, url: car.url, type: "used" as const,
          })}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            isFavorite(car.id)
              ? "bg-red-50 text-red-600 border border-red-200"
              : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-red-200 hover:text-red-500"
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite(car.id) ? "fill-current" : ""}`} />
          {isFavorite(car.id) ? "В избранном" : "В избранное"}
        </button>
        <button
          onClick={() => toggleCompare({
            id: car.id, mark: car.mark, model: car.model, year: car.year, price: car.price,
            run: car.run, color: car.color, bodyType: car.bodyType, modification: car.modification,
            images: car.images, availability: car.availability, url: car.url, type: "used" as const,
            extras: car.extras, complectation: car.complectation, vin: car.vin,
          })}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            isInCompare(car.id)
              ? "bg-[#0070b8]/10 text-[#0070b8] border border-[#0070b8]/20"
              : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-[#0070b8]/30 hover:text-[#0070b8]"
          }`}
        >
          <Scale className="w-4 h-4" />
          {isInCompare(car.id) ? "В сравнении" : "Сравнить"}
        </button>
      </div>
      <div className="space-y-2.5">
        <button
          onClick={() => setShowLead(true)}
          className="w-full brand-gradient text-white font-bold rounded-xl py-3.5 text-sm hover:opacity-90 transition-opacity"
        >
          Оставить заявку
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowCredit(true)}
            className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 font-bold rounded-xl py-2.5 text-sm border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <CreditCard className="w-4 h-4" /> Кредит
          </button>
          <button
            onClick={() => setShowTradeIn(true)}
            className="flex items-center justify-center gap-1.5 bg-green-50 text-green-700 font-bold rounded-xl py-2.5 text-sm border border-green-100 hover:bg-green-100 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Trade-In
          </button>
        </div>
        <CTPhoneDesktop className="hidden lg:flex w-full items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8] text-slate-700 font-bold rounded-xl py-3 text-sm transition-colors"
          phone={locationPhone} />
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
        {[
          { label: "Год", value: String(car.year) },
          { label: "Пробег", value: formatRun(car.run) },
          { label: "Цвет", value: car.color },
          ...(transmission ? [{ label: "КПП", value: transmission }] : []),
          ...(car.ownersNumber ? [{ label: "Владельцев", value: car.ownersNumber }] : []),
        ].map((row, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-slate-400">{row.label}</span>
            <span className="font-bold text-slate-800">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const priceValidUntil = new Date(new Date().getFullYear(), 11, 31).toISOString().split("T")[0];
  const carImages = car ? car.images.filter(Boolean).slice(0, 5) : [];

  const carJsonLd = car ? {
    "@type": "Car",
    "name": `${car.mark} ${car.model} ${car.year}`,
    "description": car.description || `Автомобиль с пробегом ${car.mark} ${car.model} ${car.year} года, пробег ${formatRun(car.run)}, кузов ${car.bodyType}, цвет ${car.color}. Дебрянск Авто, Брянск.`,
    "brand": { "@type": "Brand", "name": car.mark },
    "model": car.model,
    "vehicleTransmission": parseTransmission(car.modification),
    "driveWheelConfiguration": parseDrive(car.modification),
    "vehicleEngine": {
      "@type": "EngineSpecification",
      "name": parseEngine(car.modification)
    },
    "mileageFromOdometer": { "@type": "QuantitativeValue", "value": car.run, "unitCode": "KMT" },
    "fuelType": parseFuelType(car.modification),
    "color": car.color,
    "vehicleInteriorColor": car.color,
    "bodyType": car.bodyType,
    ...(car.vin ? { "vehicleIdentificationNumber": car.vin } : {}),
    ...(car.doorsCount ? { "numberOfDoors": car.doorsCount } : {}),
    "offers": {
      "@type": "Offer",
      "price": car.price,
      "priceCurrency": "RUB",
      "priceValidUntil": priceValidUntil,
      "availability": car.availability === "В наличии" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      "itemCondition": "https://schema.org/UsedCondition",
      "seller": {
        "@type": "AutoDealer",
        "name": "Дебрянск Авто",
        "url": "https://debryansk-auto.ru",
        "address": { "@type": "PostalAddress", "addressLocality": "Брянск", "addressCountry": "RU" }
      }
    },
    ...(reviewStats && reviewStats.overallCount > 0 ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": reviewStats.avg,
        "reviewCount": reviewStats.overallCount,
        "bestRating": 5,
        "worstRating": 1
      }
    } : {}),
    "image": carImages.length > 1 ? carImages : (carImages[0] ?? ""),
    "url": `https://debryansk-auto.ru/cars/${car.id}`,
    "productionDate": String(car.year)
  } : undefined;

  return (
    <PageCarProvider car={{ carId: car.id, brand: car.mark, model: car.model, year: car.year, price: car.price, isNew: false, bodyType: car.bodyType, run: car.run }}>
    <Layout>
      {car && (
        <SEO
          title={`${car.mark} ${car.model} ${car.year} год за ${formatPrice(car.price)}`}
          description={`Автомобиль ${car.mark} ${car.model}, ${car.year} год, пробег ${formatRun(car.run)}, кузов ${car.bodyType}, цвет ${car.color}, комплектация ${car.modification}. Дебрянск Авто.`}
          canonical={`/cars/${car.id}`}
          image={car.images.filter(Boolean)[0] || "/opengraph.jpg"}
          type="product"
          jsonLd={carJsonLd}
          breadcrumbs={[
            { name: "Главная", url: "/" },
            { name: "Автомобили с пробегом", url: "/cars" },
            { name: `${car.mark} ${car.model} ${car.year}`, url: `/cars/${car.id}` },
          ]}
        />
      )}

      {/* ── MOBILE layout (< lg) ── */}
      <div className="lg:hidden">
        {/* Gallery — full viewport width */}
        <Gallery imgs={imgs} imgIdx={imgIdx} setImgIdx={setImgIdx} availability={car.availability} />

        {/* Price + specs below */}
        <div className="px-4 py-4 space-y-4">
          <PriceCard />

          {/* Specs */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <h2 className="text-sm font-extrabold mb-3 text-slate-900">Характеристики</h2>
            <div className="grid grid-cols-2 gap-2">
              {specs.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                  <span className="shrink-0 w-5 h-5 flex items-center justify-center">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          {car.extras && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <h2 className="text-sm font-extrabold mb-3 text-slate-900">Опции и комплектация</h2>
              <div className="flex flex-wrap gap-1.5">
                {car.extras.split(", ").filter(Boolean).map((opt, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-100">
                    <CheckCircle className="w-2.5 h-2.5 text-[#87b63c]" /> {opt.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Guarantees */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Shield className="w-4 h-4 text-[#0070b8]" />, title: "Юр. чистота" },
              { icon: <Gauge className="w-4 h-4 text-[#0070b8]" />, title: "Диагностика" },
              { icon: <MapPin className="w-4 h-4 text-[#0070b8]" />, title: "Тест-драйв" },
            ].map((g, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3 flex flex-col gap-1.5">
                {g.icon}
                <p className="text-[10px] font-extrabold text-slate-800 leading-snug">{g.title}</p>
              </div>
            ))}
          </div>

          {/* Similar used */}
          {similarUsed.length > 0 && (
            <div>
              <h2 className="text-sm font-extrabold mb-3 text-slate-900">Похожие с пробегом</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
                {similarUsed.map(c => (
                  <Link key={c.id} href={`/cars/${c.id}`}>
                    <div className="snap-start shrink-0 w-44 rounded-2xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-shadow cursor-pointer">
                      <div className="h-28 bg-slate-50 overflow-hidden">
                        {c.images[0]
                          ? <img src={c.images[0]} className="w-full h-full object-cover" loading="lazy" decoding="async" alt={`${c.mark} ${c.model}`} />
                          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Car className="w-8 h-8" /></div>
                        }
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-extrabold text-slate-900 truncate">{c.mark} {c.model}</p>
                        <p className="text-[10px] text-slate-400">{c.year} · {formatRun(c.run)}</p>
                        <p className="text-sm font-extrabold text-[#0070b8] mt-0.5">{formatPrice(c.price)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Same new */}
          {sameNew.length > 0 && (
            <div className="pb-20">
              <h2 className="text-sm font-extrabold mb-3 text-slate-900">Такой же новый</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
                {sameNew.map(c => (
                  <Link key={c.id} href={`/new-cars/${encodeURIComponent(c.id)}`}>
                    <div className="snap-start shrink-0 w-44 rounded-2xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-shadow cursor-pointer">
                      <div className="relative h-28 bg-slate-50 overflow-hidden">
                        {c.images[0]
                          ? <img src={c.images[0]} className="w-full h-full object-cover" loading="lazy" decoding="async" alt={`${c.mark} ${c.model}`} />
                          : <div className="w-full h-full flex items-center justify-center text-slate-200"><Car className="w-8 h-8" /></div>
                        }
                        <span className="absolute top-2 left-2 bg-[#0070b8] text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Новый
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-extrabold text-slate-900 truncate">{c.mark} {c.model}</p>
                        <p className="text-[10px] text-slate-400">{c.year}</p>
                        <p className="text-sm font-extrabold text-[#0070b8] mt-0.5">{formatPrice(c.price - (c.maxDiscount || 0))}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Spacer for sticky bottom bar when no "same new" block */}
          {sameNew.length === 0 && <div className="pb-20" />}
        </div>
      </div>

      {/* ── DESKTOP layout (lg+) ── */}
      <div className="hidden lg:block container mx-auto px-6 py-10 max-w-6xl">
        <div className="grid grid-cols-[1fr_360px] gap-8 items-start">
          {/* Left */}
          <div className="min-w-0">
            <div className="rounded-2xl overflow-hidden border border-slate-100">
              <Gallery imgs={imgs} imgIdx={imgIdx} setImgIdx={setImgIdx} availability={car.availability} />
            </div>

            {/* Specs */}
            <div className="mt-5 bg-white rounded-2xl border border-slate-100 p-6">
              <h2 className="text-base font-extrabold mb-4 text-slate-900">Характеристики</h2>
              <div className="grid grid-cols-2 gap-3">
                {specs.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center">{s.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options */}
            {car.extras && (
              <div className="mt-5 bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-base font-extrabold mb-4 text-slate-900">Опции и комплектация</h2>
                <div className="flex flex-wrap gap-2">
                  {car.extras.split(", ").filter(Boolean).map((opt, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-100">
                      <CheckCircle className="w-3 h-3 text-[#87b63c]" /> {opt.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Guarantees */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { icon: <Shield className="w-5 h-5 text-[#0070b8]" />, title: "Юридическая чистота", desc: "Проверка по базам ГИБДД и ФССП" },
                { icon: <Gauge className="w-5 h-5 text-[#0070b8]" />, title: "Техническая проверка", desc: "Диагностика на 150+ пунктов" },
                { icon: <MapPin className="w-5 h-5 text-[#0070b8]" />, title: "Тест-драйв", desc: "Запишитесь на бесплатный тест" },
              ].map((g, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-2">
                  {g.icon}
                  <p className="text-xs font-extrabold text-slate-800">{g.title}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{g.desc}</p>
                </div>
              ))}
            </div>

            {/* Similar used — desktop */}
            {similarUsed.length > 0 && (
              <div className="mt-6">
                <h2 className="text-base font-extrabold mb-4 text-slate-900">Похожие с пробегом</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
                  {similarUsed.map(c => (
                    <Link key={c.id} href={`/cars/${c.id}`}>
                      <div className="snap-start shrink-0 w-52 rounded-2xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-shadow cursor-pointer">
                        <div className="h-32 bg-slate-50 overflow-hidden">
                          {c.images[0]
                            ? <img src={c.images[0]} className="w-full h-full object-cover" loading="lazy" decoding="async" alt={`${c.mark} ${c.model}`} />
                            : <div className="w-full h-full flex items-center justify-center text-slate-200"><Car className="w-10 h-10" /></div>
                          }
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-extrabold text-slate-900 truncate">{c.mark} {c.model}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.year} · {formatRun(c.run)}</p>
                          <p className="text-base font-extrabold text-[#0070b8] mt-1">{formatPrice(c.price)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Same new — desktop */}
            {sameNew.length > 0 && (
              <div className="mt-6">
                <h2 className="text-base font-extrabold mb-4 text-slate-900">Такой же новый</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
                  {sameNew.map(c => (
                    <Link key={c.id} href={`/new-cars/${encodeURIComponent(c.id)}`}>
                      <div className="snap-start shrink-0 w-52 rounded-2xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-shadow cursor-pointer">
                        <div className="relative h-32 bg-slate-50 overflow-hidden">
                          {c.images[0]
                            ? <img src={c.images[0]} className="w-full h-full object-cover" loading="lazy" decoding="async" alt={`${c.mark} ${c.model}`} />
                            : <div className="w-full h-full flex items-center justify-center text-slate-200"><Car className="w-10 h-10" /></div>
                          }
                          <span className="absolute top-2 left-2 bg-[#0070b8] text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Новый
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-extrabold text-slate-900 truncate">{c.mark} {c.model}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.year}</p>
                          <p className="text-base font-extrabold text-[#0070b8] mt-1">{formatPrice(c.price - (c.maxDiscount || 0))}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — sticky price card */}
          <div className="sticky top-[72px]">
            <PriceCard />
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{car.mark} {car.model}</p>
          {car.maxDiscount > 0 ? (
            <div className="flex items-baseline gap-1.5">
              <p className="text-base font-extrabold text-[#0070b8] leading-tight">от {formatPrice(car.price - car.maxDiscount)}</p>
              <p className="text-[11px] text-slate-400 line-through">{formatPrice(car.price)}</p>
              <DisclaimerBadge type="price-from-used" />
            </div>
          ) : (
            <p className="text-base font-extrabold text-slate-900 leading-tight">{formatPrice(car.price)}</p>
          )}
        </div>
        <CTPhoneMobile className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-600 shrink-0"
          phone={locationPhone} />
        <button
          onClick={() => setShowLead(true)}
          className="brand-gradient text-white font-bold rounded-xl px-5 py-3 text-sm shrink-0 hover:opacity-90 transition-opacity"
        >
          Заявка
        </button>
      </div>

      <AnimatePresence>
        {showLead && <LeadModal car={car} onClose={() => setShowLead(false)} />}
        {showCredit && <CreditModal car={car} onClose={() => setShowCredit(false)} />}
        {showTradeIn && <TradeInModal onClose={() => setShowTradeIn(false)} targetCar={{ mark: car.mark, model: car.model, year: car.year, price: car.price }} />}
      </AnimatePresence>
      <div data-prerender-ready="true" style={{ display: "none" }} />
    </Layout>
    </PageCarProvider>
  );
}
