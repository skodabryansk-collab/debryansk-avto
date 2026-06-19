import React, { useState, useEffect } from "react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { motion } from "framer-motion";
import {
  TrendingUp, Clock, Shield, BadgeCheck,
  Phone, MessageSquare, Car, Gauge, CheckCircle,
  ArrowRight, Banknote, Tag, AlertCircle,
  ChevronDown, Loader2,
} from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

/* ── Types ─────────────────────────────────────────────────── */
interface CmItem { id: string; name: string; [key: string]: any }

/* ── API helpers ────────────────────────────────────────────── */
async function fetchCmBrands(): Promise<CmItem[]> {
  const r = await fetch("/api/car-catalog/cm-brands");
  if (!r.ok) throw new Error("Ошибка загрузки марок");
  const j = await r.json();
  return j.ok ? (j.data ?? []) : [];
}

async function fetchCmModels(brand: string): Promise<CmItem[]> {
  if (!brand) return [];
  const r = await fetch(`/api/car-catalog/cm-models?brand=${encodeURIComponent(brand)}`);
  if (!r.ok) throw new Error("Ошибка загрузки моделей");
  const j = await r.json();
  return j.ok ? (j.data ?? []) : [];
}

async function fetchCmGenerations(brand: string, model: string, creationYear: string): Promise<CmItem[]> {
  if (!brand || !model) return [];
  const qs = new URLSearchParams({ brand, model });
  if (creationYear) qs.append("creationYear", creationYear);
  const r = await fetch(`/api/car-catalog/cm-generations?${qs}`);
  if (!r.ok) throw new Error("Ошибка загрузки поколений");
  const j = await r.json();
  return j.ok ? (j.data ?? []) : [];
}

async function fetchCmBodies(brand: string, model: string): Promise<CmItem[]> {
  if (!brand || !model) return [];
  const qs = new URLSearchParams({ brand, model });
  const r = await fetch(`/api/car-catalog/cm-bodies?${qs}`);
  if (!r.ok) throw new Error("Ошибка загрузки кузовов");
  const j = await r.json();
  return j.ok ? (j.data ?? []) : [];
}

async function fetchCmYears(brand: string, model: string): Promise<number[]> {
  if (!brand || !model) return [];
  const qs = new URLSearchParams({ brand, model });
  const r = await fetch(`/api/car-catalog/cm-years?${qs}`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.ok ? (j.data ?? []) : [];
}

interface ModificationItem {
  id: string; name: string;
  drive: string; engineVolume: string; power: string; gear: string; complectation: string; doors: string; bodyId: string;
}

interface ModOptions {
  modifications: ModificationItem[];
  driveTypes: { id: string; name: string }[];
  engineVolumes: { id: string; name: string }[];
  powers: { id: string; name: string }[];
  gearTypes: { id: string; name: string }[];
  complectations: { id: string; name: string }[];
  doorNumbers: { id: string; name: string }[];
}

async function fetchCmModificationsOptions(brand: string, model: string, year: string): Promise<ModOptions | null> {
  if (!brand || !model || !year) return null;
  const qs = new URLSearchParams({ brand, model, year });
  const r = await fetch(`/api/car-catalog/cm-modifications-options?${qs}`);
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.ok) return null;
  const mods = (j.modifications ?? []).map((m: any) => ({ ...m, bodyId: m.bodyId ?? "" }));
  return { modifications: mods, driveTypes: j.driveTypes ?? [], engineVolumes: j.engineVolumes ?? [], powers: j.powers ?? [], gearTypes: j.gearTypes ?? [], complectations: j.complectations ?? [], doorNumbers: j.doorNumbers ?? [] };
}

interface PredictResult {
  ok: true;
  buyoutMin: number;
  buyoutMax: number;
}

async function fetchCmExpertPredict(params: {
  brandId: string; modelId: string; year: string; mileage: string;
  bodyId?: string; generationId?: string;
  drive?: string; engineVolume?: string; complectation?: string;
  modificationId?: string; ownersNumber?: string;
}): Promise<PredictResult | { ok: false }> {
  const qs = new URLSearchParams({
    brandId: params.brandId,
    modelId: params.modelId,
    year: params.year,
    mileage: params.mileage,
  });
  if (params.bodyId)         qs.append("bodyId",       params.bodyId);
  if (params.generationId)   qs.append("generationId", params.generationId);
  if (params.modificationId) qs.append("modificationId", params.modificationId);
  if (params.drive)          qs.append("drive",        params.drive);
  if (params.engineVolume)   qs.append("engineVolume", params.engineVolume);
  if (params.complectation)  qs.append("complectation", params.complectation);
  if (params.ownersNumber)   qs.append("ownersNumber", params.ownersNumber);
  const r = await fetch(`/api/car-catalog/cm-expert-predict?${qs}`);
  if (!r.ok) return { ok: false };
  return r.json();
}

/* ── FadeIn helper ──────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Price helpers ───────────────────────────────────────────── */
function formatPriceRUB(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

/* ── Helpers to extract id/name from CM Expert items ─────────── */
function itemId(item: CmItem): string {
  return String(item.id ?? item.code ?? item.value ?? item.name ?? "");
}
function itemName(item: CmItem): string {
  return String(item.name ?? item.title ?? item.label ?? item.id ?? "");
}

/* ── Buyout form ────────────────────────────────────────────── */
function BuyoutForm() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    brand: "", model: "", year: "", mileage: "",
    modification: "", drive: "", engineVolume: "", power: "", gear: "", complectation: "", doors: "",
    generation: "", body: "",
    ownersCount: "",
    name: "", phone: "", comment: "",
  });
  const [priceResult, setPriceResult] = useState<PredictResult | { ok: false } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /* CM Expert brands */
  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["cm-brands"],
    queryFn: fetchCmBrands,
    staleTime: 24 * 60 * 60 * 1000,
  });

  /* CM Expert models — depends on brand */
  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["cm-models", form.brand],
    queryFn: () => fetchCmModels(form.brand),
    enabled: !!form.brand,
    staleTime: 24 * 60 * 60 * 1000,
  });

  /* CM Expert years — depends on brand + model */
  const { data: cmYears = [], isLoading: yearsLoading } = useQuery({
    queryKey: ["cm-years", form.brand, form.model],
    queryFn: () => fetchCmYears(form.brand, form.model),
    enabled: !!form.brand && !!form.model,
    staleTime: 24 * 60 * 60 * 1000,
  });

  /* CM Expert generations — depends on brand + model + year */
  const { data: generations = [], isLoading: generationsLoading } = useQuery({
    queryKey: ["cm-generations", form.brand, form.model, form.year],
    queryFn: () => fetchCmGenerations(form.brand, form.model, form.year),
    enabled: !!form.brand && !!form.model,
    staleTime: 24 * 60 * 60 * 1000,
  });

  /* CM Expert bodies — depends on brand + model */
  const { data: bodies = [], isLoading: bodiesLoading } = useQuery({
    queryKey: ["cm-bodies", form.brand, form.model],
    queryFn: () => fetchCmBodies(form.brand, form.model),
    enabled: !!form.brand && !!form.model,
    staleTime: 24 * 60 * 60 * 1000,
  });

  /* CM Expert modification options — depends on brand + model + year */
  const { data: modOptions, isLoading: modOptionsLoading } = useQuery({
    queryKey: ["cm-modifications-options", form.brand, form.model, form.year],
    queryFn: () => fetchCmModificationsOptions(form.brand, form.model, form.year),
    enabled: !!form.brand && !!form.model && !!form.year,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const mods = modOptions?.modifications ?? [];
  const modsForVolume = form.engineVolume
    ? mods.filter(m => m.engineVolume === form.engineVolume)
    : mods;
  const filteredDriveItems = (modOptions?.driveTypes ?? []).filter(d =>
    !form.engineVolume || modsForVolume.some(m => m.drive === d.name)
  );
  const modsForVolumeDrive = form.drive
    ? modsForVolume.filter(m => m.drive === form.drive)
    : modsForVolume;
  const filteredPowerItems = (modOptions?.powers ?? []).filter(p =>
    (!form.engineVolume && !form.drive) || modsForVolumeDrive.some(m => m.power === p.name)
  );
  const filteredGearItems = (modOptions?.gearTypes ?? []).filter(g =>
    (!form.engineVolume && !form.drive) || modsForVolumeDrive.some(m => m.gear === g.name)
  );
  const modsForBody = form.body
    ? modsForVolumeDrive.filter(m => m.bodyId === form.body)
    : modsForVolumeDrive;
  const filteredDoorItems = (modOptions?.doorNumbers ?? []).filter(d =>
    (!form.engineVolume && !form.drive && !form.body) || modsForBody.some(m => m.doors === d.id)
  );
  const matchingMods = mods.filter(m =>
    (!form.engineVolume || m.engineVolume === form.engineVolume) &&
    (!form.drive || m.drive === form.drive) &&
    (!form.power || m.power === form.power) &&
    (!form.gear || m.gear === form.gear) &&
    (!form.doors || m.doors === form.doors)
  );
  const autoModificationId = matchingMods.length === 1 ? matchingMods[0].id : "";

  const modFieldsVisible = modOptionsLoading || (modOptions != null && (
    modOptions.engineVolumes.length > 0 || modOptions.driveTypes.length > 0 ||
    modOptions.powers.length > 0 || modOptions.gearTypes.length > 0 ||
    modOptions.complectations.length > 0 || modOptions.doorNumbers.length > 0
  ));

  /* Reset dependent fields on parent change */
  useEffect(() => {
    setForm(f => ({ ...f, model: "", year: "", modification: "", drive: "", engineVolume: "", power: "", gear: "", complectation: "", doors: "", generation: "", body: "" }));
  }, [form.brand]);

  useEffect(() => {
    setForm(f => ({ ...f, year: "", modification: "", drive: "", engineVolume: "", power: "", gear: "", complectation: "", doors: "", generation: "", body: "" }));
  }, [form.model]);

  useEffect(() => {
    setForm(f => ({ ...f, modification: "", drive: "", engineVolume: "", power: "", gear: "", complectation: "", doors: "", generation: "" }));
  }, [form.year]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === "engineVolume") {
        next.modification = ""; next.drive = ""; next.power = ""; next.gear = ""; next.doors = "";
      } else if (key === "drive") {
        next.modification = ""; next.power = ""; next.gear = ""; next.doors = "";
      } else if (key === "body") {
        next.modification = ""; next.doors = "";
      } else if (["power", "gear", "complectation", "doors"].includes(key)) {
        next.modification = "";
      }
      return next;
    });
    setPriceResult(null);
  };

  const handleCalculate = async () => {
    if (!form.brand || !form.model) {
      toast({ title: "Выберите марку и модель", variant: "destructive" });
      return;
    }
    if (!form.year) {
      toast({ title: "Выберите год выпуска", variant: "destructive" });
      return;
    }
    if (!form.mileage) {
      toast({ title: "Укажите пробег", description: "Пробег необходим для точного расчёта", variant: "destructive" });
      return;
    }
    setPriceLoading(true);
    try {
      const result = await fetchCmExpertPredict({
        brandId:        form.brand,
        modelId:        form.model,
        year:           form.year,
        mileage:        form.mileage,
        bodyId:         form.body           || undefined,
        generationId:   form.generation     || undefined,
        modificationId: autoModificationId  || undefined,
        drive:          form.drive          || undefined,
        engineVolume:   form.engineVolume   || undefined,
        complectation:  form.complectation  || undefined,
        ownersNumber:   form.ownersCount    || undefined,
      });
      setPriceResult(result);
      setStep(2);
    } catch {
      setPriceResult({ ok: false });
      setStep(2);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !isPhoneValid(form.phone)) {
      toast({ title: "Укажите корректный номер телефона", variant: "destructive" });
      return;
    }
    try {
      const fd = new FormData();
      fd.append("type", "buyout");
      const brandName = brands.find(b => itemId(b) === form.brand)?.name ?? form.brand;
      const modelName = models.find(m => itemId(m) === form.model)?.name ?? form.model;
      fd.append("brand", brandName);
      fd.append("model", modelName);
      fd.append("year", form.year);
      fd.append("mileage", form.mileage);
      if (form.drive)          fd.append("drive", form.drive);
      if (form.engineVolume)   fd.append("engineVolume", form.engineVolume);
      if (form.power)          fd.append("power", form.power);
      if (form.gear)           fd.append("gear", form.gear);
      if (form.doors)          fd.append("doors", (modOptions?.doorNumbers ?? []).find(d => d.id === form.doors)?.name ?? form.doors);
      if (form.complectation)  fd.append("complectation", form.complectation);
      if (form.generation)     fd.append("generation", form.generation);
      if (form.body)           fd.append("body", bodies.find(b => b.id === form.body)?.name ?? form.body);
      if (form.ownersCount)    fd.append("owners", form.ownersCount);
      if (form.comment)        fd.append("comment", form.comment);
      fd.append("name", form.name);
      fd.append("phone", form.phone);
      if (priceResult?.ok) {
        fd.append("estimateMin", String(priceResult.buyoutMin));
        fd.append("estimateMax", String(priceResult.buyoutMax));
      }
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}
    setSubmitted(true);
    toast({ title: "Заявка принята!", description: "Перезвоним в течение 15 минут" });
  };

  const inputCls   = "w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#0070b8] focus:ring-1 focus:ring-[#0070b8] outline-none text-sm";
  const selectCls  = `${inputCls} bg-white`;
  const labelCls   = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5";

  const resetForm = () => {
    setSubmitted(false);
    setStep(1);
    setPriceResult(null);
    setForm({ brand: "", model: "", year: "", mileage: "", modification: "", drive: "", engineVolume: "", power: "", gear: "", complectation: "", doors: "", generation: "", body: "", ownersCount: "", name: "", phone: "", comment: "" });
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
        <div className="w-16 h-16 bg-[#87b63c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#87b63c]" />
        </div>
        <h3 className="text-xl font-extrabold mb-2">Заявка принята!</h3>
        <p className="text-slate-500 mb-4 text-sm">Наш менеджер перезвонит вам в течение 15 минут для обсуждения условий.</p>
        <button onClick={resetForm} className="text-[#0070b8] font-bold hover:underline text-sm">
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? "bg-[#0070b8] text-white" : "bg-[#87b63c] text-white"}`}>
          {step === 1 ? "1" : <CheckCircle className="w-4 h-4" />}
        </div>
        <div className="h-1 w-8 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${step === 2 ? "w-full bg-[#87b63c]" : "w-0"}`} />
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? "bg-[#0070b8] text-white" : "bg-slate-200 text-slate-400"}`}>2</div>
      </div>

      <h3 className="text-lg font-extrabold mb-1">
        {step === 1 ? "Рассчитайте стоимость" : "Отправьте заявку"}
      </h3>
      <p className="text-sm text-slate-500 mb-5">
        {step === 1
          ? "Заполните данные об автомобиле — покажем предварительную цену."
          : "Укажите контакты для подтверждения оценки."
        }
      </p>

      {/* ── Step 1: Car data ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Марка */}
            <div>
              <label className={labelCls}>Марка *</label>
              <SearchableSelect
                items={brands.map(b => ({ id: itemId(b), name: itemName(b) }))}
                value={form.brand}
                onChange={(id) => { setForm(f => ({ ...f, brand: id })); setPriceResult(null); }}
                placeholder="Выберите марку"
                loading={brandsLoading}
                className={`${inputCls} cursor-text`}
              />
            </div>

            {/* Модель */}
            <div>
              <label className={labelCls}>Модель *</label>
              <SearchableSelect
                items={models.map(m => ({ id: itemId(m), name: itemName(m) }))}
                value={form.model}
                onChange={(id) => { setForm(f => ({ ...f, model: id })); setPriceResult(null); }}
                placeholder={!form.brand ? "Сначала марку" : "Выберите модель"}
                disabled={!form.brand}
                loading={modelsLoading}
                className={`${inputCls} cursor-text`}
              />
            </div>

            {/* Год */}
            <div>
              <label className={labelCls}>Год *</label>
              <select value={form.year} onChange={set("year")} className={selectCls} disabled={!form.brand || !form.model || yearsLoading}>
                <option value="">{!form.model ? "Сначала модель" : yearsLoading ? "Загрузка…" : cmYears.length ? "Выберите год" : "Не указано"}</option>
                {cmYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Пробег */}
            <div>
              <label className={labelCls}>Пробег, км *</label>
              <input type="number" min="0" value={form.mileage} onChange={set("mileage")} placeholder="Например, 75 000" className={inputCls} />
            </div>

          </div>

          {/* ── Modification options (shown when year selected) ── */}
          {modFieldsVisible && (
            <div className="space-y-3 pt-1">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Объём двигателя */}
                {(modOptionsLoading || (modOptions?.engineVolumes ?? []).length > 0) && (
                  <div>
                    <label className={labelCls}>Объём двигателя</label>
                    <div className="relative">
                      <select value={form.engineVolume} onChange={set("engineVolume")} disabled={modOptionsLoading} className={`${selectCls} pr-9 appearance-none`}>
                        <option value="">{modOptionsLoading ? "Загрузка…" : "Не указан"}</option>
                        {(modOptions?.engineVolumes ?? []).map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </select>
                      {modOptionsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>
                  </div>
                )}

                {/* Тип привода */}
                {(modOptionsLoading || (modOptions?.driveTypes ?? []).length > 0) && (
                  <div>
                    <label className={labelCls}>Тип привода</label>
                    <div className="relative">
                      <select value={form.drive} onChange={set("drive")} disabled={modOptionsLoading} className={`${selectCls} pr-9 appearance-none`}>
                        <option value="">{modOptionsLoading ? "Загрузка…" : "Не указан"}</option>
                        {filteredDriveItems.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                      {modOptionsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>
                  </div>
                )}

                {/* Мощность */}
                {(modOptionsLoading || (modOptions?.powers ?? []).length > 0) && (
                  <div>
                    <label className={labelCls}>Мощность, л.с.</label>
                    <div className="relative">
                      <select value={form.power} onChange={set("power")} disabled={modOptionsLoading} className={`${selectCls} pr-9 appearance-none`}>
                        <option value="">{modOptionsLoading ? "Загрузка…" : "Не указана"}</option>
                        {filteredPowerItems.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                      {modOptionsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>
                  </div>
                )}

                {/* Тип КПП */}
                {(modOptionsLoading || (modOptions?.gearTypes ?? []).length > 0) && (
                  <div>
                    <label className={labelCls}>Тип КПП</label>
                    <div className="relative">
                      <select value={form.gear} onChange={set("gear")} disabled={modOptionsLoading} className={`${selectCls} pr-9 appearance-none`}>
                        <option value="">{modOptionsLoading ? "Загрузка…" : "Не указан"}</option>
                        {filteredGearItems.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                      </select>
                      {modOptionsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Комплектация — full width */}
              {(modOptionsLoading || (modOptions?.complectations ?? []).length > 0) && (
                <div>
                  <label className={labelCls}>Комплектация</label>
                  <div className="relative">
                    <select value={form.complectation} onChange={set("complectation")} disabled={modOptionsLoading} className={`${selectCls} pr-9 appearance-none`}>
                      <option value="">{modOptionsLoading ? "Загрузка…" : "Не указана"}</option>
                      {(modOptions?.complectations ?? []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    {modOptionsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /> : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Поколение */}
            <div>
              <label className={labelCls}>Поколение</label>
              <select value={form.generation} onChange={set("generation")} className={selectCls} disabled={!form.brand || !form.model || generationsLoading}>
                <option value="">
                  {!form.model ? "Сначала модель" : generationsLoading ? "Загрузка…" : generations.length ? "Выберите поколение" : "Не указано"}
                </option>
                {generations.map(g => <option key={itemId(g)} value={itemId(g)}>{itemName(g)}</option>)}
              </select>
            </div>

            {/* Тип кузова */}
            <div>
              <label className={labelCls}>Тип кузова</label>
              <select value={form.body} onChange={set("body")} className={selectCls} disabled={!form.brand || !form.model || bodiesLoading}>
                <option value="">
                  {!form.model ? "Сначала модель" : bodiesLoading ? "Загрузка…" : bodies.length ? "Выберите кузов" : "Не указано"}
                </option>
                {bodies.map(b => <option key={itemId(b)} value={itemId(b)}>{itemName(b)}</option>)}
              </select>
            </div>

            {/* Кол-во дверей (из данных модификаций) */}
            {filteredDoorItems.length > 0 && (
              <div>
                <label className={labelCls}>Кол-во дверей</label>
                <div className="relative">
                  <select value={form.doors} onChange={set("doors")} className={`${selectCls} pr-9 appearance-none`}>
                    <option value="">Не указано</option>
                    {filteredDoorItems.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Кол-во владельцев */}
            <div>
              <label className={labelCls}>Кол-во владельцев <span className="normal-case font-normal text-slate-400">(опционально)</span></label>
              <div className="relative">
                <select value={form.ownersCount} onChange={set("ownersCount")} className={`${selectCls} pr-9 appearance-none`}>
                  <option value="">Не указано</option>
                  <option value="1">1 владелец</option>
                  <option value="2">2 владельца</option>
                  <option value="3">3 владельца</option>
                  <option value="4">4 и более</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={priceLoading}
            className="w-full bg-[#0070b8] hover:bg-[#005a94] text-white font-bold rounded-xl py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {priceLoading ? "Расчитываем…" : "Рассчитать стоимость"}
          </button>
        </div>
      )}

      {/* ── Step 2: Price result + Contacts ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Price card — shown when predict succeeded */}
          {priceResult?.ok && (
            <div className="bg-[#0d0f14] rounded-2xl p-5 sm:p-6 border border-white/[0.07] mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#87b63c] mb-2">Предварительная оценка</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">{formatPriceRUB(priceResult.buyoutMin)}</span>
                <span className="text-sm text-white/40"> — </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-white">{formatPriceRUB(priceResult.buyoutMax)}</span>
              </div>
              <div className="bg-[#87b63c]/10 border border-[#87b63c]/20 rounded-xl px-3 py-2.5">
                <p className="text-[11px] font-semibold text-[#87b63c] leading-snug">
                  ⚠ Расчёт предварительный. Точная цена определяется после осмотра автомобиля.
                </p>
              </div>
            </div>
          )}

          {/* Error card — shown when predict failed */}
          {priceResult && !priceResult.ok && (
            <div className="bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-200 mb-2 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">Не удалось получить оценку</p>
                <p className="text-sm text-slate-500 leading-snug">
                  Менеджер перезвонит и назовёт цену — оставьте контакты, и мы свяжемся в течение 15 минут.
                </p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ваше имя *</label>
              <input type="text" value={form.name} onChange={set("name")} placeholder="Как вас зовут?" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Телефон *</label>
              <input type="tel" inputMode="tel" maxLength={18} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="+7 (___) ___-__-__" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Комментарий</label>
            <textarea
              value={form.comment} onChange={set("comment")}
              placeholder="Состояние, особенности, пожелания по цене…"
              rows={3} className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep(1); setPriceResult(null); }}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Изменить
            </button>
            <button type="submit" className="flex-1 bg-[#0070b8] hover:bg-[#005a94] text-white font-bold rounded-xl py-3 text-sm transition-colors">
              Отправить заявку
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-3 text-center">
        Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
      </p>
    </form>
  );
}

/* ── Services comparison ────────────────────────────────────── */
const services = [
  {
    icon: Banknote,
    tag: "Быстро",
    tagColor: "bg-[#87b63c]/10 text-[#5a7d22]",
    title: "Срочный выкуп",
    subtitle: "Деньги в день обращения",
    desc: "Мы выкупаем автомобиль сами — в течение одного дня. Вы называете машину, мы называем цену. Договор, перевод, снятие с учёта — всё берём на себя.",
    pros: [
      "Деньги переводим в день сделки",
      "Оценка автомобиля — бесплатно",
      "Выезд нашего специалиста к вам",
      "Без скрытых комиссий",
      "Помощь в снятии с учёта",
    ],
    note: "",
    accentColor: "border-[#87b63c]",
    iconBg: "bg-[#87b63c]/10",
    iconColor: "text-[#87b63c]",
  },
  {
    icon: TrendingUp,
    tag: "Выгоднее",
    tagColor: "bg-[#0070b8]/10 text-[#0070b8]",
    title: "Комиссионная продажа",
    subtitle: "Максимальная цена — без хлопот",
    desc: "Мы размещаем автомобиль на всех ведущих площадках: Авито, Авто.ру, Дром и нашем сайте. У нас одна из крупнейших автоплощадок в Брянске. По согласованию подготовим автомобиль к продаже. Доступна продажа в кредит для покупателей. Реклама, показы, переговоры, оформление — наша работа. Вы получаете деньги после сделки.",
    pros: [
      "Рыночная цена продажи",
      "Размещение на Авито, Авто.ру, Дром и нашем сайте",
      "Одна из крупнейших площадок города",
      "Подготовка автомобиля к продаже",
      "Продажа в кредит для покупателей",
      "Бесплатное хранение на охраняемой стоянке",
      "Мы проводим все переговоры",
      "Деньги сразу после продажи",
    ],
    note: "Наша комиссия фиксированная — озвучиваем сразу, без сюрпризов.",
    accentColor: "border-[#0070b8]",
    iconBg: "bg-[#0070b8]/10",
    iconColor: "text-[#0070b8]",
  },
];

/* ── Why us ─────────────────────────────────────────────────── */
const whyUs = [
  { icon: BadgeCheck, title: "Официальный дилер",   desc: "Договор, юридическая чистота и гарантия оплаты" },
  { icon: Clock,      title: "Ответ за 15 минут",    desc: "Перезваниваем сами — вам не надо ждать" },
  { icon: Shield,     title: "Чистая сделка",        desc: "Проверяем историю, оформляем все документы" },
  { icon: Gauge,      title: "Честная оценка",       desc: "Без искусственного занижения — только реальная цена" },
];

/* ── JSON-LD ─────────────────────────────────────────────────── */
const schema = {
  "@type": "Service",
  "name": "Выкуп и комиссионная продажа автомобилей",
  "alternateName": "Срочный выкуп авто",
  "description": "Срочный выкуп автомобилей и комиссионная продажа в Брянске. Оценка бесплатно, деньги в день сделки. Официальный дилер.",
  "url": "https://debryansk-auto.ru/buyout",
  "serviceType": "Выкуп и продажа автомобилей",
  "provider": {
    "@type": "AutoDealer",
    "name": "Дебрянск Авто",
    "url": "https://debryansk-auto.ru",
    "telephone": "+74832777770",
  },
  "areaServed": {
    "@type": "City",
    "name": "Брянск",
    "containedInPlace": { "@type": "State", "name": "Брянская область" },
  },
  "offers": {
    "@type": "Offer",
    "description": "Бесплатная оценка автомобиля. Деньги в день сделки.",
    "price": "0",
    "priceCurrency": "RUB",
  },
};

/* ── Sticky nav ─────────────────────────────────────────────── */
const navItems = [
  { id: "services", label: "Услуги" },
  { id: "process",  label: "Процесс" },
  { id: "form",     label: "Оценка" },
];

function BuyoutNav() {
  const [active, setActive] = useState("services");

  useEffect(() => {
    const sections = navItems.map(n => document.getElementById(n.id));
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach(s => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-[6.25rem] z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
          {navItems.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={e => {
                e.preventDefault();
                const el = document.getElementById(item.id);
                if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); setActive(item.id); }
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                active === item.id ? "bg-[#0070b8] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </a>
          ))}
          <Link href="/buyout" className="shrink-0 ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-[#87b63c] text-white shadow-sm">
            <Tag className="w-3.5 h-3.5" /> Выкуп
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function BuyoutPage() {
  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()).then(j => j.data as Record<string, string>),
    staleTime: 5 * 60 * 1000,
  });
  const headerPhone    = siteSettings?.header_phone ?? "+7 (4832) 77 77 70";
  const headerPhoneTel = "tel:+" + headerPhone.replace(/\D/g, "");

  return (
    <Layout>
      <SEO
        title="Выкуп и комиссия — Дебрянск Авто"
        description="Срочный выкуп автомобилей за наличные и комиссионная продажа в Брянске. Оценка бесплатно, деньги в день сделки. Официальный дилер."
        canonical="/buyout"
        jsonLd={schema}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Выкуп и комиссия", url: "/buyout" },
        ]}
      />

      <BuyoutNav />

      {/* ── Hero ── */}
      <div className="bg-[#0d0f14] text-white py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-3">
              Выкуп и комиссия
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              Выкуп и комиссия автомобилей в Брянске
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mb-8">
              Два пути — по честной цене. Срочный выкуп: деньги в тот же день. Комиссионная продажа: мы берём всё на себя и продаём по максимуму. За вами — решение, за нами — сделка.
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {[
                { icon: Banknote,   text: "Деньги в день сделки" },
                { icon: BadgeCheck, text: "Официальный договор" },
                { icon: Clock,      text: "Оценка за 15 минут" },
                { icon: Car,        text: "Любая марка и год" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                  <Icon className="w-3.5 h-3.5 text-[#87b63c]" />
                  <span className="text-xs font-semibold text-white/80">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two services ── */}
      <section id="services" className="py-12 sm:py-16 bg-[#f8f9fb]">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Услуги</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Два пути. Одна цель — ваша выгода.</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            {services.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.1}>
                <div className={`bg-white rounded-2xl border-t-4 ${s.accentColor} border border-slate-100 p-6 sm:p-8 h-full flex flex-col`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                      <s.icon className={`w-6 h-6 ${s.iconColor}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${s.tagColor}`}>
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold mb-0.5">{s.title}</h3>
                  <p className="text-xs font-semibold text-slate-400 mb-3">{s.subtitle}</p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">{s.desc}</p>
                  <ul className="space-y-2 mb-5 flex-1">
                    {s.pros.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-[#87b63c] shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {s.note && <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-4">{s.note}</p>}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Почему мы</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Группа компаний с 15-летней историей</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {whyUs.map((w, i) => (
              <FadeIn key={w.title} delay={i * 0.08}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                    <w.icon className="w-5 h-5 text-[#0070b8]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm mb-1">{w.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{w.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="process" className="py-12 sm:py-16 bg-[#f8f9fb] border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn className="mb-8 sm:mb-10">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Процесс</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Четыре шага — и автомобиль продан</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { n: "01", title: "Расскажите об авто",    desc: "Заполните форму или позвоните — нам достаточно марки, года и пробега" },
              { n: "02", title: "Называем цену",         desc: "Перезвоним в течение 15 минут с конкретной суммой — без расплывчатых ответов" },
              { n: "03", title: "Осмотр на месте",       desc: "Выедем к вам или примем на нашей площадке — осмотр всегда бесплатный" },
              { n: "04", title: "Деньги в день сделки",  desc: "Подписываем договор и переводим средства — в тот же день" },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1} className="relative">
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 h-full">
                  <span className="text-4xl font-extrabold text-slate-100 block mb-3">{step.n}</span>
                  <h3 className="font-extrabold text-sm mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden sm:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2">
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  </div>
                )}
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section id="form" className="py-12 sm:py-16 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-2">
              <FadeIn>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Заявка</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold mb-4">Рассчитайте стоимость вашего автомобиля</h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Заполните данные — система покажет диапазон цен, а наш специалист перезвонит и подтвердит предложение. Оценка бесплатно, без обязательств.
                </p>
                <div className="space-y-4">
                  <a href={headerPhoneTel} className="flex items-center gap-3 text-sm font-bold text-slate-700 hover:text-[#0070b8] transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-[#0070b8]/10 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-[#0070b8]" />
                    </div>
                    {headerPhone}
                  </a>
                  <p className="text-xs text-slate-400 pl-12">Ежедневно с 9:00 до 21:00</p>
                </div>
              </FadeIn>
            </div>
            <div className="lg:col-span-3">
              <FadeIn delay={0.1}>
                <BuyoutForm />
              </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
