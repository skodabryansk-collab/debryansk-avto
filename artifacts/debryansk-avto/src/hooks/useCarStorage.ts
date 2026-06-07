import { useState, useCallback, useEffect } from "react";

const FAV_KEY = "debryansk-favorites";
const COMPARE_KEY = "debryansk-compare";
const MAX_COMPARE = 3;

export interface StoredCar {
  id: string;
  mark: string;
  model: string;
  year: number;
  price: number;
  run: number;
  color: string;
  bodyType: string;
  modification: string;
  images: string[];
  availability?: string;
  url?: string;
  type: "used" | "new";
}

function load(key: string): StoredCar[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(key: string, items: StoredCar[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function useCarStorage() {
  const [favorites, setFavorites] = useState<StoredCar[]>(() => load(FAV_KEY));
  const [compare, setCompare] = useState<StoredCar[]>(() => load(COMPARE_KEY));

  // Sync to localStorage
  useEffect(() => save(FAV_KEY, favorites), [favorites]);
  useEffect(() => save(COMPARE_KEY, compare), [compare]);

  const isFavorite = useCallback((id: string) => favorites.some(c => c.id === id), [favorites]);
  const isInCompare = useCallback((id: string) => compare.some(c => c.id === id), [compare]);

  const toggleFavorite = useCallback((car: StoredCar) => {
    setFavorites(prev => {
      const exists = prev.some(c => c.id === car.id);
      if (exists) return prev.filter(c => c.id !== car.id);
      return [car, ...prev];
    });
  }, []);

  const toggleCompare = useCallback((car: StoredCar) => {
    setCompare(prev => {
      const exists = prev.some(c => c.id === car.id);
      if (exists) return prev.filter(c => c.id !== car.id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, car];
    });
  }, []);

  const removeFromFavorites = useCallback((id: string) => {
    setFavorites(prev => prev.filter(c => c.id !== id));
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setCompare(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearCompare = useCallback(() => setCompare([]), []);
  const clearFavorites = useCallback(() => setFavorites([]), []);

  return {
    favorites,
    compare,
    isFavorite,
    isInCompare,
    toggleFavorite,
    toggleCompare,
    removeFromFavorites,
    removeFromCompare,
    clearCompare,
    clearFavorites,
  };
}
