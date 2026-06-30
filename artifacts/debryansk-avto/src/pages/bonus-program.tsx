import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car, Percent, Gift, TrendingUp, Users, Wrench,
  CheckCircle, ChevronRight, AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import FaqBlock from "@/components/FaqBlock";
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
    "Копите бонусные рубли при каждой покупке и сервисном обслуживании — тратьте их на следующие визиты. Чем больше вы с нами, тем выгоднее каждая поездка.",
  perks: [
    { icon: "Car",        title: "Бонусы за покупку авто",   description: "Получите 3–5% бонусами от стоимости нового автомобиля на карту участника программы." },
    { icon: "Wrench",     title: "Бонусы за сервис",         description: "1% от стоимости каждого сервисного обслуживания зачисляется на бонусный счёт." },
    { icon: "Percent",    title: "Скидка до 15%",            description: "Оплачивайте бонусами до 15% стоимости любого заказ-наряда в нашем сервисе." },
    { icon: "TrendingUp", title: "Накопительные уровни",     description: "Чем больше вы тратите, тем выше уровень и процент начисляемых бонусов." },
    { icon: "Users",      title: "Приведи друга",            description: "Рекомендуйте нас — получите 5 000 бонусных рублей за каждого нового клиента." },
    { icon: "Gift",       title: "Подарки участникам",       description: "При переходе на новый уровень — приятный подарок от «Дебрянск Авто»." },
  ],
  discount_levels: [
    { level: 1, name: "Стандарт", threshold: 0,      percent: 3,  color: "#6b7280" },
    { level: 2, name: "Серебро",  threshold: 50000,  percent: 5,  color: "#9ca3af" },
    { level: 3, name: "Золото",   threshold: 150000, percent: 7,  color: "#f59e0b" },
    { level: 4, name: "Платина",  threshold: 500000, percent: 10, color: "#0070b8" },
  ],
  redemption_rules: [
    "Техническое обслуживание и ремонт",
    "Оригинальные запасные части и расходники",
    "Дополнительное оборудование и аксессуары",
    "Страховые продукты и финансовые услуги",
    "Оплата услуг кузовного центра",
  ],
  bonus_actions: [
    {
      title: "Покупка автомобиля",
      items: [
        "Новый автомобиль — 3% от стоимости покупки",
        "Автомобиль с пробегом — 1% от стоимости покупки",
        "При покупке в кредит через наш банк-партнёр — дополнительно +1%",
      ],
    },
    {
      title: "Сервисное обслуживание",
      items: [
        "Плановое ТО — 1% от стоимости работ",
        "Кузовной ремонт — 1% от стоимости заказ-наряда",
        "Прохождение диагностики — 500 бонусных рублей",
      ],
    },
    {
      title: "Дополнительные начисления",
      items: [
        "Регистрация в программе — 1 000 бонусных рублей",
        "День рождения участника — 2 000 бонусных рублей",
        "Рекомендация друга — 5 000 бонусных рублей",
      ],
    },
  ],
  important_notes:
    "Бонусные рубли не являются платёжным средством. Срок действия бонусов — 12 месяцев с момента начисления. Максимальная доля оплаты бонусами — 50% от стоимости заказ-наряда. Организатор программы — ООО «Дебрянск Авто». Приказ №474 от 01.10.2024.",
  full_rules_sections: [
    {
      title: "1. Общие положения",
      items: [
        "Бонусная программа «Дебрянск Авто» (далее — Программа) действует на основании Приказа №474 от 01.10.2024.",
        "Участником Программы может стать любое физическое лицо, совершившее покупку или воспользовавшееся услугами дилерских центров группы.",
        "Участие в Программе является бессрочным при условии совершения хотя бы одной операции за 12 месяцев.",
      ],
    },
    {
      title: "2. Начисление бонусов",
      items: [
        "Бонусы начисляются в течение 5 рабочих дней с момента завершения операции.",
        "Бонусы не начисляются на акционные предложения, если иное не указано в условиях акции.",
        "Максимальная сумма начисления бонусов за одну операцию — 50 000 бонусных рублей.",
      ],
    },
    {
      title: "3. Использование бонусов",
      items: [
        "Бонусы можно использовать для оплаты услуг и товаров в любом дилерском центре группы «Дебрянск Авто».",
        "Максимальная доля оплаты бонусами — 50% от стоимости заказ-наряда или покупки.",
        "Бонусы не обмениваются на наличные денежные средства.",
        "Срок действия начисленных бонусов — 12 месяцев с даты начисления.",
      ],
    },
    {
      title: "4. Уровни участника",
      items: [
        "Уровень участника определяется суммарным объёмом его расходов в дилерских центрах за последние 12 месяцев.",
        "Повышение уровня происходит автоматически при достижении порогового значения.",
        "Понижение уровня не предусмотрено в течение 12 месяцев с момента его присвоения.",
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
        description="Бонусная программа автодилера «Дебрянск Авто» в Брянске. Начисляем бонусы за покупку и сервис, оплачивайте ими до 50% услуг. Накопительные уровни по Приказу №474."
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
            Приказ №474 от 01.10.2024
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-5 leading-tight">
            {d.hero_title}
          </h1>
          <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-2xl mx-auto">
            {d.hero_description}
          </p>
          <div className="mt-8">
            <a
              href="tel:+74832777770"
              className="inline-flex items-center gap-2 bg-white text-[#0070b8] font-bold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-lg text-sm"
            >
              Узнать подробности
            </a>
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
              return (
                <div
                  key={i}
                  className="flex gap-4 p-5 sm:p-6 rounded-2xl border border-slate-100 hover:border-[#0070b8]/20 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0070b8]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#0070b8]" />
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
          </div>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {d.discount_levels.map((lvl) => (
              <div
                key={lvl.level}
                className="relative bg-white rounded-2xl border border-slate-100 p-6 text-center shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ backgroundColor: lvl.color }}
                />
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: lvl.color }}
                >
                  {lvl.name}
                </p>
                <p className="text-4xl font-extrabold text-slate-900 mb-1">
                  {lvl.percent}%
                </p>
                <p className="text-xs text-slate-500 mb-3">начисление бонусов</p>
                <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                  {lvl.threshold === 0
                    ? "Стартовый уровень"
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
              <p className="text-4xl font-extrabold text-[#0070b8] mb-2">50%</p>
              <p className="text-slate-700 font-bold mb-1">максимальная доля оплаты</p>
              <p className="text-sm text-slate-500">
                До половины стоимости любого заказ-наряда можно закрыть накопленными бонусами.
              </p>
              <div className="mt-6 pt-6 border-t border-[#0070b8]/15">
                <p className="text-4xl font-extrabold text-[#0070b8] mb-2">12 мес.</p>
                <p className="text-slate-700 font-bold mb-1">срок действия бонусов</p>
                <p className="text-sm text-slate-500">
                  С даты начисления. Используйте, не откладывая.
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
            <a
              href="tel:+74832777770"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#0070b8] font-bold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-md text-sm"
            >
              +7 (4832) 77-77-70
            </a>
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
