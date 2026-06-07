import React from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, ArrowRight, Heart } from "lucide-react";
import SEO from "@/components/SEO";
import miniLogo from "@/assets/mini-logo.webp";
import { newsArticles } from "./news";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function NewsDetailPage() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug ?? "";
  const article = newsArticles.find(a => a.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif] flex items-center justify-center">
        <SEO title="Новость не найдена" description="Запрашиваемая новость не найдена." canonical="/news" />
        <div className="text-center text-slate-400">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Новость не найдена</h1>
          <Link href="/news" className="text-[#0070b8] font-bold text-sm hover:underline">
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            Вернуться к новостям
          </Link>
        </div>
      </div>
    );
  }

  const related = newsArticles
    .filter(a => a.id !== article.id && a.category === article.category)
    .slice(0, 3);

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
      "logo": { "@type": "ImageObject", "url": "https://debryansk-avto.ru/favicon.svg" }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://debryansk-avto.ru/news/${article.slug}`
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif]">
      <SEO
        title={`${article.title}`}
        description={article.excerpt}
        canonical={`/news/${article.slug}`}
        image={article.image}
        type="article"
        jsonLd={articleJsonLd}
      />

      {/* Header */}
      <header className="bg-[#0d0f14] text-white px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          <img src={miniLogo} alt="Дебрянск Авто" className="h-8 w-8 object-contain" />
        </Link>
        <Link href="/news" className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Новости
        </Link>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <Link href="/" className="hover:text-[#0070b8] transition-colors">Главная</Link>
          <ArrowRight className="w-3 h-3" />
          <Link href="/news" className="hover:text-[#0070b8] transition-colors">Новости</Link>
          <ArrowRight className="w-3 h-3" />
          <span className="text-slate-600 truncate">{article.title}</span>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Category + meta */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center bg-[#0070b8]/10 text-[#0070b8] text-[11px] font-bold px-2.5 py-1 rounded-full">
              {article.category}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(article.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{article.readTime} мин чтения</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight mb-4">
            {article.title}
          </h1>

          {/* Cover image */}
          <div className="relative rounded-2xl overflow-hidden mb-6">
            <img
              src={article.image}
              alt={article.title}
              className="w-full h-48 sm:h-80 object-cover"
            />
          </div>

          {/* Content placeholder */}
          <div className="prose prose-slate max-w-none">
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-4">
              {article.excerpt}
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              В скором времени здесь появится полный текст новости. Следите за обновлениями на нашем сайте.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Если у вас есть вопросы о модели или условиях покупки, звоните в дилерские центры Дебрянск Авто или оставляйте заявку на сайте.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-8 bg-[#0070b8]/5 border border-[#0070b8]/10 rounded-2xl p-5 sm:p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Заинтересовала модель?</h3>
            <p className="text-sm text-slate-500 mb-4">
              Запишитесь на тест-драйв или консультацию в ближайшем дилерском центре.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/cars">
                <button className="px-4 py-2.5 bg-[#0070b8] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                  <Heart className="w-4 h-4 inline mr-1" />
                  Автомобили с пробегом
                </button>
              </Link>
              <Link href="/new-cars">
                <button className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:border-[#0070b8] transition-colors">
                  Новые автомобили
                </button>
              </Link>
            </div>
          </div>
        </motion.article>

        {/* Related articles */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Похожие новости</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map(a => (
                <Link key={a.id} href={`/news/${a.slug}`}>
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
                    <div className="h-32 overflow-hidden">
                      <img src={a.image} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] text-[#0070b8] font-bold mb-1">{a.category}</div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-[#0070b8] transition-colors">{a.title}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
