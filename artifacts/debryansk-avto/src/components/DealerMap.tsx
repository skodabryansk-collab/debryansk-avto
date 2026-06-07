import { useState, useCallback } from "react";
import { MapPin, Navigation, X } from "lucide-react";

export interface DealerMapLocation {
  id: number;
  address: string;
  short: string;
  phone: string;
  photo: string;
  x: number;
  y: number;
  brands: string[];
}

interface DealerMapProps {
  locations: DealerMapLocation[];
}

function Card({ loc, onClose, isActive }: {
  loc: DealerMapLocation;
  onClose: () => void;
  isActive: boolean;
}) {
  // Determine card position relative to pin to avoid overlap
  const cardBottom = loc.y > 55;
  const cardRight = loc.x > 60;

  return (
    <div
      className={`absolute z-30 transition-all duration-300 ease-out ${
        isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      style={{
        left: cardRight ? "auto" : `${loc.x}%`,
        right: cardRight ? `${100 - loc.x}%` : "auto",
        top: cardBottom ? "auto" : `${loc.y}%`,
        bottom: cardBottom ? `${100 - loc.y}%` : "auto",
        transform: cardBottom
          ? (cardRight ? "translate(20%, -20%)" : "translate(-20%, -20%)")
          : (cardRight ? "translate(20%, 20%)" : "translate(-20%, 20%)")
      }}
    >
      <div className="w-[280px] sm:w-[320px] bg-white rounded-lg shadow-[0_8px_24px_rgba(10,61,98,0.08)] border border-slate-100 overflow-hidden">
        <div className="flex items-start gap-3 p-3">
          <img
            src={loc.photo}
            alt={loc.short}
            className="w-20 h-[60px] object-cover rounded-md shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#1A1A1A] leading-tight truncate">
              {loc.short}
            </p>
            <p className="text-[13px] text-[#555] mt-0.5 leading-snug">
              {loc.phone}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {loc.brands.slice(0, 2).map((b) => (
                <span key={b} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">
                  {b}
                </span>
              ))}
              {loc.brands.length > 2 && (
                <span className="text-[10px] px-1.5 py-0.5 text-slate-400">+{loc.brands.length - 2}</span>
              )}
            </div>
          </div>
        </div>
        <div className="px-3 pb-3">
          <a
            href={`https://yandex.ru/maps/?text=${encodeURIComponent(loc.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white bg-[#0A3D62] hover:bg-[#08304D] transition-colors px-4 py-2 rounded-full"
          >
            <Navigation className="w-3.5 h-3.5" />
            Построить путь
          </a>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function DealerMap({ locations }: DealerMapProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleClick = useCallback((id: number) => {
    setActiveId((prev) => (prev === id ? null : id));
  }, []);

  const handleClose = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-[#FAFAFA] rounded-2xl overflow-hidden select-none">
      {/* SVG abstract city map */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle background wash */}
        <defs>
          <radialGradient id="cityGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F5F7FA" />
            <stop offset="100%" stopColor="#EEF1F5" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#cityGlow)" />

        {/* Abstract street grid */}
        <g stroke="#D0D5DD" strokeWidth="0.4" fill="none" strokeLinecap="round">
          {/* Concentric ring roads */}
          <ellipse cx="50" cy="50" rx="8" ry="6" />
          <ellipse cx="50" cy="50" rx="18" ry="14" />
          <ellipse cx="50" cy="50" rx="28" ry="22" />
          <ellipse cx="50" cy="50" rx="38" ry="30" />
          <ellipse cx="50" cy="50" rx="48" ry="38" />

          {/* Radial streets */}
          <line x1="50" y1="50" x2="50" y2="2" />
          <line x1="50" y1="50" x2="85" y2="15" />
          <line x1="50" y1="50" x2="98" y2="50" />
          <line x1="50" y1="50" x2="85" y2="85" />
          <line x1="50" y1="50" x2="50" y2="98" />
          <line x1="50" y1="50" x2="15" y2="85" />
          <line x1="50" y1="50" x2="2" y2="50" />
          <line x1="50" y1="50" x2="15" y2="15" />

          {/* Connecting streets between rings */}
          <line x1="50" y1="44" x2="50" y2="36" />
          <line x1="50" y1="64" x2="50" y2="72" />
          <line x1="58" y1="50" x2="68" y2="50" />
          <line x1="42" y1="50" x2="32" y2="50" />
          <line x1="62" y1="38" x2="72" y2="28" />
          <line x1="38" y1="62" x2="28" y2="72" />
          <line x1="62" y1="62" x2="72" y2="72" />
          <line x1="38" y1="38" x2="28" y2="28" />
        </g>

        {/* Subtle city blocks fill */}
        <g fill="#F0F2F5" stroke="none">
          <ellipse cx="50" cy="50" rx="6" ry="4.5" />
          <ellipse cx="50" cy="50" rx="16" ry="12.5" opacity="0.6" />
        </g>
      </svg>

      {/* Pins and cards */}
      {locations.map((loc) => {
        const isOpen = activeId === loc.id || hoveredId === loc.id;
        return (
          <div key={loc.id}>
            {/* Card layer */}
            <Card
              loc={loc}
              onClose={handleClose}
              isActive={isOpen}
            />

            {/* Pin */}
            <button
              className="absolute z-20 -translate-x-1/2 -translate-y-full group cursor-pointer"
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              onMouseEnter={() => setHoveredId(loc.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(loc.id)}
            >
              {/* Drop pin SVG */}
              <svg
                width="32"
                height="40"
                viewBox="0 0 32 40"
                className="transition-transform duration-300 group-hover:scale-110"
              >
                <defs>
                  <filter id={`pinShadow${loc.id}`} x="-20%" y="-10%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(10,61,98,0.2)" />
                  </filter>
                </defs>
                <path
                  d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24S32 28 32 16C32 7.16 24.84 0 16 0z"
                  fill="#0A3D62"
                  filter={`url(#pinShadow${loc.id})`}
                />
                <circle cx="16" cy="16" r="5" fill="white" opacity="0.9" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
