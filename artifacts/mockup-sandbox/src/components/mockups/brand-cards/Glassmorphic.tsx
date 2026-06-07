import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Car, ArrowUpRight } from "lucide-react";
import "./_group.css";

const brands = [
  { name: "OMODA",      logo: "/__mockup/images/logos/logo-omoda-nobg.png", sub: null,    href: "#" },
  { name: "JAECOO",     logo: "/__mockup/images/logos/logo-jaecoo-nobg.png", sub: null,    href: "#" },
  { name: "HAVAL",      logo: "/__mockup/images/logos/logo-haval-official.svg", sub: "CITY",  href: "#" },
  { name: "HAVAL",      logo: "/__mockup/images/logos/logo-haval-official.svg", sub: "PRO",   href: "#" },
  { name: "TENET",      logo: "/__mockup/images/logos/logo-tenet.png", sub: null,    href: "#" },
  { name: "JETOUR",     logo: "/__mockup/images/logos/logo-jetour.svg", sub: null,    href: "#" },
  { name: "\u041c\u0411-\u0411\u0440\u044f\u043d\u0441\u043a",  logo: "/__mockup/images/logos/logo-mercedes-nobg.png", sub: null,    href: "#" },
  { name: "\u0421 \u043f\u0440\u043e\u0431\u0435\u0433\u043e\u043c", logo: null, sub: null, href: "#" },
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

export function Glassmorphic() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-2 text-center text-slate-800">
          Бренды — <span className="text-[#0070b8]">Glassmorphic</span>
        </h2>
        <p className="text-center text-slate-500 mb-10 text-sm">
          Стеклянные карточки с эффектом глубины
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6">
          {brands.map((b, i) => (
            <FadeIn key={`${b.name}-${b.sub ?? i}`} delay={i * 0.05}>
              <a
                href={b.href}
                className="group relative w-full block rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1"
                style={{ aspectRatio: "5/3" }}
              >
                {/* Card base — stronger by default */}
                <div className="absolute inset-0 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] border border-slate-200/60 group-hover:shadow-[0_12px_40px_rgba(0,112,184,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] group-hover:border-[#0070b8]/20 transition-all duration-500" />
                {/* Subtle gradient sheen */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 opacity-100 group-hover:opacity-100 transition-all duration-500" />
                {/* Hover glow overlay */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0070b8]/5 via-transparent to-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {/* Top accent line */}
                <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#0070b8]/30 to-transparent rounded-full opacity-60 group-hover:opacity-100 group-hover:via-[#0070b8]/50 transition-all duration-500" />
                {/* Content */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 sm:p-5">
                  {b.logo ? (
                    <>
                      <img
                        src={b.logo}
                        alt={b.name}
                        className="w-full object-contain transition-all duration-500 group-hover:scale-110 flex-1 min-h-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.08)]"
                        style={{ maxWidth: "85%", padding: "4% 8%" }}
                      />
                      {b.sub && (
                        <span className="mt-1 text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-500 group-hover:text-[#0070b8] transition-colors duration-300">
                          {b.sub}
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Car className="w-8 h-8 sm:w-10 sm:h-10 text-[#0070b8]/70 mb-1.5 group-hover:text-[#0070b8] group-hover:scale-110 transition-all duration-300" />
                      <span className="text-xs sm:text-sm font-bold text-slate-600 group-hover:text-[#0070b8] text-center leading-tight transition-colors duration-300">{b.name}</span>
                    </div>
                  )}
                  {/* Arrow indicator on hover */}
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#0070b8]/0 group-hover:bg-[#0070b8]/10 flex items-center justify-center transition-all duration-300">
                    <ArrowUpRight className="w-4 h-4 text-[#0070b8] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0" />
                  </div>
                </div>
              </a>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
