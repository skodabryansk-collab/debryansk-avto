import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Filter, ChevronLeft, ChevronRight, ArrowLeft, X,
  Calendar, Palette, Phone, User, CheckCircle, SlidersHorizontal, Sparkles
} from "lucide-react";
import miniLogo from "@/assets/mini-logo.webp";

interface NewCarRecord {
  id: string;
  mark: string;
  model: string;
  modification: string;
  complectation: string;
  year: number;
  price: number;
  color: string;
  bodyType: string;
  availability: string;
  url: string;
  images: string[];
  dealer: string;
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
  return mod.includes("4WD") ? "Полный" : "Передний";
}

async function fetchNewCars(): Promise<NewCarRecord[]> {
  const r = await fetch("/api/cars/new");
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Unknown error");
  return json.data as NewCarRecord[];
}

function formatPrice(p: number) {
  return p.toLocaleString("ru-RU") + " ₽";
}

const DEALER_COLORS: Record<string, string> = {
  "Jaecoo":     "#f0f4ff",
  "Omoda":      "#fff5ee",
  "Tenet":      "#edfbf3",
  "Haval Pro":  "#eef2ff",
  "Haval City": "#e8f4ff",
  "Jetour":     "#f4f0ff",
};

function LeadModal({ car, onClose }: { car: NewCarRecord; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const img = car.images.filter(Boolean)[0] ?? "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-600" />
        </button>

        {submitted ? (
          <div className="p-10 text-center">
            <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
            <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Менеджер свяжется с вами в ближайшее время для уточнения деталей.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <div className="relative h-44 bg-slate-100 overflow-hidden">
              {img ? (
                <img src={img} alt={`${car.mark} ${car.model}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Car className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="font-extrabold text-white text-lg leading-tight">
                  {car.mark} {car.model}
                </div>
                <div className="text-white/70 text-xs mt-0.5">
                  {car.year} · {car.complectation || car.modification}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-extrabold">Оставить заявку</h3>
                <span className="text-lg font-extrabold text-[#0070b8]">{formatPrice(car.price)}</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Ваше имя</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Иван Иванов"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Телефон</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+7 (___) ___-__-__"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity mt-1"
                >
                  Отправить заявку
                </button>
                <p className="text-[10px] text-slate-400 text-center leading-snug">
                  Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
                </p>
              </form>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function NewCarCard({ car, onLead }: { car: NewCarRecord; onLead: (car: NewCarRecord) => void }) {
  const [, navigate] = useLocation();
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = car.images.filter(Boolean);
  const img = imgs[imgIdx] ?? "";
  const transmission = parseTransmission(car.modification);
  const drive = parseDrive(car.modification);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col cursor-pointer"
      onClick={() => navigate(`/new-cars/${encodeURIComponent(car.id)}`)}
    >
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-16 h-16" />
          </div>
        )}
        {imgs.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + imgs.length) % imgs.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % imgs.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {imgIdx + 1}/{imgs.length}
            </span>
          </>
        )}
        <span className="absolute top-2 left-2 bg-[#0070b8] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> НОВЫЙ
        </span>
        <span
          className="absolute top-2 right-2 text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide"
          style={{ background: DEALER_COLORS[car.dealer] ?? "#f0f4ff", color: "#334155" }}
        >
          {car.dealer}
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-extrabold text-base leading-snug mb-0.5">
          {car.mark} {car.model}
        </h3>
        {car.modification && (
          <p className="text-xs text-slate-400 mb-3 leading-snug line-clamp-1">{car.modification}</p>
        )}

        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
            <Calendar className="w-3 h-3 text-[#0070b8] shrink-0" />
            <span className="text-[11px] font-bold text-slate-700">{car.year}</span>
          </div>
          {car.complectation && (
            <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5 col-span-1">
              <Sparkles className="w-3 h-3 text-[#87b63c] shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 truncate">{car.complectation}</span>
            </div>
          )}
          {transmission && (
            <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
              <span className="text-[9px] font-black text-[#0070b8] shrink-0">КП</span>
              <span className="text-[11px] font-bold text-slate-700">{transmission}</span>
            </div>
          )}
          {drive && (
            <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
              <span className="text-[9px] font-black text-[#0070b8] shrink-0">4×</span>
              <span className="text-[11px] font-bold text-slate-700">{drive}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <Palette className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500">{car.color}</span>
          {car.bodyType && (
            <>
              <span className="text-slate-200 text-sm">·</span>
              <span className="text-xs text-slate-500 truncate">{car.bodyType}</span>
            </>
          )}
        </div>

        <div className="mt-auto">
          {car.maxDiscount > 0 ? (
            <>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Цена от</span>
                <span className="text-xl font-extrabold text-[#0070b8]">
                  {formatPrice(car.price - car.maxDiscount)}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-through mb-2">{formatPrice(car.price)}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {car.creditDiscount > 0 && (
                  <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                    Кредит −{formatPrice(car.creditDiscount)}
                  </span>
                )}
                {car.tradeinDiscount > 0 && (
                  <span className="inline-flex items-center gap-0.5 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100">
                    Trade-in −{formatPrice(car.tradeinDiscount)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-xl font-extrabold text-slate-900 mb-3">{formatPrice(car.price)}</p>
          )}
          <button
            onClick={e => { e.stopPropagation(); onLead(car); }}
            className="w-full brand-gradient text-white font-bold rounded-xl py-2.5 text-sm hover:opacity-90 transition-opacity"
          >
            Оставить заявку
          </button>
        </div>
      </div>
    </motion.article>
  );
}

const PAGE_SIZE = 12;

const BODY_TYPES = [
  "Все типы",
  "Внедорожник 5 дв.",
  "Внедорожник 3 дв.",
  "Седан",
  "Хэтчбек 5 дв.",
  "Универсал 5 дв.",
  "Лифтбек",
  "Минивэн",
  "Пикап",
];
const TRANSMISSIONS = ["Любая", "Робот", "Автомат", "Механика", "Вариатор"];
const DRIVES = ["Любой", "Полный", "Передний"];
const DEALERS = ["Все дилеры", "Jaecoo", "Omoda", "Tenet", "Haval City", "Haval Pro", "Jetour"];

export default function NewCars() {
  const { data: cars = [], isLoading, isError } = useQuery<NewCarRecord[]>({
    queryKey: ["new-cars"],
    queryFn: fetchNewCars,
    staleTime: 5 * 60 * 1000,
  });

  const [filterDealer, setFilterDealer] = useState("Все дилеры");
  const [filterModel, setFilterModel] = useState("Все модели");
  const [filterAvailability, setFilterAvailability] = useState("Все");
  const [filterBodyType, setFilterBodyType] = useState("Все типы");
  const [filterTransmission, setFilterTransmission] = useState("Любая");
  const [filterDrive, setFilterDrive] = useState("Любой");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "year_desc">("price_asc");
  const [page, setPage] = useState(1);
  const [leadCar, setLeadCar] = useState<NewCarRecord | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const availableModels = useMemo(() => {
    const src = filterDealer === "Все дилеры" ? cars : cars.filter(c => c.dealer === filterDealer);
    const found = [...new Set(src.map(c => c.model))].sort();
    return ["Все модели", ...found];
  }, [cars, filterDealer]);

  const filtered = useMemo(() => {
    let list = cars;
    if (filterDealer !== "Все дилеры") list = list.filter(c => c.dealer === filterDealer);
    if (filterModel !== "Все модели") list = list.filter(c => c.model === filterModel);
    if (filterAvailability !== "Все") list = list.filter(c => c.availability === filterAvailability);
    if (filterBodyType !== "Все типы") list = list.filter(c => c.bodyType === filterBodyType);
    if (filterTransmission !== "Любая") list = list.filter(c => parseTransmission(c.modification) === filterTransmission);
    if (filterDrive !== "Любой") list = list.filter(c => parseDrive(c.modification) === filterDrive);
    const pMin = priceMin ? parseInt(priceMin.replace(/\D/g, "")) : 0;
    const pMax = priceMax ? parseInt(priceMax.replace(/\D/g, "")) : Infinity;
    if (pMin) list = list.filter(c => c.price >= pMin);
    if (pMax !== Infinity) list = list.filter(c => c.price <= pMax);
    if (sortBy === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "year_desc") list = [...list].sort((a, b) => b.year - a.year);
    return list;
  }, [cars, filterDealer, filterModel, filterAvailability, filterBodyType, filterTransmission, filterDrive, priceMin, priceMax, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function go(fn: () => void) { fn(); setPage(1); }

  function resetFilters() {
    setFilterDealer("Все дилеры");
    setFilterModel("Все модели");
    setFilterAvailability("Все");
    setFilterBodyType("Все типы");
    setFilterTransmission("Любая");
    setFilterDrive("Любой");
    setPriceMin("");
    setPriceMax("");
    setPage(1);
  }

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = { "Все дилеры": cars.length };
    for (const d of DEALERS.slice(1)) counts[d] = cars.filter(c => c.dealer === d).length;
    return counts;
  }, [cars]);

  const activeCount = [
    filterDealer !== "Все дилеры",
    filterModel !== "Все модели",
    filterAvailability !== "Все",
    filterBodyType !== "Все типы",
    filterTransmission !== "Любая",
    filterDrive !== "Любой",
    !!priceMin,
    !!priceMax,
  ].filter(Boolean).length;

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Наличие</div>
        <div className="flex flex-wrap gap-1.5">
          {["Все", "В наличии", "На заказ"].map(a => (
            <button key={a} onClick={() => go(() => setFilterAvailability(a))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                filterAvailability === a ? "bg-[#87b63c] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{a}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Дилер / Бренд</div>
        <div className="flex flex-wrap gap-1.5">
          {DEALERS.map(d => (
            <button key={d} onClick={() => go(() => { setFilterDealer(d); setFilterModel("Все модели"); })}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                filterDealer === d ? "bg-[#0070b8] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{d}</button>
          ))}
        </div>
      </div>

      {availableModels.length > 2 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Модель</div>
          <div className="flex flex-wrap gap-1.5">
            {availableModels.map(m => (
              <button key={m} onClick={() => go(() => setFilterModel(m))}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  filterModel === m ? "bg-[#0070b8] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >{m}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Цена, ₽</div>
        <div className="flex gap-2 items-center">
          <input type="number" value={priceMin} onChange={e => go(() => setPriceMin(e.target.value))}
            placeholder="от"
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0070b8] transition-colors" />
          <span className="text-slate-300 shrink-0">—</span>
          <input type="number" value={priceMax} onChange={e => go(() => setPriceMax(e.target.value))}
            placeholder="до"
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0070b8] transition-colors" />
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Тип кузова</div>
        <div className="flex flex-wrap gap-1.5">
          {BODY_TYPES.map(t => (
            <button key={t} onClick={() => go(() => setFilterBodyType(t))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                filterBodyType === t ? "bg-[#0070b8] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Коробка передач</div>
        <div className="flex flex-wrap gap-1.5">
          {TRANSMISSIONS.map(t => (
            <button key={t} onClick={() => go(() => setFilterTransmission(t))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                filterTransmission === t ? "bg-[#0070b8] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Привод</div>
        <div className="flex flex-wrap gap-1.5">
          {DRIVES.map(d => (
            <button key={d} onClick={() => go(() => setFilterDrive(d))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                filterDrive === d ? "bg-[#0070b8] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{d}</button>
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <button onClick={resetFilters}
          className="flex items-center gap-1.5 text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors">
          <X className="w-3.5 h-3.5" /> Сбросить ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif]">
      <header className="bg-[#0d0f14] text-white px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-40">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          <img src={miniLogo} alt="Дебрянск Авто" className="h-8 w-8 object-contain" />
        </a>
        <a href="/" className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Главная
        </a>
        <div className="flex-1" />
        <h1 className="text-sm sm:text-base font-extrabold text-white/90">Новые автомобили</h1>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-start justify-between mb-5 sm:mb-8 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-1">В наличии</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Новые автомобили</h2>
            {!isLoading && (
              <p className="text-sm font-semibold text-slate-400 mt-1">{filtered.length} авто</p>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`lg:hidden flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all shrink-0 ${
              filtersOpen || activeCount > 0 ? "bg-[#0070b8] text-white border-[#0070b8]" : "bg-white text-slate-700 border-slate-200"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Фильтры
            {activeCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white/30 text-white text-[10px] font-black flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Quick brand filter chips ── */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {DEALERS.map(d => {
            const isAll = d === "Все дилеры";
            const label = isAll ? "Все бренды" : d;
            const count = brandCounts[d] ?? 0;
            const active = filterDealer === d;
            return (
              <button
                key={d}
                onClick={() => go(() => { setFilterDealer(d); setFilterModel("Все модели"); })}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap ${
                  active
                    ? "bg-[#0070b8] text-white border-[#0070b8] shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8]"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile filter drawer */}
        <AnimatePresence>
          {filtersOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 bg-black/40 z-40"
                onClick={() => setFiltersOpen(false)}
              />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#0070b8]" />
                    <span className="font-extrabold text-sm">Фильтры</span>
                    {activeCount > 0 && (
                      <span className="text-[10px] font-black text-white bg-[#0070b8] rounded-full w-5 h-5 flex items-center justify-center">{activeCount}</span>
                    )}
                  </div>
                  <button onClick={() => setFiltersOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-5">
                  <FilterContent />
                </div>
                <div className="p-4 border-t border-slate-100 shrink-0">
                  <button onClick={() => setFiltersOpen(false)}
                    className="w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm">
                    Показать {filtered.length} авто
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex gap-7 items-start">
          <aside className="hidden lg:block w-60 xl:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 sticky top-[72px]">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
                <Filter className="w-4 h-4 text-[#0070b8]" />
                <span className="font-extrabold text-sm text-slate-800">Фильтры</span>
                {activeCount > 0 && (
                  <span className="ml-auto text-[10px] font-black text-white bg-[#0070b8] rounded-full w-5 h-5 flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </div>
              <FilterContent />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5 gap-3">
              <span className="text-sm text-slate-500 font-medium">
                {isLoading ? "Загрузка..." : `${filtered.length} авто`}
              </span>
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#0070b8] shrink-0"
              >
                <option value="price_asc">Цена: по возрастанию</option>
                <option value="price_desc">Цена: по убыванию</option>
                <option value="year_desc">Год: сначала новее</option>
              </select>
            </div>

            {isLoading && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
                    <div className="h-48 bg-slate-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                      <div className="h-8 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isError && (
              <div className="text-center py-20 text-slate-400">
                <Car className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-semibold">Не удалось загрузить каталог</p>
                <p className="text-sm mt-1">Попробуйте обновить страницу</p>
              </div>
            )}

            {!isLoading && !isError && (
              <>
                {paginated.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <Car className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="font-semibold">Ничего не найдено</p>
                    <button onClick={resetFilters} className="mt-3 text-sm font-bold text-[#0070b8] hover:underline">
                      Сбросить фильтры
                    </button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {paginated.map(car => (
                      <NewCarCard key={car.id} car={car} onLead={setLeadCar} />
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:border-[#0070b8] transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1;
                      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                              page === p ? "bg-[#0070b8] text-white" : "border border-slate-200 text-slate-600 hover:border-[#0070b8]"
                            }`}
                          >{p}</button>
                        );
                      }
                      if (p === 2 && page > 3) return <span key="el" className="text-slate-400 text-sm">…</span>;
                      if (p === totalPages - 1 && page < totalPages - 2) return <span key="er" className="text-slate-400 text-sm">…</span>;
                      return null;
                    })}
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                      className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:border-[#0070b8] transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {leadCar && (
          <LeadModal car={leadCar} onClose={() => setLeadCar(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
