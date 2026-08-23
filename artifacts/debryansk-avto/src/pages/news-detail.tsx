import React from "react";
import { createPortal } from "react-dom";
import { Link, useRoute } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, ChevronLeft, Calendar, Clock, Car, X, ZoomIn } from "lucide-react";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";

interface NewsArticle {
  id: number;
  title: string;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  image: string | null;
  imageMobile: string | null;
  images?: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  readTime: number | null;
  slug: string;
}

async function fetchAllNews(): Promise<NewsArticle[]> {
  const r = await fetch("/api/news");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

/** Returns the effective images array for an article — prefers images[], falls back to image */
function getImages(article: NewsArticle): string[] {
  if (article.images && article.images.length > 0) return article.images;
  if (article.image) return [article.image];
  return [];
}

/**
 * Mobile carousel slide order:
 * - slide 0: imageMobile (dedicated mobile cover) OR images[0]
 * - slides 1…N: images[1…N] (additional photos from gallery)
 * Index maps 1-to-1 with lightbox heroImages (images[]).
 */
function getMobileSlides(article: NewsArticle): string[] {
  const imgs = getImages(article);
  if (!article.imageMobile) return imgs; // no dedicated mobile — use images as-is
  // imageMobile replaces images[0] visually on mobile
  return [article.imageMobile, ...imgs.slice(1)];
}

// ─── Mobile swipe carousel ───────────────────────────────────────────────────

interface MobileCarouselProps {
  slides: string[];
  title: string;
  onOpen: (idx: number) => void;
}

function MobileCarousel({ slides, title, onOpen }: MobileCarouselProps) {
  const [idx, setIdx] = React.useState(0);
  const touchStartX = React.useRef(0);
  const touchDeltaX = React.useRef(0);
  const dragged = React.useRef(false);

  if (!slides.length) return null;

  const clamp = (i: number) => Math.max(0, Math.min(slides.length - 1, i));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    dragged.current = false;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(touchDeltaX.current) > 8) dragged.current = true;
  };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -50) setIdx(i => clamp(i + 1));
    else if (touchDeltaX.current > 50) setIdx(i => clamp(i - 1));
    touchDeltaX.current = 0;
  };
  const handleClick = (e: React.MouseEvent, i: number) => {
    if (dragged.current) { e.preventDefault(); return; }
    onOpen(i);
  };

  return (
    <figure
      className="relative rounded-2xl overflow-hidden mb-6 select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides — natural image height, no clipping */}
      {slides.map((src, i) => (
        <div
          key={i}
          className="w-full"
          style={{ display: i === idx ? "block" : "none" }}
          onClick={e => handleClick(e, i)}
        >
          <img
            src={src}
            alt={slides.length > 1 ? `${title} — фото ${i + 1}` : title}
            className="w-full block"
            fetchPriority={i === 0 ? "high" : undefined}
            decoding="async"
            loading={i === 0 ? undefined : "lazy"}
            draggable={false}
          />
        </div>
      ))}

      {/* Gradient overlay for controls readability */}
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      )}

      {/* Pill dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-1.5 pointer-events-none">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i === idx ? "w-4 h-[5px] bg-white" : "w-[5px] h-[5px] bg-white/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Counter badge */}
      {slides.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full pointer-events-none tracking-wide">
          {idx + 1}&thinsp;/&thinsp;{slides.length}
        </div>
      )}
    </figure>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface LightboxProps {
  images: string[];
  startIdx: number;
  onClose: () => void;
}

function Lightbox({ images, startIdx, onClose }: LightboxProps) {
  const [idx, setIdx] = React.useState(startIdx);
  const prefersReduced = useReducedMotion();
  const touchStartX = React.useRef(0);
  const touchDeltaX = React.useRef(0);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(i => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setIdx(i => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose, images.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -50) setIdx(i => Math.min(i + 1, images.length - 1));
    else if (touchDeltaX.current > 50) setIdx(i => Math.max(i - 1, 0));
    touchDeltaX.current = 0;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ animation: prefersReduced ? "none" : "lb-fadein 0.18s ease" }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`@keyframes lb-fadein{from{opacity:0}to{opacity:1}}`}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Close */}
      <button
        aria-label="Закрыть"
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev */}
      {images.length > 1 && idx > 0 && (
        <button
          aria-label="Предыдущее фото"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next */}
      {images.length > 1 && idx < images.length - 1 && (
        <button
          aria-label="Следующее фото"
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative z-10 max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <img
          key={idx}
          src={images[idx]}
          alt={`Фото ${idx + 1}`}
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          style={{ animation: prefersReduced ? "none" : "lb-fadein 0.15s ease" }}
        />
      </div>

      {/* Dots */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              aria-label={`Фото ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-white scale-125" : "bg-white/40"}`}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── Gallery layout ───────────────────────────────────────────────────────────

/**
 * Grid class for the right-side gallery depending on how many extra photos there are.
 * 1 extra  → single cell
 * 2 extra  → 2 rows stacked
 * 3 extra  → 2-col 2-row grid, first photo spans full width
 * 4 extra  → 2×2 grid
 */
function galleryGridClass(count: number): string {
  if (count === 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-1 grid-rows-2";
  if (count === 3) return "grid-cols-2 grid-rows-2";
  return "grid-cols-2 grid-rows-2"; // 4
}

/** For 3 extras: first item spans both columns (top row full-width) */
function galleryItemClass(idx: number, total: number): string {
  if (total === 3 && idx === 0) return "col-span-2";
  return "";
}

interface HeroGalleryProps {
  images: string[];
  title: string;
  onOpen: (idx: number) => void;
}

function HeroGallery({ images, title, onOpen }: HeroGalleryProps) {
  const [main, ...rest] = images;

  if (!rest.length) {
    // Single image
    return (
      <figure className="relative rounded-2xl overflow-hidden mb-6 cursor-pointer group" onClick={() => onOpen(0)}>
        <img
          src={main}
          alt={title}
          fetchPriority="high"
          decoding="async"
          className="w-full h-52 sm:h-80 object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
        </div>
      </figure>
    );
  }

  // Multi-image grid — works on both mobile and desktop
  const RADIUS = "10px";
  const GAP = 3;

  return (
    <figure className="mb-6 rounded-2xl overflow-hidden">
      <div className="flex flex-row" style={{ gap: GAP }}>
        {/* Main photo */}
        <div
          className="w-[58%] flex-shrink-0 relative group cursor-pointer overflow-hidden"
          style={{ borderRadius: RADIUS }}
          onClick={() => onOpen(0)}
        >
          <img
            src={main}
            alt={title}
            fetchPriority="high"
            decoding="async"
            className="w-full h-52 sm:h-80 object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ display: "block" }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
            <ZoomIn className="w-6 h-6 sm:w-8 sm:h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        </div>

        {/* Thumbnails — height matches main photo via Tailwind */}
        <div
          className={`flex-1 grid overflow-hidden h-52 sm:h-80 ${galleryGridClass(rest.length)}`}
          style={{ gap: GAP }}
        >
          {rest.map((src, i) => (
            <div
              key={i}
              className={`relative group cursor-pointer overflow-hidden ${galleryItemClass(i, rest.length)}`}
              style={{ borderRadius: RADIUS }}
              onClick={() => onOpen(i + 1)}
            >
              <img
                src={src}
                alt={`${title} — фото ${i + 2}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsDetailPage() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug ?? "";
  const prefersReduced = useReducedMotion();
  const [lightboxIdx, setLightboxIdx] = React.useState<number | null>(null);

  const { data: allNews = [], isLoading } = useQuery({
    queryKey: ["public-news"],
    queryFn: fetchAllNews,
    staleTime: 60 * 1000,
  });

  const article = allNews.find(a => a.slug === slug);
  const related = article
    ? allNews.filter(a => a.id !== article.id && a.category === article.category).slice(0, 3)
    : [];

  if (isLoading) {
    return (
      <Layout>
        <div className={`container mx-auto px-4 sm:px-6 py-8 max-w-3xl space-y-4 ${prefersReduced ? "" : "animate-pulse"}`}>
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-8 bg-slate-100 rounded w-full" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!article) {
    return (
      <Layout>
        <SEO title="Новость не найдена" description="Запрашиваемая новость не найдена." canonical="/news" />
        <div className="text-center text-slate-400 py-20">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Новость не найдена</h1>
          <Link href="/news" className="text-primary font-bold text-sm hover:underline inline-flex items-center gap-1">
            <ChevronRight className="w-4 h-4 rotate-180" aria-hidden="true" />
            Вернуться к новостям
          </Link>
        </div>
      </Layout>
    );
  }

  const heroImages = getImages(article);
  const mobileSlides = getMobileSlides(article);

  const articleJsonLd = {
    "@type": "NewsArticle",
    "headline": article.title,
    "description": article.excerpt,
    "image": article.image,
    "datePublished": article.publishedAt,
    "dateModified": article.updatedAt || article.publishedAt,
    "author": { "@type": "Organization", "name": "Дебрянск Авто" },
    "publisher": {
      "@type": "Organization",
      "name": "Дебрянск Авто",
      "logo": { "@type": "ImageObject", "url": "https://debryansk-auto.ru/favicon.svg" }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://debryansk-auto.ru/news/${article.slug}`
    }
  };

  return (
    <Layout>
      <SEO
        title={article.title}
        description={article.excerpt ?? ""}
        canonical={`/news/${article.slug}`}
        image={article.image ?? undefined}
        type="article"
        jsonLd={articleJsonLd}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Новости", url: "/news" },
          { name: article.title ?? "", url: `/news/${article.slug}` },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
        {/* Breadcrumb */}
        <nav aria-label="Хлебные крошки" className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
          <Link href="/" className="hover:text-primary transition-colors">Главная</Link>
          <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" aria-hidden="true" />
          <Link href="/news" className="hover:text-primary transition-colors">Новости</Link>
          <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" aria-hidden="true" />
          <span className="text-slate-600 truncate">{article.title}</span>
        </nav>

        <motion.article
          initial={prefersReduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReduced ? 0 : 0.4 }}
        >
          {/* Category + read time */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-1 rounded-full">
              {article.category}
            </span>
            {article.readTime && (
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" aria-hidden="true" />
                <span>{article.readTime} мин чтения</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight mb-4">
            {article.title}
          </h1>

          {/* Author byline — E-E-A-T signal, mirrors JSON-LD author field */}
          <div className="flex items-center gap-2 mb-6 text-[12px] text-slate-500">
            <span>Автор:</span>
            <span itemProp="author" itemScope itemType="https://schema.org/Organization">
              <span itemProp="name">Редакция Дебрянск Авто</span>
            </span>
            {article.publishedAt && (
              <>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <Calendar className="w-3 h-3 text-slate-400" aria-hidden="true" />
                <time
                  itemProp="datePublished"
                  dateTime={new Date(article.publishedAt).toISOString()}
                  className="text-slate-400"
                >
                  {formatDate(article.publishedAt)}
                </time>
              </>
            )}
          </div>

          {/* Hero gallery grid — mobile and desktop */}
          {heroImages.length > 0 && (
            <HeroGallery images={heroImages} title={article.title} onOpen={setLightboxIdx} />
          )}

          {/* Lightbox (shared, both mobile and desktop) */}
          {lightboxIdx !== null && heroImages.length > 0 && (
            <Lightbox
              images={heroImages}
              startIdx={lightboxIdx}
              onClose={() => setLightboxIdx(null)}
            />
          )}

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            {(article.content ?? article.excerpt ?? "").split("\n\n").map((paragraph, i) => (
              <p key={i} className="text-slate-700 leading-relaxed mb-4 text-sm sm:text-base">
                {paragraph}
              </p>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 bg-primary/5 border border-primary/10 rounded-2xl p-5 sm:p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Заинтересовала модель?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Запишитесь на тест-драйв или консультацию в ближайшем дилерском центре.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/cars"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                <Car className="w-4 h-4" aria-hidden="true" />
                Автомобили с пробегом
              </Link>
              <Link
                href="/new-cars"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:border-primary transition-colors"
              >
                Новые автомобили
              </Link>
            </div>
          </div>

          {/* Prerender marker — required for Puppeteer cache */}
          <div data-prerender-ready="true" style={{ display: "none" }} />
        </motion.article>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="mt-10" aria-label="Похожие новости">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Похожие новости</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map(a => (
                <Link key={a.id} href={`/news/${a.slug}`}>
                  <article className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
                    {a.image && (
                      <div className="h-32 overflow-hidden">
                        <img
                          src={a.image}
                          alt={a.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="text-[10px] text-primary font-bold mb-1">{a.category}</div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-primary transition-colors">{a.title}</h3>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
