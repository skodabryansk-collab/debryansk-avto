import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Car, ChevronLeft, ChevronRight, SearchX, LayoutGrid, LayoutList,
  SlidersHorizontal, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import SEO from "@/components/SEO";
import { TestDriveModal } from "@/components/modals/TestDriveModal";
import { CreditModal } from "@/components/modals/CreditModal";
import { TradeInModal } from "@/components/modals/TradeInModal";
import Layout from "@/components/Layout";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/CarCard";
import FilterPanel, {
  type FilterValues, type PriceRange,
  DEFAULT_FILTER_VALUES, filterCars, countActiveFilters,
} from "@/components/FilterPanel";

interface NewCarRecord {
  id: string; mark: string; model: string; modification: string; complectation: string;
  year: number; price: number; color: string; bodyType: string; availability: string;
  url: string; images: string[]; dealer: string; maxDiscount: number;
  creditDiscount: number; tradeinDiscount: number; extras: string;
  description: string; vin: string;
}

const PRICE_RANGES: PriceRange[] = [
  { label: "до 2 млн", min: 0, max: 2_000_000 },
  { label: "2–3 млн", min: 2_000_000, max: 3_000_000 },
  { label: "3–5 млн", min: 3_000_000, max: 5_000_000 },
  { label: "от 5 млн", min: 5_000_000, max: null },
];

const PAGE_SIZE = 12;

const DEALERS = ["Все бренды", "Jaecoo", "Omoda", "Tenet", "Haval City", "Haval Pro", "Jetour", "Soueast"];

function toCardData(c: NewCarRecord, rank: number): CarCardData {
  return {
    id: c.id, mark: c.mark, model: c.model, modification: c.modification,
    complectation: c.complectation, year: c.year, price: c.price, color: c.color,
    bodyType: c.bodyType, availability: c.availability, images: c.images,
    maxDiscount: c.maxDiscount, creditDiscount: c.creditDiscount,
    tradeinDiscount: c.tradeinDiscount, dealer: c.dealer, type: "new",
    popularityRank: rank,
  };
}

async function fetchNewCars(): Promise<NewCarRecord[]> {
  const r = await fetch("/api/cars/new?sort=popularity");
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const json = await r.json();
  if (!json.ok) throw new Error(json.error ?? "Unknown error");
  return json.data as NewCarRecord[];
}

function parseFiltersFromUrl(): Partial<FilterValues> {
  const p = new URLSearchParams(window.location.search);
  const get = (k: string) => p.get(k) ?? "";
  return {
    availability: p.get("av") ? p.get("av")!.split(",") : [],
    priceMin: get("pmin"), priceMax: get("pmax"),
    priceRange: p.has("pr") ? parseInt(p.get("pr")!) : null,
    bodyTypes: p.get("bt") ? p.get("bt")!.split(",") : [],
    drive: get("dr") || "Любой",
    transmission: get("tx") || "Любая",
    colors: p.get("cl") ? p.get("cl")!.split(",") : [],
    brand: get("brand"), model: get("model"),
  };
}

function syncFiltersToUrl(f: FilterValues) {
  const p = new URLSearchParams();
  if (f.availability.length) p.set("av", f.availability.join(","));
  if (f.priceMin) p.set("pmin", f.priceMin);
  if (f.priceMax) p.set("pmax", f.priceMax);
  if (f.priceRange !== null) p.set("pr", String(f.priceRange));
  if (f.bodyTypes.length) p.set("bt", f.bodyTypes.join(","));
  if (f.drive !== "Любой") p.set("dr", f.drive);
  if (f.transmission !== "Любая") p.set("tx", f.transmission);
  if (f.colors.length) p.set("cl", f.colors.join(","));
  if (f.brand) p.set("brand", f.brand);
  if (f.model) p.set("model", f.model);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

// ─── CarModelGroup ────────────────────────────────────────────────
interface CarModelGroupProps {
  cars: CarCardData[];
  filteredColors: string[];
  totalCount: number;
  onTestDrive: (car: CarCardData) => void;
  onOrder: (car: CarCardData) => void;
}

function CarModelGroup({ cars, filteredColors, totalCount, onTestDrive, onOrder }: CarModelGroupProps) {
  const first = cars[0];
  const groupKey = `group_${first.mark}_${first.model}_${first.year}_${first.modification}`;

  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem(groupKey) === "1"; } catch { return false; }
  });

  const toggleExpand = useCallback(() => {
    setExpanded(v => {
      const next = !v;
      try { sessionStorage.setItem(groupKey, next ? "1" : "0"); } catch {}
      return next;
    });
  }, [groupKey]);

  const allColors = [...new Set(cars.map(c => c.color).filter(Boolean))];
  const sorted = [...cars].sort((a, b) => (a.price - (a.maxDiscount || 0)) - (b.price - (b.maxDiscount || 0)));
  const minPrice = sorted[0].price - (sorted[0].maxDiscount || 0);
  const img = first.images.filter(Boolean)[0] ?? "";
  const MAX_COLORS = 6;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Photo strip */}
      {img && (
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          <img src={img} alt={`${first.mark} ${first.model}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {cars.length} вариантов
          </span>
        </div>
      )}
      <div className="p-3">
        <p className="text-xs text-muted-foreground">{first.mark}</p>
        <h3 className="text-sm font-medium leading-snug">{first.model}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{first.modification}</p>

        {/* Color circles */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {allColors.slice(0, MAX_COLORS).map(color => {
            const dimmed = filteredColors.length > 0 && !filteredColors.includes(color);
            return (
              <span
                key={color}
                title={color}
                className={`w-4 h-4 rounded-full border border-black/10 transition-opacity ${dimmed ? "opacity-25" : ""}`}
                style={{ background: color }}
              />
            );
          })}
          {allColors.length > MAX_COLORS && (
            <span className="text-[10px] text-muted-foreground self-center">+{allColors.length - MAX_COLORS}</span>
          )}
        </div>

        <hr className="my-2 border-border/50" />

        <p className="text-base font-medium text-slate-900">
          от {minPrice.toLocaleString("ru-RU")}&nbsp;₽
        </p>
        <p className="text-xs text-muted-foreground">{cars.length} вариантов</p>

        <button
          onClick={toggleExpand}
          className="mt-3 w-full flex items-center justify-center gap-1.5 h-9 border border-[#0070b8] text-[#0070b8] rounded-xl text-xs font-bold hover:bg-[#0070b8]/5 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Скрыть</> : <><ChevronDown className="w-3.5 h-3.5" /> Все варианты</>}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-3 grid gap-3 sm:grid-cols-2">
          {sorted.map(car => (
            <CarCard key={car.id} car={car} mode="grid" onTestDrive={onTestDrive} onOrder={onOrder} totalCount={totalCount} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recently viewed ──────────────────────────────────────────────
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
        <a key={item.id} href={`/new-cars/${encodeURIComponent(item.id)}`}
          className="text-[#0070b8] font-semibold hover:underline shrink-0">
          {item.name}
        </a>
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────
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

// ─── Main page ────────────────────────────────────────────────────
export default function NewCars() {
  const [, navigate] = useLocation();
  useCarStorage();

  const { data: rawCars = [], isLoading, isError } = useQuery<NewCarRecord[]>({
    queryKey: ["new-cars"],
    queryFn: fetchNewCars,
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
  const [sortBy, setSortBy] = useState<"popularity" | "price_asc" | "price_desc" | "newest">("popularity");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dealer, setDealer] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("dealer") || "Все бренды";
  });
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [testDriveCar, setTestDriveCar] = useState<CarCardData | null>(null);
  const [orderCar, setOrderCar] = useState<CarCardData | null>(null);
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
    setDealer("Все бренды");
    setPage(1);
  }, []);

  const handleDealerChange = useCallback((d: string) => {
    setDealer(d);
    setFilters(prev => {
      const next = { ...prev, brand: d === "Все бренды" ? "" : d, model: "" };
      syncFiltersToUrl(next);
      return next;
    });
    setPage(1);
  }, []);

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = { "Все бренды": cars.length };
    for (const d of DEALERS.slice(1)) counts[d] = cars.filter(c => c.dealer === d).length;
    return counts;
  }, [cars]);

  const availableColors = useMemo(() => {
    const src = dealer === "Все бренды" ? cars : cars.filter(c => c.dealer === dealer);
    return [...new Set(src.map(c => c.color).filter(Boolean))].sort();
  }, [cars, dealer]);

  const filtered = useMemo(() => {
    let list = filterCars(cars, filters);
    if (dealer !== "Все бренды") list = list.filter(c => c.dealer === dealer);
    return list;
  }, [cars, filters, dealer]);

  const sorted = useMemo(() => {
    if (sortBy === "popularity") return filtered; // pre-sorted by API (rank idx)
    const copy = [...filtered];
    if (sortBy === "price_asc") copy.sort((a, b) => (a.price - (a.maxDiscount || 0)) - (b.price - (b.maxDiscount || 0)));
    if (sortBy === "price_desc") copy.sort((a, b) => (b.price - (b.maxDiscount || 0)) - (a.price - (a.maxDiscount || 0)));
    if (sortBy === "newest") copy.sort((a, b) => b.year - a.year);
    return copy;
  }, [filtered, sortBy]);

  // Grouping: only when sort=popularity
  const displayItems = useMemo(() => {
    if (sortBy !== "popularity") {
      return sorted.map(car => ({ type: "card" as const, car }));
    }
    const groups = new Map<string, CarCardData[]>();
    for (const car of sorted) {
      const key = `${car.mark}|${car.model}|${car.year}|${car.modification}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(car);
    }
    const items: Array<{ type: "card"; car: CarCardData } | { type: "group"; cars: CarCardData[] }> = [];
    const seen = new Set<string>();
    for (const car of sorted) {
      const key = `${car.mark}|${car.model}|${car.year}|${car.modification}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key)!;
      if (group.length >= 3) {
        items.push({ type: "group", cars: group });
      } else {
        for (const c of group) items.push({ type: "card", car: c });
      }
    }
    return items;
  }, [sorted, sortBy]);

  const totalPages = Math.ceil(displayItems.length / PAGE_SIZE);
  const paginated = displayItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = countActiveFilters(filters) + (dealer !== "Все бренды" ? 1 : 0);

  // Top-popularity suggestions for empty state
  const topPopular = useMemo(() => cars.slice(0, 4), [cars]);

  const itemListJsonLd = !isLoading && sorted.length > 0 ? {
    "@type": "ItemList",
    "name": "Новые автомобили — Дебрянск Авто",
    "url": "https://debryansk-auto.ru/new-cars",
    "numberOfItems": sorted.length,
    "itemListElement": sorted.slice(0, 50).map((car, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "name": `${car.mark} ${car.model} ${car.year}`,
      "url": `https://debryansk-auto.ru/new-cars/${encodeURIComponent(car.id)}`,
      "image": car.images.filter(Boolean)[0] ?? "",
      "item": {
        "@type": "Car",
        "name": `${car.mark} ${car.model} ${car.year}`,
        "offers": {
          "@type": "Offer",
          "price": car.maxDiscount > 0 ? car.price - car.maxDiscount : car.price,
          "priceCurrency": "RUB",
          "availability": car.availability === "В наличии" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        },
      },
    })),
  } : undefined;

  return (
    <Layout>
      <SEO
        title="Новые автомобили в Брянске"
        description="Новые автомобили 9 брендов у официальных дилеров Брянска. Выгодное кредитование, специальные программы, гарантия производителя. Дебрянск Авто."
        canonical="/new-cars"
        jsonLd={itemListJsonLd}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Новые автомобили", url: "/new-cars" },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Header row 1 ── */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Новые автомобили</h1>
            {!isLoading && (
              <p className="text-sm text-slate-400 mt-0.5">{sorted.length} авто</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Sort select — desktop */}
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
              className="hidden sm:block border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#0070b8]"
            >
              <option value="popularity">Популярные</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="newest">Год: сначала новее</option>
            </select>
            {/* View mode icons */}
            <div className="hidden sm:flex border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-[#0070b8] text-white" : "text-slate-500 hover:text-[#0070b8]"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#0070b8] text-white" : "text-slate-500 hover:text-[#0070b8]"}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            {/* Mobile: filter button */}
            <button
              onClick={() => setFilterOpen(true)}
              className={`lg:hidden flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all ${
                activeFilterCount > 0 ? "bg-[#0070b8] text-white border-[#0070b8]" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/30 text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Brand pills ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {DEALERS.map(d => {
            const count = brandCounts[d] ?? 0;
            const active = dealer === d;
            return (
              <button
                key={d}
                onClick={() => handleDealerChange(d)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border whitespace-nowrap transition-all ${
                  active ? "bg-[#0070b8] text-white border-[#0070b8] shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8]"
                }`}
              >
                {d}
                {count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold leading-none ${active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Recently viewed ── */}
        <RecentlyViewed />

        {/* ── Main content ── */}
        <div className="flex gap-7 items-start">
          {/* FilterPanel (sidebar desktop + bottom sheet mobile) */}
          <FilterPanel
            values={filters}
            onChange={handleFilterChange}
            onReset={resetFilters}
            priceRanges={PRICE_RANGES}
            showAvailability
            showMileage={false}
            showYear={false}
            availableColors={availableColors}
            filteredCount={sorted.length}
            open={filterOpen}
            onOpenChange={setFilterOpen}
          />

          <div className="flex-1 min-w-0" id="catalog-grid">
            {/* Sort (mobile) */}
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
                <button onClick={resetFilters} className="mt-3 text-sm font-bold text-[#0070b8] hover:underline">
                  Сбросить фильтры
                </button>
                {topPopular.length > 0 && (
                  <div className="mt-8 text-left">
                    <p className="text-sm font-bold text-slate-500 mb-4">Возможно, понравится:</p>
                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {topPopular.map(car => (
                        <CarCard key={car.id} car={car} onTestDrive={setTestDriveCar} onOrder={setOrderCar} totalCount={cars.length} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !isError && sorted.length > 0 && (
              <>
                <div className={viewMode === "grid" ? "grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5" : "flex flex-col gap-3"}>
                  {paginated.map((item, i) =>
                    item.type === "group" ? (
                      <CarModelGroup
                        key={item.cars[0].id}
                        cars={item.cars}
                        filteredColors={filters.colors}
                        totalCount={cars.length}
                        onTestDrive={setTestDriveCar}
                        onOrder={setOrderCar}
                      />
                    ) : (
                      <CarCard
                        key={item.car.id}
                        car={item.car}
                        mode={viewMode}
                        onTestDrive={setTestDriveCar}
                        onOrder={setOrderCar}
                        totalCount={cars.length}
                      />
                    )
                  )}
                </div>
                <Pagination page={page} total={totalPages} onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              </>
            )}
          </div>
        </div>
      </div>

      {testDriveCar && (
        <TestDriveModal car={testDriveCar as never} onClose={() => setTestDriveCar(null)} />
      )}
      {orderCar && (
        <TestDriveModal car={orderCar as never} onClose={() => setOrderCar(null)} />
      )}
      {showTradeIn && <TradeInModal onClose={() => setShowTradeIn(false)} />}
    </Layout>
  );
}
