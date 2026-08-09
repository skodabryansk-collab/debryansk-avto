import React from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Heart, Scale, Car, Trash2 } from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import { CarActionButtons } from "@/components/CarActionButtons";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";

function formatPrice(p: number) { return p.toLocaleString("ru-RU") + " ₽"; }
function formatRun(km: number) { return km < 1000 ? km + " км" : Math.round(km / 1000) + " тыс. км"; }

function FavoriteCard({ car, onRemove }: { car: ReturnType<typeof useCarStorage>["favorites"][0]; onRemove: () => void }) {
  const prefersReduced = useReducedMotion();
  const img = car.images[0] ?? "";

  return (
    <motion.div
      layout
      initial={prefersReduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className="relative h-40 bg-slate-100 overflow-hidden">
        <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
          {img ? (
            <img src={img} alt={`${car.mark} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Car className="w-12 h-12" />
            </div>
          )}
        </Link>
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">
        <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
          <h3 className="font-bold text-sm leading-tight mb-1 hover:text-primary transition-colors cursor-pointer">
            {car.mark} {car.model}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <span>{car.year}</span>
          <span className="text-slate-300">·</span>
          <span>{formatRun(car.run)}</span>
          <span className="text-slate-300">·</span>
          <span>{car.color}</span>
        </div>
        <p className="text-xl font-extrabold text-slate-900 mb-3">{formatPrice(car.price)}</p>
        <Link href={car.type === "used" ? `/cars/${encodeURIComponent(car.id)}` : `/new-cars/${encodeURIComponent(car.id)}`}>
          <button className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-[#005a9a] transition-colors">
            Оставить заявку
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function FavoritesPage() {
  const prefersReduced = useReducedMotion();
  const { favorites, removeFromFavorites } = useCarStorage();
  const favCount = favorites.length;

  return (
    <Layout>
      <SEO
        title="Избранное"
        description="Список избранных автомобилей Дебрянск Авто. Сохраненные автомобили с пробегом и новые."
        canonical="/favorites"
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Избранное", url: "/favorites" },
        ]}
      />
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {favorites.length === 0 ? (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-24"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Нет избранных автомобилей</h2>
            <p className="text-slate-500 text-sm mb-6">Добавляйте автомобили в избранное, чтобы вернуться к ним позже</p>
            <Link href="/cars">
              <span className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-[#0058a0] transition-colors">
                <Car className="w-4 h-4" />
                В каталог
              </span>
            </Link>
          </motion.div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Автомобилей: <span className="font-bold text-slate-900">{favorites.length}</span>
            </p>
            <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {favorites.map(car => (
                  <FavoriteCard
                    key={car.id}
                    car={car}
                    onRemove={() => removeFromFavorites(car.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </Layout>
  );
}
