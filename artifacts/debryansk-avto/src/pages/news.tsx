import React from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, ArrowRight, Clock, Newspaper } from "lucide-react";
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
  publishedAt: string | null;
  readTime: number | null;
  slug: string;
}

async function fetchNews(): Promise<NewsArticle[]> {
  const r = await fetch("/api/news");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function ArticleCard({ article, index }: { article: NewsArticle; index: number }) {
  const isFeatured = index === 0;
  const prefersReduced = useReducedMotion();

  if (isFeatured) {
    return (
      <motion.article
        initial={prefersReduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReduced ? 0 : 0.4 }}
        className="group relative rounded-2xl overflow-hidden sm:col-span-2 sm:row-span-2 min-h-[400px]"
      >
        <Link href={`/news/${article.slug}`} className="block absolute inset-0">
          {/* Full-bleed image */}
          <picture className="absolute inset-0 w-full h-full">
            {article.imageMobile && (
              <source media="(max-width: 639px)" srcSet={article.imageMobile} />
            )}
            <img
              src={article.image ?? ""}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </picture>

          {/* Gradient overlay — transparent top, dark bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

          {/* Category badge — glass pill on image */}
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/25">
              {article.category ?? "Новости"}
            </span>
          </div>

          {/* Text content at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
            <div className="flex items-center gap-2 text-[11px] text-white/65 mb-2.5">
              <Calendar className="w-3 h-3" />
              <span>{article.publishedAt ? formatDate(article.publishedAt) : ""}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-white/40" />
              <span>Редакция Дебрянск Авто</span>
              <span className="w-0.5 h-0.5 rounded-full bg-white/40" />
              <Clock className="w-3 h-3" />
              <span>{article.readTime ?? 3} мин</span>
            </div>
            <h3 className="font-bold text-xl sm:text-2xl leading-snug text-white mb-2 group-hover:text-white/90 transition-colors">
              {article.title}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed line-clamp-2 max-w-lg">
              {article.excerpt ?? ""}
            </p>
            <span className="inline-flex items-center gap-1.5 text-white/90 text-xs font-bold mt-3.5 group-hover:gap-2.5 transition-all duration-200">
              Читать дальше <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </Link>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.4, delay: prefersReduced ? 0 : index * 0.07 }}
      className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
      <Link href={`/news/${article.slug}`}>
        <div className="relative overflow-hidden h-[208px] sm:h-40">
          <picture>
            {article.imageMobile && (
              <source media="(max-width: 639px)" srcSet={article.imageMobile} />
            )}
            <img
              src={article.image ?? ""}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </picture>
        </div>
      </Link>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
          <span className="text-primary font-bold">{article.category ?? "Новости"}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <Calendar className="w-3 h-3" />
          <span>{article.publishedAt ? formatDate(article.publishedAt) : ""}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
            <span>Редакция Дебрянск Авто</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <Clock className="w-3 h-3" />
          <span>{article.readTime ?? 3} мин</span>
        </div>
        <Link href={`/news/${article.slug}`}>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug group-hover:text-primary transition-colors mb-2">
            {article.title}
          </h3>
        </Link>
        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
          {article.excerpt ?? ""}
        </p>
        <Link href={`/news/${article.slug}`} className="inline-flex items-center gap-1 text-primary text-xs font-bold mt-3 hover:underline">
          Читать дальше <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.article>
  );
}

export default function NewsPage() {
  const prefersReduced = useReducedMotion();
  const { data: newsArticles = [], isLoading } = useQuery({
    queryKey: ["public-news"],
    queryFn: fetchNews,
    staleTime: 60 * 1000,
  });

  const categories = [...new Set(newsArticles.map(a => a.category ?? "Новости"))];
  const [activeCategory, setActiveCategory] = React.useState("Все");

  const filtered = activeCategory === "Все"
    ? newsArticles
    : newsArticles.filter(a => a.category === activeCategory);

  const newsJsonLd = newsArticles.length > 0 ? [
    {
      "@type": "Blog",
      "name": "Новости авторынка — Дебрянск Авто",
      "url": "https://debryansk-auto.ru/news",
      "description": "Актуальные новости автомобильного рынка Брянска",
      "publisher": {
        "@type": "Organization",
        "name": "Дебрянск Авто",
        "url": "https://debryansk-auto.ru",
      },
      "blogPost": newsArticles.slice(0, 10).map(a => ({
        "@type": "BlogPosting",
        "headline": a.title,
        "url": `https://debryansk-auto.ru/news/${a.slug}`,
        ...(a.publishedAt ? { "datePublished": a.publishedAt } : {}),
        ...(a.image ? { "image": a.image } : {}),
        ...(a.excerpt ? { "description": a.excerpt } : {}),
      })),
    },
    {
      "@type": "ItemList",
      "name": "Последние новости — Дебрянск Авто",
      "url": "https://debryansk-auto.ru/news",
      "numberOfItems": newsArticles.slice(0, 10).length,
      "itemListElement": newsArticles.slice(0, 10).map((a, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": a.title,
        "url": `https://debryansk-auto.ru/news/${a.slug}`,
        ...(a.publishedAt ? { "datePublished": a.publishedAt } : {}),
      })),
    },
  ] as Record<string, unknown>[] : undefined;

  return (
    <Layout>
      <SEO
        title="Новости авторынка Брянска"
        description="Актуальные новости автомобильного рынка Брянска. Обзоры новинок, советы по покупке, финансирование и трейд-ин. Дебрянск Авто."
        canonical="/news"
        jsonLd={newsJsonLd}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Новости", url: "/news" },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-primary" aria-hidden="true" />
            Новости авторынка
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Актуальные материалы об автомобилях, финансировании и сервисе
          </p>
        </div>

        {/* Category filters */}
        <div
          role="group"
          aria-label="Фильтр по категориям"
          className="flex flex-wrap gap-2 mb-6"
        >
          <button
            onClick={() => setActiveCategory("Все")}
            aria-pressed={activeCategory === "Все"}
            className={`px-3 py-2.5 rounded-full text-xs font-bold transition-all min-h-[44px] ${
              activeCategory === "Все"
                ? "bg-primary text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-primary"
            }`}
          >
            Все
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`px-3 py-2.5 rounded-full text-xs font-bold transition-all min-h-[44px] ${
                activeCategory === cat
                  ? "bg-primary text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`bg-white rounded-2xl border border-slate-100 overflow-hidden ${prefersReduced ? "" : "animate-pulse"}`}>
                <div className="h-40 bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Articles grid */}
        {!isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((article, i) => (
              <ArticleCard key={article.id} article={article} index={i} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-semibold">Новостей в этой категории пока нет</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
