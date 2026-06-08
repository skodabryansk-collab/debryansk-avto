import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, Percent, Wallet, Clock, CheckCircle, Phone, User, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface CreditModalProps {
  car?: {
    id: string;
    mark: string;
    model: string;
    year: number;
    price: number;
    images: string[];
    complectation?: string;
    modification?: string;
  };
  onClose: () => void;
}

export function CreditModal({ car, onClose }: CreditModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [price, setPrice] = useState(car?.price || 2500000);
  const [downPayment, setDownPayment] = useState(Math.round((car?.price || 2500000) * 0.2));
  const [months, setMonths] = useState(60);
  const [formData, setFormData] = useState({ name: "", phone: "" });

  const rate = 0.12;
  const monthlyPayment = Math.round(
    (price - downPayment) * (rate / 12) / (1 - Math.pow(1 + rate / 12, -months))
  );
  const totalPayment = monthlyPayment * months + downPayment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;
    try {
      const fd = new FormData();
      fd.append("type", "credit");
      fd.append("name", formData.name);
      fd.append("phone", formData.phone);
      fd.append("carPrice", String(price));
      fd.append("downPayment", String(downPayment) + " ₽");
      fd.append("term", String(months));
      fd.append("monthlyPayment", monthlyPayment.toLocaleString("ru-RU") + " ₽");
      fd.append("totalAmount", totalPayment.toLocaleString("ru-RU") + " ₽");
      if (car) {
        fd.append("carMark", car.mark);
        fd.append("carModel", car.model);
        fd.append("carYear", String(car.year));
      }
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}
    setSubmitted(true);
  };

  const img = car?.images?.filter(Boolean)[0] ?? "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden max-h-[90vh] overflow-y-auto"
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
                Кредитный менеджер свяжется с вами в течение 30 минут
              </p>
              <Button
                onClick={onClose}
                className="mt-6 w-full h-12 bg-gradient-to-r from-[#059669] to-[#047857] text-white font-bold rounded-xl hover:opacity-90"
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
              <div className="relative h-36 bg-gradient-to-r from-[#059669] to-[#047857] overflow-hidden">
                {img && (
                  <img src={img} alt={car ? `${car.mark} ${car.model}` : ""} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-[#059669]/90 to-[#047857]/90" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-white/90" />
                    <div className="font-extrabold text-white text-lg">
                      {car ? `${car.mark} ${car.model}` : "Кредитный калькулятор"}
                    </div>
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {car ? `${car.year} · рассчитайте ежемесячный платеж` : "Рассчитайте ежемесячный платеж"}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Calculator */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-slate-400" />
                        Стоимость авто
                      </Label>
                      <span className="text-sm font-bold text-[#059669]">
                        {price.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                    <Slider
                      value={[price]}
                      onValueChange={(v) => {
                        setPrice(v[0]);
                        setDownPayment(Math.min(downPayment, v[0]));
                      }}
                      min={500000}
                      max={5000000}
                      step={50000}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Percent className="w-4 h-4 text-slate-400" />
                        Первоначальный взнос
                      </Label>
                      <span className="text-sm font-bold text-[#059669]">
                        {downPayment.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                    <Slider
                      value={[downPayment]}
                      onValueChange={(v) => setDownPayment(v[0])}
                      min={0}
                      max={price}
                      step={50000}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Срок
                      </Label>
                      <span className="text-sm font-bold text-[#059669]">{months} мес.</span>
                    </div>
                    <Slider
                      value={[months]}
                      onValueChange={(v) => setMonths(v[0])}
                      min={12}
                      max={84}
                      step={12}
                      className="w-full"
                    />
                  </div>

                  {/* Result */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Ежемесячный платеж</span>
                      <span className="text-xl font-bold text-[#059669]">
                        {monthlyPayment.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Общая сумма</span>
                      <span className="text-slate-600 font-medium">
                        {totalPayment.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-slate-400">Ставка</span>
                      <span className="text-slate-600 font-medium">12%</span>
                    </div>
                  </div>
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
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      required
                      className="h-11 border-slate-200 focus:border-[#059669] focus:ring-[#059669]/20"
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
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      required
                      className="h-11 border-slate-200 focus:border-[#059669] focus:ring-[#059669]/20"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  onClick={handleSubmit}
                  className="w-full h-12 bg-gradient-to-r from-[#059669] to-[#047857] hover:from-[#047857] hover:to-[#036346] text-white font-semibold text-base shadow-lg shadow-[#059669]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#059669]/30 hover:-translate-y-0.5"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Оставить заявку на кредит
                </Button>

                <p className="text-xs text-center text-slate-400">
                  Расчет предварительный. Точные условия по итогам заявки.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
