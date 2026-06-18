import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { formatPhone, isPhoneValid } from "@/hooks/usePhoneMask";
import { usePageCar } from "@/context/PageCarContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Compass, Phone, Car, Loader2, ChevronDown, ExternalLink, ThumbsUp, ThumbsDown, Shield, Sparkles } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

export interface ChatCarItem {
  id: string;
  mark: string;
  model: string;
  year: number;
  price: number;
  minPrice?: number;
  discount?: number;
  color: string;
  image: string;
  path: string;
  run: number;
  isNew: boolean;
}

interface QuickAction {
  label: string;
  action: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: string | null;
  cars?: ChatCarItem[];
  car_ids?: string[];
  messageId?: number | null;
  rating?: 1 | -1 | null;
  isStreaming?: boolean;
  queryHint?: string;
  quickActions?: QuickAction[];
  prefillModel?: string;
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Привет! Я Навигатор — ваш проводник по Территории Авто 🧭\n\nПомогу найти нужный автомобиль, подскажу адреса дилерских центров и расскажу об услугах. Что вас интересует?",
  action: null,
  cars: [],
};

const QUICK_QUESTIONS = [
  "Подобрать авто до 2 млн",
  "Какие новые бренды есть?",
  "Где ваши дилерские центры?",
  "Как сдать авто в трейд-ин?",
];

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return (price / 1_000_000).toFixed(2).replace(".", ",") + " млн ₽";
  }
  return price.toLocaleString("ru-RU") + " ₽";
}

/* ── Contextual streaming status ────────────────────────────── */
function getStatusMessages(queryHint: string): string[] {
  const q = queryHint.toLowerCase();
  if (/трейд.ин|обмен|выкуп|продать|продам|сдать/.test(q)) {
    return [
      "Оцениваю ваш автомобиль…",
      "Анализирую рыночную стоимость…",
      "Подбираю предложение по трейд-ин…",
      "Сверяю с актуальными данными…",
      "Готовлю условия обмена…",
      "Проверяю наличие подходящих вариантов…",
      "Финализирую ответ…",
    ];
  }
  if (/сервис|тех.?обслуж|ремонт|\bто\b|запись/.test(q)) {
    return [
      "Ищу информацию о сервисе…",
      "Проверяю расписание записи…",
      "Уточняю условия обслуживания…",
      "Сверяю данные дилерских центров…",
      "Подбираю подходящий центр…",
      "Анализирую информацию…",
      "Готовлю ответ…",
    ];
  }
  if (/авто|машин|подобрать|купить|найти|цена|стоит|бюджет|млн|тысяч|пробег|новый|б\/у/.test(q)) {
    return [
      "Ищу подходящие варианты…",
      "Анализирую каталог…",
      "Проверяю наличие в стоке…",
      "Сверяю актуальные цены…",
      "Сравниваю комплектации…",
      "Отбираю лучшие предложения…",
      "Формирую подборку…",
    ];
  }
  return [
    "Обрабатываю ваш запрос…",
    "Анализирую информацию…",
    "Сверяю данные дилерских центров…",
    "Подбираю актуальные сведения…",
    "Формирую ответ…",
    "Проверяю точность данных…",
    "Почти готово…",
  ];
}

function StreamingDots({ queryHint }: { queryHint?: string }) {
  const msgs = React.useMemo(() => getStatusMessages(queryHint ?? ""), [queryHint]);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 3000);
    return () => clearInterval(t);
  }, [msgs.length]);

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex items-center gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      <span className="text-xs text-slate-400 font-medium transition-all">{msgs[idx]}</span>
    </div>
  );
}

/* ── Message content renderer ───────────────────────────────── */
function MessageContent({ text, isStreaming, queryHint }: { text: string; isStreaming?: boolean; queryHint?: string }) {
  if (isStreaming && !text) {
    return <StreamingDots queryHint={queryHint} />;
  }

  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, pi) => {
        const isLast = pi === paragraphs.length - 1;
        const lines = para.split(/\n/);
        const isList = lines.every(l => l.startsWith("• ") || l.trim() === "");
        if (isList && lines.some(l => l.startsWith("• "))) {
          const listItems = lines.filter(l => l.startsWith("• "));
          return (
            <ul key={pi} className="space-y-1">
              {listItems.map((l, li) => {
                const isLastItem = isLast && li === listItems.length - 1;
                return (
                  <li key={li} className="flex gap-1.5 items-start">
                    <span className="text-[#0070b8] font-bold mt-0.5 shrink-0">•</span>
                    <span>
                      {renderInline(l.slice(2))}
                      {isStreaming && isLastItem && (
                        <span className="inline-block w-[2px] h-[1em] bg-[#0070b8] animate-pulse ml-0.5 align-middle rounded-sm" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return (
          <p key={pi} className="leading-relaxed">
            {lines.map((line, li) => {
              const isLastLine = isLast && li === lines.length - 1;
              return (
                <React.Fragment key={li}>
                  {li > 0 && <br />}
                  {renderInline(line)}
                  {isStreaming && isLastLine && (
                    <span className="inline-block w-[2px] h-[1em] bg-[#0070b8] animate-pulse ml-0.5 align-middle rounded-sm" />
                  )}
                </React.Fragment>
              );
            })}
          </p>
        );
      })}
      {isStreaming && (
        <div className="flex items-center gap-1 pt-0.5">
          <span className="text-[11px] text-slate-400 leading-none">Навигатор печатает</span>
          <span className="w-1 h-1 rounded-full bg-[#0070b8]/50 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1 h-1 rounded-full bg-[#0070b8]/50 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1 h-1 rounded-full bg-[#0070b8]/50 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function formatHistoryForEmail(messages: Message[]): string {
  return messages
    .filter(m => m.id !== "welcome" && !m.isStreaming && m.content.trim())
    .slice(-12)
    .map(m => m.role === "user"
      ? `Клиент: ${m.content.trim()}`
      : `Навигатор: ${m.content.trim().slice(0, 400)}`)
    .join("\n");
}

/* ── Car card ───────────────────────────────────────────────── */
function CarCard({ car }: { car: ChatCarItem }) {
  const totalDiscount = car.discount ?? 0;
  // Show this specific car's own price after its own discount — never use model-wide minPrice in the card
  const displayPrice = car.price - totalDiscount;
  const showFrom = totalDiscount > 0;
  return (
    <a
      href={car.path}
      className="flex bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:border-[#0070b8]/40 hover:shadow-md transition-all duration-200 group"
    >
      <div className="w-[90px] shrink-0 bg-slate-100 overflow-hidden relative" style={{ height: 72 }}>
        {car.image ? (
          <img
            src={car.image}
            alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Car className="w-7 h-7" />
          </div>
        )}
        <span className={`absolute top-1.5 left-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-md ${
          car.isNew ? "bg-[#87b63c] text-white" : "bg-slate-700/90 text-white"
        }`}>
          {car.isNew ? "NEW" : "Б/У"}
        </span>
        {totalDiscount > 0 && (
          <span className="absolute bottom-1 left-1 text-[8px] font-black px-1 py-0.5 rounded-md bg-red-500 text-white">
            −{formatPrice(totalDiscount)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center">
        <p className="text-[12px] font-bold text-slate-800 leading-tight truncate">
          {car.mark} {car.model}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-400">{car.year}</span>
          {!car.isNew && car.run > 0 && (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">
              {(car.run / 1000).toFixed(0)} тыс. км
            </span>
          )}
        </div>
        <p className="text-[13px] font-black text-[#0070b8] mt-1 leading-tight">
          {showFrom && <span className="text-[9px] font-semibold text-slate-400 mr-0.5">от</span>}
          {formatPrice(displayPrice)}
        </p>
      </div>
      <div className="flex items-center pr-3">
        <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
      </div>
    </a>
  );
}

/* ── Action button ──────────────────────────────────────────── */
function ActionButton({ action, onAction }: { action: string; onAction: (a: string) => void }) {
  if (action === "callback") {
    return (
      <button
        onClick={() => onAction("callback")}
        className="mt-3 inline-flex items-center gap-2 bg-[#0070b8] hover:bg-[#005fa0] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
      >
        <Phone className="w-3.5 h-3.5" />
        Заказать звонок
      </button>
    );
  }
  if (action === "testdrive") {
    return (
      <button
        onClick={() => onAction("testdrive")}
        className="mt-3 inline-flex items-center gap-2 bg-[#87b63c] hover:bg-[#73a030] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
      >
        <Car className="w-3.5 h-3.5" />
        Записаться на тест-драйв
      </button>
    );
  }
  return null;
}

/* ── Contact form card ──────────────────────────────────────── */
function ContactFormCard({ base, history }: { base: string; history?: Message[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (submitted) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
        <p className="text-xs font-bold text-emerald-700">✓ Заявка принята!</p>
        <p className="text-[11px] text-emerald-600 mt-0.5">Менеджер свяжется с вами в ближайшее время.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("type", "callback");
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      fd.append("source", "Навигатор (чат)");
      if (history?.length) fd.append("chatHistory", formatHistoryForEmail(history));
      const res = await fetch(`${base}/api/send-email`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("server");
      setSubmitted(true);
    } catch {
      setError("Ошибка. Позвоните: +7 (4832) 77 77 70");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Оставьте контакты</p>
      <input
        placeholder="Ваше имя"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="+7 (___) ___-__-__"
        type="tel" inputMode="tel" maxLength={18}
        value={phone}
        onChange={e => setPhone(formatPhone(e.target.value))}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !isPhoneValid(phone)}
        className="w-full text-xs font-bold text-white bg-[#0070b8] hover:bg-[#005fa0] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Отправить"}
      </button>
    </form>
  );
}

/* ── Test-drive form card (inline, no redirect) ─────────────── */
function TestDriveFormCard({ base, prefillModel, history }: { base: string; prefillModel?: string; history?: Message[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [model, setModel] = useState(prefillModel ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const maxDateStr = useMemo(() => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0], []);
  const timeSlots = ["9:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

  if (submitted) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
        <p className="text-xs font-bold text-emerald-700">✓ Заявка принята!</p>
        <p className="text-[11px] text-emerald-600 mt-0.5">Менеджер свяжется с вами для подтверждения.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("type", "testdrive");
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      if (model.trim()) fd.append("model", model.trim());
      if (date) fd.append("preferredDate", date);
      if (time) fd.append("preferredTime", time);
      fd.append("source", "Навигатор (чат)");
      if (history?.length) fd.append("chatHistory", formatHistoryForEmail(history));
      const res = await fetch(`${base}/api/send-email`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("server");
      setSubmitted(true);
    } catch {
      setError("Ошибка. Позвоните: +7 (4832) 77 77 70");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Запись на тест-драйв</p>
      <input
        placeholder="Ваше имя"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#87b63c]/60 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="+7 (___) ___-__-__"
        type="tel" inputMode="tel" maxLength={18}
        value={phone}
        onChange={e => setPhone(formatPhone(e.target.value))}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#87b63c]/60 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="Интересующая модель (необязательно)"
        value={model}
        onChange={e => setModel(e.target.value)}
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#87b63c]/60 bg-white placeholder:text-slate-300"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          min={todayStr}
          max={maxDateStr}
          className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#87b63c]/60 bg-white text-slate-700"
        />
        <select
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full text-xs rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-[#87b63c]/60 bg-white text-slate-700"
        >
          <option value="">Время</option>
          {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !isPhoneValid(phone)}
        className="w-full text-xs font-bold text-white bg-[#87b63c] hover:bg-[#73a030] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Записаться на тест-драйв"}
      </button>
    </form>
  );
}

/* ── Service form card ───────────────────────────────────────── */
function ServiceFormCard({ base, history }: { base: string; history?: Message[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (submitted) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
        <p className="text-xs font-bold text-emerald-700">✓ Заявка принята!</p>
        <p className="text-[11px] text-emerald-600 mt-0.5">Менеджер сервиса свяжется с вами в ближайшее время.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("type", "service");
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      if (comment.trim()) fd.append("comment", comment.trim());
      fd.append("source", "Навигатор (чат)");
      if (history?.length) fd.append("chatHistory", formatHistoryForEmail(history));
      const res = await fetch(`${base}/api/send-email`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("server");
      setSubmitted(true);
    } catch {
      setError("Ошибка. Позвоните: +7 (4832) 77 77 70");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Запись на сервис</p>
      <input
        placeholder="Ваше имя"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="+7 (___) ___-__-__"
        type="tel" inputMode="tel" maxLength={18}
        value={phone}
        onChange={e => setPhone(formatPhone(e.target.value))}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="Что нужно сделать? (необязательно)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !isPhoneValid(phone)}
        className="w-full text-xs font-bold text-white bg-[#0070b8] hover:bg-[#005fa0] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Записаться на сервис"}
      </button>
    </form>
  );
}

/* ── Credit form card ───────────────────────────────────────── */
function CreditFormCard({ base, prefillModel, history }: { base: string; prefillModel?: string; history?: Message[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [model, setModel] = useState(prefillModel ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (submitted) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
        <p className="text-xs font-bold text-emerald-700">✓ Заявка принята!</p>
        <p className="text-[11px] text-emerald-600 mt-0.5">Менеджер рассчитает условия кредита и свяжется с вами.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("type", "credit");
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      if (model.trim()) fd.append("model", model.trim());
      fd.append("source", "Навигатор (чат)");
      if (history?.length) fd.append("chatHistory", formatHistoryForEmail(history));
      const res = await fetch(`${base}/api/send-email`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("server");
      setSubmitted(true);
    } catch {
      setError("Ошибка. Позвоните: +7 (4832) 77 77 70");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Расчёт кредита</p>
      <input
        placeholder="Ваше имя"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="+7 (___) ___-__-__"
        type="tel" inputMode="tel" maxLength={18}
        value={phone}
        onChange={e => setPhone(formatPhone(e.target.value))}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="Интересующая модель (необязательно)"
        value={model}
        onChange={e => setModel(e.target.value)}
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !isPhoneValid(phone)}
        className="w-full text-xs font-bold text-white bg-[#0070b8] hover:bg-[#005fa0] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Рассчитать кредит"}
      </button>
    </form>
  );
}

/* ── Trade-in form card ──────────────────────────────────────── */
interface CmItem { id: string; name: string }
interface ChatModItem { id: string; name: string; drive: string; engineVolume: string; power: string; gear: string; complectation: string }
interface ChatModOptions {
  modifications: ChatModItem[];
  driveTypes: CmItem[];
  engineVolumes: CmItem[];
  powers: CmItem[];
  gearTypes: CmItem[];
  complectations: CmItem[];
}

function TradeInFormCard({ base, history }: { base: string; history?: Message[] }) {
  // Catalog data
  const [brands, setBrands] = useState<CmItem[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [models, setModels] = useState<CmItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [generations, setGenerations] = useState<CmItem[]>([]);
  const [generationsLoading, setGenerationsLoading] = useState(false);
  const [modOptions, setModOptions] = useState<ChatModOptions | null>(null);
  const [modOptionsLoading, setModOptionsLoading] = useState(false);

  // Selections
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [year, setYear] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [modification, setModification] = useState("");
  const [drive, setDrive] = useState("");
  const [engineVolume, setEngineVolume] = useState("");
  const [power, setPower] = useState("");
  const [gear, setGear] = useState("");
  const [complectation, setComplectation] = useState("");
  const [mileage, setMileage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<{ min: number; max: number } | null>(null);
  const [estimateFailed, setEstimateFailed] = useState(false);
  const [error, setError] = useState("");

  // Load brands on mount
  useEffect(() => {
    fetch(`${base}/api/car-catalog/cm-brands`)
      .then(r => r.json())
      .then(j => setBrands(j.ok ? (j.data ?? []) : []))
      .catch(() => {})
      .finally(() => setBrandsLoading(false));
  }, [base]);

  // Load models when brand changes
  useEffect(() => {
    if (!brandId) { setModels([]); return; }
    setModelsLoading(true);
    setModels([]);
    setModelId(""); setModelName("");
    setYears([]); setYear("");
    setGenerations([]); setGenerationId("");
    setModOptions(null);
    setModification(""); setDrive(""); setEngineVolume(""); setPower(""); setGear(""); setComplectation("");
    fetch(`${base}/api/car-catalog/cm-models?brand=${encodeURIComponent(brandId)}`)
      .then(r => r.json())
      .then(j => setModels(j.ok ? (j.data ?? []) : []))
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, [brandId, base]);

  // Load years when brand + model change
  useEffect(() => {
    if (!brandId || !modelId) { setYears([]); return; }
    setYearsLoading(true);
    setYears([]); setYear("");
    setGenerations([]); setGenerationId("");
    setModOptions(null);
    setModification(""); setDrive(""); setEngineVolume(""); setPower(""); setGear(""); setComplectation("");
    const qs = new URLSearchParams({ brand: brandId, model: modelId });
    fetch(`${base}/api/car-catalog/cm-years?${qs}`)
      .then(r => r.json())
      .then(j => setYears(j.ok ? (j.data ?? []) : []))
      .catch(() => {})
      .finally(() => setYearsLoading(false));
  }, [brandId, modelId, base]);

  // Load generations when brand + model + year change
  useEffect(() => {
    if (!brandId || !modelId) { setGenerations([]); return; }
    setGenerationsLoading(true);
    setGenerations([]); setGenerationId("");
    const qs = new URLSearchParams({ brand: brandId, model: modelId });
    if (year) qs.append("creationYear", year);
    fetch(`${base}/api/car-catalog/cm-generations?${qs}`)
      .then(r => r.json())
      .then(j => setGenerations(j.ok ? (j.data ?? []) : []))
      .catch(() => {})
      .finally(() => setGenerationsLoading(false));
  }, [brandId, modelId, year, base]);

  // Load modification options when brand + model + year change
  useEffect(() => {
    if (!brandId || !modelId || !year) { setModOptions(null); return; }
    setModOptionsLoading(true);
    setModOptions(null);
    setModification(""); setDrive(""); setEngineVolume(""); setPower(""); setGear(""); setComplectation("");
    const qs = new URLSearchParams({ brand: brandId, model: modelId, year });
    fetch(`${base}/api/car-catalog/cm-modifications-options?${qs}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) setModOptions({ modifications: j.modifications ?? [], driveTypes: j.driveTypes ?? [], engineVolumes: j.engineVolumes ?? [], powers: j.powers ?? [], gearTypes: j.gearTypes ?? [], complectations: j.complectations ?? [] });
        else setModOptions(null);
      })
      .catch(() => setModOptions(null))
      .finally(() => setModOptionsLoading(false));
  }, [brandId, modelId, year, base]);

  const handleEngineVolumeChange = useCallback((val: string) => {
    setEngineVolume(val); setDrive(""); setPower(""); setGear(""); setModification("");
  }, []);

  const handleDriveChange = useCallback((val: string) => {
    setDrive(val); setPower(""); setGear(""); setModification("");
  }, []);

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setEstimateFailed(false);
    try {
      // 1. Get real estimate from CM Expert
      const qs = new URLSearchParams({ brandId, modelId, year, mileage });
      if (generationId)   qs.append("generationId",   generationId);
      if (chatAutoModId)  qs.append("modificationId", chatAutoModId);
      if (drive)          qs.append("drive",          drive);
      if (engineVolume)   qs.append("engineVolume",   engineVolume);
      if (complectation)  qs.append("complectation",  complectation);
      const predictRes = await fetch(`${base}/api/car-catalog/cm-expert-predict?${qs}`);
      const predictData = await predictRes.json();

      let estimateMin: number | null = null;
      let estimateMax: number | null = null;
      if (predictData.ok) {
        estimateMin = predictData.buyoutMin;
        estimateMax = predictData.buyoutMax;
      }

      // 2. Send lead / email
      const fd = new FormData();
      fd.append("type", "buyout");
      fd.append("brand", brandName);
      fd.append("model", modelName);
      fd.append("year", year);
      fd.append("mileage", mileage);
      if (drive)         fd.append("drive",         drive);
      if (engineVolume)  fd.append("engineVolume",  engineVolume);
      if (power)         fd.append("power",         power);
      if (gear)          fd.append("gear",          gear);
      if (complectation) fd.append("complectation", complectation);
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      if (estimateMin !== null) fd.append("estimateMin", String(estimateMin));
      if (estimateMax !== null) fd.append("estimateMax", String(estimateMax));
      if (history?.length) fd.append("chatHistory", formatHistoryForEmail(history));
      const emailRes = await fetch(`${base}/api/send-email`, { method: "POST", body: fd });
      if (!emailRes.ok) throw new Error("email_send_failed");

      if (estimateMin !== null && estimateMax !== null) {
        setEstimate({ min: estimateMin, max: estimateMax });
      } else {
        setEstimateFailed(true);
      }
    } catch {
      setError("Ошибка отправки. Позвоните: +7 (4832) 77 77 70");
    } finally {
      setSubmitting(false);
    }
  };

  const selectCls = "text-xs rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-[#0070b8]/50 bg-white text-slate-700 disabled:opacity-50 w-full";
  const inputCls  = "text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300 w-full";
  const canSubmit = brandId && modelId && year && mileage && name.trim() && phone.trim();

  const chatMods = modOptions?.modifications ?? [];
  const chatModsForVolume = engineVolume
    ? chatMods.filter(m => m.engineVolume === engineVolume)
    : chatMods;
  const chatFilteredDriveItems = (modOptions?.driveTypes ?? []).filter(d =>
    !engineVolume || chatModsForVolume.some(m => m.drive === d.name)
  );
  const chatModsForVolumeDrive = drive
    ? chatModsForVolume.filter(m => m.drive === drive)
    : chatModsForVolume;
  const chatFilteredPowerItems = (modOptions?.powers ?? []).filter(p =>
    (!engineVolume && !drive) || chatModsForVolumeDrive.some(m => m.power === p.name)
  );
  const chatFilteredGearItems = (modOptions?.gearTypes ?? []).filter(g =>
    (!engineVolume && !drive) || chatModsForVolumeDrive.some(m => m.gear === g.name)
  );
  const chatMatchingMods = chatMods.filter(m =>
    (!engineVolume || m.engineVolume === engineVolume) &&
    (!drive || m.drive === drive) &&
    (!power || m.power === power) &&
    (!gear || m.gear === gear)
  );
  const chatAutoModId = chatMatchingMods.length === 1 ? chatMatchingMods[0].id : "";

  const hasModData = modOptions && (
    modOptions.engineVolumes.length > 0 || modOptions.driveTypes.length > 0 ||
    modOptions.powers.length > 0 || modOptions.gearTypes.length > 0 ||
    modOptions.complectations.length > 0
  );

  // Result state
  if (estimate !== null || (estimateFailed && !submitting)) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Предварительная оценка</p>
        {estimate ? (
          <>
            <p className="text-base font-black text-emerald-800 mt-1 leading-tight">
              {fmtPrice(estimate.min)} — {fmtPrice(estimate.max)}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1.5 leading-snug">
              Итоговая цена уточняется при осмотре. Менеджер позвонит для подтверждения.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-emerald-700 mt-1.5 leading-snug">
            Не удалось рассчитать автоматически. Менеджер перезвонит и назовёт цену в течение 15 минут.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 overflow-y-auto max-h-[70vh]">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Оценка автомобиля</p>

      {/* Марка */}
      <SearchableSelect
        items={brands}
        value={brandId}
        onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
        placeholder="Выберите марку"
        loading={brandsLoading}
        className={inputCls}
      />

      {/* Модель */}
      <SearchableSelect
        items={models}
        value={modelId}
        onChange={(id, name) => { setModelId(id); setModelName(name); }}
        placeholder={!brandId ? "Сначала выберите марку" : "Выберите модель"}
        disabled={!brandId}
        loading={modelsLoading}
        className={inputCls}
      />

      {/* Год + Поколение */}
      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          disabled={!modelId || yearsLoading}
          required
          className={selectCls}
        >
          <option value="">{yearsLoading ? "Загрузка…" : !modelId ? "Сначала модель" : "Год выпуска"}</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={generationId}
          onChange={e => setGenerationId(e.target.value)}
          disabled={!brandId || !modelId || generationsLoading}
          className={selectCls}
        >
          <option value="">{generationsLoading ? "Загрузка…" : "Поколение"}</option>
          {generations.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* Пробег */}
      <input
        placeholder="Пробег, км"
        type="number"
        min="0"
        max="999999"
        value={mileage}
        onChange={e => setMileage(e.target.value)}
        required
        className={inputCls}
      />

      {/* Модификация и технические параметры */}
      {year && (modOptionsLoading || hasModData) && (
        <div className="space-y-2">
          {!modOptionsLoading && hasModData && (
            <div className="grid grid-cols-2 gap-1.5">
              {/* Объём */}
              {(modOptions?.engineVolumes ?? []).length > 0 && (
                <select value={engineVolume} onChange={e => handleEngineVolumeChange(e.target.value)} className={selectCls}>
                  <option value="">Объём дв.</option>
                  {(modOptions?.engineVolumes ?? []).map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              )}
              {/* Привод */}
              {(modOptions?.driveTypes ?? []).length > 0 && (
                <select value={drive} onChange={e => handleDriveChange(e.target.value)} className={selectCls}>
                  <option value="">Привод</option>
                  {chatFilteredDriveItems.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              )}
              {/* Мощность */}
              {(modOptions?.powers ?? []).length > 0 && (
                <select value={power} onChange={e => { setPower(e.target.value); setModification(""); }} className={selectCls}>
                  <option value="">Мощность</option>
                  {chatFilteredPowerItems.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              )}
              {/* КПП */}
              {(modOptions?.gearTypes ?? []).length > 0 && (
                <select value={gear} onChange={e => { setGear(e.target.value); setModification(""); }} className={selectCls}>
                  <option value="">Тип КПП</option>
                  {chatFilteredGearItems.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Комплектация — full width */}
          {!modOptionsLoading && (modOptions?.complectations ?? []).length > 0 && (
            <select value={complectation} onChange={e => { setComplectation(e.target.value); setModification(""); }} className={selectCls}>
              <option value="">Комплектация (опционально)</option>
              {(modOptions?.complectations ?? []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Прогрессивное раскрытие: имя + телефон + кнопка — только когда авто заполнено */}
      {brandId && modelId && year && mileage && (
        <>
          <input
            placeholder="Ваше имя"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className={inputCls}
          />
          <input
            placeholder="+7 (___) ___-__-__"
            type="tel" inputMode="tel" maxLength={18}
            value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            required
            className={inputCls}
          />
          {error && <p className="text-[10px] text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full text-xs font-bold text-white bg-[#87b63c] hover:bg-[#73a030] disabled:opacity-50 rounded-lg py-2 transition-colors"
          >
            {submitting ? "Рассчитываем…" : "Узнать оценку"}
          </button>
        </>
      )}
    </form>
  );
}

/* ── Consent screen ─────────────────────────────────────────── */
function ConsentScreen({ onConsent, onDecline }: { onConsent: () => void; onDecline: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-7 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0070b8]/10 to-[#0070b8]/20 flex items-center justify-center">
        <Shield className="w-8 h-8 text-[#0070b8]" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800 mb-2">Согласие на обработку данных</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Чтобы улучшать качество ответов, мы сохраняем историю вашей переписки с Навигатором согласно{" "}
          <a href="/privacy" className="text-[#0070b8] underline underline-offset-2">политике конфиденциальности</a>.
        </p>
      </div>
      <div className="flex gap-2.5 w-full">
        <button
          onClick={onDecline}
          className="flex-1 text-xs text-slate-500 border border-slate-200 rounded-xl py-2.5 hover:bg-slate-50 transition-colors font-medium"
        >
          Отказаться
        </button>
        <button
          onClick={onConsent}
          className="flex-1 text-xs text-white font-bold bg-[#0070b8] hover:bg-[#005fa0] rounded-xl py-2.5 transition-colors shadow-sm"
        >
          Согласен
        </button>
      </div>
    </div>
  );
}

/* ── Rating buttons ─────────────────────────────────────────── */
function RatingButtons({
  messageId, rating, onRate,
}: {
  messageId: number | null | undefined;
  rating: 1 | -1 | null | undefined;
  onRate: (msgId: number, r: 1 | -1) => void;
}) {
  if (!messageId) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
      <span className="text-[10px] text-slate-400">Полезный ответ?</span>
      <button
        onClick={() => onRate(messageId, 1)}
        disabled={rating !== null && rating !== undefined}
        className={`p-1 rounded-lg transition-colors ${
          rating === 1 ? "bg-emerald-100 text-emerald-600" : "hover:bg-slate-100 text-slate-400 disabled:opacity-50"
        }`}
        title="Полезно"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => onRate(messageId, -1)}
        disabled={rating !== null && rating !== undefined}
        className={`p-1 rounded-lg transition-colors ${
          rating === -1 ? "bg-red-100 text-red-500" : "hover:bg-slate-100 text-slate-400 disabled:opacity-50"
        }`}
        title="Не полезно"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ── Main ChatWidget ─────────────────────────────────────────── */
export default function ChatWidget({ onOpenCallback }: { onOpenCallback?: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const base = useMemo(() => import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "", []);
  const pageCarContext = usePageCar();
  const proactiveSentRef = useRef(false);

  const sessionId = useMemo(() => {
    let id = localStorage.getItem("nav_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("nav_session_id", id);
    }
    return id;
  }, []);

  const [consented, setConsented] = useState(
    () => localStorage.getItem("nav_consented") === "1"
  );
  const [consentedAt, setConsentedAt] = useState<string | null>(
    () => localStorage.getItem("nav_consented_at")
  );

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const sid = localStorage.getItem("nav_session_id");
      if (!sid) return [WELCOME];
      const raw = localStorage.getItem(`nav_messages_${sid}`);
      if (!raw) return [WELCOME];
      const parsed: Message[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME];
      return parsed;
    } catch {
      return [WELCOME];
    }
  });

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      if (!consented) setShowConsent(true);
      setTimeout(() => { if (consented) inputRef.current?.focus(); }, 300);
      setTimeout(scrollToBottom, 100);
    }
  }, [open, consented, scrollToBottom]);

  const sendProactiveMessage = useCallback(async () => {
    if (!pageCarContext || loading) return;
    setLoading(true);
    const streamId = `proactive_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: streamId, role: "assistant", content: "", isStreaming: true, action: null, cars: [], queryHint: `${pageCarContext.brand} ${pageCarContext.model}` },
    ]);
    try {
      const res = await fetch(`${base}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "",
          history: [],
          page_context: {
            car_id: pageCarContext.carId,
            brand: pageCarContext.brand,
            model: pageCarContext.model,
            year: pageCarContext.year,
            price: pageCarContext.price,
            is_new: pageCarContext.isNew,
            body_type: pageCarContext.bodyType,
            run: pageCarContext.run,
          },
          ...(consented && consentedAt ? { session_id: sessionId, consented_at: consentedAt } : {}),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalCars: ChatCarItem[] = [];
      let finalAction: string | null = null;
      let finalReply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part.split("\n").find(l => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const evt = JSON.parse(dataLine.slice(6));
            if (evt.t === "chunk") {
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: m.content + evt.v } : m
              ));
            } else if (evt.t === "done") {
              finalCars = evt.cars ?? [];
              finalAction = evt.action ?? null;
              finalReply = evt.reply ?? "";
            } else if (evt.t === "error") {
              setMessages(prev => prev.filter(m => m.id !== streamId));
            } else if (evt.t === "thinking") {
              // request accepted — streaming placeholder already shown
            }
          } catch { /* ignore parse error */ }
        }
      }
      const prefillModel = pageCarContext ? `${pageCarContext.brand} ${pageCarContext.model}` : "";
      setMessages(prev => prev.map(m => {
        if (m.id !== streamId) return m;
        return {
          ...m,
          content: finalReply || m.content,
          isStreaming: false,
          cars: finalCars,
          car_ids: finalCars.map(c => c.id),
          action: finalAction,
          prefillModel,
          quickActions: [
            { label: "🚗 Записаться на тест-драйв", action: "testdrive" },
            { label: "💳 Рассчитать кредит", action: "credit_form" },
            { label: "🔄 Оценить авто в трейд-ин", action: "tradein_form" },
          ],
        };
      }));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== streamId));
    } finally {
      setLoading(false);
    }
  }, [pageCarContext, base, consented, consentedAt, sessionId, loading]);

  useEffect(() => {
    if (!open || !consented || !pageCarContext) return;
    const isFreshSession = messages.length === 1 && messages[0].id === "welcome";
    if (!isFreshSession) return;
    if (proactiveSentRef.current) return;
    proactiveSentRef.current = true;
    sendProactiveMessage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, consented, pageCarContext]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, open, scrollToBottom]);

  useEffect(() => {
    try {
      const eligible = messages.filter(m => !m.isStreaming || m.content);
      const toSave = eligible.length > 60
        ? [eligible[0], ...eligible.slice(eligible.length - 59)]
        : eligible;
      // Strip isStreaming flag so saved messages never re-open as incomplete
      localStorage.setItem(
        `nav_messages_${sessionId}`,
        JSON.stringify(toSave.map(m => ({ ...m, isStreaming: false })))
      );
    } catch { /* ignore */ }
  }, [messages, sessionId]);

  const handleConsent = useCallback(() => {
    const ts = new Date().toISOString();
    localStorage.setItem("nav_consented", "1");
    localStorage.setItem("nav_consented_at", ts);
    setConsented(true);
    setConsentedAt(ts);
    setShowConsent(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleDecline = useCallback(() => {
    try { localStorage.removeItem(`nav_messages_${sessionId}`); } catch { /* ignore */ }
    setMessages([WELCOME]);
    setShowConsent(false);
    setOpen(false);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        cars: [],
      };

      setLoading(true);
      const streamId = (Date.now() + 1).toString();

      setMessages(prev => [
        ...prev,
        userMsg,
        { id: streamId, role: "assistant", content: "", isStreaming: true, action: null, cars: [], queryHint: trimmed },
      ]);
      setInput("");

      try {
        const history = messages
          .filter(m => m.id !== "welcome")
          .map(m => ({
            role: m.role,
            content: m.content,
            ...(m.role === "assistant" && m.car_ids && m.car_ids.length > 0
              ? { car_ids: m.car_ids }
              : {}),
          }));

        const res = await fetch(`${base}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            ...(pageCarContext ? {
              page_context: {
                car_id: pageCarContext.carId,
                brand: pageCarContext.brand,
                model: pageCarContext.model,
                year: pageCarContext.year,
                price: pageCarContext.price,
                is_new: pageCarContext.isNew,
                body_type: pageCarContext.bodyType,
                run: pageCarContext.run,
              },
            } : {}),
            ...(consented && consentedAt
              ? { session_id: sessionId, consented_at: consentedAt }
              : {}),
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part.split("\n").find(l => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const evt = JSON.parse(dataLine.slice(6));

              if (evt.t === "chunk") {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === streamId ? { ...m, content: m.content + evt.v } : m
                  )
                );
              } else if (evt.t === "done") {
                const carIds: string[] = (evt.cars ?? []).map((c: ChatCarItem) => c.id);
                setMessages(prev =>
                  prev.map(m =>
                    m.id === streamId
                      ? {
                          ...m,
                          content: evt.reply || m.content,
                          isStreaming: false,
                          action: evt.action ?? null,
                          cars: evt.cars ?? [],
                          car_ids: carIds,
                          messageId: evt.message_id ?? null,
                          rating: null,
                        }
                      : m
                  )
                );
                if (!open) setUnread(u => u + 1);
              } else if (evt.t === "error") {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === streamId
                      ? { ...m, content: evt.message, isStreaming: false }
                      : m
                  )
                );
              } else if (evt.t === "thinking") {
                // request accepted — streaming placeholder already shown
              }
            } catch { /* bad JSON — skip */ }
          }
        }
      } catch {
        setMessages(prev =>
          prev.map(m =>
            m.id === streamId
              ? {
                  ...m,
                  content: "Ошибка соединения. Позвоните нам напрямую: +7 (4832) 77 77 70",
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [base, loading, messages, open, consented, consentedAt, sessionId]
  );

  const handleRate = useCallback(async (msgId: number, rating: 1 | -1) => {
    setMessages(prev => prev.map(m => m.messageId === msgId ? { ...m, rating } : m));
    try {
      await fetch(`${base}/api/chat/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msgId, rating }),
      });
    } catch { /* non-fatal */ }
  }, [base]);

  const handleAction = useCallback(
    (action: string) => {
      if (action === "callback") {
        setOpen(false);
        if (onOpenCallback) {
          onOpenCallback();
        } else {
          const btn = document.querySelector<HTMLButtonElement>("[data-callback-trigger]");
          btn?.click();
        }
      }
    },
    [onOpenCallback]
  );

  const handleQuickAction = useCallback(
    (sourceMsg: Message, action: string, label: string) => {
      const userMsgId = `user_qa_${Date.now()}`;
      const botMsgId = `bot_qa_${Date.now() + 1}`;
      const prefillModel = sourceMsg.prefillModel ?? "";
      const introText =
        action === "testdrive"
          ? "Отлично! Заполните форму — менеджер свяжется и подтвердит время тест-драйва 🚗"
          : action === "credit_form"
          ? "Оставьте контакты — менеджер рассчитает персональные условия кредита и перезвонит 💳"
          : "Заполните форму — оценим ваш автомобиль и рассчитаем зачёт в счёт нового 🔄";
      setMessages(prev => [
        ...prev.map(m => m.id === sourceMsg.id ? { ...m, quickActions: undefined } : m),
        { id: userMsgId, role: "user" as const, content: label },
        { id: botMsgId, role: "assistant" as const, content: introText, action, prefillModel, cars: [], isStreaming: false },
      ]);
      setTimeout(scrollToBottom, 80);
    },
    [scrollToBottom]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-[5.5rem] right-4 z-[55] w-[calc(100vw-2rem)] sm:w-[420px] max-h-[640px] bg-white rounded-3xl shadow-[0_32px_80px_-8px_rgba(0,0,0,0.16)] flex flex-col overflow-hidden"
          >
            {/* Header — Variant B: white with accent top bar */}
            <div className="shrink-0">
              {/* 4px brand gradient bar */}
              <div className="h-[4px]" style={{ background: "linear-gradient(90deg, #0070b8 0%, #87b63c 100%)" }} />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #0070b8 0%, #005a96 100%)", boxShadow: "0 6px 16px rgba(0,112,184,0.28)" }}
                >
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-[15px] text-slate-900 leading-tight tracking-tight">Навигатор</p>
                    <span className="text-[10px] font-semibold text-[#87b63c] bg-[#87b63c]/10 px-2 py-0.5 rounded-full">● онлайн</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">Дебрянск Авто · AI-консультант</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
                >
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              {/* Trust badges */}
              <div className="px-4 pb-2.5 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {["9 брендов", "10+ лет", "Ответим за 30 сек"].map(b => (
                  <span key={b} className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full whitespace-nowrap shrink-0">{b}</span>
                ))}
              </div>
            </div>

            {showConsent && !consented ? (
              <ConsentScreen onConsent={handleConsent} onDecline={handleDecline} />
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 min-h-0"
                  style={{ background: "#fafbfd" }}
                >
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {/* AI avatar */}
                      {msg.role === "assistant" && (
                        <div
                          className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{ background: "linear-gradient(135deg, #0070b8 0%, #005a96 100%)" }}
                        >
                          <Compass className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className={`max-w-[82%] ${msg.role === "user" ? "order-first" : ""}`}>
                        <div
                          className={`text-sm px-4 py-3 ${
                            msg.role === "user"
                              ? "text-white shadow-sm"
                              : "bg-white text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.07)] border border-slate-100"
                          }`}
                          style={msg.role === "user"
                            ? { background: "linear-gradient(135deg, #0070b8 0%, #005a96 100%)", borderRadius: "18px 4px 18px 18px" }
                            : { borderRadius: "4px 18px 18px 18px" }
                          }
                        >
                          {msg.role === "assistant" ? (
                            <MessageContent text={msg.content} isStreaming={msg.isStreaming} queryHint={msg.queryHint} />
                          ) : (
                            <span className="leading-relaxed">{msg.content}</span>
                          )}

                          {msg.role === "assistant" && msg.cars && msg.cars.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Подборка из наличия
                              </p>
                              {msg.cars.map(car => (
                                <CarCard key={car.id} car={car} />
                              ))}
                            </div>
                          )}

                          {msg.role === "assistant" && !msg.isStreaming && msg.action && (
                            msg.action === "contact_form" ? (
                              <ContactFormCard base={base} history={messages} />
                            ) : msg.action === "tradein_form" ? (
                              <TradeInFormCard base={base} history={messages} />
                            ) : msg.action === "testdrive" ? (
                              <TestDriveFormCard base={base} prefillModel={msg.prefillModel} history={messages} />
                            ) : msg.action === "credit_form" ? (
                              <CreditFormCard base={base} prefillModel={msg.prefillModel} history={messages} />
                            ) : msg.action === "service_form" ? (
                              <ServiceFormCard base={base} history={messages} />
                            ) : (
                              <ActionButton action={msg.action} onAction={handleAction} />
                            )
                          )}

                          {msg.role === "assistant" && !msg.isStreaming && msg.quickActions && msg.quickActions.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1.5">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Что хотите сделать?</p>
                              {msg.quickActions.map(qa => (
                                <button
                                  key={qa.action}
                                  onClick={() => handleQuickAction(msg, qa.action, qa.label)}
                                  className="w-full text-left text-xs px-3 py-2 rounded-xl border border-[#0070b8]/25 hover:border-[#0070b8]/50 hover:bg-[#0070b8]/5 text-slate-600 font-medium transition-all"
                                >
                                  {qa.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {msg.role === "assistant" && !msg.isStreaming && msg.id !== "welcome" && consented && (
                            <RatingButtons
                              messageId={msg.messageId}
                              rating={msg.rating}
                              onRate={handleRate}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* dots spinner: only when loading but no streaming message yet */}
                  {loading && !messages.some(m => m.isStreaming) && (
                    <div className="flex items-start gap-2.5 justify-start">
                      <div
                        className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                        style={{ background: "linear-gradient(135deg, #0070b8 0%, #005a96 100%)" }}
                      >
                        <Compass className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white px-4 py-3 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.07)] border border-slate-100" style={{ borderRadius: "4px 18px 18px 18px" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}

                  {messages.length === 1 && !loading && (
                    <div className="pt-1">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest px-1 mb-2">
                        Частые вопросы
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_QUESTIONS.map(q => (
                          <button
                            key={q}
                            onClick={() => sendMessage(q)}
                            className="text-xs font-semibold px-3.5 py-2 rounded-full border border-[#0070b8]/20 hover:border-[#0070b8]/50 hover:bg-[#0070b8]/6 text-[#0070b8] transition-all"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Quick action chips */}
                <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 overflow-x-auto shrink-0 border-t border-slate-100" style={{ scrollbarWidth: "none" }}>
                  {["Тест-драйв", "Кредит", "Трейд-ин", "Позвонить"].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={loading}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#0070b8]/20 hover:border-[#0070b8]/50 hover:bg-[#0070b8]/6 text-[#0070b8] whitespace-nowrap shrink-0 transition-all disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="px-3 pb-3 pt-1.5 shrink-0 bg-white">
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Написать сообщение..."
                      disabled={loading}
                      maxLength={500}
                      className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 outline-none focus:border-[#0070b8]/50 focus:ring-2 focus:ring-[#0070b8]/10 placeholder:text-slate-400 disabled:opacity-60 transition-all"
                    />
                    <motion.button
                      type="submit"
                      disabled={!input.trim() || loading}
                      whileTap={{ scale: 0.92 }}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #0070b8 0%, #005a96 100%)", boxShadow: "0 4px 12px rgba(0,112,184,0.3)" }}
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button with pulse rings */}
      <div className="fixed bottom-4 right-4 z-[55]">
        {/* Pulse rings — only when closed */}
        {!open && (
          <>
            <span className="absolute inset-0 rounded-2xl bg-[#0070b8]/30 animate-ping" style={{ animationDuration: "2.5s" }} />
            <span className="absolute inset-[-4px] rounded-2xl bg-[#0070b8]/15 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.4s" }} />
          </>
        )}

        <motion.button
          onClick={() => setOpen(o => !o)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center gap-2.5 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-xl transition-colors"
          style={{ background: open ? "#005fa0" : "linear-gradient(135deg, #0070b8 0%, #005a96 100%)" }}
          aria-label="Открыть чат Навигатор"
        >
          <Compass className="w-5 h-5 shrink-0" />
          <span className="hidden sm:inline">Навигатор</span>
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center shadow-sm">
              {unread}
            </span>
          )}
          {!open && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-[#87b63c] rounded-full border-2 border-white" />
          )}
        </motion.button>
      </div>
    </>
  );
}
