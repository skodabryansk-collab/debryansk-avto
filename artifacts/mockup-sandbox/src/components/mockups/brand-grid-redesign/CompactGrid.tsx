import { ArrowUpRight, CarFront, ChevronRight, Wrench } from "lucide-react";
import { BrandMark, brands } from "./_shared";
import "./_group.css";

const inventory = brands.filter((brand) => !brand.service);
const serviceBrands = brands.filter((brand) => brand.service);
const totalInventory = inventory.reduce((sum, brand) => sum + (brand.count ?? 0), 0);

export function CompactGrid() {
  return (
    <section className="min-h-screen bg-[#f5f8fa] px-4 py-10 text-slate-950 sm:px-8 sm:py-14 lg:px-12">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0070b8]">
              <span className="h-2 w-2 rounded-full bg-[#87b63c]" />
              Дебрянск Авто · Брянск
            </div>
            <h1 className="max-w-xl text-[clamp(2rem,4vw,3.35rem)] font-extrabold leading-[0.98] tracking-[-0.055em]">
              Выберите марку,
              <br />
              <span className="text-[#0070b8]">с которой начнём.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500 sm:text-[15px]">
              Новые автомобили в наличии, проверенные авто с пробегом и официальный сервис в одном месте.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7f3f9] text-[#0070b8]">
              <CarFront className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-lg font-extrabold leading-none">{totalInventory} авто</div>
              <div className="mt-1 text-[11px] font-semibold text-slate-400">сейчас в наличии</div>
            </div>
          </div>
        </header>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Продажа автомобилей</p>
            <p className="mt-1 text-sm text-slate-500">14 брендов и направлений · обновляется ежедневно</p>
          </div>
          <a href="#" onClick={(event) => event.preventDefault()} className="hidden items-center gap-1 text-sm font-bold text-[#0070b8] sm:flex">
            Все автомобили <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {inventory.map((brand, index) => (
            <a
              key={`${brand.name}-${brand.label ?? index}`}
              href="#"
              onClick={(event) => event.preventDefault()}
              className={`group relative flex min-h-[145px] flex-col justify-between overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_2px_10px_rgba(15,54,76,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#0070b8]/35 hover:shadow-[0_14px_30px_rgba(0,112,184,0.12)] ${brand.used ? "border-[#0070b8]/25 bg-[#eef7fb] sm:col-span-2 lg:col-span-2" : "border-slate-200/80"}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                  {brand.used ? "Отдельное направление" : brand.label ?? "Новые авто"}
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#0070b8] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <BrandMark brand={brand} className={brand.used ? "h-12 w-full" : "h-11 w-full"} />
              <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                <div>
                  <span className="block text-xl font-extrabold leading-none tracking-[-0.04em] text-[#0070b8]">{brand.count}</span>
                  <span className="mt-1 block text-[10px] font-semibold text-slate-400">автомобилей</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 transition-colors group-hover:text-[#0070b8]">Смотреть</span>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-[#d9e8ee] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6e3] text-[#6b9d25]">
              <Wrench className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="font-extrabold tracking-[-0.02em]">Официальный сервис</div>
              <div className="mt-1 text-sm text-slate-500">Обслуживаем автомобили этих марок — даже если сейчас их нет в продаже.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:max-w-[500px] sm:justify-end">
            {serviceBrands.map((brand, index) => (
              <a
                key={`${brand.name}-${index}`}
                href="#"
                onClick={(event) => event.preventDefault()}
                className="group flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-[#fbfcfd] px-3 py-2 transition-colors hover:border-[#87b63c] hover:bg-[#f7fbf1]"
              >
                <BrandMark brand={brand} className="h-6 max-w-[92px]" />
                <span className="rounded-full bg-[#eef6e3] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#679524]">Сервис</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-[#87b63c]" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}