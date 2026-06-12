import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Car, Gauge, Calendar, Phone, User, ArrowRightLeft,
  CheckCircle, Tag, ChevronDown, Loader2, Users, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const [estimating, setEstimating] = useState(false);

  const [brands, setBrands] = useState<CmItem[]>([]);
  const [models, setModels] = useState<CmItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    year: "",
    mileage: "",
    condition: "",
    owners: "",
    name: "",
    phone: "",
    comment: "",
  });

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

  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === "brand") {
        next.model = "";
        next.year = "";
      }
      if (field === "model") {
        next.year = "";
      }
      return next;
    });
    setEstimateResult(null);
  }, []);

  const handleEstimate = useCallback(async () => {
    if (!formData.brand || !formData.model || !formData.year || !formData.mileage) return;
    setEstimating(true);
    try {
      const params = new URLSearchParams({
        brandId: formData.brand,
        modelId: formData.model,
        year: formData.year,
        mileage: formData.mileage,
      });
      const resp = await fetch(`/api/car-catalog/cm-expert-predict?${params}`);
      const data = await resp.json();
      setEstimateResult(data);
    } catch {
      setEstimateResult({ ok: false, message: "Ошибка при расчете" });
    } finally {
      setEstimating(false);
    }
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;
    setLoading(true);
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
      fd.append("condition", formData.condition);
      fd.append("owners", formData.owners);
      fd.append("comment", formData.comment);
      if (estimateResult?.ok && estimateResult.buyoutMin && estimateResult.buyoutMax) {
        fd.append("estimateMin", String(estimateResult.buyoutMin));
        fd.append("estimateMax", String(estimateResult.buyoutMax));
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
    setSubmitted(true);
    setLoading(false);
  }, [formData, estimateResult, brands, models]);

  const canEstimate = formData.brand && formData.model && formData.year && formData.mileage;

  const selectedBrandName = brands.find(b => b.id === formData.brand)?.name ?? "";
  const selectedModelName = models.find(m => m.id === formData.model)?.name ?? "";

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
              className="flex flex-col items-center justify-center py-16 px-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle className="w-16 h-16 text-[#87b63c] mb-4" />
              </motion.div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Заявка отправлена!</h3>
              <p className="text-slate-500 text-sm">Оценщик свяжется для уточнения деталей</p>
              <Button onClick={onClose} className="mt-6 w-full h-12 bg-gradient-to-r from-[#d97706] to-[#b45309] text-white font-bold rounded-xl hover:opacity-90">
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

                  {/* Brand dropdown */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Марка</Label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setBrandOpen(!brandOpen)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-sm hover:border-[#d97706] transition-colors"
                      >
                        <span className={selectedBrandName ? "text-slate-900" : "text-slate-400"}>
                          {selectedBrandName || "Выберите марку"}
                        </span>
                        {brandsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                      <AnimatePresence>
                        {brandOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
                          >
                            {brands.map(b => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => { handleChange("brand", b.id); setBrandOpen(false); }}
                                className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
                              >
                                {b.name}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Model dropdown */}
                  {formData.brand && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Модель</Label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setModelOpen(!modelOpen)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-sm hover:border-[#d97706] transition-colors"
                        >
                          <span className={selectedModelName ? "text-slate-900" : "text-slate-400"}>
                            {selectedModelName || "Выберите модель"}
                          </span>
                          {modelsLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                        <AnimatePresence>
                          {modelOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
                            >
                              {models.length === 0 && !modelsLoading && (
                                <div className="px-3 py-2 text-sm text-slate-400">Нет моделей в каталоге</div>
                              )}
                              {models.map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => { handleChange("model", m.id); setModelOpen(false); }}
                                  className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
                                >
                                  {m.name}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
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

                  {/* Estimate button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEstimate}
                    disabled={!canEstimate || estimating}
                    className="w-full h-10 border-[#d97706]/30 text-[#d97706] hover:bg-[#d97706]/5 disabled:opacity-50"
                  >
                    {estimating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Tag className="w-4 h-4 mr-2" />
                    )}
                    {estimating ? "Расчет..." : "Рассчитать оценку"}
                  </Button>

                  {/* Estimate result */}
                  {estimateResult && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#d97706]/10 rounded-lg p-3 border border-[#d97706]/20"
                      >
                        {estimateResult.ok && estimateResult.buyoutMin && estimateResult.buyoutMax ? (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-[#b45309] font-medium">Предварительная оценка</span>
                            </div>
                            <div className="text-base font-bold text-[#d97706] mt-1">
                              {estimateResult.buyoutMin.toLocaleString("ru-RU")} ₽ — {estimateResult.buyoutMax.toLocaleString("ru-RU")} ₽
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-[#b45309]">
                            <AlertCircle className="w-4 h-4" />
                            <span>{estimateResult.message || "Не удалось рассчитать оценку"}</span>
                          </div>
                        )}
                        <p className="text-xs text-[#d97706]/60 mt-1">
                          Точная стоимость после осмотра
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  )}
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
                      placeholder="+7 (___) ___-__-__"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      required
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
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-[#d97706] to-[#b45309] hover:from-[#b45309] hover:to-[#92400e] text-white font-semibold text-base shadow-lg shadow-[#d97706]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#d97706]/30 hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                  )}
                  {loading ? "Отправка..." : "Оставить заявку на Trade-in"}
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
