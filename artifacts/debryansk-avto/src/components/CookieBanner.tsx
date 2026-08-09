import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { X } from "lucide-react";

const STORAGE_KEY = "cookie_consent_accepted";

export default function CookieBanner() {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch (_) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {}
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReduced ? false : { y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          role="region"
          aria-label="Уведомление об использовании cookie"
          className="fixed bottom-0 left-0 right-0 z-[200] bg-[#111317] border-t border-white/[0.08] shadow-2xl"
        >
          <div className="container mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
            <p className="flex-1 text-sm text-white/70 leading-relaxed pr-6 sm:pr-0">
              Мы используем файлы cookie для улучшения работы сайта. Продолжая
              использование сайта, вы соглашаетесь с нашей{" "}
              <Link
                href="/privacy"
                className="text-primary hover:text-[#3399d4] underline underline-offset-2 transition-colors font-medium"
              >
                Политикой конфиденциальности
              </Link>
              .
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={accept}
                className="h-9 px-5 bg-[#87b63c] hover:bg-[#7aa635] text-white text-sm font-bold rounded-xl transition-colors"
              >
                Принять
              </button>
              <button
                onClick={accept}
                aria-label="Закрыть"
                className="h-9 w-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
