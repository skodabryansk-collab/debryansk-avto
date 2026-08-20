import React, { useState } from "react";
import { ymGoal } from "@/lib/ym";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle, Send, Loader2, Calculator, AlertCircle } from "lucide-react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { sendEmail } from "@/lib/sendEmail";
import { VinGrzInput } from "@/components/VinGrzInput";
import { useVinLookup, type VinLookupResult, type VinTOEntry, type VinLookupMod } from "@/hooks/useVinLookup";

interface TOEntry {
  TO: string;
  Mileage: number;
  SumServices: number;
  SumSpareParts: number;
  TotalSum: number;
}

interface CmMod {
  id: string;
  label: string;
  power: number;
  drive: string;
  engineVolume: string;
  gear: string;
}

interface CmModsResult {
  ok: boolean;
  modifications?: CmMod[];
  error?: string;
}


async function fetchModels(brand: string): Promise<string[]> {
  const r = await fetch(`/api/to-catalog/models?brand=${encodeURIComponent(brand)}`);
  return (await r.json()).models ?? [];
}
async function fetchModifications(brand: string, model: string): Promise<string[]> {
  const r = await fetch(`/api/to-catalog/modifications?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`);
  return (await r.json()).modifications ?? [];
}
async function fetchEntries(brand: string, model: string, maintenance: string): Promise<TOEntry[]> {
  const r = await fetch(`/api/to-catalog/entries?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&maintenance=${encodeURIComponent(maintenance)}`);
  return (await r.json()).entries ?? [];
}
async function checkHasBrand(brand: string): Promise<boolean> {
  const r = await fetch(`/api/to-catalog/has-brand?brand=${encodeURIComponent(brand)}`);
  return Boolean((await r.json()).has);
}
async function fetchCmYears(brand: string, model: string): Promise<number[]> {
  const r = await fetch(
    `/api/to-catalog/cm-years?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`,
  );
  return (await r.json()).years ?? [];
}
async function fetchCmMods(brand: string, model: string, year: string): Promise<CmModsResult> {
  const r = await fetch(
    `/api/to-catalog/cm-mods?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`,
  );
  return r.json();
}
async function fetchEntriesForMod(brand: string, model: string, power: number, drive: string): Promise<TOEntry[]> {
  const r = await fetch(
    `/api/to-catalog/entries-for-mod?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&power=${power}&drive=${encodeURIComponent(drive)}`,
  );
  return (await r.json()).entries ?? [];
}

function ceilRubles(n: number) { return Math.ceil(n); }
function fmt(n: number) { return ceilRubles(n).toLocaleString("ru-RU").replace(/\s/g, "\u00a0") + "\u00a0₽"; }

function SelectField({ label, value, options, onChange, disabled, placeholder, loading }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  disabled: boolean; placeholder: string; loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <div className="relative">
        {loading && (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0070b8]" />
        )}
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          className={`w-full appearance-none rounded-xl border px-4 py-3 pr-10 text-sm font-medium bg-white transition-colors outline-none
            ${loading ? "pl-10" : ""}
            ${disabled ? "text-slate-300 border-slate-100 cursor-not-allowed" : "text-slate-800 border-slate-200 hover:border-[#0070b8]/50 focus:border-[#0070b8] cursor-pointer"}`}>
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${disabled ? "text-slate-200" : "text-slate-400"}`} />
      </div>
    </div>
  );
}

function CmModField({ label, value, mods, onChange, disabled, loading }: {
  label: string; value: string; mods: CmMod[];
  onChange: (mod: CmMod | null) => void; disabled: boolean; loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <div className="relative">
        {loading && (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0070b8]" />
        )}
        <select
          value={value}
          onChange={e => {
            const mod = mods.find(m => m.id === e.target.value) ?? null;
            onChange(mod);
          }}
          disabled={disabled}
          className={`w-full appearance-none rounded-xl border px-4 py-3 pr-10 text-sm font-medium bg-white transition-colors outline-none
            ${loading ? "pl-10" : ""}
            ${disabled ? "text-slate-300 border-slate-100 cursor-not-allowed" : "text-slate-800 border-slate-200 hover:border-[#0070b8]/50 focus:border-[#0070b8] cursor-pointer"}`}>
          <option value="">
            {disabled && !loading ? "Выберите модель и год" : "— Выберите модификацию —"}
          </option>
          {mods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${disabled ? "text-slate-200" : "text-slate-400"}`} />
      </div>
    </div>
  );
}

function ToSelectField({ label, value, entries, onChange, disabled, placeholder }: {
  label: string; value: string; entries: TOEntry[]; onChange: (v: string) => void;
  disabled: boolean; placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          className={`w-full appearance-none rounded-xl border px-4 py-3 pr-10 text-sm font-medium bg-white transition-colors outline-none
            ${disabled ? "text-slate-300 border-slate-100 cursor-not-allowed" : "text-slate-800 border-slate-200 hover:border-[#0070b8]/50 focus:border-[#0070b8] cursor-pointer"}`}>
          <option value="">{placeholder}</option>
          {entries.map(e => <option key={e.TO} value={e.TO}>{e.TO} — {e.Mileage.toLocaleString("ru-RU")} км</option>)}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${disabled ? "text-slate-200" : "text-slate-400"}`} />
      </div>
    </div>
  );
}

function CostBreakdown({ entry }: { entry: VinTOEntry | TOEntry }) {
  return (
    <div className="bg-gradient-to-r from-[#0070b8]/5 to-[#87b63c]/5 border border-[#0070b8]/15 rounded-2xl p-5 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-4">
        Расчёт стоимости — {entry.TO} ({entry.Mileage.toLocaleString("ru-RU")} км)
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Работы</div>
          <div className="text-sm sm:text-lg font-extrabold text-slate-900 whitespace-nowrap">{fmt(entry.SumServices)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Запчасти</div>
          <div className="text-sm sm:text-lg font-extrabold text-slate-900 whitespace-nowrap">{fmt(entry.SumSpareParts)}</div>
        </div>
        <div className="bg-[#0070b8] rounded-xl p-3 sm:p-4 border border-[#0070b8]">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1.5">Итого</div>
          <div className="text-sm sm:text-lg font-extrabold text-white whitespace-nowrap">{fmt(entry.TotalSum)}</div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[#87b63c]/30 bg-[#87b63c]/5 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#5a8a1a] mb-3">Бонусная программа ГК «Дебрянск-Авто»</p>
        <div className="grid sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#87b63c]/20">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ваша выгода (10%)</div>
            <div className="text-sm sm:text-base font-extrabold text-[#87b63c] whitespace-nowrap">−{fmt(ceilRubles(entry.TotalSum * 0.1))}</div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#87b63c]/20">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Итого с выгодой</div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 whitespace-nowrap">{fmt(ceilRubles(entry.TotalSum * 0.9))}</div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#87b63c]/20">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Начислят баллов</div>
            <div className="text-sm sm:text-base font-extrabold text-[#0070b8] whitespace-nowrap">+{fmt(ceilRubles(entry.TotalSum * 0.1))}</div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          * При наличии уровня бонусной программы ГК «Дебрянск-Авто» и достаточного количества баллов на счёте.
        </p>
      </div>
      <p className="mt-3 text-[10px] text-slate-400">* Точную стоимость ТО уточняйте в дилерском центре.</p>
    </div>
  );
}

function BookingForm({ onSend }: { onSend: (name: string, phone: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (sent) {
    return (
      <div className="mt-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
        <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
        <div>
          <p className="font-bold text-green-800 text-sm">Заявка отправлена!</p>
          <p className="text-green-600 text-xs mt-0.5">Наш менеджер свяжется с вами для подтверждения записи.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      if (!isPhoneValid(phone)) return;
      setSending(true); setError("");
      try { await onSend(name, phone); ymGoal("lead_submit"); setSent(true); }
      catch { setError("Не удалось отправить. Попробуйте позже."); }
      finally { setSending(false); }
    }} className="border-t border-slate-100 pt-5 mt-5">
      <p className="text-sm font-semibold text-slate-600 mb-4">Записаться на ТО — оставьте контакты</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Ваше имя</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Имя"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-300 hover:border-[#0070b8]/50 focus:border-[#0070b8] outline-none transition-colors" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Телефон *</label>
          <input type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
            onBlur={() => setPhoneTouched(true)} placeholder="+7 (___) ___-__-__"
            className={`rounded-xl border px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-300 outline-none transition-colors
              ${phoneTouched && !isPhoneValid(phone) ? "border-red-300" : "border-slate-200 hover:border-[#0070b8]/50 focus:border-[#0070b8]"}`} />
          {phoneTouched && !isPhoneValid(phone) && <span className="text-xs text-red-500">Введите корректный номер</span>}
        </div>
      </div>
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      <button type="submit" disabled={sending || !isPhoneValid(phone)}
        className="mt-4 inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005a94] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
        {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправляем...</> : <><Send className="w-4 h-4" /> Записаться на ТО</>}
      </button>
    </form>
  );
}

function VinResultPanel({ result, onClear }: { result: VinLookupResult; onClear: () => void }) {
  const mods: VinLookupMod[] = result.modifications ?? [];
  const [modIdx, setModIdx] = useState(0);
  const [toKey, setToKey] = useState(mods[0]?.entries[0]?.TO ?? "");
  const [calculated, setCalculated] = useState(false);

  const mod = mods[modIdx];
  const entry = mod?.entries.find(e => e.TO === toKey);

  if (!mods.length) return null;

  return (
    <div className="rounded-2xl border border-[#0070b8]/20 bg-[#0070b8]/3 overflow-hidden">
      <div className="p-5 space-y-4">
        {mods.length > 1 && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Модификация</label>
            <div className="flex flex-wrap gap-2">
              {mods.map((m, i) => (
                <button key={m.name} onClick={() => { setModIdx(i); setToKey(m.entries[0]?.TO ?? ""); setCalculated(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${modIdx === i ? "bg-[#0070b8] text-white border-[#0070b8]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0070b8]/50"}`}>
                  {m.engine || m.name}{m.power > 0 ? `, ${m.power} л.с.` : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {mod && (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Вид ТО</label>
            <div className="relative">
              <select value={toKey} onChange={e => { setToKey(e.target.value); setCalculated(false); }}
                className="w-full appearance-none rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm font-medium text-slate-800 hover:border-[#0070b8]/50 focus:border-[#0070b8] outline-none transition-colors bg-white">
                {mod.entries.map(e => <option key={e.TO} value={e.TO}>{e.TO} — {e.Mileage.toLocaleString("ru-RU")} км</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        <button onClick={() => setCalculated(true)} disabled={!toKey || !entry}
          className="inline-flex items-center gap-2 bg-[#87b63c] hover:bg-[#78a234] disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors">
          <Calculator className="w-4 h-4" />
          Рассчитать стоимость
        </button>

        <AnimatePresence>
          {calculated && entry && (
            <motion.div key={entry.TO} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              <CostBreakdown entry={entry} />
              <BookingForm onSend={async (name, phone) => {
                await sendEmail("to_calculator", {
                  name, phone,
                  brand: result.catalogBrand ?? result.carInfo?.brand ?? "",
                  model: result.catalogModel ?? result.carInfo?.model ?? "",
                  maintenance: mod.name,
                  toType: entry.TO,
                  mileage: String(entry.Mileage),
                  year: result.carInfo?.year ? String(result.carInfo.year) : "",
                  sumServices: String(entry.SumServices),
                  sumSpareParts: String(entry.SumSpareParts),
                  totalSum: String(entry.TotalSum),
                });
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ToCalculator({
  brandName,
  cmToBrandId,
}: {
  brandName: string;
  cmToBrandId?: string | null;
}) {
  const useCmFlow = Boolean(cmToBrandId);

  // Common state
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [toKey, setToKey] = useState("");
  const [calculated, setCalculated] = useState(false);

  // CM Expert flow state
  const [cmMod, setCmMod] = useState<CmMod | null>(null);

  // Legacy flow state (when cmToBrandId not set)
  const [maintenance, setMaintenance] = useState("");

  const vin = useVinLookup((r) => {
    if (!r.ok) return;
    if (r.catalogModel) {
      setModel(r.catalogModel);
      setMaintenance("");
      setCmMod(null);
      setToKey("");
      setCalculated(false);
    }
    if (r.carInfo?.year) setYear(String(r.carInfo.year));
    if (!useCmFlow && r.modifications?.length === 1) {
      setMaintenance(r.modifications[0].name);
      setToKey("");
      setCalculated(false);
    }
  });
  const vinResult = vin.result;
  const hasVinMatch = vinResult?.ok && (vinResult.modifications?.length ?? 0) > 0;

  /* ── Shared queries ─────────────────────────────────────────── */

  const { data: hasBrand, isLoading: checkingBrand } = useQuery({
    queryKey: ["to-catalog-has-brand", brandName],
    queryFn: () => checkHasBrand(brandName),
    staleTime: 10 * 60 * 1000,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["to-catalog-models", brandName],
    queryFn: () => fetchModels(brandName),
    enabled: Boolean(hasBrand),
    staleTime: 10 * 60 * 1000,
  });

  /* ── CM Expert flow queries ─────────────────────────────────── */

  const yearReady = year.length === 4; // year comes from CM select — always a valid 4-digit string

  const { data: cmYears = [], isLoading: cmYearsLoading } = useQuery({
    queryKey: ["to-cm-years", brandName, model],
    queryFn: () => fetchCmYears(brandName, model),
    enabled: useCmFlow && Boolean(model),
    staleTime: 60 * 60 * 1000,
  });

  const {
    data: cmModsData,
    isLoading: cmModsLoading,
  } = useQuery({
    queryKey: ["to-cm-mods", brandName, model, year],
    queryFn: () => fetchCmMods(brandName, model, year),
    enabled: useCmFlow && Boolean(model) && yearReady,
    staleTime: 60 * 60 * 1000,
  });

  const cmModsList: CmMod[] = cmModsData?.ok ? (cmModsData.modifications ?? []) : [];

  // CM flow: load TO entries directly after modification is selected — no Maintenance step needed
  const { data: cmEntries = [], isLoading: cmEntriesLoading } = useQuery({
    queryKey: ["to-entries-for-mod", brandName, model, cmMod?.power ?? 0, cmMod?.drive ?? ""],
    queryFn: () => fetchEntriesForMod(brandName, model, cmMod!.power, cmMod!.drive),
    enabled: useCmFlow && Boolean(cmMod),
    staleTime: 10 * 60 * 1000,
  });

  /* ── Legacy flow queries (when cmToBrandId not set) ─────────── */

  const { data: modifications = [], isLoading: modsLoading } = useQuery({
    queryKey: ["to-catalog-modifications", brandName, model],
    queryFn: () => fetchModifications(brandName, model),
    enabled: !useCmFlow && Boolean(model),
    staleTime: 10 * 60 * 1000,
  });

  /* ── Entries query (shared — needs resolved maintenance) ─────── */

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["to-catalog-entries", brandName, model, maintenance],
    queryFn: () => fetchEntries(brandName, model, maintenance),
    enabled: Boolean(model && maintenance),
    staleTime: 10 * 60 * 1000,
  });

  // CM flow: entries come directly from entries-for-mod
  // Legacy flow: entries come from the maintenance-based query
  const activeEntries = useCmFlow ? cmEntries : entries;
  const selectedEntry = activeEntries.find(e => e.TO === toKey);
  const canCalculate = useCmFlow
    ? Boolean(model && cmMod && toKey && !cmEntriesLoading)
    : Boolean(model && maintenance && toKey && !entriesLoading);

  if (checkingBrand) return null;
  if (!hasBrand) return null;

  return (
    <section className="py-14 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-[#0070b8] flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8]">Техническое обслуживание</p>
              <h2 className="text-2xl font-extrabold text-slate-900">Калькулятор стоимости ТО</h2>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">

              {/* VIN / GRZ search */}
              <VinGrzInput state={vin} label="Быстрый поиск по VIN" showResultCard={true} />

              <AnimatePresence>
                {hasVinMatch && vinResult && (
                  <motion.div key="vin-panel" initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }} className="overflow-hidden">
                    <VinResultPanel result={vinResult} onClear={vin.clear} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Manual selection */}
              <div className={hasVinMatch ? "opacity-40 pointer-events-none select-none" : ""}>
                {hasVinMatch && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">или выберите вручную</p>
                )}

                {useCmFlow ? (
                  /* ── CM Expert flow ───────────────────────── */
                  <div className="space-y-4">
                    {/* Row 1: Model + Year */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SelectField
                        label="Модель"
                        value={model}
                        options={models}
                        onChange={v => {
                          setModel(v);
                          setCmMod(null);
                          setCmMod(null);
                          setYear("");
                          setCalculated(false);
                        }}
                        disabled={modelsLoading || models.length === 0}
                        placeholder="— Выберите модель —"
                      />
                      <SelectField
                        label="Год выпуска"
                        value={year}
                        options={cmYears.map(y => String(y))}
                        onChange={v => {
                          setYear(v);
                          setCmMod(null);
                          setToKey("");
                          setCalculated(false);
                        }}
                        disabled={!model || cmYearsLoading || cmYears.length === 0}
                        placeholder={model ? "— Выберите год —" : "Сначала выберите модель"}
                        loading={cmYearsLoading && Boolean(model)}
                      />
                    </div>

                    {/* Row 2: CM Expert modification (full width) */}
                    <CmModField
                      label="Модификация"
                      value={cmMod?.id ?? ""}
                      mods={cmModsList}
                      onChange={mod => {
                        setCmMod(mod);
                        setToKey("");
                        setCalculated(false);
                      }}
                      disabled={!model || !yearReady || cmModsLoading}
                      loading={cmModsLoading}
                    />

                    {/* CM Expert error / not found */}
                    {!cmModsLoading && cmMod === null && cmModsData && !cmModsData.ok && model && yearReady && (
                      <div className="flex items-start gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Модификации не найдены в каталоге Авто.ру. Попробуйте другой год.</span>
                      </div>
                    )}

                    {/* Row 3: TO type — enabled immediately after modification is selected */}
                    <ToSelectField
                      label="Вид ТО"
                      value={toKey}
                      entries={cmEntries}
                      onChange={v => { setToKey(v); setCalculated(false); }}
                      disabled={!cmMod || cmEntriesLoading}
                      placeholder={cmMod ? "— Выберите вид ТО —" : "Сначала выберите модификацию"}
                    />
                  </div>
                ) : (
                  /* ── Legacy flow (no CM Expert configured) ─── */
                  <div className="grid sm:grid-cols-2 gap-4">
                    <SelectField label="Модель" value={model} options={models}
                      onChange={v => { setModel(v); setMaintenance(""); setToKey(""); setCalculated(false); }}
                      disabled={modelsLoading || models.length === 0} placeholder="— Выберите модель —" />
                    <SelectField label="Модификация" value={maintenance} options={modifications}
                      onChange={v => { setMaintenance(v); setToKey(""); setCalculated(false); }}
                      disabled={!model || modsLoading}
                      placeholder={model ? "— Выберите модификацию —" : "Сначала выберите модель"} />
                    <ToSelectField label="Вид ТО" value={toKey} entries={entries}
                      onChange={v => { setToKey(v); setCalculated(false); }}
                      disabled={!maintenance || entriesLoading}
                      placeholder={maintenance ? "— Выберите вид ТО —" : "Сначала выберите модификацию"} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Год выпуска <span className="normal-case font-normal text-slate-300">(необязательно)</span>
                      </label>
                      <input type="text" inputMode="numeric" maxLength={4} value={year}
                        onChange={e => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="Например: 2023"
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-300 hover:border-[#0070b8]/50 focus:border-[#0070b8] outline-none transition-colors" />
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <button type="button" onClick={() => setCalculated(true)} disabled={!canCalculate}
                    className="inline-flex items-center gap-2 bg-[#87b63c] hover:bg-[#78a234] disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors">
                    <Calculator className="w-4 h-4" />
                    Рассчитать стоимость
                  </button>
                </div>

                <AnimatePresence>
                  {calculated && selectedEntry && (
                    <motion.div key={selectedEntry.TO} initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <CostBreakdown entry={selectedEntry} />
                      <BookingForm onSend={async (name, phone) => {
                        await sendEmail("to_calculator", {
                          name, phone, brand: brandName, model,
                          maintenance: useCmFlow ? (cmMod?.label ?? "") : maintenance,
                          toType: selectedEntry.TO, mileage: String(selectedEntry.Mileage), year,
                          sumServices: String(selectedEntry.SumServices),
                          sumSpareParts: String(selectedEntry.SumSpareParts),
                          totalSum: String(selectedEntry.TotalSum),
                        });
                      }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
