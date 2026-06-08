import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Car, Gauge, Calendar, Phone, User, ArrowRightLeft, CheckCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TradeInModalProps {
  onClose: () => void;
}

export function TradeInModal({ onClose }: TradeInModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    year: "",
    mileage: "",
    condition: "",
    name: "",
    phone: "",
    comment: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEstimate = () => {
    if (formData.year && formData.mileage) {
      const year = parseInt(formData.year);
      const mileage = parseInt(formData.mileage);
      const basePrice = 1000000;
      const age = new Date().getFullYear() - year;
      const depreciation = age * 0.08 + (mileage / 100000) * 0.15;
      setEstimatedPrice(Math.round(basePrice * (1 - Math.min(depreciation, 0.85))));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;
    setSubmitted(true);
  };

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
              <p className="text-slate-500 text-sm">
                Оценщик свяжется для уточнения деталей
              </p>
              <Button
                onClick={onClose}
                className="mt-6 w-full h-12 bg-gradient-to-r from-[#d97706] to-[#b45309] text-white font-bold rounded-xl hover:opacity-90"
              >
                Закрыть
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Header */}
              <div className="relative h-32 bg-gradient-to-r from-[#d97706] to-[#b45309] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#d97706]/90 to-[#b45309]/90" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-white/90" />
                    <div className="font-extrabold text-white text-lg">
                      Trade-in: оцените ваш авто
                    </div>
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    Получите предварительную оценку за 1 минуту
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Car details */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Car className="w-4 h-4 text-[#d97706]" />
                    Ваш автомобиль
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Марка</Label>
                      <Input
                        placeholder="Skoda"
                        value={formData.brand}
                        onChange={(e) => handleChange("brand", e.target.value)}
                        className="h-10 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Модель</Label>
                      <Input
                        placeholder="Octavia"
                        value={formData.model}
                        onChange={(e) => handleChange("model", e.target.value)}
                        className="h-10 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Год выпуска
                      </Label>
                      <Input
                        type="number"
                        placeholder="2019"
                        value={formData.year}
                        onChange={(e) => handleChange("year", e.target.value)}
                        className="h-10 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Пробег (км)
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

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Состояние</Label>
                    <Select onValueChange={(v) => handleChange("condition", v)}>
                      <SelectTrigger className="h-10 border-slate-200 focus:border-[#d97706] focus:ring-[#d97706]/20">
                        <SelectValue placeholder="Выберите состояние" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Отличное</SelectItem>
                        <SelectItem value="good">Хорошее</SelectItem>
                        <SelectItem value="average">Среднее</SelectItem>
                        <SelectItem value="needs-repair">Требует ремонта</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estimate button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEstimate}
                    className="w-full h-10 border-[#d97706]/30 text-[#d97706] hover:bg-[#d97706]/5"
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    Рассчитать предварительную стоимость
                  </Button>

                  {estimatedPrice && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#d97706]/10 rounded-lg p-3 border border-[#d97706]/20"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#b45309] font-medium">Предварительная оценка</span>
                        <span className="text-lg font-bold text-[#d97706]">
                          {estimatedPrice.toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                      <p className="text-xs text-[#d97706]/70 mt-1">
                        Точная стоимость после осмотра
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Contact info */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      Ваше имя
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
                      <Phone className="w-4 h-4 text-slate-400" />
                      Телефон
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
                  onClick={handleSubmit}
                  className="w-full h-12 bg-gradient-to-r from-[#d97706] to-[#b45309] hover:from-[#b45309] hover:to-[#92400e] text-white font-semibold text-base shadow-lg shadow-[#d97706]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#d97706]/30 hover:-translate-y-0.5"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Оставить заявку на Trade-in
                </Button>

                <p className="text-xs text-center text-slate-400">
                  Осмотр автомобиля проводится бесплатно
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
