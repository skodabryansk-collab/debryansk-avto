import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Car } from "lucide-react";
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

function BrandCard({ brand, index }: { brand: typeof brands[0]; index: number }) {
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg)");
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (y - 0.5) * -15;
    const rotateY = (x - 0.5) * 15;
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
    setGlowPos({ x: x * 100, y: y * 100 });
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlowPos({ x: 50, y: 50 });
  };

  return (
    <FadeIn delay={index * 0.05}>
      <a
        href={brand.href}
        className="group relative w-full block rounded-2xl overflow-hidden"
        style={{
          aspectRatio: "5/3",
          transform,
          transition: "transform 0.15s ease-out",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Dark background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-2xl" />
        {/* Glowing border effect */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(0,112,184,0.3) 0%, transparent 60%)`,
          }}
        />
        {/* Border glow */}
        <div className="absolute inset-0 rounded-2xl border border-slate-700/50 group-hover:border-[#0070b8]/40 transition-colors duration-300" />
        {/* Content */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 sm:p-5">
          {brand.logo ? (
            <>
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-full object-contain transition-transform duration-300 group-hover:scale-110 flex-1 min-h-0"
                style={{ maxWidth: "80%", padding: "4% 6%", filter: "brightness(1.1)" }}
              />
              {brand.sub && (
                <span className="mt-1 text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-[#87b63c] transition-colors duration-300">
                  {brand.sub}
                </span>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <Car className="w-8 h-8 sm:w-10 sm:h-10 text-[#87b63c]/70 mb-1.5 group-hover:text-[#87b63c] transition-colors duration-300" />
              <span className="text-xs sm:text-sm font-bold text-slate-400 group-hover:text-white text-center leading-tight transition-colors duration-300">{brand.name}</span>
            </div>
          )}
        </div>
        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#0070b8] via-[#87b63c] to-[#0070b8] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-2xl" />
      </a>
    </FadeIn>
  );
}

export function Hover3D() {
  return (
    <div className="min-h-screen bg-slate-950 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold mb-2 text-center text-white">
          Бренды — <span className="text-[#87b63c]">3D Hover</span>
        </h2>
        <p className="text-center text-slate-400 mb-10 text-sm">
          3D-эффект при наведении — наведите курсор
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6">
          {brands.map((b, i) => (
            <BrandCard key={`${b.name}-${b.sub ?? i}`} brand={b} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
