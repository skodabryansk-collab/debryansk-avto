import React, { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const DESKTOP_PER_PAGE = 3;

interface HomeCarouselProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode[];
  viewAllLink: string;
  viewAllLabel: string;
}

export default function HomeCarousel({
  title,
  subtitle,
  children,
  viewAllLink,
  viewAllLabel,
}: HomeCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const total = children.length;
  const pages = Math.max(1, Math.ceil(total / DESKTOP_PER_PAGE));

  const goToPage = useCallback(
    (target: number) => {
      const el = scrollRef.current;
      if (!el || total === 0) return;
      const clamped = Math.max(0, Math.min(target, pages - 1));

      const first = el.children[0] as HTMLElement | undefined;
      const cardW = first ? first.getBoundingClientRect().width : 0;
      const gap = parseFloat(getComputedStyle(el).gap) || 16;
      const step = (cardW + gap) * DESKTOP_PER_PAGE;
      el.scrollTo({ left: clamped * step, behavior: "smooth" });
      setPage(clamped);
    },
    [total, pages]
  );

  const prev = () => goToPage(page - 1);
  const next = () => goToPage(page + 1);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const cardW = first ? first.getBoundingClientRect().width : 0;
      const gap = parseFloat(getComputedStyle(el).gap) || 16;
      const step = (cardW + gap) * DESKTOP_PER_PAGE;
      if (step <= 0) return;
      const cur = Math.round(el.scrollLeft / step);
      setPage(Math.max(0, Math.min(cur, pages - 1)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pages]);

  if (total === 0) return null;

  return (
    <section className="py-10 sm:py-14 md:py-20 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-5 sm:mb-8 md:mb-10">
          <div>
            {subtitle && (
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-1 sm:mb-1.5">
                {subtitle}
              </p>
            )}
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold">
              {title}
            </h2>
          </div>

          {/* Desktop arrows + link */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={prev}
                disabled={page === 0}
                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#0070b8] hover:text-[#0070b8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                disabled={page >= pages - 1}
                className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:border-[#0070b8] hover:text-[#0070b8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <Link
              href={viewAllLink}
              className="flex items-center gap-1.5 text-[#0070b8] font-bold text-sm hover:gap-2.5 transition-all"
            >
              {viewAllLabel} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden -mx-4 px-4">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {children.map((child, i) => (
              <div key={i} className="snap-start shrink-0 w-[47%]">
                {child}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop carousel */}
        <div className="hidden md:block">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {children.map((child, i) => (
              <div key={i} className="snap-start shrink-0 w-[30%]">
                {child}
              </div>
            ))}
          </div>

          {/* Dots */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToPage(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === page
                      ? "w-[18px] bg-[#0070b8]"
                      : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Страница ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mobile CTA */}
        <div className="flex justify-center mt-5 md:hidden">
          <Link
            href={viewAllLink}
            className="flex items-center gap-2 bg-[#0070b8] text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#005a9a] transition-colors"
          >
            {viewAllLabel} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
