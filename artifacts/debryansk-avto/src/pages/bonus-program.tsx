import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car, Percent, Gift, TrendingUp, Users, Wrench,
  CheckCircle, ChevronRight, AlertCircle, MapPin, ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import FaqBlock from "@/components/FaqBlock";
import { CTPhone } from "@/components/CTPhone";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Perk { icon: string; title: string; description: string; }
interface DiscountLevel { level: number; name: string; threshold: number; percent: number; color: string; }
interface BonusAction { title: string; items: string[]; }
interface RulesSection { title: string; items: string[]; }
interface BonusData {
  hero_title: string;
  hero_description: string;
  perks: Perk[];
  discount_levels: DiscountLevel[];
  redemption_rules: string[];
  bonus_actions: BonusAction[];
  important_notes: string;
  full_rules_sections: RulesSection[];
}

/* ── Icon map ────────────────────────────────────────────────────────────── */
const ICON_MAP: Record<string, React.ElementType> = {
  Car, Percent, Gift, TrendingUp, Users, Wrench,
};

/* ── Defaults ────────────────────────────────────────────────────────────── */
const DEFAULT: BonusData = {
  hero_title: "Бонусная программа Дебрянск Авто",
  hero_description:
    "Копите бонусные баллы при каждом обращении на сервис и оплачивайте ими часть стоимости следующего заказ-наряда. Чем больше вы с нами — тем выгоднее.",
  perks: [
    { icon: "Car",        title: "Бонусы за покупку авто",   description: "10 000 баллов за первый новый автомобиль, 20 000 за повторную покупку, 5 000 за автомобиль с пробегом." },
    { icon: "Wrench",     title: "10% за каждый визит",      description: "10% от суммы любого заказ-наряда (ТО, ремонт, запчасти, аксессуары) начисляется на бонусный счёт." },
    { icon: "Percent",    title: "Списание по уровню",       description: "Оплачивайте бонусами от 5% до 10% стоимости заказ-наряда в зависимости от вашего уровня." },
    { icon: "TrendingUp", title: "Накопительные уровни",     description: "Базовая ставка списания — 5%. Накапливайте обороты сервиса и увеличивайте процент шаг за шагом до 10%." },
    { icon: "Users",      title: "Приведи друга",            description: "Получите 5 000 баллов за каждого нового клиента, который обратится к нам по вашей рекомендации." },
    { icon: "Gift",       title: "Фиксированные бонусы",     description: "2 500 баллов при первом визите, 4 000 за прохождение 4 ТО, 1 000 за выполнение рекомендаций мастера." },
  ],
  discount_levels: [
    { level: 1, name: "Базовый",   threshold: 0,      percent: 5,  color: "#6b7280" },
    { level: 2, name: "Уровень 2", threshold: 50000,  percent: 6,  color: "#60a5fa" },
    { level: 3, name: "Уровень 3", threshold: 100000, percent: 7,  color: "#3b82f6" },
    { level: 4, name: "Уровень 4", threshold: 150000, percent: 8,  color: "#f59e0b" },
    { level: 5, name: "Уровень 5", threshold: 200000, percent: 9,  color: "#f97316" },
    { level: 6, name: "Максимум",  threshold: 250000, percent: 10, color: "#0070b8" },
  ],
  redemption_rules: [
    "Техническое обслуживание и текущий ремонт — до 10%",
    "Покупка запасных частей через магазин — до 10%",
    "Дополнительное оборудование и аксессуары — до 10%",
    "Страхование КАСКО — до 5% (не более 10 000 руб.)",
    "Заказ услуг при заезде со своими запчастями — до 5%",
  ],
  bonus_actions: [
    {
      title: "Покупка автомобиля",
      items: [
        "Новый автомобиль (первая покупка) — 10 000 баллов",
        "Повторная покупка нового или автомобиля с пробегом — 20 000 баллов",
        "Автомобиль с пробегом (новый клиент) — 5 000 баллов",
        "При оплате через СБП — дополнительно 5% от стоимости",
      ],
    },
    {
      title: "Сервисное обслуживание",
      items: [
        "Слесарный ремонт, ТО, установка доп. оборудования — 10% от суммы заказ-наряда",
        "Покупка оригинальных запасных частей и аксессуаров — 10% от суммы",
        "Страхование (КАСКО полный, ОСАГО) — 5% от суммы договора",
        "При оплате через СБП — дополнительные 5% к стандартному начислению",
      ],
    },
    {
      title: "Фиксированные начисления",
      items: [
        "Приветственные баллы при первом визите на сервис — 2 500 баллов",
        "За прохождение четырёх ТО по регламенту производителя — 4 000 баллов",
        "Выполнение работ из рекомендаций предыдущего заказ-наряда — 1 000 баллов",
        "Акция «Приведи друга» в отдел продаж — 5 000 баллов",
      ],
    },
  ],
  important_notes:
    "Бонусные единицы не являются платёжным средством и не обмениваются на наличные. По истечении 12 месяцев от последнего платного посещения баллы замораживаются на 6 месяцев — их можно разблокировать при следующем обращении в любой центр группы. Списание при кузовном ремонте и при покупке шин и дисков не производится. Бонусами нельзя оплатить услуги в рамках акций и специальных предложений. Организатор программы — ООО «Дебрянск Авто».",
  full_rules_sections: [
    {
      title: "1. Общие положения",
      items: [
        "Бонусная программа «Дебрянск Авто» действует на всех дилерских центрах группы компаний бессрочно (до отдельного уведомления).",
        "Участником программы может стать физическое лицо при покупке автомобиля или обращении в сервис.",
        "Каждому участнику выпускается виртуальная бонусная карта с индивидуальным номером. Ею может воспользоваться любой член семьи при обслуживании автомобиля клиента.",
        "1 бонусная единица = 1 рублю.",
      ],
    },
    {
      title: "2. Начисление бонусов",
      items: [
        "Слесарный ремонт, ТО, доп. оборудование (сервис), покупка ЗЧ и аксессуаров — 10% от суммы.",
        "Страхование (КАСКО полный, ОСАГО) — 5% от суммы договора.",
        "При оплате через СБП — дополнительно 5% к стандартному начислению.",
        "Бонусы не начисляются: при кузовном ремонте, оплачиваемом страховой компанией; при бесплатном осмотре по Trade-in; в рамках акций и специальных предложений.",
      ],
    },
    {
      title: "3. Использование (списание) бонусов",
      items: [
        "ТО, текущий ремонт, покупка ЗЧ/аксессуаров/доп. оборудования — до 10% от стоимости заказ-наряда.",
        "Страхование (КАСКО) — до 5%, но не более 10 000 руб.",
        "Услуги при заезде со своими запчастями — до 5% от стоимости работ.",
        "Списание при кузовном ремонте не осуществляется.",
        "Списание при покупке шин и дисков не осуществляется.",
        "Нельзя оплатить бонусами товары и услуги из акционных и специальных предложений.",
      ],
    },
    {
      title: "4. Уровни и процент списания",
      items: [
        "Базовый уровень (с момента создания карты) — списание 5% от заказ-наряда.",
        "Уровни повышаются накопительно с момента создания карты по сумме коммерческих ремонтов.",
        "+50 000 ₽ → 6% | +100 000 ₽ → 7% | +150 000 ₽ → 8% | +200 000 ₽ → 9% | +250 000 ₽ → 10%.",
        "Учитываются: ТО, текущий ремонт, доп. оборудование (сервис), покупка ЗЧ и аксессуаров.",
      ],
    },
    {
      title: "5. Блокировка и срок действия",
      items: [
        "По истечении 12 месяцев от последнего платного посещения баллы замораживаются на 6 месяцев.",
        "В течение 6 месяцев клиент может разблокировать баллы, обратившись в любой центр группы.",
        "По истечении 6 месяцев заморозки бонусные единицы аннулируются.",
        "При возврате товара или отказе от услуги начисленные баллы списываются с карты.",
      ],
    },
  ],
};

const fmt = new Intl.NumberFormat("ru-RU");

async function fetchBonusProgram(): Promise<BonusData | null> {
  const r = await fetch("/api/bonus-program");
  if (!r.ok) return null;
  const json = await r.json();
  return json.data ?? null;
}

export default function BonusProgramPage() {
  const { data: remote } = useQuery({
    queryKey: ["bonus-program"],
    queryFn: fetchBonusProgram,
    staleTime: 5 * 60 * 1000,
  });

  const d: BonusData = remote ?? DEFAULT;

  const breadcrumbs = [
    { name: "Главная", url: "/" },
    { name: "Сервис", url: "/service" },
    { name: "Бонусная программа", url: "/service/bonus" },
  ];

  return (
    <Layout>
      <SEO
        title="Бонусная программа — Дебрянск Авто | Копите и тратьте бонусы"
        description="Бонусная программа автодилера «Дебрянск Авто» в Брянске. Начисление 10% от заказ-наряда на сервис. Списание от 5% до 10% в зависимости от накопительного уровня."
        canonical="/service/bonus"
        breadcrumbs={breadcrumbs}
      />

      {/* ── Breadcrumbs ──────────────────────────────────────────────── */}
      <nav className="bg-slate-50 border-b border-slate-100" aria-label="Навигация">
        <div className="container mx-auto px-4 sm:px-6 py-2.5">
          <ol className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
            <li><Link href="/" className="hover:text-[#0070b8] transition-colors">Главная</Link></li>
            <li><ChevronRight className="w-3 h-3 shrink-0" /></li>
            <li><Link href="/service" className="hover:text-[#0070b8] transition-colors">Сервис</Link></li>
            <li><ChevronRight className="w-3 h-3 shrink-0" /></li>
            <li className="text-slate-800 font-medium">Бонусная программа</li>
          </ol>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-[#0d1b2e] via-[#0a2540] to-[#0070b8] text-white py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,#ffffff_0%,transparent_60%)]" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-3xl text-center">
          <span className="inline-block bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
            Программа лояльности для клиентов сервиса
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-5 leading-tight">
            {d.hero_title}
          </h1>
          <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-2xl mx-auto">
            {d.hero_description}
          </p>
          <div className="mt-8">
            <CTPhone
              className="inline-flex items-center gap-2 bg-white text-[#0070b8] font-bold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-lg text-sm"
              phone="+7 (4832) 77-77-70">
              Узнать подробности
            </CTPhone>
          </div>
        </div>
      </section>

      {/* ── Perks ────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-2 text-center">
            Программа
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">
            Почему выгодно участвовать
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {d.perks.map((perk, i) => {
              const Icon = ICON_MAP[perk.icon] ?? Gift;
              const bgColors = [
                "bg-blue-50 border-blue-100 hover:border-blue-200",
                "bg-teal-50 border-teal-100 hover:border-teal-200",
                "bg-amber-50 border-amber-100 hover:border-amber-200",
                "bg-indigo-50 border-indigo-100 hover:border-indigo-200",
                "bg-emerald-50 border-emerald-100 hover:border-emerald-200",
                "bg-rose-50 border-rose-100 hover:border-rose-200",
              ];
              const iconColors = [
                "bg-blue-100 text-blue-600",
                "bg-teal-100 text-teal-600",
                "bg-amber-100 text-amber-600",
                "bg-indigo-100 text-indigo-600",
                "bg-emerald-100 text-emerald-600",
                "bg-rose-100 text-rose-600",
              ];
              const bgCls = bgColors[i % bgColors.length];
              const iconCls = iconColors[i % iconColors.length];
              return (
                <div
                  key={i}
                  className={`flex gap-4 p-5 sm:p-6 rounded-2xl border ${bgCls} hover:shadow-sm transition-all`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1 text-sm sm:text-base">
                      {perk.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {perk.description}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 p-5 sm:p-6 rounded-2xl border border-[#87b63c]/20 bg-[#87b63c]/5 hover:border-[#87b63c]/30 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#87b63c]/15 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-[#87b63c]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 text-sm sm:text-base">
                  Во всех 4 центрах
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Бонусная карта действует в любом дилерском центре группы. Накопленные баллы работают везде одинаково.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Customer journey ───────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-[#0070b8] text-white border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-2 text-center">
            Ваша выгода по бонусной программе
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
            <div className="bg-white/10 rounded-2xl p-5 sm:p-6 border border-white/15 backdrop-blur-sm text-center">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-widest mb-3">Год 1 — ТО</p>
              <p className="text-3xl font-extrabold mb-1">15 000 ₽</p>
              <p className="text-sm text-white/50">заказ-наряд</p>
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
                <p className="text-sm">Списано <span className="font-extrabold text-[#87b63c]">1 500 ₽</span></p>
                <p className="text-sm">+Начислено <span className="font-extrabold text-[#87b63c]">1 500 ₽</span></p>
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5 sm:p-6 border border-white/15 backdrop-blur-sm text-center">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-widest mb-3">Год 2 — ТО</p>
              <p className="text-3xl font-extrabold mb-1">20 000 ₽</p>
              <p className="text-sm text-white/50">заказ-наряд</p>
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
                <p className="text-sm">Списано <span className="font-extrabold text-[#87b63c]">2 000 ₽</span></p>
                <p className="text-sm">+Начислено <span className="font-extrabold text-[#87b63c]">2 000 ₽</span></p>
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5 sm:p-6 border border-white/15 backdrop-blur-sm text-center">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-widest mb-3">Год 3 — ТО</p>
              <p className="text-3xl font-extrabold mb-1">25 000 ₽</p>
              <p className="text-sm text-white/50">заказ-наряд</p>
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
                <p className="text-sm">Списано <span className="font-extrabold text-[#87b63c]">2 500 ₽</span></p>
                <p className="text-sm">+Начислено <span className="font-extrabold text-[#87b63c]">2 500 ₽</span></p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0070b8] mb-2">Итого ваша выгода</p>
            <p className="text-4xl sm:text-5xl font-extrabold text-[#0070b8] mb-2">6 000 ₽</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Сумма выгоды за 3 года обслуживания (только списания бонусов на ТО)</p>
          </div>
          <p className="mt-4 text-center text-xs text-white/40">
            * Расчёт является предварительным. Фактические суммы зависят от уровня программы и объёма заказ-наряда.
          </p>
        </div>
      </section>

      {/* ── Discount levels ──────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-slate-50 border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-2 text-center">
            Уровни
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">
            Накопительная система
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {d.discount_levels.map((lvl) => (
              <div
                key={lvl.level}
                className="relative bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 text-center shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ backgroundColor: lvl.color }}
                />
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-3 mt-1"
                  style={{ color: lvl.color }}
                >
                  {lvl.name}
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mb-1">
                  {lvl.percent}%
                </p>
                <p className="text-[10px] text-slate-500 mb-3">списание</p>
                <div className="text-[10px] text-slate-400 bg-slate-50 rounded-lg px-2 py-1.5">
                  {lvl.threshold === 0
                    ? "Старт"
                    : `от ${fmt.format(lvl.threshold)} ₽`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Redemption rules ─────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-2">
                Применение
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-4">
                Где списывать бонусы
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Бонусные рубли принимаются в любом из четырёх дилерских центров группы «Дебрянск Авто» в счёт частичной оплаты следующих услуг:
              </p>
              <ul className="space-y-3">
                {d.redemption_rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle className="w-4.5 h-4.5 text-[#0070b8] shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-[#0070b8]/5 to-[#0070b8]/10 rounded-2xl p-8 border border-[#0070b8]/10">
              <p className="text-4xl font-extrabold text-[#0070b8] mb-2">до 10%</p>
              <p className="text-slate-700 font-bold mb-1">максимальное списание</p>
              <p className="text-sm text-slate-500">
                До 10% стоимости заказ-наряда можно оплатить бонусами. Базовый уровень — 5%.
              </p>
              <div className="mt-6 pt-6 border-t border-[#0070b8]/15">
                <p className="text-4xl font-extrabold text-[#0070b8] mb-2">10%</p>
                <p className="text-slate-700 font-bold mb-1">начисление за сервис</p>
                <p className="text-sm text-slate-500">
                  10% от суммы любого заказ-наряда зачисляется на ваш счёт автоматически.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bonus actions ────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-slate-50 border-t border-slate-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-2 text-center">
            Начисление
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">
            За что начисляются бонусы
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {d.bonus_actions.map((action, i) => (
              <AccordionItem
                key={i}
                value={`action-${i}`}
                className="border border-slate-200 rounded-xl px-4 sm:px-5 data-[state=open]:border-[#0070b8]/30 bg-white transition-colors"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-bold hover:no-underline py-4">
                  {action.title}
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ul className="space-y-2">
                    {action.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8] shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Important notes ──────────────────────────────────────────── */}
      {d.important_notes && (
        <section className="py-10 bg-amber-50 border-t border-amber-100">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">{d.important_notes}</p>
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <FaqBlock
        pageSlug="bonus-program"
        title="Вопросы о бонусной программе"
      />

      {/* ── Full rules ───────────────────────────────────────────────── */}
      {d.full_rules_sections.length > 0 && (
        <section className="py-14 sm:py-20 bg-slate-50 border-t border-slate-100">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#0070b8] mb-2 text-center">
              Документ
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">
              Полные правила программы
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              {d.full_rules_sections.map((section, i) => (
                <AccordionItem
                  key={i}
                  value={`rule-${i}`}
                  className="border border-slate-200 rounded-xl px-4 sm:px-5 data-[state=open]:border-[#0070b8]/30 bg-white"
                >
                  <AccordionTrigger className="text-left text-sm font-bold hover:no-underline py-4">
                    {section.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <ol className="space-y-2.5 list-none">
                      {section.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <span className="text-[#0070b8] font-bold text-xs shrink-0 mt-0.5">
                            {String(j + 1).padStart(2, "0")}
                          </span>
                          {item}
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="mt-6 text-center text-xs text-slate-400">
              Полный текст правил доступен в любом дилерском центре «Дебрянск Авто» по запросу.
            </p>
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-[#0070b8] text-white border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
            Стать участником бесплатно
          </h2>
          <p className="text-white/75 mb-8 text-sm sm:text-base">
            Просто обратитесь на ресепшен любого нашего центра — оформим карту за 5 минут.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <CTPhone
              className="inline-flex items-center justify-center gap-2 bg-white text-[#0070b8] font-bold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-md text-sm"
              phone="+7 (4832) 77-77-70">
              +7 (4832) 77-77-70
            </CTPhone>
            <Link
              href="/contacts"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-bold px-7 py-3.5 rounded-full hover:bg-white/10 transition-colors text-sm"
            >
              Адреса центров
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
