import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Compass, Phone, Car, Loader2, ChevronDown, ExternalLink, ThumbsUp, ThumbsDown, Shield, Sparkles } from "lucide-react";

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
    return ["Оцениваю ваш автомобиль…", "Анализирую рыночную стоимость…", "Подбираю предложение…"];
  }
  if (/сервис|тех.?обслуж|ремонт|\bто\b|запись/.test(q)) {
    return ["Ищу информацию о сервисе…", "Проверяю расписание…", "Уточняю данные…"];
  }
  if (/авто|машин|подобрать|купить|найти|цена|стоит|бюджет|млн|тысяч|пробег|новый|б\/у/.test(q)) {
    return ["Подбираю варианты…", "Проверяю наличие…", "Анализирую каталог…"];
  }
  return ["Думаю над ответом…", "Анализирую информацию…", "Подготавливаю ответ…"];
}

function StreamingDots({ queryHint }: { queryHint?: string }) {
  const msgs = React.useMemo(() => getStatusMessages(queryHint ?? ""), [queryHint]);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 2000);
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

/* ── Car card ───────────────────────────────────────────────── */
function CarCard({ car }: { car: ChatCarItem }) {
  const displayPrice = car.isNew && car.minPrice != null ? car.minPrice : car.price;
  const showFrom = car.isNew && car.minPrice != null && car.minPrice < car.price;
  return (
    <a
      href={car.path}
      className="flex-none w-[148px] bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-[#0070b8]/40 hover:shadow-lg transition-all duration-200 group"
    >
      <div className="h-[88px] bg-slate-50 overflow-hidden relative">
        {car.image ? (
          <img
            src={car.image}
            alt={`${car.mark} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-200">
            <Car className="w-8 h-8" />
          </div>
        )}
        <span className={`absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-lg ${
          car.isNew ? "bg-[#87b63c] text-white" : "bg-slate-700/90 text-white"
        }`}>
          {car.isNew ? "НОВЫЙ" : "С ПРОБЕГОМ"}
        </span>
        {car.discount != null && car.discount > 0 && (
          <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-red-500 text-white">
            −{formatPrice(car.discount)}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">
          {car.mark} {car.model}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {car.year}{!car.isNew && car.run > 0 ? ` · ${(car.run / 1000).toFixed(0)} тыс. км` : ""}
        </p>
        <p className="text-[12px] font-black text-[#0070b8] mt-1.5 leading-tight">
          {showFrom && <span className="text-[9px] font-semibold text-slate-400 mr-0.5">от</span>}
          {formatPrice(displayPrice)}
        </p>
        <p className="text-[9px] text-[#0070b8]/70 mt-0.5 flex items-center gap-0.5 font-medium">
          Смотреть <ExternalLink className="w-2.5 h-2.5" />
        </p>
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
function ContactFormCard({ base }: { base: string }) {
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
        type="tel"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#0070b8]/50 bg-white placeholder:text-slate-300"
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !phone.trim()}
        className="w-full text-xs font-bold text-white bg-[#0070b8] hover:bg-[#005fa0] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Отправить"}
      </button>
    </form>
  );
}

/* ── Test-drive form card (inline, no redirect) ─────────────── */
function TestDriveFormCard({ base, prefillModel }: { base: string; prefillModel?: string }) {
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
      fd.append("source", "Навигатор (чат)");
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
        type="tel"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        required
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#87b63c]/60 bg-white placeholder:text-slate-300"
      />
      <input
        placeholder="Интересующая модель (необязательно)"
        value={model}
        onChange={e => setModel(e.target.value)}
        className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 outline-none focus:border-[#87b63c]/60 bg-white placeholder:text-slate-300"
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !name.trim() || !phone.trim()}
        className="w-full text-xs font-bold text-white bg-[#87b63c] hover:bg-[#73a030] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Записаться на тест-драйв"}
      </button>
    </form>
  );
}

/* ── Service form card ───────────────────────────────────────── */
function ServiceFormCard({ base }: { base: string }) {
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
        type="tel"
        value={phone}
        onChange={e => setPhone(e.target.value)}
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
        disabled={submitting || !name.trim() || !phone.trim()}
        className="w-full text-xs font-bold text-white bg-[#0070b8] hover:bg-[#005fa0] disabled:opacity-50 rounded-lg py-2 transition-colors"
      >
        {submitting ? "Отправка…" : "Записаться на сервис"}
      </button>
    </form>
  );
}

/* ── Trade-in form card ──────────────────────────────────────── */
interface CmItem { id: string; name: string }

function TradeInFormCard({ base }: { base: string }) {
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i),
    [currentYear]
  );

  // Catalog data
  const [brands, setBrands] = useState<CmItem[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [models, setModels] = useState<CmItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [generations, setGenerations] = useState<CmItem[]>([]);
  const [generationsLoading, setGenerationsLoading] = useState(false);

  // Selections
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [year, setYear] = useState("");
  const [generationId, setGenerationId] = useState("");
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
    setGenerations([]); setGenerationId("");
    fetch(`${base}/api/car-catalog/cm-models?brand=${encodeURIComponent(brandId)}`)
      .then(r => r.json())
      .then(j => setModels(j.ok ? (j.data ?? []) : []))
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, [brandId, base]);

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
      if (generationId) qs.append("generationId", generationId);
      const predictRes = await fetch(`${base}/api/car-catalog/cm-expert-predict?${qs}`);
      const predictData = await predictRes.json();

      let estimateMin: number | null = null;
      let estimateMax: number | null = null;
      if (predictData.ok) {
        estimateMin = predictData.buyoutMin;
        estimateMax = predictData.buyoutMax;
      }

      // 2. Send lead / email (check response explicitly)
      const fd = new FormData();
      fd.append("type", "buyout");
      fd.append("brand", brandName);
      fd.append("model", modelName);
      fd.append("year", year);
      fd.append("mileage", mileage);
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      if (estimateMin !== null) fd.append("estimateMin", String(estimateMin));
      if (estimateMax !== null) fd.append("estimateMax", String(estimateMax));
      const emailRes = await fetch(`${base}/api/send-email`, { method: "POST", body: fd });
      if (!emailRes.ok) throw new Error("email_send_failed");

      // Show result after both steps done
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
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Оценка автомобиля</p>

      {/* Марка */}
      <select
        value={brandId}
        onChange={e => {
          const sel = brands.find(b => b.id === e.target.value);
          setBrandId(e.target.value);
          setBrandName(sel?.name ?? "");
        }}
        disabled={brandsLoading}
        required
        className={selectCls}
      >
        <option value="">{brandsLoading ? "Загрузка марок…" : "Выберите марку"}</option>
        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      {/* Модель */}
      <select
        value={modelId}
        onChange={e => {
          const sel = models.find(m => m.id === e.target.value);
          setModelId(e.target.value);
          setModelName(sel?.name ?? "");
        }}
        disabled={!brandId || modelsLoading}
        required
        className={selectCls}
      >
        <option value="">{!brandId ? "Сначала выберите марку" : modelsLoading ? "Загрузка моделей…" : "Выберите модель"}</option>
        {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>

      {/* Год + Поколение */}
      <div className="grid grid-cols-2 gap-1.5">
        <select value={year} onChange={e => setYear(e.target.value)} required className={selectCls}>
          <option value="">Год выпуска</option>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
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
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
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
            className="fixed bottom-[5.5rem] right-4 z-[55] w-[calc(100vw-2rem)] sm:w-[420px] max-h-[620px] bg-white rounded-3xl shadow-[0_24px_64px_-8px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
            style={{ border: "1px solid rgba(0,112,184,0.12)" }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 shrink-0 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #0070b8 0%, #005a96 100%)" }}
            >
              {/* decorative arc */}
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute -right-4 -top-12 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 relative z-10">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-1.5">
                  <p className="font-extrabold text-sm text-white leading-tight">Навигатор</p>
                  <span className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#87b63c]" />
                    <span className="text-[10px] text-white/60 font-medium">онлайн</span>
                  </span>
                </div>
                <p className="text-[11px] text-white/65 truncate">Ваш проводник по Территории Авто</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-white/15 flex items-center justify-center transition-colors shrink-0 relative z-10"
              >
                <ChevronDown className="w-4 h-4 text-white" />
              </button>
            </div>

            {showConsent && !consented ? (
              <ConsentScreen onConsent={handleConsent} onDecline={handleDecline} />
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
                  style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}
                >
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {/* AI avatar */}
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-xl bg-[#0070b8] flex items-center justify-center shrink-0 mb-0.5 shadow-sm">
                          <Compass className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}

                      <div className={`max-w-[88%] ${msg.role === "user" ? "order-first" : ""}`}>
                        <div
                          className={`text-sm rounded-2xl px-4 py-3 ${
                            msg.role === "user"
                              ? "bg-[#0070b8] text-white rounded-br-sm shadow-sm"
                              : "bg-white text-slate-700 rounded-bl-sm shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-slate-100/80"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <MessageContent text={msg.content} isStreaming={msg.isStreaming} queryHint={msg.queryHint} />
                          ) : (
                            <span className="leading-relaxed">{msg.content}</span>
                          )}

                          {msg.role === "assistant" && msg.cars && msg.cars.length > 0 && (
                            <div className="mt-3 -mx-1">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">
                                Подборка из наличия
                              </p>
                              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                                {msg.cars.map(car => (
                                  <CarCard key={car.id} car={car} />
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.role === "assistant" && !msg.isStreaming && msg.action && (
                            msg.action === "contact_form" ? (
                              <ContactFormCard base={base} />
                            ) : msg.action === "tradein_form" ? (
                              <TradeInFormCard base={base} />
                            ) : msg.action === "testdrive" ? (
                              <TestDriveFormCard base={base} />
                            ) : msg.action === "service_form" ? (
                              <ServiceFormCard base={base} />
                            ) : (
                              <ActionButton action={msg.action} onAction={handleAction} />
                            )
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
                    <div className="flex items-end gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-xl bg-[#0070b8] flex items-center justify-center shrink-0 mb-0.5 shadow-sm">
                        <Compass className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="bg-white rounded-2xl rounded-bl-sm shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-slate-100/80 px-4 py-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}

                  {messages.length === 1 && !loading && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest px-1">
                        Частые вопросы
                      </p>
                      {QUICK_QUESTIONS.map(q => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="w-full text-left text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-[#0070b8]/40 hover:bg-[#0070b8]/4 text-slate-600 transition-all hover:shadow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-3 py-3 border-t border-slate-100 shrink-0 bg-white">
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
                      className="w-10 h-10 rounded-2xl bg-[#0070b8] hover:bg-[#005fa0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors shrink-0 shadow-sm"
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
