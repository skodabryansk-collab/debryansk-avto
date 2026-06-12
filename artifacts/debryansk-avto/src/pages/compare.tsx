import React from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X, Heart, Car, Scale, Calendar, Gauge, Palette, Trash2, Check, Minus } from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";

function formatPrice(p: number) { return p.toLocaleString("ru-RU") + " ₽"; }
function formatRun(km: number) { return km < 1000 ? km + " км" : Math.round(km / 1000) + " тыс. км"; }
function parseTransmission(mod: string): string {
  if (!mod) return "—";
  if (mod.includes("AMT")) return "Робот";
  if (mod.includes("CVT")) return "Вариатор";
  if (mod.includes(" AT")) return "Автомат";
  if (mod.includes("MT")) return "Механика";
  return "—";
}
function parseDrive(mod: string): string {
  if (!mod) return "—";
  return mod.includes("4WD") ? "Полный" : "Передний/задний";
}
function parseEngine(mod: string): string {
  const m = mod.match(/(\d+\.\d+)\s*([\w]+)\s*\((\d+)\s*л\.с\.\)/);
  if (m) return `${m[1]} л, ${m[3]} л.с.`;
  const hp = mod.match(/\((\d+)\s*л\.с\.\)/);
  if (hp) return `${hp[1]} л.с.`;
  return "—";
}

const paramDefs = [
  { key: "price", label: "Цена", icon: null as any, format: (c: any) => formatPrice(c.price) },
  { key: "year", label: "Год", icon: Calendar, format: (c: any) => c.year },
  { key: "run", label: "Пробег", icon: Gauge, format: (c: any) => formatRun(c.run) },
  { key: "color", label: "Цвет", icon: Palette, format: (c: any) => c.color },
  { key: "bodyType", label: "Кузов", icon: null as any, format: (c: any) => c.bodyType || "—" },
  { key: "transmission", label: "Коробка", icon: null as any, format: (c: any) => parseTransmission(c.modification) },
  { key: "drive", label: "Привод", icon: null as any, format: (c: any) => parseDrive(c.modification) },
  { key: "engine", label: "Двигатель", icon: null as any, format: (c: any) => parseEngine(c.modification) },
  { key: "complectation", label: "Комплектация", icon: null as any, format: (c: any) => c.complectation || "—" },
  { key: "vin", label: "VIN", icon: null as any, format: (c: any) => c.vin || "—" },
];

function extrasList(c: any): string[] {
  if (!c.extras) return [];
  return c.extras.split(", ").filter(Boolean).map((s: string) => s.trim());
}

function allExtras(cars: any[]): string[] {
  const set = new Set<string>();
  for (const c of cars) {
    for (const e of extrasList(c)) set.add(e);
  }
  return Array.from(set).sort();
}

export default function ComparePage() {
  const { compare, removeFromCompare, clearCompare } = useCarStorage();
  const commonExtras = allExtras(compare);
  const hasExtras = commonExtras.length > 0;

  return (
    <Layout>
      <SEO
        title="Сравнение автомобилей"
        description="Сравните автомобили по параметрам: цена, пробег, год, комплектация, коробка, привод, опции. До 3 авто в сравнении."
        canonical="/compare"
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Сравнение", url: "/compare" },
        ]}
      />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {compare.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-24"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Нет автомобилей для сравнения</h2>
            <p className="text-slate-500 text-sm mb-6">Добавьте автомобили из каталога — до 3 штук</p>
            <Link href="/cars">
              <span className="inline-flex items-center gap-2 bg-[#0070b8] text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-[#0058a0] transition-colors">
                <Car className="w-4 h-4" />
                В каталог
              </span>
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-slate-500">
                Автомобилей: <span className="font-bold text-slate-900">{compare.length}</span> / 3
              </p>
              <button
                onClick={clearCompare}
                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Очистить
              </button>
            </div>

            {/* MOBILE: Card layout */}
            <div className="sm:hidden space-y-4">
              <AnimatePresence>
                {compare.map(car => (
                  <motion.div
                    key={car.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                  >
                    {/* Photo + title */}
                    <div className="relative h-44 bg-slate-100">
                      {car.images[0] ? (
                        <img src={car.images[0]} alt={`${car.mark} ${car.model}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Car className="w-12 h-12" />
                        </div>
                      )}
                      <button
                        onClick={() => removeFromCompare(car.id)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="p-4">
                      <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
                        <h3 className="font-bold text-base hover:text-[#0070b8] transition-colors">
                          {car.mark} {car.model}
                        </h3>
                      </Link>
                      <p className="text-xl font-extrabold text-[#0070b8] mt-1">{formatPrice(car.price)}</p>
                      <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
                        <button className="w-full mt-3 py-2.5 rounded-xl bg-[#0070b8] text-white font-bold text-sm hover:bg-[#005a9a] transition-colors">
                          Оставить заявку
                        </button>
                      </Link>

                      {/* Params table */}
                      <div className="mt-4 space-y-0 border-t border-slate-100">
                        {paramDefs.map(p => (
                          <div key={p.key} className="flex items-center justify-between py-2.5 border-b border-slate-50">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              {p.icon && <p.icon className="w-3.5 h-3.5" />}
                              <span>{p.label}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900">{p.format(car)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Extras */}
                      {hasExtras && (
                        <div className="mt-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Опции</p>
                          <div className="space-y-1">
                            {commonExtras.map(extra => {
                              const has = extrasList(car).includes(extra);
                              return (
                                <div key={extra} className="flex items-center justify-between py-1">
                                  <span className="text-xs text-slate-500">{extra}</span>
                                  {has ? (
                                    <Check className="w-3.5 h-3.5 text-[#87b63c]" />
                                  ) : (
                                    <Minus className="w-3.5 h-3.5 text-slate-300" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* DESKTOP: Grid table */}
            <div className="hidden sm:block overflow-x-auto -mx-6 px-6">
              <div className="min-w-[640px]">
                <div className="grid gap-3" style={{ gridTemplateColumns: `140px repeat(${compare.length}, 1fr)` }}>
                  {/* Header row */}
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3">Параметр</div>
                  <AnimatePresence>
                    {compare.map(car => (
                      <motion.div
                        key={car.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative"
                      >
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                          <div className="relative h-32 bg-slate-100">
                            {car.images[0] ? (
                              <img src={car.images[0]} alt={`${car.mark} ${car.model}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Car className="w-10 h-10" />
                              </div>
                            )}
                            <button
                              onClick={() => removeFromCompare(car.id)}
                              className="absolute top-2 right-2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-3.5 h-3.5 text-white" />
                            </button>
                          </div>
                          <div className="p-3">
                            <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
                              <h3 className="font-bold text-sm leading-tight hover:text-[#0070b8] transition-colors cursor-pointer">
                                {car.mark} {car.model}
                              </h3>
                            </Link>
                            <p className="text-lg font-extrabold text-[#0070b8] mt-1">{formatPrice(car.price)}</p>
                            <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
                              <button className="w-full mt-2 py-2 rounded-xl bg-[#0070b8] text-white font-bold text-xs hover:bg-[#005a9a] transition-colors">
                                Оставить заявку
                              </button>
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Separator */}
                  <div className="col-span-full h-px bg-slate-200 my-1" />

                  {/* Data rows */}
                  {paramDefs.map(p => (
                    <React.Fragment key={p.key}>
                      <div className="text-sm font-bold text-slate-500 py-3 flex items-center gap-1.5">
                        {p.icon && <p.icon className="w-3.5 h-3.5" />}
                        {p.label}
                      </div>
                      {compare.map(car => (
                        <div key={car.id} className="text-sm font-bold text-slate-700 py-3 flex items-center">
                          {p.format(car)}
                        </div>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Extras section */}
                  {hasExtras && (
                    <React.Fragment>
                      <div className="col-span-full h-px bg-slate-200 my-1" />
                      <div className="text-[10px] font-bold text-[#0070b8] uppercase tracking-wider py-2">Опции и комплектация</div>
                      {compare.map(car => (
                        <div key={car.id} className="py-2" />
                      ))}
                      {commonExtras.map(extra => (
                        <React.Fragment key={extra}>
                          <div className="text-xs font-bold text-slate-500 py-2 flex items-center gap-1">
                            <span>{extra}</span>
                          </div>
                          {compare.map(car => {
                            const has = extrasList(car).includes(extra);
                            return (
                              <div key={car.id} className="py-2 flex items-center">
                                {has ? (
                                  <span className="w-6 h-6 rounded-full bg-[#87b63c]/10 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-[#87b63c]" />
                                  </span>
                                ) : (
                                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                    <Minus className="w-3.5 h-3.5 text-slate-300" />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
