import { ArrowRight, ArrowUpRight, CarFront, ChevronRight, CircleCheck, Wrench } from "lucide-react";
import { BrandMark, brands } from "./_shared";
import "./_group.css";

const formatCount = (value: number) => value.toLocaleString("ru-RU");

export function InventoryCatalog() {
  const used = brands.find((brand) => brand.used);
  const serviceBrands = brands.filter((brand) => brand.service);
  const inventoryBrands = brands.filter((brand) => !brand.service && !brand.used);
  const totalNew = inventoryBrands.reduce((sum, brand) => sum + (brand.count ?? 0), 0);

  return (
    <section className="min-h-screen bg-[#f5f8fb] px-4 py-10 text-slate-950 sm:px-8 sm:py-14 lg:px-12">
      <div className="mx-auto max-w-[1160px]">
        <header className="mb-9 flex flex-col gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#0070b8]">
              <span className="h-2 w-2 rounded-full bg-[#87b63c]" />
              Дебрянск Авто · Брянск
            </div>
            <h1 className="max-w-[680px] text-3xl font-extrabold tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Выберите марку —<br className="hidden sm:block" /> найдём ваш автомобиль
            </h1>
            <p className="mt-4 max-w-[570px] text-sm leading-6 text-slate-500 sm:text-base">
              Новые автомобили в наличии, проверенные авто с пробегом и официальный сервис в одном месте.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">В продаже сейчас</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-[#0070b8]">{formatCount((used?.count ?? 0) + totalNew)}</p>
            </div>
            <CarFront className="h-9 w-9 text-[#87b63c]" strokeWidth={1.5} />
          </div>
        </header>

        <div className="mb-10 grid gap-4 lg:grid-cols-[1.35fr_2fr]">
          {used && (
            <a
              href="#"
              onClick={(event) => event.preventDefault()}
              className="group relative flex min-h-[208px] flex-col justify-between overflow-hidden rounded-[26px] bg-[#0070b8] p-6 text-white shadow-[0_12px_28px_rgba(0,112,184,0.18)] transition-transform duration-300 hover:-translate-y-1 sm:p-7"
            >
              <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full border-[22px] border-white/10" />
              <div className="absolute -bottom-20 right-16 h-48 w-48 rounded-full border border-white/10" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-100">Большой выбор</p>
                  <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Автомобили с пробегом</h2>
                </div>
                <ArrowUpRight className="h-5 w-5 opacity-70 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </div>
              <div className="relative mt-8 flex items-end justify-between">
                <div>
                  <span className="text-5xl font-black tracking-[-0.06em]">{formatCount(used.count ?? 0)}</span>
                  <span className="ml-2 text-sm font-semibold text-blue-100">автомобилей</span>
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">Проверены нами</span>
              </div>
            </a>
          )}

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#87b63c]">Новые автомобили</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Марки в наличии</h2>
              </div>
              <span className="text-sm font-bold text-slate-400">{formatCount(totalNew)} авто</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {inventoryBrands.map((brand, index) => (
                <a
                  key={`${brand.name}-${brand.label ?? index}`}
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="group flex min-h-[102px] flex-col justify-between rounded-2xl border border-slate-100 bg-[#f8fafc] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0070b8]/25 hover:bg-blue-50/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <BrandMark brand={brand} className="h-7 max-w-[78px] justify-start overflow-hidden whitespace-nowrap text-ellipsis [&>span]:truncate [&>span]:whitespace-nowrap [&_img]:max-h-7" />
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0070b8]" />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-xl font-black tracking-tight text-slate-900">{formatCount(brand.count ?? 0)}</span>
                    <span className="pb-0.5 text-[10px] font-semibold text-slate-400">в наличии</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Официальный сервис</p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {serviceBrands.map((brand, index) => (
            <a
              key={`${brand.name}-${index}`}
              href="#"
              onClick={(event) => event.preventDefault()}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#87b63c]/50 hover:shadow-[0_8px_22px_rgba(135,182,60,0.12)]"
            >
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-2">
                <BrandMark brand={brand} className="h-7 w-full [&_img]:max-h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-slate-800">{brand.name}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0070b8]">
                  <CircleCheck className="h-3 w-3" /> обслуживание
                </span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-[#87b63c]" />
            </a>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-[#87b63c]" /> Сервис доступен для всех перечисленных марок</span>
          <a href="#" onClick={(event) => event.preventDefault()} className="inline-flex items-center gap-1.5 font-extrabold text-[#0070b8] hover:text-[#005b94]">Записаться на сервис <ArrowRight className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}