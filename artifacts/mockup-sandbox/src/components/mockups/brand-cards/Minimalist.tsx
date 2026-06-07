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

export function Minimalist() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-2 text-center text-slate-900">
          Бренды — <span className="text-[#0070b8]">Minimalist</span>
        </h2>
        <p className="text-center text-slate-400 mb-12 text-sm">
          Максимальная чистота и простота
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {brands.map((b, i) => (
            <FadeIn key={`${b.name}-${b.sub ?? i}`} delay={i * 0.05}>
              <a
                href={b.href}
                className="group relative w-full flex flex-col items-center justify-center py-10 px-6 border-b border-r border-slate-100 hover:bg-slate-50 transition-all duration-300"
              >
                {b.logo ? (
                  <>
                    <img
                      src={b.logo}
                      alt={b.name}
                      className="w-full object-contain transition-all duration-300 group-hover:scale-105"
                      style={{ maxWidth: "70%", maxHeight: "48px" }}
                    />
                    {b.sub && (
                      <span className="mt-3 text-[10px] font-medium tracking-widest uppercase text-slate-400">
                        {b.sub}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Car className="w-7 h-7 text-slate-300 mb-2 group-hover:text-[#0070b8] transition-colors duration-300" />
                    <span className="text-sm font-semibold text-slate-600 group-hover:text-[#0070b8] text-center transition-colors duration-300">{b.name}</span>
                  </div>
                )}
                {/* Subtle arrow on hover */}
                <ArrowUpRight className="absolute top-4 right-4 w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                {/* Underline accent on hover */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-0 h-px bg-[#0070b8] group-hover:w-8 transition-all duration-300" />
              </a>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
