import { Car } from "lucide-react";

export type Brand = {
  name: string;
  logo?: string;
  label?: string;
  count?: number;
  service?: boolean;
  used?: boolean;
};

export const brands: Brand[] = [
  { name: "HAVAL", label: "CITY", logo: "/__mockup/images/brand-grid/logo-haval.svg", count: 112 },
  { name: "HAVAL", label: "PRO", logo: "/__mockup/images/brand-grid/logo-haval.svg", count: 30 },
  { name: "JAECOO", logo: "/__mockup/images/brand-grid/logo-jaecoo.webp", count: 23 },
  { name: "JETOUR", logo: "/__mockup/images/brand-grid/logo-jetour.svg", count: 36 },
  { name: "JELAND", logo: "/__mockup/images/brand-grid/logo-jeland.png", count: 34 },
  { name: "OMODA", logo: "/__mockup/images/brand-grid/logo-omoda.webp", count: 18 },
  { name: "SOUEAST", count: 2 },
  { name: "TENET", logo: "/__mockup/images/brand-grid/logo-tenet.webp", count: 88 },
  { name: "Tenet Plus", count: 8 },
  { name: "С пробегом", count: 170, used: true },
  { name: "EXEED", service: true },
  { name: "Mercedes-Benz", logo: "/__mockup/images/brand-grid/logo-mercedes.webp", service: true },
  { name: "ŠKODA", service: true },
  { name: "Volkswagen", logo: "/__mockup/images/brand-grid/logo-vw.svg", service: true },
];

export function BrandMark({ brand, className = "" }: { brand: Brand; className?: string }) {
  if (brand.used) {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <Car className="h-8 w-8 text-[#0070b8]" strokeWidth={1.7} />
        <span className="text-[13px] font-extrabold text-slate-700">{brand.name}</span>
      </div>
    );
  }

  if (brand.logo) {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        <img src={brand.logo} alt={brand.name} className="max-h-full max-w-full object-contain" />
        {brand.label && (
          <span className="text-sm font-extrabold tracking-tight text-[#48aaa9]">{brand.label}</span>
        )}
      </div>
    );
  }

  return (
    <span
      className={`text-center text-[24px] font-extrabold tracking-[0.08em] text-slate-900 ${className}`}
      style={{ fontFamily: brand.name === "Tenet Plus" ? "Georgia, serif" : "Manrope, sans-serif" }}
    >
      {brand.name}
    </span>
  );
}
