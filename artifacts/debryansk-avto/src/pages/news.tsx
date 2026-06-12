import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ArrowRight, Clock, Newspaper } from "lucide-react";
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
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className={`group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow ${
        isFeatured ? "sm:col-span-2 sm:row-span-2" : ""
      }`}
    >
      <Link href={`/news/${article.slug}`}>
        <div className={`relative overflow-hidden ${isFeatured ? "h-48 sm:h-64" : "h-40"}`}>
          <img
            src={article.image ?? ""}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center bg-[#0070b8]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {article.category ?? "Новости"}
            </span>
          </div>
        </div>
      </Link>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
          <Calendar className="w-3 h-3" />
          <span>{article.publishedAt ? formatDate(article.publishedAt) : ""}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <Clock className="w-3 h-3" />
          <span>{article.readTime ?? 3} мин</span>
        </div>
        <Link href={`/news/${article.slug}`}>
          <h3 className={`font-bold text-slate-900 leading-snug group-hover:text-[#0070b8] transition-colors mb-2 ${
            isFeatured ? "text-lg sm:text-xl" : "text-sm sm:text-base"
          }`}>
            {article.title}
          </h3>
        </Link>
        <p className={`text-slate-500 leading-relaxed ${isFeatured ? "text-sm" : "text-xs sm:text-sm"}`}>
          {article.excerpt ?? ""}
        </p>
        <Link href={`/news/${article.slug}`} className="inline-flex items-center gap-1 text-[#0070b8] text-xs font-bold mt-3 hover:underline">
          Читать дальше <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.article>
  );
}

export default function NewsPage() {
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

  return (
    <Layout>
      <SEO
        title="Новости авторынка Брянска"
        description="Актуальные новости автомобильного рынка Брянска. Обзоры новинок, советы по покупке, финансирование и трейд-ин. Дебрянск Авто."
        canonical="/news"
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "Новости", url: "/news" },
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-[#0070b8]" />
            Новости авторынка
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Актуальные материалы о автомобилях, финансировании и сервисе
          </p>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory("Все")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeCategory === "Все"
                ? "bg-[#0070b8] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-[#0070b8]"
            }`}
          >
            Все
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat
                  ? "bg-[#0070b8] text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-[#0070b8]"
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
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
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
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Новостей в этой категории пока нет</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
