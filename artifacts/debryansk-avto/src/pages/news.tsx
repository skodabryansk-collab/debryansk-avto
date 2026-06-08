import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ArrowRight, Clock, Newspaper } from "lucide-react";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
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
    content: "Jaecoo готовит пополнение линейки: два новых кроссовера и обновление для моделей J7 и J8. Ожидается, что все новинки получат гибридную установку, адаптивный круиз-контроль и обновленную мультимедийную систему.\n\nБренд Jaecoo, принадлежащий компании Chery, быстро завоевал популярность в России. В 2026 году планируется выпуск двух полноценных кроссоверов в сегменте C-и D+класса. Обе модели получат платформу T2X, где T обозначает повышенную базовую комплектацию.\n\nАдаптивный круиз-контроль будет работать в диапазоне от 0 до 150 км/ч, что делает его особенно актуальным для длинных трасс. Обновленная мультимедиа на базе процессора Qualcomm 8155 получит диагональ 14,6 дюйма с поддержкой беспроводной Android Auto и Apple CarPlay.",
    category: "Новинки",
    image: "https://www.omodajaecoo.co.nz/sites/default/files/styles/accelerator_landscape_crop_16_9/public/2024-06/J7-Page-Gallery-Image-1-HD.jpg",
    publishedAt: "2026-06-05",
    readTime: 4,
    slug: "jaecoo-2026-lineup",
  },
  {
    id: "2",
    title: "Haval показал обновленный Haval Jolion: что изменилось",
    excerpt: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций. Он стал самой популярной моделью в линейке Haval в России.",
    content: "Обновленный Haval Jolion получил новый дизайн передней части, переработанный интерьер и расширенный список опций. Он стал самой популярной моделью в линейке Haval в России.\n\nГлавное изменение — передняя часть с новой светооптикой, измененной решеткой радиатора и аномальными блоками поворотников. Собранная в Китае автомобиль получил переработанный бампер и новые диодные блоки.\n\nВ интерьере появилась новая панель приборов с диагональю 12,3 дюйма, беспроводная зарядка для смартфона и улучшенная отделка от немецких коллег. Система безопасности дополнена блинд-зонами и автоматическим торможением.",
    category: "Новинки",
    image: "https://img-ik.cars.co.za/news-site-za/images/2024/04/2025-Haval-Jolion-Facelift-2.jpg",
    publishedAt: "2026-05-28",
    readTime: 3,
    slug: "haval-jolion-update",
  },
  {
    id: "3",
    title: "Как получить автокредит по двум документам: разбор программ в Брянске",
    excerpt: "Все более дилерских центров Брянска предлагают автокредитование по двум документам без первоначального взноса. Разбираем, какие ставки, условия и подводные камни адаптивного кредита помогают не переплатить.",
    content: "Автокредитование по двум документам — сейчас один из самых востребованных продуктов в дилерских центрах Брянска. Минимальный пакет документов — паспорт и ВУ, без подтверждения дохода и без первоначального взноса.\n\nСтавки начинаются от 4,9% годовых, но важно помнить: базовая ставка повышается после одобрения банка до 7,9–12,9%. Срок кредита — от 1 до 7 лет, максимальная сумма до 5 млн рублей.\n\nОсновной подводный камень — скрытые комиссии за оформление, которые могут довести общую стоимость до 15–25% от ставки. Рекомендуем заказывать обязательный перечень страховки — он часто увеличивает платёж более чем на 5%. Свободное досрочное погашение возможно со второго месяца.",
    category: "Финансы",
    image: "https://thumbs.dreamstime.com/b/panorama-view-car-dealer-handing-key-vehicle-model-to-customer-contract-signing-concept-auto-loan-finance-407833732.jpg",
    publishedAt: "2026-05-20",
    readTime: 5,
    slug: "auto-credit-two-docs",
  },
  {
    id: "4",
    title: "Trade-in в Брянске: как получить максимальную выгоду от обмена",
    excerpt: "Эксперты делятся, как продать старый автомобиль по выгодной цене. Рассказываем, как подготовить авто, увеличить стоимость выкупа и получить дополнительные бонусы при обмене.",
    content: "Эксперты делятся, как продать старый автомобиль по выгодной цене. Рассказываем, как подготовить авто, увеличить стоимость выкупа и получить дополнительные бонусы при обмене.\n\nШаг первый — подготовка. Уберите авто в порядок: комплексная мойка, полировка, дезодорация и подготовка документов могут увеличить цену выкупа до 15%.\n\nШаг второй — оценка. Онлайн-калькуляторы на сайтах дилеров дают первичную цену, но не бойтесь торговаться. Реальная выкупная стоимость часто оказывается выше первоначальной оценки на 10–25%. Собирайте оферты от нескольких дилеров для сравнения.\n\nШаг третий — бонусы. При одновременном обмене и покупке нового авто вы получаете дополнительную скидку, расширенную гарантию или комплект шин. Обратитесь к менеджеру за советом.",
    category: "Советы",
    image: "https://di-uploads-pod30.dealerinspire.com/serratraversecity/uploads/2025/07/used-cars_5.jpg",
    publishedAt: "2026-05-15",
    readTime: 3,
    slug: "trade-in-max-profit",
  },
  {
    id: "5",
    title: "Омода S5 и C5: какой кроссовер лучше выбрать в 2026 году",
    excerpt: "Омода показала отличные продажи в первой половине 2026 года. Разбираем, в чем разница между S5 и C5, и какой модель лучше подойдет для города, а какой для загорода.",
    content: "Омода показала отличные продажи в первой половине 2026 года. Разбираем, в чем разница между S5 и C5, и какой модель лучше подойдет для города, а какой для загорода.\n\nOmoda S5 — компактный кроссовер длиной 4,4 м с базовым двигателем 1,5 л (147 л.с.). Оптимален для города: маневренность, небольшие габариты, парковка и багажник. Базовая комплектация уже включает камеру, климат и мультимедию.\n\nOmoda C5 — более крупный автомобиль длиной 4,6 м с двигателем 1,6 л (186 л.с.) и полным приводом. Подойдет для загорода: большой багажник, увеличенный клиренс, дополнительная защита днища. Разница в цене — около 300 тыс. рублей.\n\nВывод: для города и первого авто берите S5, для загорода и семейной поездки — C5. Оба модели доступны для тест-драйва в дилерских центрах Дебрянск Авто.",
    category: "Сравнение",
    image: "https://www.omoda.co.za/_next/image?url=/_next/static/media/overview1.03e219a1.jpg&w=1920&q=100",
    publishedAt: "2026-05-10",
    readTime: 4,
    slug: "omoda-s5-c5-compare",
  },
  {
    id: "6",
    title: "Автомобилейный рынок Брянска: тенденции и перспективы на 2026 год",
    excerpt: "Рынок автомобилей в Брянской области показывает уверенный рост. Китайские бренды завоевывают рост в популярности, а классические бренды обновляют модельный ряд.",
    content: "Рынок автомобилей в Брянской области показывает уверенный рост. Китайские бренды завоевывают рост в популярности, а классические бренды обновляют модельный ряд.\n\nПо данным за первую половину 2026 года, продажи новых автомобилей в области выросли на 18% по сравнению с аналогичным периодом 2025 года. Лидерами по продажам стали Haval, Omoda и Chery — общая доля китайских брендов превысила 60%.\n\nВ сегменте бюджетных автомобилей (до 1,5 млн рублей) рост составил 24%. Это связано с запуском новых моделей Jaecoo, расширением линейки Haval и агрессивной ценовой политикой Omoda. Автомобили с пробегом показали повышенный спрос — покупатели чаще выбирают бюджетные седаны и кроссоверы возрастом 3–5 лет.\n\nПерспектива: авторыыки рост продаж продолжится, если сохранятся текущие ставки по кредитам и государственная поддержка автопрома. Дилеры увеличивают автопарк и расширяют сервисные возможности.",
    category: "Рынок",
    image: "https://thumbs.dreamstime.com/b/modern-car-dealership-showroom-parked-cars-row-clean-bright-new-vehicles-opportunities-leasing-auto-insurance-349897622.jpg",
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
    <Layout>
      <SEO
        title="Новости авторынка Брянска"
        description="Актуальные новости автомобильного рынка Брянска. Обзоры новинок, советы по покупке, финансирование и трейд-ин. Дебрянск Авто."
        canonical="/news"
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
      </div>
    </Layout>
  );
}
