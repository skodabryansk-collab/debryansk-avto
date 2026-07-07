import { useState } from "react";

export interface VinTOEntry {
  TO: string;
  Mileage: number;
  SumServices: number;
  SumSpareParts: number;
  TotalSum: number;
}

export interface VinLookupMod {
  name: string;
  engine: string;
  power: number;
  entries: VinTOEntry[];
}

export interface VinCarInfo {
  brand: string;
  model: string;
  year?: number;
  power?: number;
  engine?: string;
}

export interface VinLookupResult {
  ok: boolean;
  carInfo?: VinCarInfo;
  catalogBrand?: string | null;
  catalogModel?: string | null;
  modifications?: VinLookupMod[];
  error?: string;
}

export interface UseVinLookupReturn {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  result: VinLookupResult | null;
  search: () => Promise<void>;
  clear: () => void;
}

export function useVinLookup(onResult?: (r: VinLookupResult) => void): UseVinLookupReturn {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VinLookupResult | null>(null);

  async function search() {
    const q = input.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      const isVin = /^[A-Z0-9]{17}$/.test(q);
      const qs = isVin ? `vin=${encodeURIComponent(q)}` : `grz=${encodeURIComponent(q)}`;
      const r = await fetch(`/api/to-catalog/lookup?${qs}`);
      const j: VinLookupResult = await r.json();
      setResult(j);
      onResult?.(j);
    } catch {
      const errResult: VinLookupResult = { ok: false, error: "Ошибка соединения" };
      setResult(errResult);
      onResult?.(errResult);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setInput("");
    setResult(null);
  }

  return { input, setInput, loading, result, search, clear };
}
