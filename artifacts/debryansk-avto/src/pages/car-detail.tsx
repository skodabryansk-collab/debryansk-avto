import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, ChevronLeft, ChevronRight, Phone, User,
  CheckCircle, X, Calendar, Gauge, Palette, MapPin, Shield,
  Heart, Scale
} from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import SEO from "@/components/SEO";
import miniLogo from "@/assets/mini-logo.webp";

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
function formatPrice(p: number) {
  return p.toLocaleString("ru-RU") + " ₽";
}
function formatRun(km: number) {
  return km < 1000 ? km + " км" : Math.round(km / 1000) + " тыс. км";
}

async function fetchCars(): Promise<CarRecord[]> {
  const r = await fetch("/api/cars/used");
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Unknown error");
  return json.data as CarRecord[];
}

function LeadModal({ car, onClose }: { car: CarRecord; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
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
            <p className="text-[#0070b8] font-bold text-xl mb-5">{formatPrice(car.price)}</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ваше имя" required
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8]" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__" required type="tel"
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
  return (
    <>
      <div className="relative w-full bg-white overflow-hidden" style={{ aspectRatio: "16/9", maxHeight: "70vh" }}>
        {imgs.length > 0 ? (
          <img
            src={imgs[imgIdx]}
            alt="Фото автомобиля"
            className="absolute inset-0 w-full h-full object-contain"
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
              onClick={() => setImgIdx(i)}
              className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                i === imgIdx ? "border-[#0070b8]" : "border-transparent opacity-55 hover:opacity-90"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
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

  const car = cars.find(c => c.id === id);
  const [imgIdx, setImgIdx] = useState(0);
  const [showLead, setShowLead] = useState(false);
  const imgs = car?.images.filter(Boolean) ?? [];
  const { favorites, compare, isFavorite, isInCompare, toggleFavorite, toggleCompare } = useCarStorage();

  const AppHeader = ({ backHref }: { backHref: string }) => (
    <header className="bg-[#0d0f14] text-white px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-40">
      <img src={miniLogo} alt="Дебрянск Авто" className="h-8 w-8 object-contain shrink-0" />
      <Link href={backHref} className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-semibold">
        <ArrowLeft className="w-4 h-4" /> Автомобили с пробегом
      </Link>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Link href="/favorites" className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
          <Heart className="w-4 h-4" />
          <span className="hidden sm:inline">Избранное</span>
          {favorites.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{favorites.length}</span>
          )}
        </Link>
        <Link href="/compare" className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-all">
          <Scale className="w-4 h-4" />
          <span className="hidden sm:inline">Сравнить</span>
          {compare.length > 0 && (
            <span className="bg-[#0070b8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{compare.length}</span>
          )}
        </Link>
      </div>
      {car && (
        <span className="text-xs font-bold text-white/50 hidden sm:block truncate max-w-[260px] ml-2">
          {car.mark} {car.model}, {car.year}
        </span>
      )}
    </header>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif]">
        <AppHeader backHref="/cars" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-slate-400">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-30 animate-pulse" />
            <p className="font-semibold">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !car) {
    return (
      <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif]">
        <AppHeader backHref="/cars" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-slate-400">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">Автомобиль не найден</p>
            <Link href="/cars" className="mt-3 inline-block text-sm font-bold text-[#0070b8] hover:underline">
              Вернуться в каталог
            </Link>
          </div>
        </div>
      </div>
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
      <div className="mb-1">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{formatPrice(car.price)}</span>
      </div>
      <p className="text-xs text-slate-400 mb-4">Цена окончательная, торг уместен</p>
      <div className="flex gap-2 mb-3">
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
        <a href="tel:+74832000000"
          className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8] text-slate-700 font-bold rounded-xl py-3 text-sm transition-colors">
          <Phone className="w-4 h-4" />
          +7 (4832) 000-000
        </a>
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

  const carJsonLd = car ? {
    "@type": "Vehicle",
    "name": `${car.mark} ${car.model}`,
    "brand": car.mark,
    "model": car.model,
    "vehicleTransmission": parseTransmission(car.modification),
    "driveWheelConfiguration": parseDrive(car.modification),
    "vehicleEngine": {
      "@type": "EngineSpecification",
      "name": parseEngine(car.modification)
    },
    "mileageFromOdometer": { "@type": "QuantitativeValue", "value": car.run, "unitCode": "KMT" },
    "vehicleInteriorColor": car.color,
    "bodyType": car.bodyType,
    "offers": {
      "@type": "Offer",
      "price": car.price,
      "priceCurrency": "RUB",
      "availability": "https://schema.org/InStock",
      "seller": { "@type": "AutoDealer", "name": "Дебрянск Авто" }
    },
    "image": car.images.filter(Boolean)[0],
    "url": `https://debryansk-avto.ru/cars/${car.id}`,
    "productionDate": car.year
  } : undefined;

  return (
    <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif] pb-24 lg:pb-0">
      {car && (
        <SEO
          title={`${car.mark} ${car.model} ${car.year} год за ${formatPrice(car.price)}`}
          description={`Автомобиль ${car.mark} ${car.model}, ${car.year} год, пробег ${formatRun(car.run)}, кузов ${car.bodyType}, цвет ${car.color}, комплектация ${car.modification}. Дебрянск Авто.`}
          canonical={`/cars/${car.id}`}
          image={car.images.filter(Boolean)[0] || "/opengraph.jpg"}
          type="product"
          jsonLd={carJsonLd}
        />
      )}
      <AppHeader backHref="/cars" />

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
          <p className="text-base font-extrabold text-slate-900 leading-tight">{formatPrice(car.price)}</p>
        </div>
        <a href="tel:+74832000000"
          className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-600 shrink-0">
          <Phone className="w-4 h-4" />
        </a>
        <button
          onClick={() => setShowLead(true)}
          className="brand-gradient text-white font-bold rounded-xl px-5 py-3 text-sm shrink-0 hover:opacity-90 transition-opacity"
        >
          Заявка
        </button>
      </div>

      <AnimatePresence>
        {showLead && <LeadModal car={car} onClose={() => setShowLead(false)} />}
      </AnimatePresence>
    </div>
  );
}
