import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CarFront,
  Check,
  ChevronRight,
  CircleHelp,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { BrandMark, brands, type Brand } from "./_shared";

type Journey = "new" | "used" | "service";

const journeyCopy: Record<
  Journey,
  {
    eyebrow: string;
    title: string;
    description: string;
    stat: string;
    statLabel: string;
    accent: string;
  }
> = {
  new: {
    eyebrow: "Выбор нового автомобиля",
    title: "Начните с задачи, а не с логотипа.",
    description: "Сначала выберите сценарий покупки. Мы покажем только те марки, где прямо сейчас есть подходящие автомобили.",
    stat: "6",
    statLabel: "марок в наличии",
    accent: "#0d6572",
  },
  used: {
    eyebrow: "Автомобили с пробегом",
    title: "Большой выбор уже на площадке.",
    description: "Проверенные автомобили с пробегом в Брянске. Откройте актуальную выдачу и приезжайте на осмотр.",
    stat: "170",
    statLabel: "автомобилей сегодня",
    accent: "#bd5534",
  },
  service: {
    eyebrow: "Сервис и обслуживание",
    title: "Поддержим автомобиль после покупки.",
    description: "Запишитесь на обслуживание у официальных специалистов — независимо от того, где вы покупали автомобиль.",
    stat: "4",
    statLabel: "марки обслуживаем",
    accent: "#637c42",
  },
};

const inventoryBrands = brands.filter((brand) => !brand.service && !brand.used);
const serviceBrands = brands.filter((brand) => brand.service);

function getBrandsForJourney(journey: Journey) {
  if (journey === "service") return serviceBrands;
  if (journey === "used") return brands.filter((brand) => brand.used);
  return inventoryBrands;
}

function brandKey(brand: Brand) {
  return `${brand.name}-${brand.label ?? "base"}`;
}

function BrandNavigator() {
  const [journey, setJourney] = useState<Journey>("new");
  const [selectedKey, setSelectedKey] = useState(brandKey(inventoryBrands[0]));
  const [query, setQuery] = useState("");

  const visibleBrands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return getBrandsForJourney(journey).filter((brand) => {
      if (!normalizedQuery) return true;
      return `${brand.name} ${brand.label ?? ""}`.toLowerCase().includes(normalizedQuery);
    });
  }, [journey, query]);

  const selectedBrand = useMemo(
    () => getBrandsForJourney(journey).find((brand) => brandKey(brand) === selectedKey) ?? visibleBrands[0],
    [journey, selectedKey, visibleBrands],
  );
  const activeCopy = journeyCopy[journey];
  const total = journey === "used" ? 170 : journey === "service" ? serviceBrands.length : inventoryBrands.reduce((sum, brand) => sum + (brand.count ?? 0), 0);

  function changeJourney(nextJourney: Journey) {
    setJourney(nextJourney);
    setQuery("");
    const firstBrand = getBrandsForJourney(nextJourney)[0];
    if (firstBrand) setSelectedKey(brandKey(firstBrand));
  }

  return (
    <section
      className="min-h-screen overflow-hidden px-4 py-6 text-[#172c35] sm:px-8 sm:py-10"
      style={{
        background: "#f5f1e9",
        fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="flex items-center justify-between gap-4 border-b border-[#d8d3c9] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#172c35] text-[#d7e77b]">
              <CarFront className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#172c35]">Дебрянск Авто</div>
              <div className="mt-0.5 text-[10px] font-semibold text-[#8d9797]">Брянск · 09:42 · наличие обновлено</div>
            </div>
          </div>
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-[#d8d3c9] bg-[#fbf9f3] px-3.5 py-2 text-[11px] font-bold text-[#58686b] transition-colors hover:border-[#172c35] hover:text-[#172c35] sm:flex"
            onClick={() => setQuery("")}
          >
            <CircleHelp className="h-3.5 w-3.5" />
            Не знаете, что выбрать?
          </button>
        </div>

        <div className="grid gap-7 pb-8 pt-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(390px,.96fr)] lg:gap-12 lg:pt-12">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: activeCopy.accent }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeCopy.accent }} />
              {activeCopy.eyebrow}
            </div>
            <h1 className="max-w-[650px] text-[clamp(2.5rem,6vw,5.9rem)] font-black leading-[0.91] tracking-[-0.075em] text-[#172c35]">
              {activeCopy.title}
            </h1>
            <p className="mt-6 max-w-[520px] text-sm leading-6 text-[#687879] sm:text-base">
              {activeCopy.description}
            </p>
            <div className="mt-8 flex items-end gap-7">
              <div>
                <div className="text-4xl font-black leading-none tracking-[-0.06em]" style={{ color: activeCopy.accent }}>{total}</div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#8d9797]">{activeCopy.statLabel}</div>
              </div>
              <div className="h-10 w-px bg-[#d8d3c9]" />
              <div className="max-w-[170px] text-xs leading-5 text-[#879291]">
                Подберем маршрут за пару кликов — без длинного каталога.
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#dad4c9] bg-[#fbf9f3] p-4 shadow-[0_20px_50px_rgba(48,64,65,0.08)] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d9797]">Шаг 01 / 02</div>
              <div className="flex gap-1.5">
                <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: activeCopy.accent }} />
                <span className="h-1.5 w-5 rounded-full bg-[#ddd8ce]" />
              </div>
            </div>
            <h2 className="text-xl font-black tracking-[-0.045em] text-[#172c35] sm:text-2xl">Что вы ищете?</h2>
            <div className="mt-4 grid gap-2">
              {([
                ["new", "Новый автомобиль", "В наличии у дилера"],
                ["used", "Автомобиль с пробегом", "Проверенная площадка"],
                ["service", "Сервис и обслуживание", "Запись к специалисту"],
              ] as [Journey, string, string][]).map(([key, label, detail]) => {
                const isActive = journey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeJourney(key)}
                    className={`group flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${isActive ? "border-[#172c35] bg-[#172c35] text-[#fbf9f3] shadow-[0_8px_20px_rgba(23,44,53,0.16)]" : "border-[#e1dcd2] bg-transparent text-[#172c35] hover:border-[#9baba8]"}`}
                  >
                    <span>
                      <span className="block text-sm font-extrabold">{label}</span>
                      <span className={`mt-1 block text-[11px] ${isActive ? "text-white/55" : "text-[#929b9a]"}`}>{detail}</span>
                    </span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 ${isActive ? "bg-[#d7e77b] text-[#172c35]" : "border border-[#d9d4ca] text-[#9da7a5]"}`}>
                      {isActive ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-[#e2ddd3] pt-4 text-[11px] leading-4 text-[#919b99]">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#bd5534]" />
              На следующем шаге сравним условия и покажем автомобили в наличии.
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-[#dce9e2] p-4 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#637c42]">Шаг 02 / 02 · Выберите направление</div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.055em] text-[#172c35] sm:text-3xl">
                {journey === "service" ? "С какой маркой работаем?" : journey === "used" ? "Откройте актуальную выдачу" : "Какая марка вам ближе?"}
              </h2>
            </div>
            <div className="flex w-full items-center gap-2 rounded-xl border border-[#c9dacf] bg-[#edf5ef] px-3 py-2.5 lg:max-w-[230px]">
              <Search className="h-4 w-4 text-[#86958e]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти марку"
                className="w-full bg-transparent text-xs font-bold text-[#172c35] outline-none placeholder:text-[#97a39e]"
                aria-label="Найти марку"
              />
              {query && (
                <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")} className="text-[#86958e] hover:text-[#172c35]">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(245px,.72fr)]">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleBrands.map((brand) => {
                const isSelected = selectedBrand && brandKey(selectedBrand) === brandKey(brand);
                return (
                  <button
                    key={brandKey(brand)}
                    type="button"
                    onClick={() => setSelectedKey(brandKey(brand))}
                    className={`group flex min-h-[112px] flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${isSelected ? "border-[#172c35] bg-[#172c35] text-[#fbf9f3] shadow-[0_10px_20px_rgba(23,44,53,0.12)]" : "border-[#c9dacf] bg-[#edf5ef] hover:-translate-y-0.5 hover:border-[#87a595]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <BrandMark brand={brand} className={`h-8 max-w-[145px] justify-start ${isSelected ? "[&_*]:!text-[#fbf9f3]" : ""}`} />
                      <ArrowUpRight className={`h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${isSelected ? "text-[#d7e77b]" : "text-[#9aad9f]"}`} />
                    </div>
                    <div className={`flex items-center justify-between border-t pt-2.5 text-[10px] font-bold ${isSelected ? "border-white/15 text-white/55" : "border-[#d7e4d9] text-[#82918b]"}`}>
                      <span>{journey === "service" ? "Официальный сервис" : journey === "used" ? "В каталоге" : "В наличии"}</span>
                      {journey !== "service" && <span className={`text-sm font-black ${isSelected ? "text-[#d7e77b]" : "text-[#172c35]"}`}>{brand.count}</span>}
                    </div>
                  </button>
                );
              })}
              {visibleBrands.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-[#aec4b8] bg-[#edf5ef] p-8 text-center">
                  <SlidersHorizontal className="mx-auto h-5 w-5 text-[#879b90]" />
                  <div className="mt-2 text-sm font-extrabold text-[#172c35]">Ничего не нашли</div>
                  <button type="button" onClick={() => setQuery("")} className="mt-2 text-xs font-bold text-[#637c42] underline underline-offset-2">Показать все марки</button>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-[#172c35] p-5 text-[#fbf9f3]">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#d7e77b]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d7e77b]" />
                  Ваш выбор
                </div>
                <div className="mt-7">
                  {selectedBrand ? (
                    <>
                      <BrandMark brand={selectedBrand} className="h-10 max-w-[170px] justify-start [&_*]:!text-[#fbf9f3]" />
                      <div className="mt-5 text-2xl font-black tracking-[-0.05em]">
                        {journey === "used" ? "Каталог автомобилей" : journey === "service" ? "Запись на сервис" : `${selectedBrand.count ?? 0} авто в наличии`}
                      </div>
                      <p className="mt-2 max-w-[210px] text-xs leading-5 text-white/55">
                        {journey === "service" ? "Выберите удобное время — мастер-приёмщик свяжется с вами." : "Откройте список моделей, комплектаций и актуальных условий."}
                      </p>
                    </>
                  ) : (
                    <div className="text-sm text-white/60">Выберите карточку слева.</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="mt-8 flex w-full items-center justify-between rounded-xl bg-[#d7e77b] px-4 py-3 text-left text-xs font-black text-[#172c35] transition-transform hover:-translate-y-0.5"
                onClick={() => setQuery(selectedBrand?.name ?? "")}
              >
                <span>{journey === "service" ? "Выбрать сервис" : "Смотреть автомобили"}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#d8d3c9] py-5 text-xs text-[#8d9797] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><Wrench className="h-3.5 w-3.5 text-[#637c42]" /> Официальный дилерский центр и сервис в Брянске</span>
          <span className="font-bold text-[#172c35]">14 брендов · один понятный маршрут</span>
        </div>
      </div>
    </section>
  );
}

export { BrandNavigator };