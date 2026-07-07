import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle, Send, Loader2, Calculator, Search, X, Car, AlertCircle } from "lucide-react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { sendEmail } from "@/lib/sendEmail";

interface TOEntry {
  TO: string;
  Mileage: number;
  SumServices: number;
  SumSpareParts: number;
  TotalSum: number;
}

interface LookupMod {
  name: string;
  engine: string;
  power: number;
  entries: TOEntry[];
}

interface LookupResult {
  ok: boolean;
  carInfo?: { brand: string; model: string; year?: number; power?: number; engine?: string };
  catalogBrand?: string | null;
  catalogModel?: string | null;
  modifications?: LookupMod[];
  error?: string;
}

async function fetchModels(brand: string): Promise<string[]> {
  const r = await fetch(`/api/to-catalog/models?brand=${encodeURIComponent(brand)}`);
  const j = await r.json();
  return j.models ?? [];
}
async function fetchModifications(brand: string, model: string): Promise<string[]> {
  const r = await fetch(`/api/to-catalog/modifications?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`);
  const j = await r.json();
  return j.modifications ?? [];
}
async function fetchEntries(brand: string, model: string, maintenance: string): Promise<TOEntry[]> {
  const r = await fetch(
    `/api/to-catalog/entries?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&maintenance=${encodeURIComponent(maintenance)}`
  );
  const j = await r.json();
  return j.entries ?? [];
}
async function checkHasBrand(brand: string): Promise<boolean> {
  const r = await fetch(`/api/to-catalog/has-brand?brand=${encodeURIComponent(brand)}`);
  const j = await r.json();
  return Boolean(j.has);
}

function fmt(n: number) { return n.toLocaleString("ru-RU").replace(/\s/g, "\u00a0") + "\u00a0₽"; }

function SelectField({ label, value, options, onChange, disabled, placeholder }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
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
          {options.map(o => <option key={o} value={o}>{o}</option>)}
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

function ResultBlock({ entry, brandName }: { entry: TOEntry; brandName: string }) {
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
            <div className="text-sm sm:text-base font-extrabold text-[#87b63c] whitespace-nowrap">−{fmt(Math.round(entry.TotalSum * 0.1))}</div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#87b63c]/20">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Итого с выгодой</div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 whitespace-nowrap">{fmt(Math.round(entry.TotalSum * 0.9))}</div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-[#87b63c]/20">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Начислят баллов</div>
            <div className="text-sm sm:text-base font-extrabold text-[#0070b8] whitespace-nowrap">+{fmt(Math.round(entry.TotalSum * 0.1))}</div>
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

function BookingForm({ onSend, entry, brand, model, maintenance, year }: {
  onSend: (name: string, phone: string) => Promise<void>;
  entry: TOEntry; brand: string; model: string; maintenance: string; year: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(phone)) return;
    setSending(true); setError("");
    try {
      await onSend(name, phone);
      setSent(true);
    } catch { setError("Не удалось отправить. Попробуйте позже."); }
    finally { setSending(false); }
  }

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
    <form onSubmit={handleSubmit} className="border-t border-slate-100 pt-5 mt-5">
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
              ${phoneTouched && !isPhoneValid(phone) ? "border-red-300 focus:border-red-400" : "border-slate-200 hover:border-[#0070b8]/50 focus:border-[#0070b8]"}`} />
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

export default function ToCalculator({ brandName }: { brandName: string }) {
  const [model, setModel] = useState("");
  const [maintenance, setMaintenance] = useState("");
  const [toKey, setToKey] = useState("");
  const [year, setYear] = useState("");
  const [calculated, setCalculated] = useState(false);

  const [vinInput, setVinInput] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinResult, setVinResult] = useState<LookupResult | null>(null);
  const [vinModIdx, setVinModIdx] = useState(0);
  const [vinToKey, setVinToKey] = useState("");
  const [vinCalculated, setVinCalculated] = useState(false);

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

  const { data: modifications = [], isLoading: modsLoading } = useQuery({
    queryKey: ["to-catalog-modifications", brandName, model],
    queryFn: () => fetchModifications(brandName, model),
    enabled: Boolean(model),
    staleTime: 10 * 60 * 1000,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["to-catalog-entries", brandName, model, maintenance],
    queryFn: () => fetchEntries(brandName, model, maintenance),
    enabled: Boolean(model && maintenance),
    staleTime: 10 * 60 * 1000,
  });

  const selectedEntry = entries.find(e => e.TO === toKey);
  const canCalculate = Boolean(model && maintenance && toKey && !entriesLoading);

  function handleModelChange(v: string) { setModel(v); setMaintenance(""); setToKey(""); setCalculated(false); }
  function handleMaintenanceChange(v: string) { setMaintenance(v); setToKey(""); setCalculated(false); }
  function handleToChange(v: string) { setToKey(v); setCalculated(false); }

  async function handleVinSearch() {
    const q = vinInput.trim().toUpperCase();
    if (!q) return;
    setVinLoading(true);
    setVinResult(null);
    setVinModIdx(0);
    setVinToKey("");
    setVinCalculated(false);
    try {
      const isVin = /^[A-Z0-9]{17}$/.test(q);
      const qs = isVin ? `vin=${encodeURIComponent(q)}` : `grz=${encodeURIComponent(q)}`;
      const r = await fetch(`/api/to-catalog/lookup?${qs}`);
      const j: LookupResult = await r.json();
      setVinResult(j);
      if (j.ok && j.modifications && j.modifications.length > 0) {
        setVinModIdx(0);
        if (j.modifications[0].entries.length > 0) setVinToKey(j.modifications[0].entries[0].TO);
      }
    } catch {
      setVinResult({ ok: false, error: "Ошибка соединения" });
    } finally {
      setVinLoading(false);
    }
  }

  function clearVin() {
    setVinInput(""); setVinResult(null); setVinModIdx(0); setVinToKey(""); setVinCalculated(false);
  }

  const vinMods = vinResult?.modifications ?? [];
  const vinMod = vinMods[vinModIdx];
  const vinEntry = vinMod?.entries.find(e => e.TO === vinToKey);

  async function sendVinBooking(name: string, phone: string) {
    if (!vinEntry || !vinResult?.carInfo) return;
    const ci = vinResult.carInfo;
    await sendEmail("to_calculator", {
      name, phone,
      brand: vinResult.catalogBrand ?? ci.brand,
      model: vinResult.catalogModel ?? ci.model,
      maintenance: vinMod?.name ?? "",
      toType: vinEntry.TO,
      mileage: String(vinEntry.Mileage),
      year: ci.year ? String(ci.year) : "",
      sumServices: String(vinEntry.SumServices),
      sumSpareParts: String(vinEntry.SumSpareParts),
      totalSum: String(vinEntry.TotalSum),
    });
  }

  async function sendManualBooking(name: string, phone: string) {
    if (!selectedEntry) return;
    await sendEmail("to_calculator", {
      name, phone, brand: brandName, model, maintenance,
      toType: selectedEntry.TO, mileage: String(selectedEntry.Mileage), year,
      sumServices: String(selectedEntry.SumServices), sumSpareParts: String(selectedEntry.SumSpareParts),
      totalSum: String(selectedEntry.TotalSum),
    });
  }

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
            <div className="p-6 sm:p-8">

              {/* ── VIN / GRZ search ── */}
              <div className="mb-6">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
                  Быстрый поиск по VIN или ГРЗ
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={vinInput}
                      onChange={e => setVinInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && handleVinSearch()}
                      placeholder="VIN (17 символов) или ГРЗ (А123ВС77)"
                      maxLength={20}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm font-medium text-slate-800 placeholder:text-slate-300 hover:border-[#0070b8]/50 focus:border-[#0070b8] outline-none transition-colors uppercase"
                    />
                    {vinInput && (
                      <button onClick={clearVin} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button onClick={handleVinSearch} disabled={!vinInput.trim() || vinLoading}
                    className="inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005a94] disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors shrink-0">
                    {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Найти
                  </button>
                </div>
              </div>

              {/* ── VIN result ── */}
              <AnimatePresence>
                {vinResult && (
                  <motion.div key="vin-result" initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="overflow-hidden">

                    {!vinResult.ok && (
                      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-sm text-red-700">{vinResult.error ?? "Не удалось определить автомобиль"}</p>
                      </div>
                    )}

                    {vinResult.ok && vinResult.carInfo && (
                      <div className="rounded-2xl border border-[#0070b8]/20 bg-[#0070b8]/3 overflow-hidden">
                        {/* Car info header */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#0070b8]/10 bg-[#0070b8]/5">
                          <Car className="w-5 h-5 text-[#0070b8] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800">
                              {vinResult.carInfo.brand} {vinResult.carInfo.model}
                              {vinResult.carInfo.year ? `, ${vinResult.carInfo.year} г.` : ""}
                            </p>
                            {(vinResult.carInfo.engine || vinResult.carInfo.power) && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {[vinResult.carInfo.engine, vinResult.carInfo.power ? `${vinResult.carInfo.power} л.с.` : ""].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                          <button onClick={clearVin} className="text-slate-400 hover:text-slate-600 ml-2"><X className="w-4 h-4" /></button>
                        </div>

                        {/* Not in catalog */}
                        {(!vinMods.length) && (
                          <div className="px-5 py-4">
                            <p className="text-sm text-slate-500">
                              Автомобиль определён, но данные ТО для этой модели пока не добавлены в каталог.
                              Воспользуйтесь ручным выбором ниже или свяжитесь с нами.
                            </p>
                          </div>
                        )}

                        {/* Modifications */}
                        {vinMods.length > 0 && (
                          <div className="p-5 space-y-4">
                            {/* Modification tabs (if multiple) */}
                            {vinMods.length > 1 && (
                              <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Модификация</label>
                                <div className="flex flex-wrap gap-2">
                                  {vinMods.map((m, i) => (
                                    <button key={m.name} onClick={() => { setVinModIdx(i); setVinToKey(m.entries[0]?.TO ?? ""); setVinCalculated(false); }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${vinModIdx === i ? "bg-[#0070b8] text-white border-[#0070b8]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0070b8]/50"}`}>
                                      {m.engine || m.name}{m.power > 0 ? `, ${m.power} л.с.` : ""}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* TO type selector */}
                            {vinMod && (
                              <div>
                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Вид ТО</label>
                                <div className="relative">
                                  <select value={vinToKey} onChange={e => { setVinToKey(e.target.value); setVinCalculated(false); }}
                                    className="w-full appearance-none rounded-xl border border-slate-200 px-4 py-3 pr-10 text-sm font-medium text-slate-800 hover:border-[#0070b8]/50 focus:border-[#0070b8] outline-none transition-colors bg-white">
                                    {vinMod.entries.map(e => (
                                      <option key={e.TO} value={e.TO}>{e.TO} — {e.Mileage.toLocaleString("ru-RU")} км</option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            )}

                            <button type="button" onClick={() => setVinCalculated(true)} disabled={!vinToKey || !vinEntry}
                              className="inline-flex items-center gap-2 bg-[#87b63c] hover:bg-[#78a234] disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors">
                              <Calculator className="w-4 h-4" />
                              Рассчитать стоимость
                            </button>

                            <AnimatePresence>
                              {vinCalculated && vinEntry && (
                                <motion.div key={vinEntry.TO} initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }} className="overflow-hidden">
                                  <ResultBlock entry={vinEntry} brandName={brandName} />
                                  <BookingForm entry={vinEntry} brand={vinResult.catalogBrand ?? vinResult.carInfo?.brand ?? brandName}
                                    model={vinResult.catalogModel ?? vinResult.carInfo?.model ?? ""}
                                    maintenance={vinMod.name} year={vinResult.carInfo?.year ? String(vinResult.carInfo.year) : ""}
                                    onSend={sendVinBooking} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Manual selection ── */}
              <div className={vinResult?.ok && vinMods.length > 0 ? "opacity-50 pointer-events-none" : ""}>
                {vinResult?.ok && vinMods.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    или выберите вручную
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <SelectField label="Модель" value={model} options={models}
                    onChange={handleModelChange} disabled={modelsLoading || models.length === 0}
                    placeholder="— Выберите модель —" />
                  <SelectField label="Модификация" value={maintenance} options={modifications}
                    onChange={handleMaintenanceChange} disabled={!model || modsLoading}
                    placeholder={model ? "— Выберите модификацию —" : "Сначала выберите модель"} />
                  <ToSelectField label="Вид ТО" value={toKey} entries={entries}
                    onChange={handleToChange} disabled={!maintenance || entriesLoading}
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
                      <ResultBlock entry={selectedEntry} brandName={brandName} />
                      <BookingForm entry={selectedEntry} brand={brandName} model={model}
                        maintenance={maintenance} year={year} onSend={sendManualBooking} />
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
