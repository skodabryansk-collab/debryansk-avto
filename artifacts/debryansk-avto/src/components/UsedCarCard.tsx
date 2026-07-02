import React from "react";
import { Car, Heart, Scale } from "lucide-react";
import { HomeActionBtn } from "@/components/HomeActionBtn";
import { useCarStorage } from "@/hooks/useCarStorage";

interface UsedCar {
  id: string; mark: string; model: string; modification: string;
  year: number; price: number; run: number; color: string;
  availability: string; url: string; images: string[];
  bodyType?: string; extras?: string; complectation?: string; vin?: string;
}

function fmtPrice(p: number) { return p.toLocaleString("ru-RU") + " ₽"; }
function fmtRun(km: number) { return km < 1000 ? km + " км" : Math.round(km / 1000) + " тыс. км"; }

const COLOR_MAP: Record<string, { bg: string; border?: string }> = {
  "Белый":      { bg: "#ffffff", border: "#d1d5db" },
  "Чёрный":     { bg: "#1a1a1a" },
  "Черный":     { bg: "#1a1a1a" },
  "Серый":      { bg: "#9ca3af" },
  "Серебряный": { bg: "#c0c0c0", border: "#d1d5db" },
  "Серебристый":{ bg: "#c0c0c0", border: "#d1d5db" },
  "Синий":      { bg: "#2563eb" },
  "Голубой":    { bg: "#38bdf8" },
  "Красный":    { bg: "#dc2626" },
  "Зеленый":    { bg: "#16a34a" },
  "Зелёный":    { bg: "#16a34a" },
  "Бежевый":    { bg: "#d4b896" },
  "Коричневый": { bg: "#92400e" },
  "Оранжевый":  { bg: "#f97316" },
  "Желтый":     { bg: "#facc15" },
  "Жёлтый":     { bg: "#facc15" },
  "Фиолетовый": { bg: "#7c3aed" },
  "Розовый":    { bg: "#f9a8d4" },
  "Золотой":    { bg: "#d4a017", border: "#c49a0a" },
};

function ColorDot({ color }: { color: string }) {
  const match = COLOR_MAP[color];
  const bg = match?.bg ?? "#e5e7eb";
  const border = match?.border ?? (match ? undefined : "#d1d5db");
  return (
    <span
      title={color}
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: bg,
        border: `1.5px solid ${border ?? "transparent"}`,
        flexShrink: 0,
      }}
    />
  );
}

export default function UsedCarCard({ car }: { car: UsedCar }) {
  const { isFavorite, isInCompare, toggleFavorite, toggleCompare } = useCarStorage();
  const stored = {
    id: car.id, mark: car.mark, model: car.model, year: car.year, price: car.price,
    run: car.run, color: car.color, bodyType: car.bodyType || "", modification: car.modification,
    images: car.images, availability: car.availability, url: car.url, type: "used" as const,
    extras: car.extras, complectation: car.complectation, vin: car.vin,
  };

  return (
    <div
      className="snap-start shrink-0 w-full bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-[#0070b8]/20 transition-all group cursor-pointer flex flex-col"
      onClick={() => window.location.href = `/cars/${encodeURIComponent(car.id)}`}
    >
      <div className="relative h-40 bg-slate-100 overflow-hidden shrink-0">
        {car.images[0] ? (
          <img
            src={car.images[0]}
            alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {car.availability && (
          <span className="absolute top-2.5 left-2.5 bg-[#87b63c] text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            {car.availability}
          </span>
        )}
        {car.images.length > 1 && (
          <span className="absolute bottom-2 right-2.5 text-white text-[10px] font-bold opacity-80">
            {car.images.length} фото
          </span>
        )}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          <HomeActionBtn icon={<Heart className="w-3.5 h-3.5" />} active={isFavorite(car.id)} activeClass="bg-red-500 text-white" onClick={() => toggleFavorite(stored)} />
          <HomeActionBtn icon={<Scale className="w-3.5 h-3.5" />} active={isInCompare(car.id)} activeClass="bg-[#0070b8] text-white" onClick={() => toggleCompare(stored)} />
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="font-extrabold text-sm leading-snug text-slate-900 mb-0.5 group-hover:text-[#0070b8] transition-colors line-clamp-1">
          {car.mark} {car.model}
        </p>
        {car.modification && (
          <p className="text-[11px] text-slate-400 leading-snug mb-2 line-clamp-1">{car.modification}</p>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mb-3">
          <span className="whitespace-nowrap shrink-0">{car.year}</span>
          <span className="text-slate-300 shrink-0">·</span>
          <span className="whitespace-nowrap shrink-0">{fmtRun(car.run)}</span>
          <span className="text-slate-300 shrink-0">·</span>
          <ColorDot color={car.color} />
        </div>
        <p className="text-base font-extrabold text-slate-900 mt-auto">{fmtPrice(car.price)}</p>
      </div>
    </div>
  );
}
