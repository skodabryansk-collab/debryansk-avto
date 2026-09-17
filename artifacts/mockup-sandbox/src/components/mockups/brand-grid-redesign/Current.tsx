import { ArrowUpRight } from "lucide-react";
import { BrandMark, brands } from "./_shared";
import "./_group.css";

export function Current() {
  return (
    <section className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid grid-cols-4 gap-6">
          {brands.map((brand, index) => (
            <a
              key={`${brand.name}-${brand.label ?? index}`}
              href="#"
              onClick={(event) => event.preventDefault()}
              className="group relative block aspect-[5/3] overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-500 hover:-translate-y-1 hover:scale-[1.02] hover:border-[#0070b8]/20 hover:shadow-[0_12px_40px_rgba(0,112,184,0.16)]"
            >
              <div className="absolute left-4 right-4 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#0070b8]/30 to-transparent" />
              <div className="relative flex h-full w-full items-center justify-center p-6">
                <BrandMark brand={brand} className="h-[54px] w-[82%]" />
                <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 translate-y-1 text-[#0070b8] opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100" />
                {brand.service ? (
                  <span className="absolute bottom-2.5 left-3 rounded-md border border-[#0070b8]/20 bg-[#0070b8]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0070b8]">
                    Сервис
                  </span>
                ) : (
                  <span className="absolute bottom-3 right-3 text-[10px] font-semibold text-slate-400">
                    {brand.count} авто
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
