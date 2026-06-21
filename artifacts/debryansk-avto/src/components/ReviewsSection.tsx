import React, { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { Helmet } from "react-helmet-async";

/* ── Types ────────────────────────────────────────────── */
export interface ApiReview {
  id: string | number;
  author: string;
  rating: number;
  text: string;
  date: string;
  source: string;
  sourceUrl?: string;
}

/* ── Fetch ────────────────────────────────────────────── */
export async function fetchReviews(): Promise<{ data: ApiReview[]; avg: number; total: number; overallCount: number }> {
  const r = await fetch("/api/reviews");
  if (!r.ok) return { data: [], avg: 5, total: 0, overallCount: 0 };
  const json = await r.json();
  return json.ok
    ? { data: json.data ?? [], avg: json.avg ?? 5, total: json.total ?? 0, overallCount: json.overallCount ?? 0 }
    : { data: [], avg: 5, total: 0, overallCount: 0 };
}

/* ── Helpers ──────────────────────────────────────────── */
function SourceIcon({ source }: { source: string }) {
  const s = source.toLowerCase();
  if (s === "яндекс" || s === "yandex") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <path d="M12 0C5.372 0 0 5.372 0 12C0 18.628 5.372 24 12 24C18.628 24 24 18.628 24 12C24 5.372 18.628 0 12 0Z" fill="#FC3F1D"/>
        <path d="M13.6 5.5H12.4C10.4 5.5 9.3 6.5 9.3 8.1C9.3 9.9 10.1 10.8 11.7 11.9L12.9 12.7L9.2 18.5H7L10.4 13.1C8.5 11.8 7.4 10.6 7.4 8.2C7.4 5.8 9.1 4 12.4 4H15.6V18.5H13.6V5.5Z" fill="white"/>
      </svg>
    );
  }
  if (s === "google") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  }
  if (s === "авито" || s === "avito") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <rect width="24" height="24" rx="6" fill="#00AAFF"/>
        <text x="4" y="17" fontSize="11" fontWeight="bold" fill="white" fontFamily="Arial">A</text>
      </svg>
    );
  }
  return <span className="text-[10px] font-bold text-slate-400">{source}</span>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= rating ? "#f59e0b" : "#e2e8f0"} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.45, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ── Main component ───────────────────────────────────── */
export const ReviewsSection = () => {
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["reviews"],
    queryFn: fetchReviews,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const reviews = reviewsData?.data ?? [];
  const avg = reviewsData?.avg ?? 5;
  const overallCount = reviewsData?.overallCount ?? 0;

  const [expanded, setExpanded] = React.useState<Record<string | number, boolean>>({});
  const [visibleCount, setVisibleCount] = React.useState(6);

  if (!isLoading && reviews.length === 0) return null;

  const skeletons = Array.from({ length: 3 });
  const visible = reviews.slice(0, visibleCount);
  const hasMore = visibleCount < reviews.length;

  const reviewsJsonLd = !isLoading && overallCount > 0 ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "name": "Дебрянск Авто",
    "url": "https://debryansk-auto.ru",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": avg.toFixed(1),
      "reviewCount": overallCount,
      "bestRating": "5",
      "worstRating": "1",
    },
    "review": reviews.slice(0, 10).map(r => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": r.author },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": r.rating,
        "bestRating": "5",
        "worstRating": "1",
      },
      "reviewBody": r.text,
      ...(r.date ? { "datePublished": r.date.split("T")[0] } : {}),
    })),
  }) : null;

  return (
    <section className="py-12 sm:py-20 bg-slate-50 border-t border-slate-100">
      {reviewsJsonLd && (
        <Helmet>
          <script type="application/ld+json">{reviewsJsonLd}</script>
        </Helmet>
      )}
      <div className="container mx-auto px-4 sm:px-6">

        {/* Header */}
        <FadeIn className="mb-6 sm:mb-10">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Нам доверяют</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold">Отзывы покупателей</h2>
          {!isLoading && overallCount > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StarRating rating={Math.round(avg)} />
              <span className="text-sm font-bold text-slate-700">{avg.toFixed(1)}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">
                {overallCount.toLocaleString("ru-RU")}&nbsp;отзыв
                {overallCount % 10 === 1 && overallCount % 100 !== 11 ? "" :
                  overallCount % 10 >= 2 && overallCount % 10 <= 4 && (overallCount % 100 < 10 || overallCount % 100 >= 20) ? "а" : "ов"}
                &nbsp;за всё время
              </span>
            </div>
          )}
        </FadeIn>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {skeletons.map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-full" />
                  <div className="flex-1">
                    <div className="h-3 w-24 bg-slate-100 rounded mb-2" />
                    <div className="h-2.5 w-16 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-5/6" />
                  <div className="h-3 bg-slate-100 rounded w-4/6" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {visible.map((review, i) => {
                const isExp = expanded[review.id];
                const LIMIT = 160;
                const longText = review.text.length > LIMIT;
                const displayText = isExp || !longText ? review.text : review.text.slice(0, LIMIT) + "…";

                return (
                  <FadeIn
                    key={review.id}
                    delay={Math.min(i * 0.06, 0.25)}
                  >
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 h-full flex flex-col hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#0070b8]/20 to-[#87b63c]/20 flex items-center justify-center text-sm font-bold text-[#0070b8] shrink-0">
                            {review.author.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate">{review.author}</p>
                            {review.date && (
                              <p className="text-[11px] text-slate-400">
                                {new Date(review.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>
                        <SourceIcon source={review.source} />
                      </div>

                      <StarRating rating={review.rating} />

                      <p className="text-sm text-slate-600 leading-relaxed mt-2.5 flex-1">
                        {displayText}
                      </p>
                      {longText && (
                        <button
                          className="text-[11px] font-semibold text-[#0070b8] hover:underline mt-2 text-left"
                          onClick={() => setExpanded(e => ({ ...e, [review.id]: !isExp }))}
                        >
                          {isExp ? "Свернуть" : "Читать полностью"}
                        </button>
                      )}
                    </div>
                  </FadeIn>
                );
              })}
            </div>

            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setVisibleCount(c => c + 6)}
                  className="px-6 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-[#0070b8]/40 hover:text-[#0070b8] transition-colors"
                >
                  Показать ещё · {Math.min(6, reviews.length - visibleCount)} отзывов
                </button>
              </div>
            ) : reviews.length > 0 && (
              <div className="mt-8 flex justify-center">
                <p className="text-sm text-slate-500 text-center">
                  Больше отзывов смотрите на{" "}
                  <a
                    href="https://yandex.ru/maps/org/debryansk_avto/1127547147/reviews/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0070b8] hover:underline"
                  >
                    Яндекс Картах
                  </a>
                  {" "}и{" "}
                  <a
                    href="https://2gis.ru/bryansk/firm/70000001085543814/tab/reviews"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0070b8] hover:underline"
                  >
                    2ГИС
                  </a>
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </section>
  );
};
