import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ArrowRight, Clock, Newspaper } from "lucide-react";
import SEO from "@/components/SEO";
import miniLogo from "@/assets/mini-logo.webp";

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  publishedAt: string;
  readTime: number;
  slug: string;
}

export const newsArticles: NewsArticle[] = [
  {
    id: "1",
    title: "Jaecoo запускает новую линейку: чего ждать от бренда в 2026 году",
    excerpt: "Jaecoo готовит пополнение линейки: два новых кроссовера и обновление для моделей J7 и J8. Ожидается, что все новинки получат гибридную установку, адаптивный круиз-контроль и обновленную мультимедийную систему.",
    category: "Новинки",
    image: "https://img.drive.ru/i/0/5f3e3e8cec05c4e87e000004.jpg",
    publishedAt: "2026-06-05",
    readTime: 4,
    slug: "jaecoo-2026-lineup",
  },
  {
    id: "2",
    title: "Haval показал обновленный Haval Jolion: что изменилось",
    excerpt: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций. Он стал самой популярной моделью в линейке Haval в России.",
    category: "Новинки",
    image: "https://img.drive.ru/i/0/5f3e3e8cec05c4e87e000004.jpg",
    publishedAt: "2026-05-28",
    readTime: 3,
    slug: "haval-jolion-update",
  },
  {
    id: "3",
    title: "Как получить автокредит по двум документам: разбор программ в Брянске",
    excerpt: "Все более дилерских центров Брянска предлагают автокредитование по двум документам без первоначального взноса. Разбираем, какие ставки, условия и подводные камни адаптивного кредита помогают не переплатить.",
    category: "Финансы",
    image: "https://img.drive.ru/i/0/5f3e3e8cec05c4e87e000004.jpg",
    publishedAt: "2026-05-20",
    readTime: 5,
    slug: "auto-credit-two-docs",
  },
  {
    id: "4",
    title: "Trade-in в Брянске: как получить максимальную выгоду от обмена",
    excerpt: "Эксперты делаться давним автомобилем по выгодной цене. Рассказываем, как подготовить авто, увеличить стоимость выкупа и получить дополнительные бонусы при обмене.",
    category: "Советы",
    image: "https://img.drive.ru/i/0/5f3e3e8cec05c4e87e000004.jpg",
    publishedAt: "2026-05-15",
    readTime: 3,
    slug: "trade-in-max-profit",
  },
  {
    id: "5",
    title: "Омода S5 и C5: какой кроссовер лучше выбрать в 2026 году",
    excerpt: "Омода показала отличные продажи в первой половине 2026 года. Разбираем, в чем разница между S5 и C5, и какой модель лучше подойдет для города, а какой для загорода.",
    category: "Сравнение",
    image: "https://img.drive.ru/i/0/5f3e3e8cec05c4e87e000004.jpg",
    publishedAt: "2026-05-10",
    readTime: 4,
    slug: "omoda-s5-c5-compare",
  },
  {
    id: "6",
    title: "Автомобилейный рынок Брянска: тенденции и перспективы на 2026 год",
    excerpt: "Рынок автомобилей в Брянской области показывает уверенный рост. Китайские бренды завоевывают рост в популярности, а классические бренды обновляют модельный ряд.",
    category: "Рынок",
    image: "https://img.drive.ru/i/0/5f3e3e8cec05c4e87e000004.jpg",
    publishedAt: "2026-05-01",
    readTime: 6,
    slug: "bryansk-auto-market-2026",
  },
];

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
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center bg-[#0070b8]/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {article.category}
            </span>
          </div>
        </div>
      </Link>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(article.publishedAt)}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <Clock className="w-3 h-3" />
          <span>{article.readTime} мин</span>
        </div>
        <Link href={`/news/${article.slug}`}>
          <h3 className={`font-bold text-slate-900 leading-snug group-hover:text-[#0070b8] transition-colors mb-2 ${
            isFeatured ? "text-lg sm:text-xl" : "text-sm sm:text-base"
          }`}>
            {article.title}
          </h3>
        </Link>
        <p className={`text-slate-500 leading-relaxed ${isFeatured ? "text-sm" : "text-xs sm:text-sm"}`}>
          {article.excerpt}
        </p>
        <Link href={`/news/${article.slug}`} className="inline-flex items-center gap-1 text-[#0070b8] text-xs font-bold mt-3 hover:underline">
          Читать дальше <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.article>
  );
}

export default function NewsPage() {
  const categories = [...new Set(newsArticles.map(a => a.category))];
  const [activeCategory, setActiveCategory] = React.useState("Все");

  const filtered = activeCategory === "Все"
    ? newsArticles
    : newsArticles.filter(a => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-slate-50 font-[Manrope,sans-serif]">
      <SEO
        title="Новости авторынка Брянска"
        description="Актуальные новости автомобильного рынка Брянска. Обзоры новинок, советы по покупке, финансирование и трейд-ин. Дебрянск Авто."
        canonical="/news"
      />

      {/* Header */}
      <header className="bg-[#0d0f14] text-white px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          <img src={miniLogo} alt="Дебрянск Авто" className="h-8 w-8 object-contain" />
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Главная
        </Link>
        <div className="flex-1" />
        <h1 className="text-lg font-bold text-white hidden sm:block">Новости</h1>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
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

        {/* Articles grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((article, i) => (
            <ArticleCard key={article.id} article={article} index={i} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Новостей в этой категории пока нет</p>
          </div>
        )}
      </main>
    </div>
  );
}
