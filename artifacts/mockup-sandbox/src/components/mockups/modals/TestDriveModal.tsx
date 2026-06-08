import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Phone, User, Car, Clock, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function TestDriveModal() {
  const [open, setOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    comment: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      setTimeout(() => setOpen(true), 1500);
    }, 3000);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40 flex items-center justify-center p-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-0 shadow-2xl">
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
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Заявка отправлена!
                </h3>
                <p className="text-slate-500 text-sm">
                  Менеджер свяжется с вами в течение 15 минут
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Шапка с брендовым цветом */}
                <div className="bg-gradient-to-r from-[#0070b8] to-[#005a94] px-6 py-5">
                  <DialogHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-white/90" />
                      <DialogTitle className="text-white text-lg font-bold">
                        Запись на тест-драйв
                      </DialogTitle>
                    </div>
                    <DialogDescription className="text-white/70 text-sm">
                      Haval Jolion 2024 · от 2 500 000 ₽
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Форма */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-700 font-medium text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      Ваше имя
                    </Label>
                    <Input
                      id="name"
                      placeholder="Иван Иванов"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                      className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-700 font-medium text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      Телефон
                    </Label>
                    <Input
                      id="phone"
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
                      <Label htmlFor="date" className="text-slate-700 font-medium text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Дата
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleChange("date", e.target.value)}
                        required
                        className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time" className="text-slate-700 font-medium text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Время
                      </Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.time}
                        onChange={(e) => handleChange("time", e.target.value)}
                        required
                        className="h-11 border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comment" className="text-slate-700 font-medium text-sm">
                      Комментарий
                    </Label>
                    <Textarea
                      id="comment"
                      placeholder="Какой автомобиль вас интересует, какие вопросы..."
                      value={formData.comment}
                      onChange={(e) => handleChange("comment", e.target.value)}
                      className="min-h-[80px] border-slate-200 focus:border-[#0070b8] focus:ring-[#0070b8]/20 resize-none"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#0070b8] to-[#005a94] hover:from-[#005a94] hover:to-[#004a7a] text-white font-semibold text-base shadow-lg shadow-[#0070b8]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#0070b8]/30 hover:-translate-y-0.5"
                    >
                      <Car className="w-4 h-4 mr-2" />
                      Записаться на тест-драйв
                    </Button>
                  </DialogFooter>

                  <p className="text-xs text-center text-slate-400 -mt-1">
                    Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
