import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Users, Award, Clock, Car, TrendingUp,
  CheckCircle, MapPin, Star, Building2
} from "lucide-react";
import SEO from "@/components/SEO";
import Layout from "@/components/Layout";

/* ─── Data ────────────────────────────────────────────────────────────────────────────────────── */
const stats = [
  { value: "2011", label: "Год основания", icon: Clock },
  { value: "9", label: "Автомобильных брендов", icon: Car },
  { value: "6", label: "Дилерских центров", icon: Building2 },
  { value: "15+", label: "Лет на рынке", icon: TrendingUp },
];

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

const brands = [
  { name: "CHERY",      since: "с 2022" },
  { name: "OMODA",      since: "с 2022" },
  { name: "JAECOO",     since: "с 2024" },
  { name: "HAVAL",      since: "с 2022" },
  { name: "TENET",      since: "с 2023" },
  { name: "JETOUR",     since: "с 2024" },
  { name: "Mercedes",   since: "с 2011" },
  { name: "С пробегом", since: "с 2011" },
];

/* ─── Page ────────────────────────────────────────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <Layout>
      <SEO
        title="О группе компаний Дебрянск Авто — территория автомобилей"
        description="Дебрянск Авто — крупнейший автодилер Брянска. 9 брендов, 6 дилерских центров, 15 лет на рынке. Продажа, сервис, финансирование."
        canonical="/about"
      />

      <div>
        {/* Hero */}
        <section className="bg-[#0d0f14] text-white py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl"
            >
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">
                О компании
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-4">
                Территория<br />
                <span className="text-[#4ade80]">Автомобилей</span>
              </h1>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                Дебрянск Авто — крупнейшая автомобильная группа компаний в Брянской области.
                С 2011 года мы предоставляем полный спектр услуг для автомобилистов:
                от покупки нового авто до постгарантийного обслуживания.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 sm:mt-14"
            >
              {stats.map((s, i) => (
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
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Ценности</p>
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
                  <div className="w-12 h-12 bg-[#0070b8]/10 rounded-xl flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-[#0070b8]" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Brands */}
        <section className="py-16 sm:py-24 bg-slate-50 border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Бренды</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Автомобильные бренды в нашей группе</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
              {brands.map((b, i) => (
                <motion.div
                  key={b.name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow"
                >
                  <p className="text-lg font-black text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{b.since}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24 bg-[#0070b8] text-white">
          <div className="container mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">
              Станьте частью территории автомобилей
            </h2>
            <p className="text-white/70 text-base max-w-xl mx-auto mb-8">
              Выберите свой идеальный автомобиль в каталоге дилерских центров Дебрянск Авто
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/new-cars" className="inline-flex items-center justify-center gap-2 bg-white text-[#0070b8] font-bold px-6 py-3.5 rounded-xl hover:bg-slate-100 transition-colors">
                <Car className="w-4 h-4" />
                Новые авто
              </Link>
              <Link href="/contacts" className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors border border-white/20">
                <MapPin className="w-4 h-4" />
                Контакты
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
