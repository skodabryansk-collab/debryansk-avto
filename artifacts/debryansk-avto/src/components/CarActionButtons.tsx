import React from "react";
import { Heart, Scale } from "lucide-react";
import { useCarStorage, type StoredCar } from "@/hooks/useCarStorage";

interface Props {
  car: StoredCar;
  className?: string;
  vertical?: boolean;
}

export function CarActionButtons({ car, className = "", vertical = false }: Props) {
  const { isFavorite, isInCompare, toggleFavorite, toggleCompare } = useCarStorage();
  const fav = isFavorite(car.id);
  const comp = isInCompare(car.id);

  return (
    <div className={`flex ${vertical ? "flex-col gap-1.5" : "gap-2"} ${className}`}>
      <button
        onClick={e => { e.stopPropagation(); toggleFavorite(car); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          fav
            ? "bg-red-500 text-white shadow-md shadow-red-500/20"
            : "bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
        }`}
        title={fav ? "\u0423\u0431\u0440\u0430\u0442\u044c \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e" : "\u0412 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435"}
      >
        <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); toggleCompare(car); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          comp
            ? "bg-primary text-white shadow-md shadow-primary/20"
            : "bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
        }`}
        title={comp ? "\u0423\u0431\u0440\u0430\u0442\u044c \u0438\u0437 \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f" : "\u0421\u0440\u0430\u0432\u043d\u0438\u0442\u044c"}
      >
        <Scale className="w-4 h-4" />
      </button>
    </div>
  );
}
