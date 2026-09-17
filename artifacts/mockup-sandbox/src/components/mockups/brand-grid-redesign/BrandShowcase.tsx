import { ArrowUpRight, CarFront, Check, ChevronRight, Wrench } from "lucide-react";
import { BrandMark, brands } from "./_shared";
import "./_group.css";

const inventoryBrands = brands.filter((brand) => !brand.service);
const serviceBrands = brands.filter((brand) => brand.service);
const totalInventory = inventoryBrands.reduce((sum, brand) => sum + (brand.count ?? 0), 0);
const leadBrands = brands.filter((brand) => brand.count && brand.count >= 80 && !brand.used);

function BrandShowcase() {
  return (
    <section className="min-h-screen overflow-hidden bg-[#f4f8fb] px-4 py-10 text-slate-950 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-9 flex flex-col justify-between gap-6 md:mb-12 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#0070b8]">
              <span className="h-px w-8 bg-[#87b63c]" />
              Дебрянск Авто · Брянск
            </div>
            <h1 className="max-w-[760px] text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-[#102b3f] sm:text-6xl">
              Автомобили, которые
              <span className="block text-[#0070b8]">есть сегодня.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
              Официальные дилеры и сервисный центр в одном месте. Выберите марку — мы покажем автомобили в наличии и условия обслуживания.
            </p>
          </div>
          <div className="flex items-end gap-8 border-l border-[#c9dce8] pl-5 md:mb-1">
            <div>
              <div className="text-3xl font-extrabold tracking-[-0.04em] text-[#102b3f]">{totalInventory}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">автомобилей</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-[-0.04em] text-[#87b63c]">{inventoryBrands.length}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">направлений</div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <a
            href="#"
            onClick={(event) => event.preventDefault()}
            className="group relative min-h-[330px] overflow-hidden rounded-[28px] bg-[#102b3f] p-7 text-white shadow-[0_18px_45px_rgba(16,43,63,0.16)] transition-transform duration-300 hover:-translate-y-1 sm:p-10"
          >
            <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[34px] border-[#0070b8]/25" />
            <div className="absolute -bottom-28 right-16 h-64 w-64 rounded-full border border-[#87b63c]/30" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#87b63c] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#102b3f]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#102b3f]" /> Самый большой выбор
                  </span>
                  <div className="mt-9 max-w-[310px] text-5xl font-black tracking-[-0.07em] sm:text-7xl">170</div>
                  <div className="mt-1 text-lg font-semibold text-white/75">автомобилей с пробегом</div>
                </div>
                <ArrowUpRight className="h-6 w-6 text-[#87b63c] transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
              <div className="mt-10 flex items-center justify-between border-t border-white/15 pt-5">
                <div className="flex items-center gap-3">
                  <CarFront className="h-5 w-5 text-[#87b63c]" strokeWidth={1.8} />
                  <span className="text-sm font-bold">Проверенные автомобили</span>
                </div>
                <span className="text-xs font-bold text-white/60">Смотреть каталог →</span>
              </div>
            </div>
          </a>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {leadBrands.map((brand, index) => (
              <a
                key={`${brand.name}-${brand.label ?? index}`}
                href="#"
                onClick={(event) => event.preventDefault()}
                className="group flex min-h-[156px] items-center justify-between rounded-[24px] border border-[#d9e7ee] bg-white px-6 py-5 shadow-[0_8px_28px_rgba(20,72,102,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#0070b8]/30 hover:shadow-[0_14px_35px_rgba(0,112,184,0.12)]"
              >
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#87b63c]" />
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">В наличии</span>
                  </div>
                  <BrandMark brand={brand} className="h-10 max-w-[175px] justify-start" />
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black tracking-[-0.06em] text-[#0070b8]">{brand.count}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">авто</div>
                  <ChevronRight className="ml-auto mt-3 h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-[#0070b8]" />
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-11 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#87b63c]">Полный каталог брендов</div>
            <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[#102b3f] sm:text-3xl">Выберите свой маршрут</h2>
          </div>
          <div className="text-sm text-slate-500">Все предложения · {inventoryBrands.length} брендов</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {inventoryBrands.filter((brand) => !leadBrands.includes(brand) && !brand.used).map((brand, index) => (
            <a
              key={`${brand.name}-${brand.label ?? index}`}
              href="#"
              onClick={(event) => event.preventDefault()}
              className="group relative flex min-h-[145px] flex-col justify-between rounded-2xl border border-[#d9e7ee] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#0070b8]/30 hover:shadow-[0_12px_30px_rgba(0,112,184,0.1)]"
            >
              <div className="flex items-start justify-between">
                <BrandMark brand={brand} className="h-9 max-w-[145px] justify-start" />
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#0070b8]" />
              </div>
              <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-medium text-slate-400">{brand.count === 2 ? "Редкие автомобили" : "Автомобили в наличии"}</span>
                <span className="text-lg font-extrabold text-[#102b3f]">{brand.count}</span>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-[24px] border border-[#b8d7df] bg-[#e8f3f5] p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0070b8] shadow-sm">
                <Wrench className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold tracking-[-0.03em] text-[#102b3f]">Сервис для тех, кто уже выбрал</h3>
                <p className="mt-1 max-w-xl text-sm leading-5 text-slate-500">Обслуживаем автомобили этих марок по стандартам производителя. Запись онлайн или по телефону.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {serviceBrands.map((brand, index) => (
                <a
                  key={`${brand.name}-${index}`}
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="group flex min-w-[128px] items-center justify-between gap-3 rounded-xl border border-white bg-white/80 px-3 py-2.5 transition-colors hover:border-[#0070b8]/30"
                >
                  <BrandMark brand={brand} className="h-7 max-w-[88px] justify-start" />
                  <Check className="h-3.5 w-3.5 text-[#87b63c]" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[#d9e7ee] pt-5 text-xs text-slate-400">
          <span>Актуальность наличия обновляется ежедневно</span>
          <span className="font-bold text-[#0070b8]">14 брендов в группе</span>
        </div>
      </div>
    </section>
  );
}

export { BrandShowcase };