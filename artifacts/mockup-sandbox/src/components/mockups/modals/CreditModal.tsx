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
import { Slider } from "@/components/ui/slider";
import { CreditCard, Percent, Wallet, Clock, CheckCircle, Car, Phone, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function CreditModal() {
  const [open, setOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [price, setPrice] = useState(2500000);
  const [downPayment, setDownPayment] = useState(500000);
  const [months, setMonths] = useState(60);

  const monthlyPayment = Math.round((price - downPayment) * (0.12 / 12) / (1 - Math.pow(1 + 0.12 / 12, -months)));
  const totalPayment = monthlyPayment * months + downPayment;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      setTimeout(() => setOpen(true), 1500);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40 flex items-center justify-center p-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-0 shadow-2xl">
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
                  Кредитный менеджер свяжется с вами в течение 30 минут
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Шапка */}
                <div className="bg-gradient-to-r from-[#059669] to-[#047857] px-6 py-5">
                  <DialogHeader className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-white/90" />
                      <DialogTitle className="text-white text-lg font-bold">
                        Кредитный калькулятор
                      </DialogTitle>
                    </div>
                    <DialogDescription className="text-white/70 text-sm">
                      Haval Jolion 2024 · рассчитайте ежемесячный платеж
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                  {/* Калькулятор */}
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
                        onValueChange={(v) => setPrice(v[0])}
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

                    {/* Результат */}
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

                  {/* Контактные данные */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        Ваше имя
                      </Label>
                      <Input
                        placeholder="Иван Иванов"
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
                        required
                        className="h-11 border-slate-200 focus:border-[#059669] focus:ring-[#059669]/20"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#059669] to-[#047857] hover:from-[#047857] hover:to-[#036346] text-white font-semibold text-base shadow-lg shadow-[#059669]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#059669]/30 hover:-translate-y-0.5"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Оставить заявку на кредит
                    </Button>
                  </DialogFooter>

                  <p className="text-xs text-center text-slate-400 -mt-1">
                    Расчет предварительный. Точные условия по итогам заявки.
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
