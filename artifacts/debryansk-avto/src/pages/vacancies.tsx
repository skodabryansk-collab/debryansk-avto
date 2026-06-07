import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Clock, Briefcase, ChevronRight, X,
  Phone, User, CheckCircle, Star, GraduationCap, TrendingUp, Heart,
  Paperclip, FileText
} from "lucide-react";
import miniLogo from "@/assets/mini-logo.webp";

/* ─── Types ──────────────────────────────────────────────────────────
   Designed for easy hh.ru API swap:
   - All fields map directly to hh.ru Vacancy object
   - hhId / hhUrl ready to attach when integration is connected
─────────────────────────────────────────────────────────────────── */
export interface Vacancy {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  schedule: string;
  experience: string;
  salaryFrom?: number;
  salaryTo?: number;
  location: string;
  description: string;
  duties: string[];
  requirements: string[];
  conditions: string[];
  hhId?: string;
  hhUrl?: string;
  source?: "hh" | "internal";
}

/* ─── hh.ru helpers ─────────────────────────────────────────────── */
const HH_EMPLOYER_ID = "2421744";
const HH_API = "https://api.hh.ru";

function guessDepartment(title: string): string {
  const t = title.toLowerCase();
  if (/продаж|менеджер|trade.in|трейд|выкуп/.test(t)) return "Продажи";
  if (/механик|мастер.консульт|сервис|кузов|детейл|шиномонт|техни/.test(t)) return "Сервис";
  if (/финанс|кредит|страхов|бухгалт/.test(t)) return "Финансы";
  return "Администрация";
}

function scheduleLabel(id?: string): string {
  const map: Record<string, string> = {
    fullDay: "5/2", shift: "Сменный", flexible: "Гибкий",
    remote: "Удалённо", flyInFlyOut: "Вахта",
  };
  return id ? (map[id] ?? id) : "";
}

function experienceLabel(id?: string): string {
  const map: Record<string, string> = {
    noExperience: "Без опыта", between1And3: "От 1 до 3 лет",
    between3And6: "От 3 до 6 лет", moreThan6: "Более 6 лет",
  };
  return id ? (map[id] ?? id) : "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Maps our API server response (parsed from hh.ru RSS + optional API enrichment)
function mapHhItem(item: any): Vacancy {
  return {
    id: `hh_${item.id}`,
    title: item.title ?? item.name ?? "",
    department: guessDepartment(item.title ?? item.name ?? ""),
    employmentType: item.employmentType ?? "Полная занятость",
    schedule: item.schedule ?? "",
    experience: item.experience ?? "",
    salaryFrom: item.salaryFrom ?? undefined,
    salaryTo: item.salaryTo ?? undefined,
    location: item.area ?? "Брянск",
    description: item.description ?? "",
    duties: [], requirements: [], conditions: [],
    hhId: String(item.id),
    hhUrl: item.url,
    source: "hh",
  };
}

/* ─── Static vacancy data ──────────────────────────────────────────
   Замените fetchVacancies() на запрос к /api/vacancies (hh.ru proxy),
   оставив интерфейс Vacancy неизменным.
─────────────────────────────────────────────────────────────────── */
const VACANCIES: Vacancy[] = [
  {
    id: "v1",
    title: "Менеджер по продажам новых автомобилей",
    department: "Продажи",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 1 года",
    salaryFrom: 80000,
    location: "Jaecoo / Omoda · Супонево",
    description: "Консультируем покупателей, помогаем с выбором и оформлением нового автомобиля. Работаем с тёплыми лидами и входящим потоком.",
    duties: [
      "Консультация клиентов в шоуруме и по телефону",
      "Ведение сделки от первого контакта до выдачи авто",
      "Работа с кредитными и страховыми продуктами",
      "Поддержание клиентской базы и повторные продажи",
    ],
    requirements: [
      "Опыт в продажах от 1 года (авто — преимущество)",
      "Уверенный пользователь ПК и CRM",
      "Грамотная речь, нацеленность на результат",
    ],
    conditions: [
      "Оклад от 80 000 ₽ + % от продаж (совокупный доход 120 000–200 000 ₽)",
      "Официальное трудоустройство, ДМС",
      "Обучение за счёт компании, стажировка у производителя",
      "Современный шоурум, корпоративные мероприятия",
    ],
  },
  {
    id: "v2",
    title: "Менеджер по продажам автомобилей с пробегом",
    department: "Продажи",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 1 года",
    salaryFrom: 70000,
    location: "Центр с пробегом · Супонево",
    description: "Принимаем и продаём автомобили с пробегом: оценка, выкуп, trade-in. Работаем с горячими заявками с сайта и авторынков.",
    duties: [
      "Оценка и приём автомобилей на trade-in и выкуп",
      "Продажа автомобилей с пробегом из наличия",
      "Публикация объявлений на площадках (Авито, Авто.ру)",
      "Сопровождение сделки, оформление документов",
    ],
    requirements: [
      "Знание рынка б/у автомобилей",
      "Опыт работы в продажах от 1 года",
      "Наличие водительского удостоверения",
    ],
    conditions: [
      "Оклад от 70 000 ₽ + бонус за каждую сделку",
      "Официальное оформление",
      "График 5/2 с плавающими выходными",
    ],
  },
  {
    id: "v3",
    title: "Специалист по trade-in и выкупу автомобилей",
    department: "Продажи",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 2 лет",
    salaryFrom: 65000,
    salaryTo: 100000,
    location: "Любой ДЦ · Брянск",
    description: "Проводим осмотр и оценку автомобилей клиентов для trade-in. Знание рынка и технической части обязательно.",
    duties: [
      "Осмотр, диагностика и оценка стоимости автомобилей",
      "Переговоры с клиентами по условиям обмена",
      "Работа с базой данных оценки (CarPrice, АвтоКод)",
      "Взаимодействие с отделом продаж по зачётным сделкам",
    ],
    requirements: [
      "Опыт оценки автомобилей от 2 лет",
      "Знание рыночных цен и технического состояния авто",
      "Водительское удостоверение категории B",
    ],
    conditions: [
      "Оклад 65 000 – 100 000 ₽ в зависимости от опыта",
      "ДМС, корпоративное обучение",
      "Служебный автомобиль при необходимости",
    ],
  },
  {
    id: "v4",
    title: "Менеджер по финансовым продуктам",
    department: "Финансы",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 1 года",
    salaryFrom: 75000,
    location: "Haval / Jetour · Брянск",
    description: "Оформляем кредиты, страховки и дополнительные услуги для покупателей автомобилей. Работаем с 15 банками-партнёрами.",
    duties: [
      "Подбор и оформление автокредитов от банков-партнёров",
      "Оформление страховых продуктов (КАСКО, ОСАГО)",
      "Консультация клиентов по финансовым программам",
      "Взаимодействие с банками и страховыми компаниями",
    ],
    requirements: [
      "Опыт в банковских продуктах или страховании от 1 года",
      "Аналитический склад ума, внимательность к деталям",
      "Знание 1С или аналогичных систем",
    ],
    conditions: [
      "Оклад от 75 000 ₽ + % с каждого оформленного продукта",
      "Обучение по продуктам банков-партнёров за счёт компании",
      "Официальное трудоустройство, ДМС",
    ],
  },
  {
    id: "v5",
    title: "Мастер-консультант сервисной зоны",
    department: "Сервис",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 2 лет",
    salaryFrom: 70000,
    location: "Любой ДЦ · Брянск",
    description: "Принимаем автомобили в сервис, координируем ремонт, общаемся с клиентами. Технический бэкграунд или опыт в автосервисе обязательны.",
    duties: [
      "Приём автомобилей, оформление заказ-нарядов",
      "Консультация клиентов по видам и стоимости работ",
      "Координация работы механиков, контроль сроков",
      "Выдача готовых автомобилей и расчёт с клиентами",
    ],
    requirements: [
      "Опыт работы в автосервисе от 2 лет",
      "Технические знания устройства автомобиля",
      "Коммуникабельность, стрессоустойчивость",
    ],
    conditions: [
      "Оклад от 70 000 ₽ + бонус за KPI",
      "Официальный дилерский сервис, современное оборудование",
      "Обучение и сертификация от производителя",
    ],
  },
  {
    id: "v6",
    title: "Автомеханик",
    department: "Сервис",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 1 года",
    salaryFrom: 60000,
    salaryTo: 110000,
    location: "Любой ДЦ · Брянск",
    description: "Выполняем техническое обслуживание и ремонт автомобилей в официальном дилерском сервисе. Работаем на современном оборудовании.",
    duties: [
      "Техническое обслуживание (ТО) по регламенту",
      "Диагностика и устранение неисправностей",
      "Гарантийный и постгарантийный ремонт",
      "Работа с фирменным диагностическим оборудованием",
    ],
    requirements: [
      "Профильное техническое образование",
      "Опыт работы автомехаником от 1 года",
      "Знание устройства современных автомобилей",
    ],
    conditions: [
      "Сдельная оплата 60 000 – 110 000 ₽",
      "Официальное трудоустройство, спецодежда",
      "Фирменный инструмент и оборудование",
      "Обучение и сертификация от брендов",
    ],
  },
  {
    id: "v7",
    title: "Администратор дилерского центра",
    department: "Администрация",
    employmentType: "Полная занятость",
    schedule: "2/2",
    experience: "Без опыта",
    salaryFrom: 45000,
    salaryTo: 55000,
    location: "Любой ДЦ · Брянск",
    description: "Встречаем клиентов, отвечаем на звонки, помогаем с навигацией по ДЦ. Лицо нашего дилерского центра.",
    duties: [
      "Встреча и первичная консультация клиентов",
      "Приём входящих звонков и переключение на специалистов",
      "Ведение записи на сервис и тест-драйв",
      "Поддержание порядка в клиентской зоне",
    ],
    requirements: [
      "Приятная внешность и грамотная речь",
      "Уверенный пользователь ПК",
      "Стрессоустойчивость, доброжелательность",
    ],
    conditions: [
      "Оклад 45 000 – 55 000 ₽",
      "График 2/2, возможность сменного графика",
      "Форменная одежда за счёт компании",
    ],
  },
  {
    id: "v8",
    title: "HR-специалист",
    department: "Администрация",
    employmentType: "Полная занятость",
    schedule: "5/2",
    experience: "От 2 лет",
    salaryFrom: 55000,
    salaryTo: 75000,
    location: "Головной офис · Брянск",
    description: "Подбираем персонал для всех дилерских центров холдинга, ведём адаптацию и развитие сотрудников.",
    duties: [
      "Полный цикл подбора персонала (от заявки до выхода)",
      "Размещение вакансий на hh.ru и других площадках",
      "Проведение собеседований, оценка кандидатов",
      "Адаптация новых сотрудников, кадровое делопроизводство",
    ],
    requirements: [
      "Опыт в подборе персонала от 2 лет",
      "Знание трудового законодательства",
      "Опыт работы с hh.ru и другими job-площадками",
    ],
    conditions: [
      "Оклад 55 000 – 75 000 ₽",
      "Официальное трудоустройство, ДМС",
      "Работа с коллективом 200+ человек",
    ],
  },
];

const DEPARTMENTS = ["Все отделы", "Продажи", "Сервис", "Финансы", "Администрация"];

const DEPT_COLORS: Record<string, { bg: string; text: string }> = {
  "Продажи":      { bg: "#dbeafe", text: "#1d4ed8" },
  "Сервис":       { bg: "#dcfce7", text: "#15803d" },
  "Финансы":      { bg: "#fef9c3", text: "#854d0e" },
  "Администрация":{ bg: "#f3e8ff", text: "#6b21a8" },
};

function fmtSalary(from?: number, to?: number) {
  if (!from) return null;
  const f = from.toLocaleString("ru-RU");
  const t = to ? to.toLocaleString("ru-RU") : null;
  return t ? `${f} – ${t} ₽` : `от ${f} ₽`;
}

/* ─── Apply modal ─────────────────────────────────────────────── */
function ApplyModal({ vacancy, onClose }: { vacancy: Vacancy; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState<"info" | "apply">("info");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch full hh.ru vacancy details when modal opens
  const [hhDetails, setHhDetails] = useState<any>(null);
  const [hhLoading, setHhLoading] = useState(false);
  useEffect(() => {
    if (!vacancy.hhId) return;
    setHhLoading(true);
    fetch(`${HH_API}/vacancies/${vacancy.hhId}`, {
      headers: { "Accept": "application/json" }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setHhDetails(d); setHhLoading(false); })
      .catch(() => setHhLoading(false));
  }, [vacancy.hhId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitted(true);
  }

  const dept = DEPT_COLORS[vacancy.department] ?? { bg: "#e2e8f0", text: "#334155" };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
        className="relative bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-2"
                style={{ background: dept.bg, color: dept.text }}>
                {vacancy.department}
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">{vacancy.title}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3 shrink-0" />
                {vacancy.location}
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors mt-0.5">
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Tabs */}
          {!submitted && (
            <div className="flex gap-1 mt-4 bg-slate-100 rounded-xl p-1">
              {(["info", "apply"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tab === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                  }`}>
                  {t === "info" ? "О вакансии" : "Откликнуться"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {submitted ? (
            <div className="p-10 text-center">
              <CheckCircle className="w-14 h-14 text-[#87b63c] mx-auto mb-4" />
              <h3 className="text-xl font-extrabold mb-2">Отклик отправлен!</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Мы свяжемся с вами в ближайшее время. Спасибо за интерес к нашей компании!
              </p>
              <button onClick={onClose}
                className="mt-6 w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm">
                Закрыть
              </button>
            </div>
          ) : tab === "info" ? (
            <div className="p-5 sm:p-6 space-y-5">
              {/* Key params */}
              <div className="flex flex-wrap gap-2">
                {vacancy.employmentType && (
                  <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600">
                    <Briefcase className="w-3 h-3" /> {vacancy.employmentType}
                  </span>
                )}
                {vacancy.schedule && (
                  <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600">
                    <Clock className="w-3 h-3" /> {vacancy.schedule}
                  </span>
                )}
                {vacancy.experience && (
                  <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600">
                    <GraduationCap className="w-3 h-3" /> {vacancy.experience}
                  </span>
                )}
              </div>

              {fmtSalary(vacancy.salaryFrom, vacancy.salaryTo) && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Зарплата</p>
                  <p className="text-xl font-extrabold text-[#0070b8]">{fmtSalary(vacancy.salaryFrom, vacancy.salaryTo)}</p>
                </div>
              )}

              {/* hh.ru full description */}
              {vacancy.source === "hh" ? (
                hhLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[80, 60, 90, 50, 70].map(w => (
                      <div key={w} className="h-3 bg-slate-100 rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : hhDetails?.description ? (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Описание вакансии</p>
                    <div
                      className="text-sm text-slate-700 leading-relaxed hh-description"
                      dangerouslySetInnerHTML={{ __html: hhDetails.description }}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Подробности доступны на странице вакансии.</p>
                )
              ) : (
                /* Static data blocks */
                [
                  { title: "Обязанности", items: vacancy.duties },
                  { title: "Требования",  items: vacancy.requirements },
                  { title: "Условия",     items: vacancy.conditions },
                ].map(block => block.items.length > 0 && (
                  <div key={block.title}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{block.title}</p>
                    <ul className="space-y-1.5">
                      {block.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8] shrink-0 mt-1.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}

              {/* hh.ru link */}
              {vacancy.hhUrl && (
                <a href={vacancy.hhUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-[#0070b8] transition-colors">
                  <span className="w-4 h-4 rounded bg-[#d6001c] flex items-center justify-center text-white font-extrabold text-[8px] shrink-0">hh</span>
                  Открыть на hh.ru
                </a>
              )}
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Ваше имя</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Телефон</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Резюме (необязательно)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={e => setResumeFile(e.target.files?.[0] ?? null)}
                  />
                  {resumeFile ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 border border-[#0070b8]/30 bg-[#0070b8]/5 rounded-xl">
                      <FileText className="w-4 h-4 text-[#0070b8] shrink-0" />
                      <span className="text-sm text-slate-700 truncate flex-1">{resumeFile.name}</span>
                      <button type="button" onClick={() => { setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center shrink-0 transition-colors">
                        <X className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-[#0070b8] hover:bg-[#0070b8]/5 rounded-xl py-3 text-sm text-slate-500 hover:text-[#0070b8] transition-all">
                      <Paperclip className="w-4 h-4" />
                      Прикрепить резюме (PDF, DOC)
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Комментарий (необязательно)</label>
                  <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Расскажите немного о себе…" rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8] transition-colors resize-none" />
                </div>
                <button type="submit"
                  className="w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm hover:opacity-90 transition-opacity mt-1">
                  Отправить отклик
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
                </p>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Vacancy Card ────────────────────────────────────────────── */
function VacancyCard({ vacancy, onOpen }: { vacancy: Vacancy; onOpen: () => void }) {
  const dept = DEPT_COLORS[vacancy.department] ?? { bg: "#e2e8f0", text: "#334155" };
  const salary = fmtSalary(vacancy.salaryFrom, vacancy.salaryTo);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all p-5 sm:p-6 flex flex-col gap-4 group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: dept.bg, color: dept.text }}>
          {vacancy.department}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
          <MapPin className="w-3 h-3" /> {vacancy.location.split("·")[1]?.trim() ?? vacancy.location}
        </span>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug group-hover:text-[#0070b8] transition-colors mb-2">
          {vacancy.title}
        </h3>
        {vacancy.description && (
          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{vacancy.description}</p>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {[vacancy.employmentType, vacancy.schedule, vacancy.experience].filter(Boolean).map((tag, i) => (
          <span key={`${tag}-${i}`} className="text-[11px] font-semibold bg-slate-50 border border-slate-100 rounded-full px-2.5 py-0.5 text-slate-600">
            {tag}
          </span>
        ))}
      </div>

      {/* Salary */}
      {salary && (
        <p className="text-lg sm:text-xl font-extrabold text-[#0070b8]">{salary}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={onOpen}
          className="flex-1 brand-gradient text-white font-bold rounded-xl py-2.5 text-sm hover:opacity-90 transition-opacity"
        >
          Откликнуться
        </button>
        <button
          onClick={onOpen}
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8] transition-colors text-slate-600"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.article>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function Vacancies() {
  const [, navigate] = useLocation();
  const [dept, setDept] = useState("Все отделы");
  const [activeVacancy, setActiveVacancy] = useState<Vacancy | null>(null);
  const [openApply, setOpenApply] = useState(false);
  const [openName, setOpenName] = useState("");
  const [openPhone, setOpenPhone] = useState("");
  const [openSubmitted, setOpenSubmitted] = useState(false);

  // Fetch vacancies from hh.ru (browser-side, no CORS issues)
  const [hhVacancies, setHhVacancies] = useState<Vacancy[]>([]);
  const [hhStatus, setHhStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/hh-vacancies")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const items: Vacancy[] = (data.items ?? []).map(mapHhItem);
        setHhVacancies(items);
        setHhStatus(items.length > 0 ? "ok" : "error");
      })
      .catch(() => setHhStatus("error"));
  }, []);

  // Use hh.ru data when available, static as fallback
  const vacancies = hhStatus === "ok" ? hhVacancies : VACANCIES;
  const isLoading = hhStatus === "loading";

  const filtered = useMemo(
    () => dept === "Все отделы" ? vacancies : vacancies.filter(v => v.department === dept),
    [dept, vacancies]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06] h-14 flex items-center px-4 sm:px-6 gap-4">
        <button onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Главная
        </button>
        <div className="flex-1" />
        <img src={miniLogo} alt="Дебрянск Авто" className="h-8 w-8 object-contain" />
      </header>

      <div className="pt-14">
        {/* ── Hero strip ── */}
        <div className="bg-[#0d0f14] text-white py-10 sm:py-14">
          <div className="container mx-auto px-4 sm:px-6">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#87b63c] mb-3">Карьера</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">
              Работайте с нами
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-lg mb-7">
              Дебрянск Авто — один из крупнейших автодилеров Брянска. Приглашаем в команду профессионалов.
            </p>
            {/* Benefits */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {[
                { icon: Star,        text: "Стабильная зарплата" },
                { icon: TrendingUp,  text: "Карьерный рост" },
                { icon: GraduationCap, text: "Обучение за счёт компании" },
                { icon: Heart,       text: "ДМС и соцпакет" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 bg-white/[0.07] border border-white/[0.1] rounded-full px-3 py-1.5 text-xs font-semibold text-white/80">
                  <Icon className="w-3.5 h-3.5 text-[#87b63c]" /> {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">

          {/* Source badge */}
          {hhStatus === "ok" && (
            <div className="flex items-center gap-2 mb-5 text-xs text-slate-400">
              <span className="w-4 h-4 rounded bg-[#d6001c] flex items-center justify-center text-white font-extrabold text-[8px] shrink-0">hh</span>
              Данные загружены с hh.ru · обновляются автоматически
            </div>
          )}

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-7 -mx-4 px-4 sm:mx-0 sm:px-0"
            style={{ scrollbarWidth: "none" }}>
            {DEPARTMENTS.map(d => (
              <button key={d} onClick={() => setDept(d)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap ${
                  dept === d
                    ? "bg-[#0070b8] text-white border-[#0070b8] shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-[#0070b8] hover:text-[#0070b8]"
                }`}>
                {d}
                <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  dept === d ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {isLoading ? "…" : d === "Все отделы" ? vacancies.length : vacancies.filter(v => v.department === d).length}
                </span>
              </button>
            ))}
          </div>

          {/* Count */}
          {!isLoading && (
            <p className="text-sm text-slate-500 mb-5">
              {filtered.length} {filtered.length === 1 ? "вакансия" : filtered.length < 5 ? "вакансии" : "вакансий"}
            </p>
          )}

          {/* Cards grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 animate-pulse space-y-3">
                    <div className="flex justify-between">
                      <div className="h-5 w-20 bg-slate-100 rounded-full" />
                      <div className="h-4 w-16 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-100 rounded" />
                    <div className="h-4 w-full bg-slate-100 rounded" />
                    <div className="h-4 w-2/3 bg-slate-100 rounded" />
                    <div className="flex gap-1.5">
                      <div className="h-5 w-28 bg-slate-100 rounded-full" />
                      <div className="h-5 w-10 bg-slate-100 rounded-full" />
                      <div className="h-5 w-20 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-6 w-32 bg-slate-100 rounded" />
                    <div className="h-9 w-full bg-slate-100 rounded-xl" />
                  </div>
                ))
              : filtered.map(v => (
                  <VacancyCard key={v.id} vacancy={v} onOpen={() => setActiveVacancy(v)} />
                ))
            }
          </div>

          {/* Open application CTA */}
          <div className="mt-12 sm:mt-16 bg-gradient-to-r from-[#0070b8] to-[#005fa0] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div>
              <h3 className="text-white font-extrabold text-lg sm:text-xl mb-1">Не нашли подходящую вакансию?</h3>
              <p className="text-blue-200 text-sm">Отправьте резюме — мы свяжемся при появлении подходящей позиции</p>
            </div>
            <button
              onClick={() => setOpenApply(true)}
              className="shrink-0 bg-white text-[#0070b8] font-bold rounded-xl px-6 py-3 text-sm hover:bg-blue-50 transition-colors">
              Отправить резюме
            </button>
          </div>
        </div>
      </div>

      {/* ── Vacancy detail / apply modal ── */}
      <AnimatePresence>
        {activeVacancy && (
          <ApplyModal vacancy={activeVacancy} onClose={() => setActiveVacancy(null)} />
        )}
      </AnimatePresence>

      {/* ── Open application modal ── */}
      <AnimatePresence>
        {openApply && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpenApply(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <button onClick={() => setOpenApply(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
              {openSubmitted ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-12 h-12 text-[#87b63c] mx-auto mb-3" />
                  <h3 className="font-extrabold text-lg mb-2">Резюме получено!</h3>
                  <p className="text-slate-500 text-sm">Свяжемся с вами при появлении подходящей позиции.</p>
                  <button onClick={() => { setOpenApply(false); setOpenSubmitted(false); }}
                    className="mt-5 w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm">
                    Закрыть
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-extrabold mb-1">Открытый отклик</h3>
                  <p className="text-slate-500 text-sm mb-5">Рассмотрим ваше резюме для будущих вакансий</p>
                  <form onSubmit={e => { e.preventDefault(); setOpenSubmitted(true); }} className="space-y-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={openName} onChange={e => setOpenName(e.target.value)} placeholder="Ваше имя" required
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8]" />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={openPhone} onChange={e => setOpenPhone(e.target.value)} placeholder="Телефон" required
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0070b8]" />
                    </div>
                    <button type="submit"
                      className="w-full brand-gradient text-white font-bold rounded-xl py-3 text-sm">
                      Отправить
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
