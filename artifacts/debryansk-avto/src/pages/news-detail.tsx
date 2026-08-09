import React from "react";
import { Link, useRoute } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Calendar, Clock, ArrowRight, Car } from "lucide-react";
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

export default function NewsDetailPage() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug ?? "";
  const prefersReduced = useReducedMotion();

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

  const articleJsonLd = {
    "@type": "NewsArticle",
    "headline": article.title,
    "description": article.excerpt,
    "image": article.image,
    "datePublished": article.publishedAt,
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

          {/* Cover image */}
          {article.image && (
            <figure className="rounded-2xl overflow-hidden mb-6">
              <picture>
                {article.imageMobile && (
                  <source media="(max-width: 639px)" srcSet={article.imageMobile} />
                )}
                <img
                  src={article.image}
                  alt={article.title}
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-48 sm:h-80 object-cover"
                />
              </picture>
            </figure>
          )}

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            {(article.content ?? article.excerpt ?? "").split("\n\n").map((paragraph, i) => (
              <p key={i} className={`text-slate-700 leading-relaxed mb-4 ${i === 0 ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}>
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
