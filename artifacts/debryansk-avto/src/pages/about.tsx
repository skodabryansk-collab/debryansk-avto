import React from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  Shield, Users, Award, Clock, Car, TrendingUp,
  Star, Building2, Wrench
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";
import { ReviewsSection } from "@/components/ReviewsSection";

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface ApiBrand {
  id: number;
  name: string;
  logoUrl: string | null;
  isServiceOnly?: boolean;
}

async function fetchBrands(): Promise<ApiBrand[]> {
  const r = await fetch("/api/brands");
  if (!r.ok) throw new Error("API error");
  const json = await r.json();
  return json.ok ? json.data : [];
}

/* ─── Static data ───────────────────────────────────────────────────────────── */
const values = [
  {
    icon: Shield,
    title: "Официальный дилер",
    desc: "Все автомобили проходят предпродажную подготовку. Гарантия от производителя. Оригинальные запчасти.",
  },
  {
    icon: Users,
    title: "Профессиональная команда",
    desc: "Сертифицированные менеджеры, мастера-консультанты и сервисные специалисты. Обучение за счёт компании.",
  },
  {
    icon: Award,
    title: "Прозрачное ценообразование",
    desc: "Честная стоимость, без скрытых комиссий и допов. Все условия открыто и понятно.",
  },
  {
    icon: Star,
    title: "Полный цикл услуг",
    desc: "Продажа, трейд-ин, автокредит, сервис, страхование, кузовной ремонт и детейлинг в одном месте.",
  },
];

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default function AboutPage() {
  const prefersReduced = useReducedMotion();
  const { data: apiBrands = [] } = useQuery({
    queryKey: ["public-brands"],
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000,
  });

  const totalBrands = apiBrands.length || 12;

  const organizationSchema = {
    "@type": "Organization",
    "name": "Дебрянск Авто",
    "alternateName": "Debryansk Auto",
    "url": "https://debryansk-auto.ru",
    "logo": "https://debryansk-auto.ru/favicon.svg",
    "foundingDate": "2011",
    "description": `Крупнейшая автомобильная группа компаний в Брянской области. ${totalBrands} брендов, 4 дилерских центра.`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Брянск",
      "addressRegion": "Брянская область",
      "addressCountry": "RU"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+74832631000",
      "contactType": "customer service",
      "availableLanguage": "Russian"
    },
    "sameAs": [
      "https://debryansk-auto.ru"
    ]
  };

  const stats = [
    { value: "2011",        label: "Год основания",    icon: Clock },
    { value: totalBrands,   label: "Брендов в группе", icon: Car },
    { value: "4",           label: "Дилерских центра",  icon: Building2 },
    { value: "15+",         label: "Лет на рынке",     icon: TrendingUp },
  ];

  return (
    <Layout>
      <SEO
        title={`О группе — Дебрянск Авто | ${totalBrands || 13} брендов, 4 центра в Брянске`}
        description={`Дебрянск Авто — крупнейший автодилер Брянска. ${totalBrands} брендов, 4 дилерских центра, 15 лет на рынке. Продажа, сервис, финансирование.`}
        canonical="/about"
        jsonLd={organizationSchema}
        breadcrumbs={[
          { name: "Главная", url: "/" },
          { name: "О группе", url: "/about" },
        ]}
      />

      <div>
        {/* Hero */}
        <section className="bg-[#0d0f14] text-white py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6">
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl"
            >
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">
                О компании
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-4">
                О группе компаний<br />
                <span className="text-[#4ade80]">Дебрянск Авто</span>
              </h1>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                Дебрянск Авто — крупнейшая автомобильная группа компаний в Брянской области.
                С 2011 года мы предоставляем полный спектр услуг для автомобилистов:
                от покупки нового авто до постгарантийного обслуживания.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 sm:mt-14"
            >
              {stats.map((s) => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
                  <s.icon className="w-5 h-5 text-[#4ade80] mb-3" />
                  <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-white/50 mt-1 font-semibold">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 sm:py-24 bg-white">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2">Ценности</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Почему выбирают нас</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {values.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-50 rounded-2xl border border-slate-100 p-6 sm:p-7"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <ReviewsSection />

        {/* Brands */}
        <section className="py-16 sm:py-24 bg-slate-50 border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary mb-2">Бренды</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Все бренды нашей группы</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
              {apiBrands.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="relative bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow"
                >
                  <p className="text-lg font-black text-slate-900">{b.name}</p>
                  {b.isServiceOnly && (
                    <span className="mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-md px-1.5 py-0.5 leading-none">
                      Сервис
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24 bg-primary text-white">
          <div className="container mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">
              Станьте частью территории автомобилей
            </h2>
            <p className="text-white/70 text-base max-w-xl mx-auto mb-8">
              Выберите свой идеальный автомобиль в каталоге дилерских центров Дебрянск Авто
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/new-cars" className="inline-flex items-center justify-center gap-2 bg-white text-primary font-bold px-6 py-3.5 rounded-xl hover:bg-slate-100 transition-colors">
                <Car className="w-4 h-4" />
                Новые автомобили
              </Link>
              <Link href="/cars" className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors border border-white/20">
                <Car className="w-4 h-4" />
                С пробегом
              </Link>
              <Link href="/service" className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors border border-white/20">
                <Wrench className="w-4 h-4" />
                Сервис и ТО
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
