import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Car } from "lucide-react";
import "./_group.css";

const brands = [
  { name: "OMODA",      bg: "#fff5ee", logo: "/__mockup/images/logos/logo-omoda-nobg.png", sub: null,    href: "#" },
  { name: "JAECOO",     bg: "#f2f2f6", logo: "/__mockup/images/logos/logo-jaecoo-nobg.png", sub: null,    href: "#" },
  { name: "HAVAL",      bg: "#eef2ff", logo: "/__mockup/images/logos/logo-haval-official.svg", sub: "CITY",  href: "#" },
  { name: "HAVAL",      bg: "#e8f4ff", logo: "/__mockup/images/logos/logo-haval-official.svg", sub: "PRO",   href: "#" },
  { name: "TENET",      bg: "#edfbf3", logo: "/__mockup/images/logos/logo-tenet.png", sub: null,    href: "#" },
  { name: "JETOUR",     bg: "#f0f4ff", logo: "/__mockup/images/logos/logo-jetour.svg", sub: null,    href: "#" },
  { name: "\u041c\u0411-\u0411\u0440\u044f\u043d\u0441\u043a",  bg: "#f6f6f6", logo: "/__mockup/images/logos/logo-mercedes-nobg.png", sub: null,    href: "#" },
  { name: "\u0421 \u043f\u0440\u043e\u0431\u0435\u0433\u043e\u043c", bg: "#eef6ff", logo: null, sub: null, href: "#" },
];

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}>
      {children}
    </motion.div>
  );
};

export function Current() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-8 text-center">
          Бренды — <span className="text-[#0070b8]">Текущий вариант</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          {brands.map((b, i) => {
            const cls = "w-full rounded-2xl border border-slate-100 hover:border-[#0070b8]/25 hover:shadow-lg transition-all group overflow-hidden block";
            const inner = (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6">
                {b.logo ? (
                  <>
                    <img
                      src={b.logo}
                      alt={b.name}
                      className="w-full object-contain group-hover:scale-105 transition-transform duration-300 flex-1 min-h-0"
                      style={{ maxWidth: "100%", padding: "8% 12%" }}
                    />
                    {b.sub && (
                      <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-500 pb-1 leading-none">
                        {b.sub}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Car className="w-9 h-9 sm:w-11 sm:h-11 text-[#0070b8] mb-2 opacity-60" />
                    <span className="text-xs sm:text-sm font-black text-[#0070b8] text-center leading-tight px-2">{b.name}</span>
                  </div>
                )}
              </div>
            );
            return (
              <FadeIn key={`${b.name}-${b.sub ?? i}`} delay={i * 0.05}>
                <a href={b.href} className={cls} style={{ background: b.bg, aspectRatio: "5/3" }}>
                  {inner}
                </a>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </div>
  );
}
