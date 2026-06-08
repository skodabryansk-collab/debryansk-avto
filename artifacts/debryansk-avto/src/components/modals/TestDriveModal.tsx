import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Car, Phone, User, Calendar, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TestDriveModalProps {
  car: {
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

export function TestDriveModal({ car, onClose }: TestDriveModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    comment: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;
    try {
      const fd = new FormData();
      fd.append("type", "testdrive");
      fd.append("name", formData.name);
      fd.append("phone", formData.phone);
      fd.append("preferredDate", formData.date);
      fd.append("preferredTime", formData.time);
      fd.append("comment", formData.comment);
      fd.append("carMark", car.mark);
      fd.append("carModel", car.model);
      fd.append("carYear", String(car.year));
      fd.append("carPrice", String(car.price));
      await fetch("/api/send-email", { method: "POST", body: fd });
    } catch (_) {}
    setSubmitted(true);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const img = car.images.filter(Boolean)[0] ?? "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden max-h-[90vh] overflow-y-auto"
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
                Менеджер свяжется с вами для подтверждения записи
              </p>
              <Button
                onClick={onClose}
                className="mt-6 w-full h-12 bg-gradient-to-r from-[#0070b8] to-[#005a94] text-white font-bold rounded-xl hover:opacity-90"
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
              {/* Header with car image */}
              <div className="relative h-40 bg-slate-100 overflow-hidden">
                {img ? (
                  <img src={img} alt={`${car.mark} ${car.model}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Car className="w-16 h-16" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-white/90" />
                    <div className="font-extrabold text-white text-lg leading-tight">
                      {car.mark} {car.model}
                    </div>
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {car.year} · {car.complectation || car.modification || "Тест-драйв"}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900">Запись на тест-драйв</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
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
                      className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Дата
                      </Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleChange("date", e.target.value)}
                        required
                        className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Время
                      </Label>
                      <Input
                        type="time"
                        value={formData.time}
                        onChange={(e) => handleChange("time", e.target.value)}
                        required
                        className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Комментарий</Label>
                    <Textarea
                      placeholder="Какой автомобиль вас интересует, какие вопросы..."
                      value={formData.comment}
                      onChange={(e) => handleChange("comment", e.target.value)}
                      className="min-h-[80px] border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20 resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-[#0070b8] to-[#005a94] hover:from-[#005a94] hover:to-[#004a7a] text-white font-semibold text-base shadow-lg shadow-[#0070b8]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#0070b8]/30 hover:-translate-y-0.5"
                  >
                    <Car className="w-4 h-4 mr-2" />
                    Записаться на тест-драйв
                  </Button>

                  <p className="text-xs text-center text-slate-400">
                    Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
                  </p>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
