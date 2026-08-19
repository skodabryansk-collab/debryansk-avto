import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BadgePercent, X, Phone } from "lucide-react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { ymGoal } from "@/lib/ym";
import { useLocation } from "wouter";
import { useExitIntentContext } from "@/hooks/useExitIntentContext";

interface ExitIntentSliderProps {
  open: boolean;
  onClose: () => void;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function ExitIntentSlider({ open, onClose }: ExitIntentSliderProps) {
  // Read context at render time — by then car data is loaded (exit-intent only fires after 30s dwell)
  const { headline, subline } = useExitIntentContext();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();

  // Track open event + autofocus
  useEffect(() => {
    if (!open) return;
    ymGoal("exit_intent_open");
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [open]);

  // Auto-close 3s after successful send
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [sent, onClose]);

  // Reset form state on each open
  useEffect(() => {
    if (!open) {
      setPhone("");
      setSent(false);
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(phone) || loading) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("type", "exit_intent");
      fd.append("phone", phone);
      fd.append("page", location);
      const res = await fetch(`${BASE}/api/send-email`, { method: "POST", body: fd });
      if (res.ok) {
        ymGoal("exit_intent_submit");
        setSent(true);
      }
    } catch (_) {}
    setLoading(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="ei-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-black/40 sm:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="ei-panel"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "110%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 36, mass: 0.85 }}
            role="dialog"
            aria-modal="true"
            aria-label="Специальное предложение"
            className={[
              "fixed z-[56]",
              // Mobile: full-width bottom-sheet
              "bottom-0 left-0 right-0 rounded-t-2xl",
              // Desktop: compact bottom-right card
              "sm:bottom-[6.5rem] sm:right-6 sm:left-auto sm:w-[360px] sm:rounded-2xl",
              "bg-[#111317] text-white",
              "border border-white/[0.10] shadow-2xl",
            ].join(" ")}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center
                rounded-full bg-white/[0.07] hover:bg-white/[0.14] transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4 pr-6">
                <span
                  className="shrink-0 mt-[-1px] w-9 h-9 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-[#0070b8]/25 to-[#87b63c]/20
                    border border-[#87b63c]/25"
                  aria-hidden
                >
                  <BadgePercent className="w-[19px] h-[19px] text-[#a8d35c]" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-bold text-[15px] leading-snug">{headline}</p>
                  <p className="text-white/55 text-[13px] mt-1 leading-snug">{subline}</p>
                </div>
              </div>

              {/* Form ↔ Success */}
              <AnimatePresence mode="wait" initial={false}>
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-1.5 py-5"
                  >
                    <span className="text-4xl leading-none mb-1" aria-hidden>🎉</span>
                    <p className="font-bold text-lg">Перезвоним!</p>
                    <p className="text-white/50 text-[13px] text-center leading-snug">
                      Ожидайте звонка в ближайшее время
                    </p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-2.5"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
                    <div className="relative">
                      <Phone
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none"
                        strokeWidth={1.75}
                      />
                      <input
                        ref={inputRef}
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={e => setPhone(formatPhone(e.target.value))}
                        placeholder="+7 (___) ___-__-__"
                        required
                        className="w-full pl-9 pr-3 h-11 rounded-xl
                          bg-white/[0.08] border border-white/[0.12]
                          text-white placeholder:text-white/30 text-sm
                          outline-none focus:border-[#87b63c]/60 focus:ring-1 focus:ring-[#87b63c]/25
                          transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !isPhoneValid(phone)}
                      className="h-11 rounded-xl brand-gradient font-bold text-sm text-white
                        disabled:opacity-40 disabled:cursor-not-allowed
                        active:scale-[0.97] transition-all"
                    >
                      {loading ? "Отправляем…" : "Перезвоните мне →"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
