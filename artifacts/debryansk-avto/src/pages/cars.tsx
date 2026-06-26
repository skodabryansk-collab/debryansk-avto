import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car, ChevronLeft, ChevronRight, SearchX, LayoutGrid, LayoutList, SlidersHorizontal, Clock,
} from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import SEO from "@/components/SEO";
import { CreditModal } from "@/components/modals/CreditModal";
import { TradeInModal } from "@/components/modals/TradeInModal";
import Layout from "@/components/Layout";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/CarCard";
import FilterPanel, {
  type FilterValues, type PriceRange,
  DEFAULT_FILTER_VALUES, filterCars, countActiveFilters,
} from "@/components/FilterPanel";

interface CarRecord {
  id: string; mark: string; model: string; modification: string;
  year: number; price: number; run: number; color: string; bodyType: string;
  availability: string; url: string; images: string[]; ownersNumber: string;
  state: string; extras: string; description: string; vin: string;
  complectation: string; maxDiscount: number; creditDiscount: number; tradeinDiscount: number;
}

const PRICE_RANGES: PriceRange[] = [
  { label: "до 1 млн", min: 0, max: 1_000_000 },
  { label: "1–2 млн", min: 1_000_000, max: 2_000_000 },
  { label: "2–4 млн", min: 2_000_000, max: 4_000_000 },
  { label: "4–10 млн", min: 4_000_000, max: 10_000_000 },
  { label: "от 10 млн", min: 10_000_000, max: null },
];

const PAGE_SIZE = 12;

function toCardData(c: CarRecord, rank: number): CarCardData {
  return {
    id: c.id, mark: c.mark, model: c.model, modification: c.modification,
    complectation: c.complectation, year: c.year, price: c.price, color: c.color,
    bodyType: c.bodyType, availability: c.availability, images: c.images,
    maxDiscount: c.maxDiscount, creditDiscount: c.creditDiscount,
    tradeinDiscount: c.tradeinDiscount, run: c.run, type: "used",
    popularityRank: rank,
  };
}

async function fetchUsedCars(): Promise<CarRecord[]> {
  const r = await fetch("/api/cars/used?sort=popularity");
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Unknown error");
  return json.data as CarRecord[];
}

function parseFiltersFromUrl(): Partial<FilterValues> {
  const p = new URLSearchParams(window.location.search);
  const get = (k: string) => p.get(k) ?? "";
  return {
    priceMin: get("pmin"), priceMax: get("pmax"),
    priceRange: p.has("pr") ? parseInt(p.get("pr")!) : null,
    mileageMin: get("mmin"), mileageMax: get("mmax"),
    mileageRange: p.has("mr") ? parseInt(p.get("mr")!) : null,
    bodyTypes: p.get("bt") ? p.get("bt")!.split(",") : [],
    drive: get("dr") || "Любой",
    transmission: get("tx") || "Любая",
    yearMin: get("ymin"), yearMax: get("ymax"),
    colors: p.get("cl") ? p.get("cl")!.split(",") : [],
    brand: get("brand"), model: get("model"),
  };
}

function syncFiltersToUrl(f: FilterValues) {
  const p = new URLSearchParams();
  if (f.priceMin) p.set("pmin", f.priceMin);
  if (f.priceMax) p.set("pmax", f.priceMax);
  if (f.priceRange !== null) p.set("pr", String(f.priceRange));
  if (f.mileageMin) p.set("mmin", f.mileageMin);
  if (f.mileageMax) p.set("mmax", f.mileageMax);
  if (f.mileageRange !== null) p.set("mr", String(f.mileageRange));
  if (f.bodyTypes.length) p.set("bt", f.bodyTypes.join(","));
  if (f.drive !== "Любой") p.set("dr", f.drive);
  if (f.transmission !== "Любая") p.set("tx", f.transmission);
  if (f.yearMin) p.set("ymin", f.yearMin);
  if (f.yearMax) p.set("ymax", f.yearMax);
  if (f.colors.length) p.set("cl", f.colors.join(","));
  if (f.brand) p.set("brand", f.brand);
  if (f.model) p.set("model", f.model);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function RecentlyViewed() {
  const [items, setItems] = useState<Array<{ id: string; name: string; price: number; timestamp: number }>>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("catalog_recently_viewed");
      if (raw) setItems(JSON.parse(raw).slice(0, 3));
    } catch {}
  }, []);
  if (!items.length) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap mb-4 text-xs text-slate-500">
      <div className="flex items-center gap-1 shrink-0">
        <Clock className="w-3.5 h-3.5" />
        <span className="font-semibold">Вы смотрели:</span>
      </div>
      {items.map(item => (
        <a key={item.id} href={`/cars/${encodeURIComponent(item.id)}`}
          className="text-[#0070b8] font-semibold hover:underline shrink-0">
          {item.name}
        </a>
      ))}
    </div>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}
        className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:border-[#0070b8] transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: total }).map((_, i) => {
        const p = i + 1;
        if (p !== 1 && p !== total && Math.abs(p - page) > 1) {
          if (p === page - 2 || p === page + 2) return <span key={p} className="text-slate-400 text-sm">…</span>;
          return null;
        }
        return (
          <button key={p} onClick={() => onChange(p)}
            className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${p === page ? "bg-[#0070b8] text-white" : "border border-slate-200 text-slate-600 hover:border-[#0070b8]"}`}>
            {p}
          </button>
        );
      })}
      <button disabled={page === total} onClick={() => onChange(page + 1)}
        className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40 hover:border-[#0070b8] transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function UsedCars() {
  useCarStorage();

  const { data: rawCars = [], isLoading, isError } = useQuery<CarRecord[]>({
    queryKey: ["used-cars"],
    queryFn: fetchUsedCars,
    staleTime: 5 * 60 * 1000,
  });

  const cars: CarCardData[] = useMemo(
    () => rawCars.map((c, i) => toCardData(c, i)),
    [rawCars],
  );

  const [filters, setFilters] = useState<FilterValues>(() => ({
    ...DEFAULT_FILTER_VALUES,
    ...parseFiltersFromUrl(),
  }));
  const [sortBy, setSortBy] = useState<"popularity" | "price_asc" | "price_desc" | "newest" | "run_asc">("popularity");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [creditCar, setCreditCar] = useState<CarCardData | null>(null);
  const [showTradeIn, setShowTradeIn] = useState(false);

  // Scroll restore
  useEffect(() => {
    if (sessionStorage.getItem("catalog_from_detail") === "1") {
      sessionStorage.removeItem("catalog_from_detail");
      const y = parseInt(sessionStorage.getItem("catalog_scroll") ?? "0");
      if (y) setTimeout(() => window.scrollTo({ top: y }), 100);
    }
  }, []);

  const handleFilterChange = useCallback((patch: Partial<FilterValues>) => {
    setFilters(prev => {
      const next = { ...prev, ...patch };
      syncFiltersToUrl(next);
      return next;
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    const next = { ...DEFAULT_FILTER_VALUES };
    setFilters(next);
    syncFiltersToUrl(next);
    setPage(1);
  }, []);

  const availableMarks = useMemo(() => [...new Set(cars.map(c => c.mark).filter(Boolean))].sort(), [cars]);
  const availableColors = useMemo(() => [...new Set(cars.map(c => c.color).filter(Boolean))].sort(), [cars]);

  const filtered = useMemo(() => filterCars(cars, filters), [cars, filters]);

  const sorted = useMemo(() => {
    if (sortBy === "popularity") return filtered;
    const copy = [...filtered];
    if (sortBy === "price_asc") copy.sort((a, b) => (a.price - (a.maxDiscount || 0)) - (b.price - (b.maxDiscount || 0)));
    if (sortBy === "price_desc") copy.sort((a, b) => (b.price - (b.maxDiscount || 0)) - (a.price - (a.maxDiscount || 0)));
    if (sortBy === "newest") copy.sort((a, b) => b.year - a.year);
    if (sortBy === "run_asc") copy.sort((a, b) => (a.run ?? 0) - (b.run ?? 0));
    return copy;
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilterCount = countActiveFilters(filters);
  const topPopular = useMemo(() => cars.slice(0, 4), [cars]);

  const itemListJsonLd = !isLoading && sorted.length > 0 ? {
    "@type": "ItemList",
    "name": "Автомобили с пробегом — Дебрянск Авто",
    "url": "https://debryansk-auto.ru/cars",
    "numberOfItems": sorted.length,
    "itemListElement": sorted.slice(0, 50).map((car, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "name": `${car.mark} ${car.model} ${car.year}`,
      "url": `https://debryansk-auto.ru/cars/${car.id}`,
      "image": car.images.filter(Boolean)[0] ?? "",
      "item": {
        "@type": "Car",
        "name": `${car.mark} ${car.model} ${car.year}`,
        "offers": { "@type": "Offer", "price": car.price, "priceCurrency": "RUB", "availability": "https://schema.org/InStock" },
      },
    })),
  } : undefined;

  return (
    <Layout>
      <SEO
        title="Автомобили с пробегом в Брянске"
        description="Купить авто с пробегом в Брянске. Выгодные цены, проверенные автомобили, кредит, трейд-ин. Дебрянск Авто — 9 брендов."
        canonical="/cars"
        jsonLd={itemListJsonLd}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Автомобили с пробегом", url: "/cars" },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Автомобили с пробегом</h1>
            {!isLoading && <p className="text-sm text-slate-400 mt-0.5">{sorted.length} авто</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
              className="hidden sm:block border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#0070b8]"
            >
              <option value="popularity">Популярные</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="newest">Год: сначала новее</option>
              <option value="run_asc">Пробег: меньше</option>
            </select>
            <div className="hidden sm:flex border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => setViewMode("grid")} className={`w-9 h-9 flex items-center justify-center ${viewMode === "grid" ? "bg-[#0070b8] text-white" : "text-slate-500 hover:text-[#0070b8]"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={`w-9 h-9 flex items-center justify-center ${viewMode === "list" ? "bg-[#0070b8] text-white" : "text-slate-500 hover:text-[#0070b8]"}`}>
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className={`lg:hidden flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold ${activeFilterCount > 0 ? "bg-[#0070b8] text-white border-[#0070b8]" : "bg-white text-slate-700 border-slate-200"}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
              {activeFilterCount > 0 && <span className="w-5 h-5 rounded-full bg-white/30 text-[10px] font-black flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {/* ── Brand pills ── */}
        {availableMarks.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {["Все марки", ...availableMarks].map(m => {
              const active = filters.brand === (m === "Все марки" ? "" : m);
              const count = m === "Все марки" ? cars.length : cars.filter(c => c.mark === m).length;
              return (
                <button
                  key={m}
                  onClick={() => handleFilterChange({ brand: m === "Все марки" ? "" : m, model: "" })}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border whitespace-nowrap transition-all ${active ? "bg-[#0070b8] text-white border-[#0070b8]" : "bg-white text-slate-700 border-slate-200 hover:border-[#0070b8]"}`}
                >
                  {m}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold leading-none ${active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <RecentlyViewed />

        <div className="flex gap-7 items-start">
          <FilterPanel
            values={filters}
            onChange={handleFilterChange}
            onReset={resetFilters}
            priceRanges={PRICE_RANGES}
            showAvailability={false}
            showMileage
            showYear
            availableColors={availableColors}
            filteredCount={sorted.length}
            open={filterOpen}
            onOpenChange={setFilterOpen}
          />

          <div className="flex-1 min-w-0">
            {/* Sort mobile */}
            <div className="flex items-center justify-between mb-4 gap-3 sm:hidden">
              <span className="text-sm text-slate-500">{isLoading ? "Загрузка…" : `${sorted.length} авто`}</span>
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
              >
                <option value="popularity">Популярные</option>
                <option value="price_asc">Цена ↑</option>
                <option value="price_desc">Цена ↓</option>
                <option value="newest">Год ↓</option>
                <option value="run_asc">Пробег ↑</option>
              </select>
            </div>

            {isLoading && (
              <div className={viewMode === "grid" ? "grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5" : "flex flex-col gap-3"}>
                {Array.from({ length: 6 }).map((_, i) => <CarCardSkeleton key={i} mode={viewMode} />)}
              </div>
            )}

            {isError && (
              <div className="text-center py-20 text-slate-400">
                <Car className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-semibold">Не удалось загрузить каталог</p>
                <p className="text-sm mt-1">Попробуйте обновить страницу</p>
              </div>
            )}

            {!isLoading && !isError && sorted.length === 0 && (
              <div className="text-center py-16">
                <SearchX className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="font-semibold text-slate-600">Нет авто по вашим фильтрам</p>
                <button onClick={resetFilters} className="mt-3 text-sm font-bold text-[#0070b8] hover:underline">Сбросить фильтры</button>
                {topPopular.length > 0 && (
                  <div className="mt-8 text-left">
                    <p className="text-sm font-bold text-slate-500 mb-4">Возможно, понравится:</p>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {topPopular.map(car => <CarCard key={car.id} car={car} totalCount={cars.length} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !isError && sorted.length > 0 && (
              <>
                <div className={viewMode === "grid" ? "grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5" : "flex flex-col gap-3"}>
                  {paginated.map(car => (
                    <CarCard key={car.id} car={car} mode={viewMode} totalCount={cars.length} />
                  ))}
                </div>
                <Pagination page={page} total={totalPages} onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              </>
            )}
          </div>
        </div>
      </div>

      {creditCar && <CreditModal car={creditCar as never} onClose={() => setCreditCar(null)} />}
      {showTradeIn && <TradeInModal onClose={() => setShowTradeIn(false)} />}
    </Layout>
  );
}
