import { KeyboardEvent } from "react";
import { Search, X, Loader2, Car, AlertCircle } from "lucide-react";
import { useVinLookup, type VinLookupResult, type UseVinLookupReturn } from "@/hooks/useVinLookup";

interface VinGrzInputProps {
  onResult?: (r: VinLookupResult) => void;
  showResultCard?: boolean;
  placeholder?: string;
  label?: string;
  state?: UseVinLookupReturn;
}

function CarInfoCard({ result, onClear }: { result: VinLookupResult; onClear: () => void }) {
  if (!result.ok) {
    return (
      <div className="mt-2 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
        <p className="text-sm text-red-700">{result.error ?? "Не удалось определить автомобиль"}</p>
      </div>
    );
  }
  if (!result.carInfo) return null;
  const { brand, model, year, engine, power } = result.carInfo;
  const inCatalog = (result.modifications?.length ?? 0) > 0;
  return (
    <div className="mt-2 flex items-center gap-3 bg-[#0070b8]/5 border border-[#0070b8]/20 rounded-xl px-4 py-3">
      <Car className="w-4 h-4 text-[#0070b8] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">
          {brand} {model}{year ? `, ${year} г.` : ""}
        </p>
        {(engine || power) && (
          <p className="text-xs text-slate-500 mt-0.5">
            {[engine, power ? `${power} л.с.` : ""].filter(Boolean).join(" · ")}
            {inCatalog
              ? <span className="ml-2 text-[#87b63c] font-semibold">· есть в каталоге ТО</span>
              : <span className="ml-2 text-slate-400">· не найден в каталоге ТО</span>
            }
          </p>
        )}
      </div>
      <button onClick={onClear} className="text-slate-300 hover:text-slate-500 ml-1 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function VinGrzInput({
  onResult,
  showResultCard = true,
  placeholder = "VIN (17 символов) или ГРЗ (А123ВС77)",
  label,
  state: externalState,
}: VinGrzInputProps) {
  const internal = useVinLookup(onResult);
  const s = externalState ?? internal;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") s.search();
  }

  return (
    <div>
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={s.input}
            onChange={e => s.setInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={20}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm font-medium text-slate-800 placeholder:text-slate-300 hover:border-[#0070b8]/50 focus:border-[#0070b8] outline-none transition-colors uppercase"
          />
          {s.input && (
            <button
              onClick={s.clear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={s.search}
          disabled={!s.input.trim() || s.loading}
          className="inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005a94] disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors shrink-0"
        >
          {s.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Найти
        </button>
      </div>

      {showResultCard && s.result && (
        <CarInfoCard result={s.result} onClear={s.clear} />
      )}
    </div>
  );
}
