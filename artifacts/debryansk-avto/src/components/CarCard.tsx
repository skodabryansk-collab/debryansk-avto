import React, { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Heart, ArrowRight, Car, Flame, Sparkles } from "lucide-react";
import { useCarStorage } from "@/hooks/useCarStorage";
import { Button } from "@/components/ui/button";

export interface CarCardData {
  id: string;
  mark: string;
  model: string;
  modification: string;
  complectation?: string;
  year: number;
  price: number;
  color: string;
  bodyType: string;
  availability: string;
  images: string[];
  maxDiscount: number;
  creditDiscount: number;
  tradeinDiscount: number;
  run?: number;
  dealer?: string;
  type: "new" | "used";
  createdAt?: string;
  popularityScore?: number;
  popularityRank?: number;
}

interface CarCardProps {
  car: CarCardData;
  mode?: "grid" | "list";
  isLoading?: false;
  onTestDrive?: (car: CarCardData) => void;
  onOrder?: (car: CarCardData) => void;
  totalCount?: number;
}

interface SkeletonProps {
  mode?: "grid" | "list";
  isLoading: true;
}

type Props = CarCardProps | SkeletonProps;

function formatPrice(p: number) {
  return p.toLocaleString("ru-RU") + "\u00a0₽";
}

function formatRun(km: number) {
  return km < 1000 ? km + "\u00a0км" : Math.round(km / 1000) + "\u00a0тыс.\u00a0км";
}

function recordView(id: string, mark: string, model: string, price: number) {
  try {
    fetch(`/api/cars/${encodeURIComponent(id)}/view`, { method: "POST" }).catch(() => {});
    const key = "catalog_recently_viewed";
    const raw = localStorage.getItem(key);
    const list: Array<{ id: string; name: string; price: number; timestamp: number }> = raw
      ? JSON.parse(raw)
      : [];
    const filtered = list.filter(i => i.id !== id);
    filtered.unshift({ id, name: `${mark} ${model}`, price, timestamp: Date.now() });
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 5)));
  } catch {}
}

function Badge({ car, totalCount }: { car: CarCardData; totalCount?: number }) {
  if (car.maxDiscount > 0) {
    return (
      <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full leading-none">
        −{formatPrice(car.maxDiscount)}
      </span>
    );
  }
  if (car.createdAt) {
    const age = (Date.now() - new Date(car.createdAt).getTime()) / 86400000;
    if (age < 7) {
      return (
        <span className="bg-amber-400 text-white text-[10px] font-black px-2.5 py-1 rounded-full leading-none flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> Новинка
        </span>
      );
    }
  }
  if (
    totalCount &&
    car.popularityRank !== undefined &&
    car.popularityRank < Math.ceil(totalCount * 0.2)
  ) {
    return (
      <span className="bg-green-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full leading-none flex items-center gap-1">
        <Flame className="w-2.5 h-2.5" /> Популярное
      </span>
    );
  }
  return null;
}

export function CarCardSkeleton({ mode = "grid" }: { mode?: "grid" | "list" }) {
  if (mode === "list") {
    return (
      <div className="flex flex-row overflow-hidden rounded-2xl border border-slate-100 bg-white animate-pulse h-[90px]">
        <div className="w-[120px] h-full bg-slate-200 shrink-0" />
        <div className="flex-1 p-3 space-y-2">
          <div className="h-3 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-slate-200" />
      <div className="p-3 space-y-2.5">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-px bg-slate-100 my-2" />
        <div className="h-5 bg-slate-200 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="flex gap-2 mt-3">
          <div className="h-9 bg-slate-200 rounded-xl flex-1" />
          <div className="h-9 w-9 bg-slate-200 rounded-xl shrink-0" />
        </div>
      </div>
    </div>
  );
}

export function CarCard(props: Props) {
  if ("isLoading" in props && props.isLoading) {
    return <CarCardSkeleton mode={props.mode} />;
  }
  const { car, mode = "grid", onTestDrive, onOrder, totalCount } = props as CarCardProps;

  const [, navigate] = useLocation();
  const { isFavorite, toggleFavorite } = useCarStorage();
  const [imgError, setImgError] = useState(false);

  const imgs = car.images.filter(Boolean);
  const img = imgError ? "" : (imgs[0] ?? "");
  const fav = isFavorite(car.id);

  const detailPath = car.type === "new" ? `/new-cars/${encodeURIComponent(car.id)}` : `/cars/${encodeURIComponent(car.id)}`;

  const storedCar = {
    id: car.id, mark: car.mark, model: car.model, year: car.year, price: car.price,
    run: car.run ?? 0, color: car.color, bodyType: car.bodyType,
    modification: car.modification, images: car.images, availability: car.availability,
    url: "", type: car.type,
    extras: "", complectation: car.complectation ?? "", vin: "",
  };

  const handleCardClick = useCallback(() => {
    sessionStorage.setItem("catalog_scroll", window.scrollY.toString());
    sessionStorage.setItem("catalog_from_detail", "1");
    recordView(car.id, car.mark, car.model, car.price);
    navigate(detailPath);
  }, [car, detailPath, navigate]);

  const handleFav = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(storedCar);
  }, [storedCar, toggleFavorite]);

  const specs = (() => {
    const parts: string[] = [];
    parts.push(String(car.year));
    if (car.modification) parts.push(car.modification);
    if (car.type === "used" && car.run) parts.push(formatRun(car.run));
    return parts.join(" · ");
  })();

  const specsMobile = (() => {
    const parts: string[] = [String(car.year)];
    if (car.modification) parts.push(car.modification);
    if (car.type === "used" && car.run) parts.push(formatRun(car.run));
    return parts.join(" · ");
  })();

  const availBadge = (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
        car.availability === "В наличии"
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-gray-100 text-gray-500 border-gray-200"
      }`}
    >
      {car.availability || "В наличии"}
    </span>
  );

  const priceBlock = (
    <>
      {car.maxDiscount > 0 ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-medium text-slate-900">{formatPrice(car.price)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatPrice(car.price + car.maxDiscount)}</span>
          </div>
          <p className="text-xs text-green-600 mt-0.5">Выгода до {formatPrice(car.maxDiscount)}</p>
          {car.creditDiscount > 0 && (
            <p className="text-xs text-muted-foreground">−{formatPrice(car.creditDiscount)} в кредит</p>
          )}
          {car.tradeinDiscount > 0 && (
            <p className="text-xs text-muted-foreground">−{formatPrice(car.tradeinDiscount)} при trade-in</p>
          )}
        </>
      ) : (
        <>
          <span className="text-base font-medium text-slate-900">{formatPrice(car.price)}</span>
          {car.availability !== "В наличии" && (
            <p className="text-xs text-muted-foreground mt-0.5">Срок поставки — уточняйте</p>
          )}
        </>
      )}
    </>
  );

  const ctaLabel = (() => {
    if (car.type === "used") return "Подробнее";
    if (car.availability === "В наличии") return "Тест-драйв";
    return "Узнать о поставке";
  })();

  const handleCta = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (car.type === "used") {
      sessionStorage.setItem("catalog_scroll", window.scrollY.toString());
      sessionStorage.setItem("catalog_from_detail", "1");
      recordView(car.id, car.mark, car.model, car.price);
      navigate(detailPath);
    } else if (car.availability === "В наличии" && onTestDrive) {
      onTestDrive(car);
    } else if (onOrder) {
      onOrder(car);
    } else {
      sessionStorage.setItem("catalog_scroll", window.scrollY.toString());
      sessionStorage.setItem("catalog_from_detail", "1");
      navigate(detailPath);
    }
  };

  if (mode === "list") {
    return (
      <article
        onClick={handleCardClick}
        className="flex flex-row overflow-hidden rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="w-[120px] h-[90px] bg-slate-100 shrink-0 overflow-hidden">
          {img ? (
            <img
              src={img}
              alt={`${car.mark} ${car.model}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Car className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground leading-none">{car.mark}</p>
              {availBadge}
            </div>
            <p className="text-sm font-medium leading-snug mt-0.5 truncate">{car.model}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{specsMobile}</p>
          </div>
          <div>
            <div className="mt-1">{priceBlock}</div>
            <Button
              size="sm"
              className="w-full h-9 mt-2 text-xs font-bold"
              onClick={handleCta}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer flex flex-col"
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-16 h-16" />
          </div>
        )}
        {/* Single top-left badge */}
        <div className="absolute top-2 left-2 z-10">
          <Badge car={car} totalCount={totalCount} />
        </div>
        {/* Favorite button top-right, min 44×44 touch target */}
        <button
          onClick={handleFav}
          aria-label={fav ? "Убрать из избранного" : "В избранное"}
          className={`absolute top-1 right-1 z-10 w-11 h-11 flex items-center justify-center rounded-full transition-all duration-200 ${
            fav
              ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
              : "bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
          }`}
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none">{car.mark}</p>
            <h3 className="text-sm font-medium leading-snug mt-0.5">{car.model}</h3>
          </div>
          {availBadge}
        </div>

        {/* Specs one-line with truncate */}
        <p className="text-xs text-muted-foreground mt-1 truncate hidden sm:block" title={specs}>
          {specs.length > 40 ? specs.slice(0, 37) + "…" : specs}
        </p>
        <p className="text-xs text-muted-foreground mt-1 truncate sm:hidden" title={specsMobile}>
          {specsMobile.length > 40 ? specsMobile.slice(0, 37) + "…" : specsMobile}
        </p>

        <hr className="my-2 border-border/50" />

        {/* Price */}
        <div className="flex-1">
          {priceBlock}
        </div>

        {/* CTA */}
        <div className="flex gap-2 mt-3">
          <Button
            className="flex-1 h-9 text-xs font-bold"
            onClick={handleCta}
          >
            {ctaLabel}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-9 h-9 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              sessionStorage.setItem("catalog_scroll", window.scrollY.toString());
              sessionStorage.setItem("catalog_from_detail", "1");
              navigate(detailPath);
            }}
            aria-label="Открыть карточку"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
