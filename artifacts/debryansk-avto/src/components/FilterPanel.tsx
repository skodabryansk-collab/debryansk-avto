import React, { useEffect, useCallback, useRef } from "react";
import {
  SlidersHorizontal, X, Car, Truck, Bus,
} from "lucide-react";

export interface PriceRange { label: string; min: number; max: number | null }
export interface MileageRange { label: string; min: number; max: number | null }

export interface FilterValues {
  availability: string[];
  priceRange: number | null;
  priceMin: string;
  priceMax: string;
  mileageRange: number | null;
  mileageMin: string;
  mileageMax: string;
  bodyTypes: string[];
  drive: string;
  transmission: string;
  yearMin: string;
  yearMax: string;
  colors: string[];
  brand: string;
  model: string;
}

export const DEFAULT_FILTER_VALUES: FilterValues = {
  availability: [],
  priceRange: null,
  priceMin: "",
  priceMax: "",
  mileageRange: null,
  mileageMin: "",
  mileageMax: "",
  bodyTypes: [],
  drive: "Любой",
  transmission: "Любая",
  yearMin: "",
  yearMax: "",
  colors: [],
  brand: "",
  model: "",
};

const BODY_TYPE_OPTIONS: Array<{ label: string; matches: string[] }> = [
  { label: "Кроссовер/Внедорожник", matches: ["Внедорожник"] },
  { label: "Седан", matches: ["Седан"] },
  { label: "Пикап", matches: ["Пикап"] },
  { label: "Минивэн", matches: ["Минивэн"] },
  { label: "Хэтч/Лифтбек", matches: ["Хэтчбек", "Лифтбек"] },
];

const DRIVES = ["Любой", "Полный", "Передний"];
const TRANSMISSIONS = ["Любая", "Автомат", "Робот", "Механика", "Вариатор"];
const MILEAGE_RANGES: MileageRange[] = [
  { label: "до 50 тыс.", min: 0, max: 50000 },
  { label: "50–100 тыс.", min: 50000, max: 100000 },
  { label: "100–150 тыс.", min: 100000, max: 150000 },
  { label: "от 150 тыс.", min: 150000, max: null },
];

export function countActiveFilters(v: FilterValues): number {
  let n = 0;
  if (v.availability.length) n++;
  if (v.priceRange !== null || v.priceMin || v.priceMax) n++;
  if (v.mileageRange !== null || v.mileageMin || v.mileageMax) n++;
  if (v.bodyTypes.length) n++;
  if (v.drive !== "Любой") n++;
  if (v.transmission !== "Любая") n++;
  if (v.yearMin || v.yearMax) n++;
  if (v.colors.length) n++;
  if (v.brand) n++;
  if (v.model) n++;
  return n;
}

export function filterCars<T extends {
  availability?: string;
  price: number;
  maxDiscount?: number;
  run?: number;
  bodyType?: string;
  modification?: string;
  color?: string;
  year?: number;
  mark?: string;
  model?: string;
}>(cars: T[], f: FilterValues): T[] {
  let list = cars;
  if (f.availability.length) list = list.filter(c => f.availability.includes(c.availability ?? ""));
  const pMin = f.priceMin ? parseInt(f.priceMin.replace(/\D/g, "")) : 0;
  const pMax = f.priceMax ? parseInt(f.priceMax.replace(/\D/g, "")) : Infinity;
  if (pMin) list = list.filter(c => (c.price - (c.maxDiscount || 0)) >= pMin);
  if (pMax !== Infinity) list = list.filter(c => (c.price - (c.maxDiscount || 0)) <= pMax);
  if (f.mileageMin) list = list.filter(c => (c.run ?? 0) >= parseInt(f.mileageMin));
  if (f.mileageMax) list = list.filter(c => (c.run ?? 0) <= parseInt(f.mileageMax));
  if (f.bodyTypes.length) {
    list = list.filter(c => {
      const bt = c.bodyType ?? "";
      return f.bodyTypes.some(sel => {
        const opt = BODY_TYPE_OPTIONS.find(o => o.label === sel);
        return opt ? opt.matches.some(m => bt.includes(m)) : bt === sel;
      });
    });
  }
  if (f.drive !== "Любой") list = list.filter(c => parseDrive(c.modification ?? "").includes(f.drive));
  if (f.transmission !== "Любая") list = list.filter(c => parseTx(c.modification ?? "") === f.transmission);
  if (f.yearMin) list = list.filter(c => (c.year ?? 0) >= parseInt(f.yearMin));
  if (f.yearMax) list = list.filter(c => (c.year ?? 0) <= parseInt(f.yearMax));
  if (f.colors.length) list = list.filter(c => f.colors.includes(c.color ?? ""));
  if (f.brand) list = list.filter(c => (c.mark ?? "").toLowerCase() === f.brand.toLowerCase());
  if (f.model) list = list.filter(c => (c.model ?? "").toLowerCase() === f.model.toLowerCase());
  return list;
}

function parseTx(mod: string): string {
  if (!mod) return "";
  if (mod.includes("AMT")) return "Робот";
  if (mod.includes("CVT")) return "Вариатор";
  if (mod.includes(" AT")) return "Автомат";
  if (mod.includes("MT")) return "Механика";
  return "";
}

function parseDrive(mod: string): string {
  return mod.includes("4WD") ? "Полный" : "Передний";
}

interface FilterPanelProps {
  values: FilterValues;
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
  priceRanges: PriceRange[];
  showAvailability: boolean;
  showMileage: boolean;
  showYear: boolean;
  availableColors: string[];
  filteredCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pill = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
    active
      ? "bg-[#0070b8] text-white border-[#0070b8]"
      : "bg-white text-slate-700 border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8]"
  }`;

const sectionTitle = "text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2";

export default function FilterPanel({
  values, onChange, onReset, priceRanges,
  showAvailability, showMileage, showYear,
  availableColors, filteredCount, open, onOpenChange,
}: FilterPanelProps) {
  const priceMinRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceMaxRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mileageMinRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mileageMaxRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yearMinRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yearMaxRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounce = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, fn: () => void, ms = 500) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(fn, ms);
  };

  const activeCount = countActiveFilters(values);

  const activeTagLabels: Array<{ label: string; onRemove: () => void }> = [];
  if (values.availability.length) activeTagLabels.push({ label: `Наличие: ${values.availability.join(", ")}`, onRemove: () => onChange({ availability: [] }) });
  if (values.priceRange !== null || values.priceMin || values.priceMax) {
    const label = values.priceRange !== null ? `Цена: ${priceRanges[values.priceRange]?.label}` : `Цена: от ${values.priceMin || "…"} до ${values.priceMax || "…"}`;
    activeTagLabels.push({ label, onRemove: () => onChange({ priceRange: null, priceMin: "", priceMax: "" }) });
  }
  if (values.mileageRange !== null || values.mileageMin || values.mileageMax) {
    const label = values.mileageRange !== null ? `Пробег: ${MILEAGE_RANGES[values.mileageRange]?.label}` : "Пробег: задан";
    activeTagLabels.push({ label, onRemove: () => onChange({ mileageRange: null, mileageMin: "", mileageMax: "" }) });
  }
  if (values.bodyTypes.length) activeTagLabels.push({ label: `Кузов: ${values.bodyTypes.join(", ")}`, onRemove: () => onChange({ bodyTypes: [] }) });
  if (values.drive !== "Любой") activeTagLabels.push({ label: `Привод: ${values.drive}`, onRemove: () => onChange({ drive: "Любой" }) });
  if (values.transmission !== "Любая") activeTagLabels.push({ label: `КПП: ${values.transmission}`, onRemove: () => onChange({ transmission: "Любая" }) });
  if (values.yearMin || values.yearMax) activeTagLabels.push({ label: `Год: ${values.yearMin || "…"}–${values.yearMax || "…"}`, onRemove: () => onChange({ yearMin: "", yearMax: "" }) });
  if (values.colors.length) activeTagLabels.push({ label: `Цвет: ${values.colors.length} выбр.`, onRemove: () => onChange({ colors: [] }) });

  const toggleBodyType = useCallback((label: string) => {
    const cur = values.bodyTypes;
    onChange({ bodyTypes: cur.includes(label) ? cur.filter(b => b !== label) : [...cur, label] });
  }, [values.bodyTypes, onChange]);

  const toggleColor = useCallback((c: string) => {
    const cur = values.colors;
    onChange({ colors: cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c] });
  }, [values.colors, onChange]);

  const toggleAvailability = useCallback((v: string) => {
    const cur = values.availability;
    onChange({ availability: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] });
  }, [values.availability, onChange]);

  const content = (
    <div className="space-y-5">
      {/* Availability */}
      {showAvailability && (
        <div>
          <div className={sectionTitle}>Наличие</div>
          <div className="flex gap-2">
            {["В наличии", "На заказ"].map(v => (
              <button key={v} onClick={() => toggleAvailability(v)} className={pill(values.availability.includes(v))}>
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price */}
      <div>
        <div className={sectionTitle}>Цена, ₽</div>
        <div className="space-y-1.5 mb-2">
          {priceRanges.map((r, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="priceRange"
                checked={values.priceRange === i}
                onChange={() => onChange({
                  priceRange: i,
                  priceMin: String(r.min || ""),
                  priceMax: r.max ? String(r.max) : "",
                })}
                className="accent-[#0070b8]"
              />
              <span className="text-xs text-slate-700 group-hover:text-[#0070b8] transition-colors">{r.label}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="priceRange"
              checked={values.priceRange === null && !values.priceMin && !values.priceMax}
              onChange={() => onChange({ priceRange: null, priceMin: "", priceMax: "" })}
              className="accent-[#0070b8]"
            />
            <span className="text-xs text-slate-700 group-hover:text-[#0070b8] transition-colors">Любая</span>
          </label>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="от"
            defaultValue={values.priceMin}
            key={`pmin-${values.priceMin}`}
            onChange={e => debounce(priceMinRef, () => onChange({ priceMin: e.target.value, priceRange: null }), 500)}
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0070b8]"
          />
          <span className="text-slate-300 shrink-0 text-sm">—</span>
          <input
            type="number"
            placeholder="до"
            defaultValue={values.priceMax}
            key={`pmax-${values.priceMax}`}
            onChange={e => debounce(priceMaxRef, () => onChange({ priceMax: e.target.value, priceRange: null }), 500)}
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0070b8]"
          />
        </div>
      </div>

      {/* Mileage */}
      {showMileage && (
        <div>
          <div className={sectionTitle}>Пробег, км</div>
          <div className="space-y-1.5 mb-2">
            {MILEAGE_RANGES.map((r, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="mileageRange"
                  checked={values.mileageRange === i}
                  onChange={() => onChange({
                    mileageRange: i,
                    mileageMin: String(r.min || ""),
                    mileageMax: r.max ? String(r.max) : "",
                  })}
                  className="accent-[#0070b8]"
                />
                <span className="text-xs text-slate-700 group-hover:text-[#0070b8] transition-colors">{r.label}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="mileageRange"
                checked={values.mileageRange === null && !values.mileageMin && !values.mileageMax}
                onChange={() => onChange({ mileageRange: null, mileageMin: "", mileageMax: "" })}
                className="accent-[#0070b8]"
              />
              <span className="text-xs text-slate-700 group-hover:text-[#0070b8] transition-colors">Любой</span>
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="от"
              defaultValue={values.mileageMin}
              key={`mmin-${values.mileageMin}`}
              onChange={e => debounce(mileageMinRef, () => onChange({ mileageMin: e.target.value, mileageRange: null }), 500)}
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0070b8]"
            />
            <span className="text-slate-300 shrink-0 text-sm">—</span>
            <input
              type="number"
              placeholder="до"
              defaultValue={values.mileageMax}
              key={`mmax-${values.mileageMax}`}
              onChange={e => debounce(mileageMaxRef, () => onChange({ mileageMax: e.target.value, mileageRange: null }), 500)}
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0070b8]"
            />
          </div>
        </div>
      )}

      {/* Body type */}
      <div>
        <div className={sectionTitle}>Тип кузова</div>
        <div className="grid grid-cols-2 gap-1.5">
          {BODY_TYPE_OPTIONS.map(opt => {
            const active = values.bodyTypes.includes(opt.label);
            return (
              <button
                key={opt.label}
                onClick={() => toggleBodyType(opt.label)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-all text-left ${
                  active
                    ? "bg-[#0070b8]/10 border-[#0070b8] text-[#0070b8]"
                    : "bg-white border-slate-200 text-slate-700 hover:border-[#0070b8]"
                }`}
              >
                {opt.label === "Кроссовер/Внедорожник" && <Car className="w-3 h-3 shrink-0" />}
                {opt.label === "Пикап" && <Truck className="w-3 h-3 shrink-0" />}
                {opt.label === "Минивэн" && <Bus className="w-3 h-3 shrink-0" />}
                {(opt.label === "Седан" || opt.label === "Хэтч/Лифтбек") && <Car className="w-3 h-3 shrink-0" />}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drive */}
      <div>
        <div className={sectionTitle}>Привод</div>
        <div className="flex flex-wrap gap-1.5">
          {DRIVES.map(d => (
            <button key={d} onClick={() => onChange({ drive: d })} className={pill(values.drive === d)}>{d}</button>
          ))}
        </div>
      </div>

      {/* Transmission */}
      <div>
        <div className={sectionTitle}>Коробка передач</div>
        <div className="flex flex-wrap gap-1.5">
          {TRANSMISSIONS.map(t => (
            <button key={t} onClick={() => onChange({ transmission: t })} className={pill(values.transmission === t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Year */}
      {showYear && (
        <div>
          <div className={sectionTitle}>Год выпуска</div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="от"
              defaultValue={values.yearMin}
              key={`ymin-${values.yearMin}`}
              onChange={e => debounce(yearMinRef, () => onChange({ yearMin: e.target.value }), 500)}
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0070b8]"
            />
            <span className="text-slate-300 shrink-0 text-sm">—</span>
            <input
              type="number"
              placeholder="до"
              defaultValue={values.yearMax}
              key={`ymax-${values.yearMax}`}
              onChange={e => debounce(yearMaxRef, () => onChange({ yearMax: e.target.value }), 500)}
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0070b8]"
            />
          </div>
        </div>
      )}

      {/* Color */}
      {availableColors.length > 0 && (
        <div>
          <div className={sectionTitle}>Цвет</div>
          <div className="flex flex-wrap gap-2">
            {availableColors.map(color => {
              const active = values.colors.includes(color);
              const bg = COLOR_MAP[color] ?? "#e2e8f0";
              return (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  aria-label={color}
                  title={color}
                  className="w-[22px] h-[22px] rounded-full transition-all"
                  style={{
                    background: bg,
                    outline: active ? `2px solid var(--primary, #0070b8)` : "2px solid transparent",
                    outlineOffset: "2px",
                    border: "1.5px solid rgba(0,0,0,0.1)",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Active tags */}
      {activeTagLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          {activeTagLabels.map(tag => (
            <span key={tag.label} className="text-xs bg-[#0070b8]/10 text-[#0070b8] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
              {tag.label}
              <button onClick={tag.onRemove} className="hover:text-[#0070b8]/60">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 xl:w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sticky top-[72px]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#0070b8]" />
              <span className="font-extrabold text-sm text-slate-800">Фильтры</span>
              {activeCount > 0 && (
                <span className="text-[10px] font-black text-white bg-[#0070b8] rounded-full w-5 h-5 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </div>
            {activeCount > 0 && (
              <button onClick={onReset} className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Сбросить
              </button>
            )}
          </div>
          <div className="max-h-[calc(100vh-160px)] overflow-y-auto pr-1 -mr-1">
            {content}
          </div>
        </div>
      </aside>

      {/* Mobile: bottom sheet */}
      <>
        {/* Backdrop */}
        <div
          className={`lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={() => onOpenChange(false)}
        />
        {/* Sheet */}
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col"
          style={{
            height: "85vh",
            borderRadius: "16px 16px 0 0",
            background: "hsl(var(--background, 0 0% 100%))",
            transform: open ? "translateY(0)" : "translateY(100%)",
            transition: "transform 300ms ease-out",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-8 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#0070b8]" />
              <span className="font-extrabold text-sm">Фильтры</span>
              {activeCount > 0 && (
                <span className="text-[10px] font-black text-white bg-[#0070b8] rounded-full w-5 h-5 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button onClick={onReset} className="text-xs font-bold text-rose-500 hover:text-rose-600">
                  Сбросить
                </button>
              )}
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {content}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-12 brand-gradient text-white font-bold rounded-xl text-sm"
            >
              Показать {filteredCount} авто
            </button>
          </div>
        </div>
      </>
    </>
  );
}

const COLOR_MAP: Record<string, string> = {
  "Белый": "#ffffff",
  "Чёрный": "#1a1a1a",
  "Серый": "#9ca3af",
  "Серебристый": "#d1d5db",
  "Красный": "#ef4444",
  "Синий": "#3b82f6",
  "Тёмно-синий": "#1e40af",
  "Зелёный": "#22c55e",
  "Бежевый": "#d4b896",
  "Коричневый": "#92400e",
  "Оранжевый": "#f97316",
  "Жёлтый": "#eab308",
  "Голубой": "#38bdf8",
  "Бордовый": "#9f1239",
  "Золотистый": "#d4af37",
  "Графитовый": "#374151",
};
