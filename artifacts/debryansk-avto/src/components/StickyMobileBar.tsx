import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PhoneCall } from "lucide-react";
import { CTPhone } from "@/components/CTPhone";
import { ymGoal } from "@/lib/ym";

export const MOBILE_STICKY_SCROLL_Y = 240;

interface StickyMobileBarProps {
  phone: string;
  onCallbackOpen: () => void;
}

export function StickyMobileBar({ phone, onCallbackOpen }: StickyMobileBarProps) {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY >= MOBILE_STICKY_SCROLL_Y);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
          className="md:hidden fixed bottom-0 left-0 right-0 z-[48]
            bg-[#111317] border-t border-white/[0.10]
            flex items-center gap-2.5 px-4"
          style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))", paddingTop: 10 }}
          aria-label="Контакты"
        >
          {/* Phone side — CTPhone handles Calltouch substitution */}
          <CTPhone
            className="flex-1 flex items-center gap-2.5 min-w-0 py-0.5 text-white"
            phone={phone}
          >
            <span
              className="shrink-0 flex items-center justify-center
                w-9 h-9 rounded-full bg-white/[0.07] border border-white/[0.10]"
            >
              <PhoneCall className="w-4 h-4 text-[#87b63c]" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 truncate text-[13px] font-semibold tracking-tight leading-none">
              {phone}
            </span>
          </CTPhone>

          {/* Vertical separator */}
          <span className="shrink-0 w-px h-7 bg-white/[0.12]" aria-hidden />

          {/* Callback CTA */}
          <button
            type="button"
            onClick={() => {
              onCallbackOpen();
              ymGoal("callback_open");
            }}
            className="shrink-0 h-[42px] px-5 rounded-xl text-[13px] font-bold
              text-white brand-gradient
              active:scale-[0.96] transition-transform duration-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87b63c]/60"
          >
            Перезвоните мне
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
