import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import {
  X, Car, Gauge, Calendar, Phone, User, ArrowRightLeft,
  CheckCircle, ChevronDown, Loader2, Users, LayoutPanelTop, Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";

interface TargetCar {
  mark: string;
  model: string;
  year?: number | string;
  price?: number;
  isNew?: boolean;
}

interface TradeInModalProps {
  onClose: () => void;
  targetCar?: TargetCar;
}

interface CmItem { id: string; name: string }

interface ModificationItem {
  id: string;
  name: string;
  drive: string;
  engineVolume: string;
  power: string;
  gear: string;
  complectation: string;
  doors: string;
  bodyId: string;
}

interface EstimateResult {
  ok: boolean;
  buyoutMin?: number;
  buyoutMax?: number;
  message?: string;
}

export function TradeInModal({ onClose, targetCar }: TradeInModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [brands, setBrands] = useState<CmItem[]>([]);
  const [models, setModels] = useState<CmItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [bodies, setBodies] = useState<CmItem[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [bodiesLoading, setBodiesLoading] = useState(false);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    year: "",
    mileage: "",
    modification: "",
    drive: "",
    engineVolume: "",
    power: "",
    gear: "",
    complectation: "",
    doors: "",
    body: "",
    condition: "",
    owners: "",
    name: "",
    phone: "",
    comment: "",
  });

  interface ModOptions {
    driveTypes: { id: string; name: string }[];
    engineVolumes: { id: string; name: string }[];
    complectations: { id: string; name: string }[];
    powers: { id: string; name: string }[];
    gearTypes: { id: string; name: string }[];
    doorNumbers: { id: string; name: string }[];
    modifications: ModificationItem[];
  }
  const [modOptions, setModOptions] = useState<ModOptions | null>(null);
  const [modOptionsLoading, setModOptionsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/car-catalog/cm-brands")
      .then(r => r.json())
      .then(data => {
        if (data.ok) setBrands(data.data ?? []);
      })
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, []);

  useEffect(() => {
    if (!formData.brand) {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    fetch(`/api/car-catalog/cm-models?brand=${encodeURIComponent(formData.brand)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setModels(data.data ?? []);
      })
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [formData.brand]);

  useEffect(() => {
    if (!formData.brand || !formData.model) {
      setYears([]);
      return;
    }
    setYearsLoading(true);
    const qs = new URLSearchParams({ brand: formData.brand, model: formData.model });
    fetch(`/api/car-catalog/cm-years?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setYears(data.data ?? []);
      })
      .catch(() => setYears([]))
      .finally(() => setYearsLoading(false));
  }, [formData.brand, formData.model]);

  useEffect(() => {
    if (!formData.brand || !formData.model) { setBodies([]); return; }
    setBodiesLoading(true);
    fetch(`/api/car-catalog/cm-bodies?brand=${encodeURIComponent(formData.brand)}&model=${encodeURIComponent(formData.model)}`)
      .then(r => r.json())
      .then(data => setBodies(data.ok ? (data.data ?? []) : []))
      .catch(() => setBodies([]))
      .finally(() => setBodiesLoading(false));
  }, [formData.brand, formData.model]);

  useEffect(() => {
    if (!formData.brand || !formData.model || !formData.year) {
      setModOptions(null);
      return;
    }
    setModOptionsLoading(true);
    const qs = new URLSearchParams({ brand: formData.brand, model: formData.model, year: formData.year });
    fetch(`/api/car-catalog/cm-modifications-options?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const mods = (data.modifications ?? []).map((m: any) => ({ ...m, bodyId: m.bodyId ?? "" }));
          setModOptions({ driveTypes: data.driveTypes ?? [], engineVolumes: data.engineVolumes ?? [], complectations: data.complectations ?? [], powers: data.powers ?? [], gearTypes: data.gearTypes ?? [], doorNumbers: data.doorNumbers ?? [], modifications: mods });
        } else setModOptions(null);
      })
      .catch(() => setModOptions(null))
      .finally(() => setModOptionsLoading(false));
  }, [formData.brand, formData.model, formData.year]);

  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === "brand") {
        next.model = ""; next.year = ""; next.body = ""; next.modification = "";
        next.drive = ""; next.engineVolume = ""; next.power = ""; next.gear = ""; next.complectation = ""; next.doors = "";
      }
      if (field === "model") {
        next.year = ""; next.body = ""; next.modification = "";
        next.drive = ""; next.engineVolume = ""; next.power = ""; next.gear = ""; next.complectation = ""; next.doors = "";
      }
      if (field === "year") {
        next.modification = "";
        next.drive = ""; next.engineVolume = ""; next.power = ""; next.gear = ""; next.complectation = ""; next.doors = "";
      }
      if (field === "body") {
        next.modification = ""; next.doors = "";
      }
      if (field === "engineVolume") {
        next.modification = ""; next.drive = ""; next.power = ""; next.gear = ""; next.doors = "";
      }
      if (field === "drive") {
        next.modification = ""; next.power = ""; next.gear = ""; next.doors = "";
      }
      if (["power", "gear", "complectation", "doors"].includes(field)) {
        next.modification = "";
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !isPhoneValid(formData.phone)) return;
    setLoading(true);
    let estimate: EstimateResult | null = null;
    try {
      const params = new URLSearchParams({
        brandId: formData.brand,
        modelId: formData.model,
        year: formData.year,
        mileage: formData.mileage,
      });
      if (autoModificationId)      params.append("modificationId", autoModificationId);
      if (formData.body)           params.append("bodyId",         formData.body);
      if (formData.drive)          params.append("drive",          formData.drive);
      if (formData.engineVolume)   params.append("engineVolume",   formData.engineVolume);
      if (formData.complectation)  params.append("complectation",  formData.complectation);
      if (formData.owners)         params.append("ownersNumber",   formData.owners);
      const resp = await fetch(`/api/car-catalog/cm-expert-predict?${params}`);
      estimate = await resp.json();
    } catch { estimate = { ok: false }; }

    try {
      const fd = new FormData();
      fd.append("type", "tradein");
      fd.append("name", formData.name);
      fd.append("phone", formData.phone);
      const brandName = brands.find(b => b.id === formData.brand)?.name ?? formData.brand;
      const modelName = models.find(m => m.id === formData.model)?.name ?? formData.model;
      fd.append("brand", brandName);
      fd.append("model", modelName);
      fd.append("year", formData.year);
      fd.append("mileage", formData.mileage);
      if (formData.body) fd.append("bodyName", bodies.find(b => b.id === formData.body)?.name ?? formData.body);
      if (formData.drive) fd.append("drive", formData.drive);
      if (formData.engineVolume) fd.append("engineVolume", formData.engineVolume);
      if (formData.power) fd.append("power", formData.power);
      if (formData.gear) fd.append("gear", formData.gear);
      if (formData.doors) fd.append("doors", (modOptions?.doorNumbers ?? []).find(d => d.id === formData.doors)?.name ?? formData.doors);
      if (formData.complectation) fd.append("complectation", formData.complectation);
      if (formData.condition) fd.append("condition", formData.condition);
      if (formData.owners) fd.append("owners", formData.owners);
      if (formData.comment) fd.append("comment", formData.comment);
      if (estimate?.ok && estimate.buyoutMin && estimate.buyoutMax) {
        fd.append("estimateMin", String(estimate.buyoutMin));
        fd.append("estimateMax", String(estimate.buyoutMax));
      }
      if (targetCar) {
        fd.append("targetMark", targetCar.mark);
        fd.append("targetModel", targetCar.model);
        if (targetCar.year) fd.append("targetYear", String(targetCar.year));
        if (targetCar.price) fd.append("targetPrice", String(targetCar.price));
        fd.append("targetIsNew", targetCar.isNew ? "да" : "нет");
      }
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}

    setEstimateResult(estimate);
    setSubmitted(true);
    setLoading(false);
  }, [formData, brands, models, bodies, modOptions]);

  const mods = modOptions?.modifications ?? [];
  const modsForVolume = formData.engineVolume
    ? mods.filter(m => m.engineVolume === formData.engineVolume)
    : mods;
  const filteredDriveItems = (modOptions?.driveTypes ?? []).filter(d =>
    !formData.engineVolume || modsForVolume.some(m => m.drive === d.name)
  );
  const modsForVolumeDrive = formData.drive
    ? modsForVolume.filter(m => m.drive === formData.drive)
    : modsForVolume;
  const filteredPowerItems = (modOptions?.powers ?? []).filter(p =>
    (!formData.engineVolume && !formData.drive) || modsForVolumeDrive.some(m => m.power === p.name)
  );
  const filteredGearItems = (modOptions?.gearTypes ?? []).filter(g =>
    (!formData.engineVolume && !formData.drive) || modsForVolumeDrive.some(m => m.gear === g.name)
  );
  const modsForBody = formData.body
    ? modsForVolumeDrive.filter(m => m.bodyId === formData.body)
    : modsForVolumeDrive;
  const filteredDoorItems = (modOptions?.doorNumbers ?? []).filter(d =>
    (!formData.engineVolume && !formData.drive && !formData.body) || modsForBody.some(m => m.doors === d.id)
  );
  const matchingMods = mods.filter(m =>
    (!formData.engineVolume || m.engineVolume === formData.engineVolume) &&
    (!formData.drive || m.drive === formData.drive) &&
    (!formData.power || m.power === formData.power) &&
    (!formData.gear || m.gear === formData.gear) &&
    (!formData.doors || m.doors === formData.doors) &&
    (!formData.body || m.bodyId === formData.body)
  );
  const autoModificationId = matchingMods.length === 1 ? matchingMods[0].id : "";

  const canSubmit = !!(formData.brand && formData.model && formData.year && formData.mileage && formData.name.trim() && isPhoneValid(formData.phone));


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-md"
        >
          <X className="w-4 h-4 text-slate-600" />
        </button>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-10 px-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle className="w-14 h-14 text-[#87b63c] mb-3" />
              </motion.div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Заявка отправлена!</h3>
              <p className="text-slate-500 text-sm mb-4">Оценщик свяжется для уточнения деталей</p>

              {estimateResult?.ok && estimateResult.buyoutMin && estimateResult.buyoutMax ? (
                <div className="w-full bg-[#d97706]/10 border border-[#d97706]/25 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-[#b45309] uppercase tracking-wider mb-1">Предварительная оценка</p>
                  <p className="text-2xl font-extrabold text-[#d97706]">
                    {estimateResult.buyoutMin.toLocaleString("ru-RU")} — {estimateResult.buyoutMax.toLocaleString("ru-RU")} ₽
                  </p>
                  <p className="text-xs text-[#d97706]/60 mt-1">Точная стоимость определяется после осмотра</p>
                </div>
              ) : (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-slate-600">Менеджер назовёт точную цену при звонке</p>
                </div>
              )}

              <Button onClick={onClose} className="w-full h-12 bg-gradient-to-r from-[#d97706] to-[#b45309] text-white font-bold rounded-xl hover:opacity-90">
                Закрыть
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Header */}
              <div className="relative h-32 bg-gradient-to-r from-[#d97706] to-[#b45309] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#d97706]/90 to-[#b45309]/90" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-white/90" />
                    <div className="font-extrabold text-white text-lg">Trade-in: оцените ваш авто</div>
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Выберите автомобиль из каталога и получите оценку
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Car details */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Car className="w-4 h-4 text-[#d97706]" />
                    Ваш автомобиль
                  </h4>

                  {/* Brand searchable */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Марка</Label>
                    <SearchableSelect
                      items={brands}
                      value={formData.brand}
                      onChange={(id) => handleChange("brand", id)}
                      placeholder="Выберите марку"
                      loading={brandsLoading}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Model searchable */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Модель</Label>
                    <SearchableSelect
                      items={models}
                      value={formData.model}
                      onChange={(id) => handleChange("model", id)}
                      placeholder={!formData.brand ? "Сначала выберите марку" : "Выберите модель"}
                      disabled={!formData.brand}
                      loading={modelsLoading}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Body type */}
                  {(bodiesLoading || bodies.length > 0) && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 flex items-center gap-1">
                        <LayoutPanelTop className="w-3 h-3" />Тип кузова
                      </Label>
                      <div className="relative">
                        <select
                          value={formData.body}
                          onChange={(e) => handleChange("body", e.target.value)}
                          disabled={bodiesLoading || !formData.brand || !formData.model}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                        >
                          <option value="">{bodiesLoading ? "Загрузка..." : "Не указан"}</option>
                          {bodies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        {bodiesLoading
                          ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        }
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {/* Year */}
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />Год выпуска
                      </Label>
                      <div className="relative">
                        <select
                          value={formData.year}
                          onChange={(e) => handleChange("year", e.target.value)}
                          disabled={!formData.model || yearsLoading}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                        >
                          <option value="">
                            {yearsLoading ? "Загрузка..." : !formData.model ? "Сначала модель" : "Год"}
                          </option>
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {yearsLoading
                          ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        }
                      </div>
                    </div>

                    {/* Mileage */}
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 flex items-center gap-1">
                        <Gauge className="w-3 h-3" />Пробег (км)
                      </Label>
                      <Input
                        type="number"
                        placeholder="45000"
                        value={formData.mileage}
                        onChange={(e) => handleChange("mileage", e.target.value)}
                        className="h-10 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20"
                      />
                    </div>
                  </div>

                  {/* ── Modification options: volume / drive / power / gear / complectation ── */}
                  {(modOptionsLoading || (modOptions && (modOptions.engineVolumes.length > 0 || modOptions.driveTypes.length > 0 || modOptions.powers.length > 0 || modOptions.gearTypes.length > 0 || modOptions.complectations.length > 0))) && (
                    <div className="space-y-3">

                      <div className="grid grid-cols-2 gap-3">
                        {/* Engine volume */}
                        {(modOptionsLoading || (modOptions?.engineVolumes ?? []).length > 0) && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">Объём двигателя</Label>
                            <div className="relative">
                              <select
                                value={formData.engineVolume}
                                onChange={(e) => handleChange("engineVolume", e.target.value)}
                                disabled={modOptionsLoading}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                              >
                                <option value="">{modOptionsLoading ? "Загрузка..." : "Не указан"}</option>
                                {(modOptions?.engineVolumes ?? []).map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                              {modOptionsLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              }
                            </div>
                          </div>
                        )}

                        {/* Drive type */}
                        {(modOptionsLoading || (modOptions?.driveTypes ?? []).length > 0) && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">Тип привода</Label>
                            <div className="relative">
                              <select
                                value={formData.drive}
                                onChange={(e) => handleChange("drive", e.target.value)}
                                disabled={modOptionsLoading}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                              >
                                <option value="">{modOptionsLoading ? "Загрузка..." : "Не указан"}</option>
                                {filteredDriveItems.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                              </select>
                              {modOptionsLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              }
                            </div>
                          </div>
                        )}

                        {/* Power */}
                        {(modOptionsLoading || (modOptions?.powers ?? []).length > 0) && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">Мощность, л.с.</Label>
                            <div className="relative">
                              <select
                                value={formData.power}
                                onChange={(e) => handleChange("power", e.target.value)}
                                disabled={modOptionsLoading}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                              >
                                <option value="">{modOptionsLoading ? "Загрузка..." : "Не указана"}</option>
                                {filteredPowerItems.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                              </select>
                              {modOptionsLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              }
                            </div>
                          </div>
                        )}

                        {/* Gear type */}
                        {(modOptionsLoading || (modOptions?.gearTypes ?? []).length > 0) && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500">Тип КПП</Label>
                            <div className="relative">
                              <select
                                value={formData.gear}
                                onChange={(e) => handleChange("gear", e.target.value)}
                                disabled={modOptionsLoading}
                                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                              >
                                <option value="">{modOptionsLoading ? "Загрузка..." : "Не указан"}</option>
                                {filteredGearItems.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                              </select>
                              {modOptionsLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              }
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Кол-во дверей — full width */}
                      {!modOptionsLoading && filteredDoorItems.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-500">Кол-во дверей</Label>
                          <div className="relative">
                            <select
                              value={formData.doors}
                              onChange={(e) => handleChange("doors", e.target.value)}
                              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none"
                            >
                              <option value="">Не указано</option>
                              {filteredDoorItems.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      )}

                      {/* Complectation — full width */}
                      {(modOptionsLoading || (modOptions?.complectations ?? []).length > 0) && (
                        <div className="space-y-2">
                          <Label className="text-xs text-slate-500">Комплектация</Label>
                          <div className="relative">
                            <select
                              value={formData.complectation}
                              onChange={(e) => handleChange("complectation", e.target.value)}
                              disabled={modOptionsLoading}
                              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none disabled:opacity-50"
                            >
                              <option value="">{modOptionsLoading ? "Загрузка..." : "Не указана"}</option>
                              {(modOptions?.complectations ?? []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            {modOptionsLoading
                              ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              : <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {/* Condition */}
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Состояние</Label>
                      <div className="relative">
                        <select
                          value={formData.condition}
                          onChange={(e) => handleChange("condition", e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none"
                        >
                          <option value="">Выберите</option>
                          <option value="excellent">Отличное</option>
                          <option value="good">Хорошее</option>
                          <option value="average">Среднее</option>
                          <option value="needs-repair">Требует ремонта</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Owners */}
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />Владельцы
                      </Label>
                      <div className="relative">
                        <select
                          value={formData.owners}
                          onChange={(e) => handleChange("owners", e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm appearance-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706]/20 outline-none"
                        >
                          <option value="">Кол-во</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3+</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                </div>

                {/* Contact info */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />Ваше имя
                    </Label>
                    <Input
                      placeholder="Иван Иванов"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                      className="h-11 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />Телефон
                    </Label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="+7 (___) ___-__-__"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                      required
                      maxLength={18}
                      className="h-11 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Комментарий</Label>
                    <Textarea
                      placeholder="Дополнительная информация об авто..."
                      value={formData.comment}
                      onChange={(e) => handleChange("comment", e.target.value)}
                      className="min-h-[60px] border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20 resize-none"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full h-12 bg-gradient-to-r from-[#d97706] to-[#b45309] hover:from-[#b45309] hover:to-[#92400e] text-white font-semibold text-base shadow-lg shadow-[#d97706]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#d97706]/30 hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="w-4 h-4 mr-2" />
                  )}
                  {loading ? "Расчёт..." : "Рассчитать стоимость автомобиля"}
                </Button>

                <p className="text-xs text-center text-slate-400">
                  Осмотр автомобиля проводится бесплатно
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
