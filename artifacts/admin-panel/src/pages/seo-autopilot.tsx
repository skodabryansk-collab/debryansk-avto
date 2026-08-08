import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSeoAutopilotSuggestions, getSeoAutopilotAlerts, getSeoAutopilotQuota,
  getSeoAutopilotStatus, applySeoSuggestion, rejectSeoSuggestion,
  runWordstatFetch, runGapAnalysis, resolveOauthAlert, getGapRuns, getSuggestionPreview,
  cleanupDuplicateModelFaqs, resetAndRerunGap, publishLandingPage,
  getLandingDraft, updateLandingDraft,
  type SeoSuggestion, type OauthAlert, type WordstatQuotaEntry, type GapRun, type FaqPreviewItem,
  type LandingDraft,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Database, Zap, ShieldAlert, BarChart3, Wrench, FileText, FilePlus, Clock, Activity, Trash2, RotateCcw, Sparkles, Target, HelpCircle, AlertCircle, Check, Pencil, ChevronUp, ChevronDown } from "lucide-react";

/* ── Type labels ─────────────────────────────────────────────────────── */
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  meta:       { label: "Мета-теги",   color: "bg-blue-100 text-blue-800" },
  cluster:    { label: "НЧ-кластер",  color: "bg-purple-100 text-purple-800" },
  tech:       { label: "Технический", color: "bg-red-100 text-red-700" },
  content:    { label: "Контент",     color: "bg-amber-100 text-amber-800" },
  text_block: { label: "Текст",       color: "bg-teal-100 text-teal-800" },
  new_page:   { label: "Новая стр.",  color: "bg-green-100 text-green-800" },
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:             { label: "Ожидает",      color: "bg-slate-100 text-slate-700" },
  applied:             { label: "Применено",    color: "bg-green-100 text-green-700" },
  applied_with_errors: { label: "Ошибка",       color: "bg-red-100 text-red-700" },
  rejected:            { label: "Отклонено",    color: "bg-slate-200 text-slate-500" },
};

/* ── Animated progress hook ──────────────────────────────────────────── */
function useAnimatedProgress(running: boolean, estimatedMs = 60000) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    if (running) {
      progressRef.current = 0;
      setProgress(0);
      const step = 250; // tick every 250ms
      const totalTicks = estimatedMs / step;
      timerRef.current = setInterval(() => {
        progressRef.current += 1;
        // Ease-out: fast start, slows near 90%
        const raw = progressRef.current / totalTicks;
        const eased = Math.min(0.93, 1 - Math.pow(1 - raw, 2.5));
        setProgress(Math.round(eased * 100));
        if (progressRef.current >= totalTicks * 1.5) clearInterval(timerRef.current!);
      }, step);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current > 0) {
        setProgress(100);
        const t = setTimeout(() => { setProgress(0); progressRef.current = 0; }, 1800);
        return () => clearTimeout(t);
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, estimatedMs]);

  return progress;
}

/* ── ProgressBar component ───────────────────────────────────────────── */
function ProgressBar({ progress, label, color = "bg-[#0070b8]" }: { progress: number; label?: string; color?: string }) {
  if (progress === 0) return null;
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between items-center text-[11px] text-slate-500">
        {label && <span>{label}</span>}
        <span className="font-semibold tabular-nums">{progress}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`${color} h-1.5 rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, Math.round((score / Math.max(max, 1)) * 100));
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className="bg-[#0070b8] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function parseMeta(value: string | null): { title?: string; desc?: string } {
  if (!value) return {};
  const lines = value.split("\n");
  const title = lines.find(l => l.startsWith("title:"))?.slice(6).trim();
  const desc  = lines.find(l => l.startsWith("desc:"))?.slice(5).trim();
  return { title, desc };
}

/** Known brand name overrides: all-caps brands and sub-brand slugs that map to parent name */
const BRAND_SLUG_OVERRIDES: Record<string, string> = {
  "omoda": "OMODA", "jaecoo": "JAECOO", "exeed": "EXEED",
  "haval": "Haval", "haval-city": "Haval", "haval-pro": "Haval",
  "jetour": "Jetour", "tenet": "Tenet",
  "volkswagen": "Volkswagen", "skoda": "ŠKODA",
  "mercedes": "Mercedes-Benz", "soueast": "Soueast",
};
function slugToBrandName(slug: string): string {
  if (BRAND_SLUG_OVERRIDES[slug]) return BRAND_SLUG_OVERRIDES[slug];
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function queryToFaqPreview(query: string, brandName: string): { question: string; answer: string } {
  const q = query.toLowerCase();
  if (q.includes("официальный дилер"))
    return { question: `Есть ли официальный дилер ${brandName} в Брянске?`, answer: `Да, официальный дилер ${brandName} в Брянске — Дебрянск Авто. Полный модельный ряд, кредит, трейд-ин и гарантийный сервис.` };
  if (q.includes("цена") || q.includes("стоимост") || q.includes("прайс"))
    return { question: `Какая цена на ${brandName} в Брянске?`, answer: `Актуальные цены на ${brandName} у официального дилера Дебрянск Авто — в каталоге. Доступны выгодные условия кредита, трейд-ин и скидки по акциям.` };
  if (q.includes("кредит") || q.includes("рассрочк") || q.includes("лизинг"))
    return { question: `Можно ли купить ${brandName} в кредит в Брянске?`, answer: `Да, ${brandName} доступен в кредит у официального дилера Дебрянск Авто. Действуют выгодные программы кредитования — уточните условия у менеджера.` };
  if (q.includes("трейд") || q.includes("trade"))
    return { question: `Принимают ли ${brandName} по трейд-ин?`, answer: `В Дебрянск Авто действует программа трейд-ин: бесплатная оценка, зачёт стоимости при покупке нового ${brandName}.` };
  if (q.includes("сервис") || q.includes("обслуж") || q.includes("ремонт"))
    return { question: `Где пройти ТО ${brandName} в Брянске?`, answer: `Официальный сервис ${brandName} в Брянске — Дебрянск Авто. Оригинальные запчасти, онлайн-запись.` };
  if (q.includes("купить") || q.includes("куплю"))
    return { question: `Где купить ${brandName} в Брянске?`, answer: `Купить ${brandName} у официального дилера в Брянске — Дебрянск Авто. Автомобили в наличии, кредит и трейд-ин.` };
  return { question: `Почему стоит выбрать ${brandName} у официального дилера в Брянске?`, answer: `Дебрянск Авто — официальный дилер ${brandName} в Брянске. Автомобили в наличии, гарантия, кредит, трейд-ин, сервис.` };
}

function parseClusterFaqs(proposedValue: string, pageUrl: string): { question: string; answer: string }[] {
  if (!pageUrl.startsWith("/brands/")) return [];

  // New format: pre-generated JSON array [{"question":"...","answer":"..."}]
  const trimmed = proposedValue.trimStart();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as { question: string; answer: string }[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) return parsed;
    } catch { /* fall through to legacy parser */ }
  }

  // Legacy format: "query text (позиция X.X)\n..."
  const brandName = slugToBrandName(pageUrl.replace("/brands/", ""));
  const queries: string[] = [];
  for (const line of proposedValue.split("\n")) {
    const m = line.trim().match(/^(.+?)\s*\(позиция/);
    if (m) queries.push(m[1].trim());
    // Also handle Wordstat format: "query text (123 показов/мес)"
    const m2 = line.trim().match(/^(.+?)\s*\(\d+\s*показов/);
    if (!m && m2) queries.push(m2[1].trim());
  }
  const seen = new Set<string>();
  return queries.reduce<{ question: string; answer: string }[]>((acc, q) => {
    const faq = queryToFaqPreview(q, brandName);
    if (!seen.has(faq.question)) { seen.add(faq.question); acc.push(faq); }
    return acc;
  }, []);
}

/* ── ContentBrandPreview — загружает FAQ из preview API, позволяет редактировать ── */
function ContentBrandPreview({
  suggestionId,
  onEditChange,
}: {
  suggestionId: number;
  onEditChange?: (v: string) => void;
}) {
  type EditableFaq = FaqPreviewItem & { _q: string; _a: string };
  const [faqs, setFaqs] = useState<EditableFaq[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSuggestionPreview(suggestionId)
      .then(r => {
        if (!cancelled) {
          setFaqs((r.faqs ?? []).map(f => ({ ...f, _q: f.question, _a: f.answer })));
        }
      })
      .catch(() => { if (!cancelled) setFaqs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [suggestionId]);

  const updateFaq = (idx: number, field: "_q" | "_a", val: string) => {
    if (!faqs) return;
    const updated = faqs.map((f, i) => i === idx ? { ...f, [field]: val } : f);
    setFaqs(updated);
    onEditChange?.(JSON.stringify(updated.map(f => ({ question: f._q, answer: f._a, modelTerm: f.modelTerm }))));
  };

  return (
    <div className="border border-orange-100 bg-orange-50/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Что будет добавлено на сайт — модельные FAQ + SSG rebuild + IndexNow
        {onEditChange && <span className="ml-auto flex items-center gap-0.5 text-[10px] font-normal text-orange-400"><Pencil className="w-2.5 h-2.5" /> редактируется</span>}
      </div>

      {loading && (
        <p className="text-[11px] text-slate-400 animate-pulse">Загрузка предпросмотра…</p>
      )}

      {!loading && (!faqs || faqs.length === 0) && (
        <p className="text-[11px] text-slate-500">Модельные FAQ будут сгенерированы из каталога при применении.</p>
      )}

      {!loading && faqs && faqs.length > 0 && (
        <div className="space-y-2">
          {(() => {
            const groups = new Map<string, { faq: EditableFaq; idx: number }[]>();
            faqs.forEach((faq, idx) => {
              if (!groups.has(faq.modelTerm)) groups.set(faq.modelTerm, []);
              groups.get(faq.modelTerm)!.push({ faq, idx });
            });
            return [...groups.entries()].map(([model, items]) => (
              <div key={model} className="space-y-1">
                <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">{model}</div>
                {items.map(({ faq, idx }) => (
                  <div key={idx} className="bg-white rounded-md p-2 border border-orange-100 space-y-1.5">
                    {onEditChange ? (
                      <>
                        <input
                          type="text"
                          value={faq._q}
                          onChange={e => updateFaq(idx, "_q", e.target.value)}
                          className="w-full rounded border border-orange-200 px-2 py-1 text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                        />
                        <textarea
                          rows={2}
                          value={faq._a}
                          onChange={e => updateFaq(idx, "_a", e.target.value)}
                          className="w-full rounded border border-orange-200 px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white resize-none leading-relaxed"
                        />
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-semibold text-slate-800 mb-0.5 flex items-start gap-1"><HelpCircle className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />{faq.question}</div>
                        <div className="text-[11px] text-slate-600 leading-relaxed pl-4">{faq.answer}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        FAQ вставляются в БД → SSG пересобирается → Google уведомляется через IndexNow
      </p>
    </div>
  );
}

/* ── EditableMetaBlock ───────────────────────────────────────────────── */
function EditableMetaBlock({
  s,
  onEditChange,
}: {
  s: SeoSuggestion;
  onEditChange?: (v: string) => void;
}) {
  const isBrand = s.page_url?.startsWith("/brands/");
  const cur   = parseMeta(s.current_value);
  const initP = parseMeta(s.proposed_value);
  const [title, setTitle] = useState(initP.title ?? "");
  const [desc,  setDesc]  = useState(initP.desc  ?? "");

  const emit = (t: string, d: string) => onEditChange?.(`title: ${t}\ndesc: ${d}`);

  return (
    <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Что будет сделано — обновление мета-тегов{isBrand ? " + SSG rebuild + IndexNow" : ""}
        {onEditChange && <span className="ml-auto flex items-center gap-0.5 text-[10px] font-normal text-blue-400"><Pencil className="w-2.5 h-2.5" /> редактируется</span>}
      </div>
      <div className="grid grid-cols-1 gap-2 text-[11px]">
        {(cur.title || initP.title) && (
          <div className="space-y-1">
            <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Title</div>
            {cur.title && (
              <div className="bg-white rounded px-2 py-1 border border-slate-100 text-slate-500 line-through">{cur.title}</div>
            )}
            {onEditChange ? (
              <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); emit(e.target.value, desc); }}
                className="w-full rounded border border-blue-200 px-2 py-1 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
            ) : (
              <div className="bg-white rounded px-2 py-1 border border-blue-200 text-slate-800 font-medium">{initP.title}</div>
            )}
          </div>
        )}
        {(cur.desc || initP.desc) && (
          <div className="space-y-1">
            <div className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Description</div>
            {cur.desc && (
              <div className="bg-white rounded px-2 py-1.5 border border-slate-100 text-slate-500 line-through leading-relaxed">{cur.desc}</div>
            )}
            {onEditChange ? (
              <textarea
                rows={3}
                value={desc}
                onChange={e => { setDesc(e.target.value); emit(title, e.target.value); }}
                className="w-full rounded border border-blue-200 px-2 py-1.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none leading-relaxed"
              />
            ) : (
              <div className="bg-white rounded px-2 py-1.5 border border-blue-200 text-slate-800 leading-relaxed">{initP.desc}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── EditableClusterBlock ─────────────────────────────────────────────── */
function EditableClusterBlock({
  s,
  onEditChange,
}: {
  s: SeoSuggestion;
  onEditChange?: (v: string) => void;
}) {
  const { page_url, proposed_value } = s;
  const isBrand = page_url?.startsWith("/brands/");

  const initFaqs = React.useMemo(() => {
    if (!proposed_value) return [] as { question: string; answer: string }[];
    if (isBrand) return parseClusterFaqs(proposed_value, page_url!);
    if (page_url === "/cars") {
      const queries = proposed_value.split("\n")
        .map(l => l.replace(/\s*\(позиция[\s\d.,]+\)\s*$/, "").trim()).filter(Boolean);
      const seen = new Set<string>();
      return queries.slice(0, 5).map(q => {
        const ql = q.toLowerCase();
        if (ql.includes("авито") || ql.includes("без посредник"))
          return { question: "Как купить авто с пробегом в Брянске без Авито?", answer: "В Дебрянск Авто все авто прошли проверку перед продажей. Покупайте напрямую у официального дилера: прозрачная история, выгодные условия кредита и трейд-ин." };
        if (ql.includes("купить авто") || ql.includes("купить машин") || ql.includes("куплю"))
          return { question: "Где купить автомобиль в Брянске выгодно?", answer: "Дебрянск Авто — официальный дилер с пробегом. Широкий выбор проверенных автомобилей, прозрачная история, выгодные программы кредитования и трейд-ин." };
        if (ql.includes("с пробегом"))
          return { question: "Какие автомобили с пробегом есть в Брянске?", answer: "В Дебрянск Авто — постоянно обновляемый сток. Все машины прошли диагностику. Смотрите актуальный каталог на сайте." };
        if (ql.includes("авто брянск") || ql.includes("брянск авто"))
          return { question: "Как выбрать автомобиль в Брянске?", answer: "Используйте фильтры на сайте Дебрянск Авто по марке, году, цене и пробегу. Можно забронировать онлайн или записаться на тест-драйв." };
        return { question: "Продаются ли проверенные авто с пробегом в Брянске?", answer: "Да. Все авто с пробегом в Дебрянск Авто проходят техническую проверку перед продажей. Доступны выгодные условия кредитования и трейд-ин." };
      }).filter(f => seen.has(f.question) ? false : (seen.add(f.question), true));
    }
    return [] as { question: string; answer: string }[];
  }, [proposed_value, page_url, isBrand]);

  const [faqs, setFaqs] = useState(initFaqs.map(f => ({ ...f })));

  const updateFaq = (i: number, field: "question" | "answer", val: string) => {
    const updated = faqs.map((f, idx) => idx === i ? { ...f, [field]: val } : f);
    setFaqs(updated);
    onEditChange?.(JSON.stringify(updated));
  };

  const color = isBrand ? "purple" : "purple";
  const borderCls   = isBrand ? "border-purple-100 bg-purple-50/30" : "border-purple-100 bg-purple-50/30";
  const titleColor  = isBrand ? "text-purple-700" : "text-purple-700";
  const inputBorder = "border-purple-200 focus:ring-purple-300";

  return (
    <div className={`border ${borderCls} rounded-lg p-3 space-y-2`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${titleColor}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        Что будет сделано — добавить FAQ-блок{isBrand ? " на страницу бренда" : ` на страницу ${page_url}`} + SSG rebuild + IndexNow
        {onEditChange && <span className="ml-auto flex items-center gap-0.5 text-[10px] font-normal text-purple-400"><Pencil className="w-2.5 h-2.5" /> редактируется</span>}
      </div>
      <div className="space-y-1.5">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white rounded-md p-2 border border-purple-100 space-y-1.5">
            {onEditChange ? (
              <>
                <input
                  type="text"
                  value={faq.question}
                  onChange={e => updateFaq(i, "question", e.target.value)}
                  className={`w-full rounded border ${inputBorder} px-2 py-1 text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 bg-white`}
                />
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={e => updateFaq(i, "answer", e.target.value)}
                  className={`w-full rounded border ${inputBorder} px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-1 bg-white resize-none leading-relaxed`}
                />
              </>
            ) : (
              <>
                <div className="text-[11px] font-semibold text-slate-800 mb-0.5 flex items-start gap-1"><HelpCircle className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />{faq.question}</div>
                <div className="text-[11px] text-slate-600 leading-relaxed pl-4">{faq.answer}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── "Что будет сделано" unified block ───────────────────────────────── */
function WillBeDoneBlock({
  s,
  onEditChange,
}: {
  s: SeoSuggestion;
  onEditChange?: (v: string) => void;
}) {
  const { type, page_url, proposed_value } = s;

  /* META — dispatches to EditableMetaBlock */
  if (type === "meta") return <EditableMetaBlock s={s} onEditChange={onEditChange} />;

  /* CLUSTER — brand page or /cars: dispatches to EditableClusterBlock */
  if (type === "cluster" && (page_url?.startsWith("/brands/") || page_url === "/cars") && proposed_value) {
    return <EditableClusterBlock s={s} onEditChange={onEditChange} />;
  }

  /* CLUSTER — other non-brand */
  if (type === "cluster") {
    const queries = (proposed_value ?? "").split("\n").map(l => l.trim()).filter(Boolean);
    return (
      <div className="border border-amber-100 bg-amber-50/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Wrench className="w-3.5 h-3.5" />
          Что будет сделано — ручная доработка контента страницы
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Задача отмечается выполненной. Рекомендуется усилить заголовки, SEO-описание и фильтры раздела под эти запросы:
        </p>
        <ul className="space-y-0.5">
          {queries.map((q, i) => (
            <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5">
              <span className="text-amber-500 mt-0.5">›</span>{q}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* TECH: auto prerender trigger */
  if (type === "tech") {
    const lines = (proposed_value ?? "").split("\n").map(l => l.trim()).filter(Boolean);
    return (
      <div className="border border-red-100 bg-red-50/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Что будет сделано — принудительный рендер страницы
        </div>
        <div className="text-[11px] text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-red-400">1.</span>
            <span>Puppeteer откроет <span className="font-mono bg-slate-100 px-1 rounded">{page_url}</span> и сохранит HTML в кэш</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-400">2.</span>
            <span>Верификация размера кэша (должен быть {page_url?.startsWith("/brands/") ? "≥ 50 КБ" : "≥ 20 КБ"})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-400">3.</span>
            <span>IndexNow пинг для ускорения переиндексации</span>
          </div>
        </div>
        {lines.length > 0 && (
          <ul className="space-y-0.5 mt-1">
            {lines.map((l, i) => (
              <li key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                <span className="text-red-300 mt-0.5">›</span>{l}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* CONTENT on brand pages — dispatches to ContentBrandPreview (editable) */
  if (type === "content" && page_url?.startsWith("/brands/")) {
    return <ContentBrandPreview suggestionId={s.id} onEditChange={onEditChange} />;
  }

  /* CONTENT — other */
  if (type === "content") {
    const lines = (proposed_value ?? "").split("\n").map(l => l.trim()).filter(Boolean);
    return (
      <div className="border border-amber-100 bg-amber-50/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <FileText className="w-3.5 h-3.5" />
          Что будет сделано — контентные изменения
        </div>
        {lines.length > 0 && (
          <ul className="space-y-0.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5">›</span>{l}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* TEXT_BLOCK — SEO paragraph (editable when pending) */
  if (type === "text_block") {
    return (
      <div className="border border-teal-100 bg-teal-50/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
          <FileText className="w-3.5 h-3.5" />
          Что будет сделано — SEO-текстовый блок
          {onEditChange && <span className="ml-auto flex items-center gap-0.5 text-[10px] font-normal text-teal-400"><Pencil className="w-2.5 h-2.5" /> редактируется</span>}
        </div>
        {onEditChange ? (
          <textarea
            rows={5}
            defaultValue={proposed_value ?? ""}
            onChange={e => onEditChange(e.target.value)}
            className="w-full rounded border border-teal-200 px-2 py-1.5 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white resize-none leading-relaxed"
          />
        ) : (
          <p className="text-[11px] text-slate-700 leading-relaxed">{proposed_value}</p>
        )}
        <p className="text-[10px] text-slate-400 italic">Текст будет добавлен в поле service_text страницы бренда.</p>
      </div>
    );
  }

  /* NEW_PAGE */
  if (type === "new_page") {
    const lines = (proposed_value ?? "").split("\n").map(l => l.trim()).filter(Boolean);
    return (
      <div className="border border-purple-100 bg-purple-50/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
          <Sparkles className="w-3.5 h-3.5" />
          Что будет сделано — AI создаст страницу автоматически
        </div>
        {lines.length > 0 && (
          <ul className="space-y-0.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                <span className="text-purple-400 mt-0.5">›</span>{l}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-purple-500 italic flex items-start gap-1">
          <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
          AI сгенерирует текст, FAQ и мета-теги и сохранит черновик /p/[slug] (~30 сек). Публикация — после ручного одобрения.
        </p>
      </div>
    );
  }

  return null;
}

/* ── DraftPreviewEditor — загружает и редактирует черновик лендинга ─────── */
interface DraftEditorState { empty: boolean; dirty: boolean; loaded: boolean; error: boolean }

function DraftPreviewEditor({
  slug,
  onStateChange,
}: {
  slug: string;
  onStateChange?: (s: DraftEditorState) => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<LandingDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);

  // Emit current state whenever any dependency changes
  const emit = (d: LandingDraft | null, ld: boolean, le: boolean, di: boolean) => {
    onStateChange?.({
      empty: !d?.h1 && (d?.paragraphs.length ?? 0) === 0,
      dirty: di,
      loaded: !ld && !le,
      error: le,
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setDirty(false);
    emit(null, true, false, false);
    getLandingDraft(slug)
      .then(r => {
        if (!cancelled) {
          setDraft(r.data);
          emit(r.data, false, false, false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraft(null);
          setLoadError(true);
          emit(null, false, true, false);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<LandingDraft>) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    setDirty(true);
    emit(next, false, false, true);
  };

  const updateFaq = (i: number, field: "q" | "a", val: string) => {
    if (!draft) return;
    const items = draft.faq_items.map((f, idx) => idx === i ? { ...f, [field]: val } : f);
    update({ faq_items: items });
  };

  const addFaq = () => {
    if (!draft) return;
    update({ faq_items: [...draft.faq_items, { q: "", a: "" }] });
  };

  const removeFaq = (i: number) => {
    if (!draft) return;
    update({ faq_items: draft.faq_items.filter((_, idx) => idx !== i) });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateLandingDraft(slug, {
        h1: draft.h1,
        meta_title: draft.meta_title,
        meta_description: draft.meta_description,
        paragraphs: draft.paragraphs,
        faq_items: draft.faq_items,
      });
      setDirty(false);
      emit(draft, false, false, false);
      toast({ title: "Черновик сохранён" });
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-[11px] text-slate-400 animate-pulse py-1">Загрузка черновика…</div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="text-[11px] text-red-500 py-1 flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Не удалось загрузить черновик — публикация недоступна
      </div>
    );
  }

  const isEmpty = !draft.h1 && draft.paragraphs.length === 0;

  return (
    <div className="border border-green-200 bg-green-50/30 rounded-lg overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50/60 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Просмотр черновика
          {isEmpty && <span className="ml-1 flex items-center gap-0.5 text-red-500 text-[10px] font-normal"><AlertCircle className="w-3 h-3" /> пустой</span>}
          {dirty && !isEmpty && <span className="ml-1 flex items-center gap-0.5 text-amber-600 text-[10px] font-normal"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> не сохранено</span>}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-green-100">
          {/* H1 */}
          <div className="space-y-1 pt-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Заголовок H1</label>
            <input
              type="text"
              value={draft.h1}
              onChange={e => update({ h1: e.target.value })}
              placeholder="Заголовок страницы"
              className="w-full rounded border border-green-200 px-2 py-1.5 text-[12px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
            />
          </div>

          {/* Meta title */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Meta title</label>
            <input
              type="text"
              value={draft.meta_title}
              onChange={e => update({ meta_title: e.target.value })}
              placeholder="Заголовок для поисковиков (до 65 симв.)"
              className="w-full rounded border border-green-200 px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
            />
            <div className="text-[10px] text-slate-400">{draft.meta_title.length} / 65 символов</div>
          </div>

          {/* Meta description */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Meta description</label>
            <textarea
              rows={2}
              value={draft.meta_description}
              onChange={e => update({ meta_description: e.target.value })}
              placeholder="Описание для поисковиков (130–160 симв.)"
              className="w-full rounded border border-green-200 px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400 bg-white resize-none leading-relaxed"
            />
            <div className="text-[10px] text-slate-400">{draft.meta_description.length} / 160 символов</div>
          </div>

          {/* Paragraphs */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Параграфы ({draft.paragraphs.length})
            </label>
            {draft.paragraphs.map((p, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <textarea
                  rows={3}
                  value={p}
                  onChange={e => {
                    const next = draft.paragraphs.map((pp, ii) => ii === i ? e.target.value : pp);
                    update({ paragraphs: next });
                  }}
                  className="flex-1 rounded border border-green-200 px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-green-400 bg-white resize-none leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => update({ paragraphs: draft.paragraphs.filter((_, ii) => ii !== i) })}
                  className="text-slate-400 hover:text-red-500 mt-1 text-[14px] leading-none"
                  title="Удалить параграф"
                >×</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ paragraphs: [...draft.paragraphs, ""] })}
              className="text-[10px] text-green-600 hover:text-green-800 font-medium"
            >+ добавить параграф</button>
          </div>

          {/* FAQ */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              FAQ ({draft.faq_items.length} вопросов)
            </label>
            {draft.faq_items.map((f, i) => (
              <div key={i} className="bg-white border border-green-100 rounded-md p-2 space-y-1.5">
                <div className="flex items-start justify-between gap-1.5">
                  <input
                    type="text"
                    value={f.q}
                    onChange={e => updateFaq(i, "q", e.target.value)}
                    placeholder="Вопрос"
                    className="flex-1 rounded border border-green-200 px-2 py-1 text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-green-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="text-slate-400 hover:text-red-500 text-[14px] leading-none mt-0.5"
                    title="Удалить"
                  >×</button>
                </div>
                <textarea
                  rows={2}
                  value={f.a}
                  onChange={e => updateFaq(i, "a", e.target.value)}
                  placeholder="Ответ"
                  className="w-full rounded border border-green-200 px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-300 bg-white resize-none leading-relaxed"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addFaq}
              className="text-[10px] text-green-600 hover:text-green-800 font-medium"
            >+ добавить вопрос</button>
          </div>

          {/* Save button */}
          {dirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs w-full"
            >
              {saving ? "Сохраняю…" : "Сохранить изменения"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SuggestionCard ──────────────────────────────────────────────────── */
function SuggestionCard({ s, maxScore, onApply, onReject, isApplying, isRejecting }: {
  s: SeoSuggestion;
  maxScore: number;
  onApply: (overrideValue?: string) => void;
  onReject: (reason?: string) => void;
  isApplying: boolean;
  isRejecting: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [editedValue, setEditedValue] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [draftState, setDraftState] = useState<DraftEditorState>({ empty: true, dirty: false, loaded: false, error: false });
  const typeInfo   = TYPE_LABELS[s.type]   ?? { label: s.type,   color: "bg-slate-100 text-slate-700" };
  const statusInfo = STATUS_LABELS[s.status] ?? { label: s.status, color: "bg-slate-100 text-slate-700" };
  const isPending = s.status === "pending";
  const isError   = s.status === "applied_with_errors";

  // Animated progress while applying (estimated 45 seconds)
  const applyProgress = useAnimatedProgress(isApplying, 45000);

  // Extract slug from verification_log for new_page publish button
  const draftSlug = s.type === "new_page" && s.status === "applied" && s.verification_log
    ? (s.verification_log.match(/\/p\/([a-z0-9-]+)/) ?? [])[1] ?? null
    : null;
  const alreadyPublished = draftSlug && s.verification_log?.includes("Страница опубликована:");

  const handlePublish = async () => {
    if (!draftSlug || publishing) return;
    setPublishing(true);
    try {
      await publishLandingPage(draftSlug);
      toast({ title: "Опубликовано", description: `Страница /p/${draftSlug} теперь доступна публично.` });
      qc.invalidateQueries({ queryKey: ["seo-autopilot-suggestions"] });
    } catch {
      toast({ title: "Ошибка публикации", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-3 ${s.blocked_by_tech ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}>
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            {s.generated_by === "ai" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            )}
            {s.is_anchor_boosted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <Target className="w-3 h-3" /> Анкерный
              </span>
            )}
            {s.blocked_by_tech && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3 h-3" />Блокирован тех. ошибкой
              </span>
            )}
          </div>
          <a
            href={`https://debryansk-auto.ru${s.page_url}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[#0070b8] font-mono text-sm hover:underline"
          >
            {s.page_url}
          </a>
        </div>
        <div className="text-right min-w-[90px]">
          <div className="text-xs text-slate-500">Приоритет</div>
          <div className="font-bold text-slate-800">{Math.round(s.priority_score).toLocaleString("ru-RU")}</div>
          <ScoreBar score={s.priority_score} max={maxScore} />
        </div>
      </div>

      {/* Metrics — compact inline row */}
      <div className="flex items-center gap-3 text-xs text-slate-500 border-t border-slate-100 pt-2">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-slate-700">{s.demand.toLocaleString("ru-RU")}</span>
          <span>спрос</span>
        </span>
        <span className="text-slate-200">·</span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-slate-700">{(s.position_factor * 100).toFixed(0)}%</span>
          <span>позиция</span>
        </span>
        <span className="text-slate-200">·</span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-slate-700">{(s.ease * 100).toFixed(0)}%</span>
          <span>лёгкость</span>
        </span>
      </div>

      {/* Reasoning */}
      <p className="text-xs text-slate-600 leading-relaxed">{s.reasoning}</p>

      {/* ── Что будет сделано (unified for all types, editable when pending) ── */}
      <WillBeDoneBlock
        s={s}
        onEditChange={(isPending || isError) ? (v) => setEditedValue(v) : undefined}
      />

      {/* Apply progress bar */}
      {isApplying && (
        <ProgressBar
          progress={applyProgress}
          label={s.type === "new_page" ? "AI генерирует страницу…" : "Применяю: SSG rebuild + верификация..."}
          color={s.type === "new_page" ? "bg-purple-500" : "bg-[#0070b8]"}
        />
      )}

      {/* Verification log — success banner + log text */}
      {s.status === "applied" && s.verification_log && (
        <div className="bg-green-50 border border-green-200 rounded p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Применено успешно
          </div>
          <div className="text-[11px] font-mono text-slate-600 whitespace-pre-wrap">
            {s.verification_log.split(/(\s+)/).map((token, i) =>
              /^\/p\/[a-z0-9-]+$/.test(token) ? (
                <a
                  key={i}
                  href={`https://debryansk-auto.ru${token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0070b8] underline hover:text-[#005a94]"
                >
                  {token}
                </a>
              ) : token
            )}
          </div>
        </div>
      )}
      {s.status !== "applied" && s.verification_log && (
        <div className="bg-slate-50 rounded p-2 text-[11px] font-mono text-slate-600 whitespace-pre-wrap">
          {s.verification_log}
        </div>
      )}

      {/* Publish button for new_page drafts */}
      {draftSlug && !alreadyPublished && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <FilePlus className="w-3.5 h-3.5" />
            Черновик готов — нужно ручное одобрение
          </div>
          <p className="text-[11px] text-slate-600">
            Страница <span className="font-mono bg-slate-100 px-1 rounded">/p/{draftSlug}</span> сохранена как черновик.
            Просмотрите и при необходимости отредактируйте контент перед публикацией.
          </p>

          {/* Draft editor */}
          <DraftPreviewEditor slug={draftSlug} onStateChange={setDraftState} />

          {/* Publish button — blocked until draft is loaded, saved, and non-empty */}
          {(() => {
            const notLoaded = !draftState.loaded && !draftState.error;
            const blockReason = draftState.error
              ? "Черновик не загружен — публикация недоступна"
              : notLoaded
              ? "Ожидаем загрузки черновика…"
              : draftState.dirty
              ? "Сохраните изменения перед публикацией"
              : draftState.empty
              ? "Черновик пустой — добавьте контент перед публикацией"
              : null;
            return (
              <>
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing || !!blockReason}
                  title={blockReason ?? undefined}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {publishing ? "Публикую…" : "Опубликовать страницу"}
                </Button>
                {blockReason && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{blockReason}</p>
                )}
              </>
            );
          })()}
        </div>
      )}
      {draftSlug && alreadyPublished && (
        <div className="text-[11px] text-green-700 font-medium flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Страница опубликована:{" "}
          <a href={`https://debryansk-auto.ru/p/${draftSlug}`} target="_blank" rel="noopener noreferrer"
             className="text-[#0070b8] underline">/p/{draftSlug}</a>
        </div>
      )}

      {/* Actions */}
      {(isPending || isError) && !isApplying && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onApply(editedValue ?? undefined)}
              disabled={isRejecting}
              className="bg-[#0070b8] hover:bg-[#005f9e] text-white text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {isError ? "Повторить" : (editedValue !== null ? "Применить (отредактировано)" : "Применить")}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => setShowRejectInput(v => !v)}
              disabled={isRejecting}
              className="border-slate-200 text-slate-600 text-xs"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Отклонить
            </Button>
          </div>
          {showRejectInput && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
              <textarea
                rows={2}
                placeholder="Причина отклонения (необязательно)"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { onReject(rejectNote.trim() || undefined); setShowRejectInput(false); setRejectNote(""); }}
                  disabled={isRejecting}
                  className="bg-slate-700 hover:bg-slate-800 text-white text-xs"
                >
                  Подтвердить отклонение
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRejectInput(false)} className="text-xs">
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function SeoAutopilotPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab]               = useState<"suggestions" | "alerts" | "quota" | "gap-runs">("suggestions");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [applyingId, setApplyingId]     = useState<number | null>(null);
  const [rejectingId, setRejectingId]   = useState<number | null>(null);

  const { data: statusData } = useQuery({
    queryKey: ["seo-autopilot-status"],
    queryFn: getSeoAutopilotStatus,
    refetchInterval: 5000,
  });

  const { data: suggestionsData, isLoading: loadingSuggestions } = useQuery({
    queryKey: ["seo-autopilot-suggestions", typeFilter, statusFilter],
    queryFn: () => getSeoAutopilotSuggestions({ type: typeFilter !== "all" ? typeFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined }),
    enabled: tab === "suggestions",
  });

  const { data: alertsData } = useQuery({
    queryKey: ["seo-autopilot-alerts"],
    queryFn: getSeoAutopilotAlerts,
    enabled: tab === "alerts",
  });

  const { data: quotaData } = useQuery({
    queryKey: ["seo-autopilot-quota"],
    queryFn: getSeoAutopilotQuota,
    enabled: tab === "quota",
  });

  const { data: gapRunsData, refetch: refetchGapRuns } = useQuery({
    queryKey: ["seo-gap-runs"],
    queryFn: () => getGapRuns({ limit: 50 }),
    enabled: tab === "gap-runs",
    refetchInterval: tab === "gap-runs" && !!statusData?.gapRunning ? 3000 : false,
  });

  // Progress bars for long-running operations
  const wordstatProgress = useAnimatedProgress(!!statusData?.wordstatRunning, 120000); // ~2 min
  const gapProgress      = useAnimatedProgress(!!statusData?.gapRunning,      90000);  // ~1.5 min

  const applyMutation = useMutation({
    mutationFn: ({ id, overrideValue }: { id: number; overrideValue?: string }) =>
      applySeoSuggestion(id, overrideValue),
    onSuccess: () => {
      setApplyingId(null);
      toast({ title: "Применение запущено", description: "Верификация займёт 30–60 секунд." });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["seo-autopilot-suggestions"] });
        qc.invalidateQueries({ queryKey: ["seo-autopilot-status"] });
      }, 5000);
    },
    onError: (err: Error) => {
      setApplyingId(null);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => rejectSeoSuggestion(id, reason),
    onSuccess: () => {
      setRejectingId(null);
      qc.invalidateQueries({ queryKey: ["seo-autopilot-suggestions"] });
    },
    onError: (err: Error) => {
      setRejectingId(null);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const wordstatMutation = useMutation({
    mutationFn: runWordstatFetch,
    onSuccess: () => toast({ title: "Wordstat запущен", description: "Обновление займёт несколько минут." }),
    onError:   (err: Error) => toast({ title: "Ошибка Wordstat", description: err.message, variant: "destructive" }),
  });

  const gapMutation = useMutation({
    mutationFn: runGapAnalysis,
    onSuccess: () => {
      toast({ title: "GAP-анализ запущен", description: "Новые находки появятся через 1–2 минуты." });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["seo-autopilot-suggestions"] });
        qc.invalidateQueries({ queryKey: ["seo-autopilot-status"] });
      }, 3000);
    },
    onError: (err: Error) => toast({ title: "Ошибка GAP", description: err.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => resolveOauthAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-autopilot-alerts"] }),
  });

  const [cleanupPreview, setCleanupPreview] = useState<{
    rows: { id: number; page_slug: string; question: string; reason: string }[];
    groups: { pageSlug: string; canonicalKey: string; keptVariant: string; deletedVariant: string; deletedCount: number }[];
    affectedPages: string[];
  } | null>(null);

  const cleanupDryRunMutation = useMutation({
    mutationFn: () => cleanupDuplicateModelFaqs(true),
    onSuccess: (data) => {
      if (!data.rows || data.rows.length === 0) {
        toast({ title: "Дубликатов не найдено", description: "FAQ-база чистая." });
      } else {
        setCleanupPreview({ rows: data.rows, groups: data.groups ?? [], affectedPages: data.affectedPages });
      }
    },
    onError: (err: Error) => toast({ title: "Ошибка анализа", description: err.message, variant: "destructive" }),
  });

  const cleanupFaqsMutation = useMutation({
    mutationFn: () => cleanupDuplicateModelFaqs(false),
    onSuccess: (data) => {
      setCleanupPreview(null);
      toast({
        title: data.deleted && data.deleted > 0 ? `Удалено ${data.deleted} дубл. FAQ` : "Дубликатов не найдено",
        description: data.affectedPages.length > 0 ? `Затронуто страниц: ${data.affectedPages.join(", ")}` : undefined,
      });
    },
    onError: (err: Error) => toast({ title: "Ошибка очистки", description: err.message, variant: "destructive" }),
  });

  const resetRerunMutation = useMutation({
    mutationFn: resetAndRerunGap,
    onSuccess: (data) => {
      toast({ title: "Сброс выполнен", description: data.message });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["seo-autopilot-suggestions"] });
        qc.invalidateQueries({ queryKey: ["seo-autopilot-status"] });
        qc.invalidateQueries({ queryKey: ["seo-gap-runs"] });
      }, 2000);
    },
    onError: (err: Error) => toast({ title: "Ошибка сброса", description: err.message, variant: "destructive" }),
  });

  const suggestions = (suggestionsData?.data ?? []) as SeoSuggestion[];
  const maxScore    = suggestions.reduce((m, s) => Math.max(m, s.priority_score), 1);
  const counts      = statusData?.counts as { pending: number; applied: number; errors: number; rejected: number; blocked: number } | undefined;

  const wordstatRunning = !!statusData?.wordstatRunning;
  const gapRunning      = !!statusData?.gapRunning;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#0070b8]" />
            SEO Autopilot
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Wordstat + Вебмастер + Метрика → GAP-анализ → аппрув изменений
          </p>
        </div>

        {/* Buttons + progress bars */}
        <div className="flex flex-col gap-3 min-w-[220px]">
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => wordstatMutation.mutate()}
              disabled={wordstatMutation.isPending || wordstatRunning}
              className="border-slate-200 text-slate-600 text-xs flex-1"
            >
              <Database className={`w-3.5 h-3.5 mr-1 ${wordstatRunning ? "animate-spin" : ""}`} />
              {wordstatRunning ? "Обновляю..." : "Обновить Wordstat"}
            </Button>
            <Button
              size="sm"
              onClick={() => gapMutation.mutate()}
              disabled={gapMutation.isPending || gapRunning}
              className="bg-[#0070b8] hover:bg-[#005f9e] text-white text-xs flex-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${gapRunning ? "animate-spin" : ""}`} />
              {gapRunning ? "Анализирую..." : "GAP-анализ"}
            </Button>
          </div>

          {/* Maintenance row */}
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => cleanupDryRunMutation.mutate()}
              disabled={cleanupDryRunMutation.isPending || cleanupFaqsMutation.isPending}
              className="border-orange-200 text-orange-700 hover:bg-orange-50 text-xs flex-1"
              title="Находит дублирующиеся FAQ-блоки (JOLION + ДЖОЛИОН → одна модель)"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {cleanupDryRunMutation.isPending ? "Ищу..." : "Дубли FAQ"}
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => resetRerunMutation.mutate()}
              disabled={resetRerunMutation.isPending || gapRunning}
              className="border-red-200 text-red-700 hover:bg-red-50 text-xs flex-1"
              title="Удаляет все pending-предложения и запускает GAP-анализ заново"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {resetRerunMutation.isPending ? "Сбрасываю..." : "Сброс + пересчёт"}
            </Button>
          </div>

          {/* Wordstat progress */}
          {wordstatProgress > 0 && (
            <ProgressBar
              progress={wordstatProgress}
              label="Wordstat: обновление данных Метрики..."
              color="bg-slate-500"
            />
          )}
          {/* GAP progress */}
          {gapProgress > 0 && (
            <ProgressBar
              progress={gapProgress}
              label="GAP-анализ: поиск новых находок..."
              color="bg-[#0070b8]"
            />
          )}
        </div>
      </div>

      {/* Cleanup confirmation modal */}
      {cleanupPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={() => setCleanupPreview(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Найдено {cleanupPreview.groups.length} дублирующихся блоков модели
              </h3>
              <button onClick={() => setCleanupPreview(null)}><XCircle className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-3">
              {cleanupPreview.groups.length > 0 ? (
                cleanupPreview.groups.map((g, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-xs space-y-1">
                    <div className="font-mono text-orange-600 text-[10px]">{g.pageSlug}</div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-green-700 font-semibold"><Check className="w-3.5 h-3.5" /> Оставить: «{g.keptVariant}»</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-1 text-red-600 font-semibold"><XCircle className="w-3.5 h-3.5" /> Удалить: «{g.deletedVariant}» ({g.deletedCount} FAQ)</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-1.5">
                  {cleanupPreview.rows.map((r) => (
                    <div key={r.id} className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium"><XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />«{r.question}»</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{r.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500 mb-3">
                Будет удалено {cleanupPreview.rows.length} FAQ-записей с нежелательным написанием модели.
                Все FAQ с каноническим написанием сохранятся.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setCleanupPreview(null)}>Отмена</Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={cleanupFaqsMutation.isPending}
                  onClick={() => cleanupFaqsMutation.mutate()}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {cleanupFaqsMutation.isPending ? "Удаляю..." : `Удалить ${cleanupPreview.rows.length} дублей`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ожидают",   value: counts?.pending  ?? 0, color: "text-slate-800" },
          { label: "Применено", value: counts?.applied  ?? 0, color: "text-green-700" },
          { label: "Ошибки",    value: counts?.errors   ?? 0, color: "text-red-600"   },
          { label: "Блокированы", value: counts?.blocked ?? 0, color: "text-orange-600" },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs — segment-control style matching SEO hub outer nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto shrink-0">
        {[
          { id: "suggestions", label: "Находки",        icon: BarChart3   },
          { id: "gap-runs",    label: "Логи GAP",       icon: Activity,   dot: gapRunning },
          { id: "alerts",      label: "Алерты",         icon: ShieldAlert, count: statusData?.unresolvedAlerts as number | undefined },
          { id: "quota",       label: "Квота Wordstat", icon: Database    },
        ].map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] ${
                isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#0070b8]" : ""}`} />
              {t.label}
              {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-[#0070b8] animate-pulse" />}
              {t.count ? <span className="ml-0.5 px-1.5 py-0 rounded-full text-xs font-semibold bg-red-100 text-red-700">{t.count}</span> : null}
            </button>
          );
        })}
      </div>

      {/* ── Suggestions tab ── */}
      {tab === "suggestions" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0070b8]/30"
            >
              <option value="all">Все типы</option>
              <option value="meta">Мета-теги</option>
              <option value="cluster">НЧ-кластер</option>
              <option value="tech">Технический</option>
              <option value="content">Контент</option>
              <option value="text_block">Текст</option>
              <option value="new_page">Новая стр.</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0070b8]/30"
            >
              <option value="all">Все статусы</option>
              <option value="pending">Ожидают</option>
              <option value="applied">Применено</option>
              <option value="applied_with_errors">С ошибками</option>
              <option value="rejected">Отклонено</option>
            </select>
            <div className="text-sm text-slate-500 self-center">
              {suggestionsData?.total ?? 0} находок
            </div>
          </div>

          {loadingSuggestions ? (
            <div className="text-sm text-slate-400">Загрузка...</div>
          ) : suggestions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                {statusFilter === "pending"
                  ? "Нет ожидающих находок. Запустите GAP-анализ."
                  : "Нет находок с выбранными фильтрами."}
              </p>
              {statusFilter === "pending" && (
                <Button
                  size="sm" className="mt-3 bg-[#0070b8] hover:bg-[#005f9e] text-white text-xs"
                  onClick={() => gapMutation.mutate()}
                  disabled={gapMutation.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Запустить GAP-анализ
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(s => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  maxScore={maxScore}
                  onApply={(overrideValue) => { setApplyingId(s.id); applyMutation.mutate({ id: s.id, overrideValue }); }}
                  onReject={(reason?: string) => { setRejectingId(s.id); rejectMutation.mutate({ id: s.id, reason }); }}
                  isApplying={applyingId === s.id && applyMutation.isPending}
                  isRejecting={rejectingId === s.id && rejectMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GAP Runs log tab ── */}
      {tab === "gap-runs" && (
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {gapRunsData?.total ?? 0} запусков всего
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => refetchGapRuns()}
              className="border-slate-200 text-slate-600 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Обновить
            </Button>
          </div>

          {/* Running indicator */}
          {gapRunning && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
              <Activity className="w-4 h-4 text-[#0070b8] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="text-sm font-medium text-[#0070b8]">GAP-анализ выполняется...</div>
                <ProgressBar progress={gapProgress} color="bg-[#0070b8]" />
              </div>
            </div>
          )}

          {/* Runs list */}
          {!gapRunsData?.data.length ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
              Нет записей. Запустите GAP-анализ.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Статус</th>
                    <th className="text-left px-4 py-3">Запуск</th>
                    <th className="text-left px-4 py-3">Источник</th>
                    <th className="text-right px-4 py-3">Длительность</th>
                    <th className="text-right px-4 py-3">Находок</th>
                    <th className="text-right px-4 py-3">Применено</th>
                    <th className="text-right px-4 py-3">Wordstat</th>
                    <th className="text-right px-4 py-3">Вебмастер</th>
                  </tr>
                </thead>
                <tbody>
                  {(gapRunsData.data as GapRun[]).map((run, i) => {
                    const isRunning   = run.status === "running";
                    const isCompleted = run.status === "completed";
                    const isError     = run.status === "error";
                    const durationSec = run.duration_ms != null
                      ? run.duration_ms < 60000
                        ? `${(run.duration_ms / 1000).toFixed(1)} с`
                        : `${(run.duration_ms / 60000).toFixed(1)} мин`
                      : "—";
                    return (
                      <tr key={run.id} className={`border-t border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                        {/* Status */}
                        <td className="px-4 py-2.5">
                          {isRunning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Выполняется
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Выполнен
                            </span>
                          )}
                          {isError && (
                            <span
                              title={run.error_message ?? ""}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 cursor-help"
                            >
                              <XCircle className="w-3 h-3" />
                              Ошибка
                            </span>
                          )}
                        </td>
                        {/* Started at */}
                        <td className="px-4 py-2.5 text-slate-700 text-xs font-mono whitespace-nowrap">
                          {new Date(run.started_at).toLocaleString("ru-RU", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        {/* Triggered by */}
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            run.triggered_by === "manual"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {run.triggered_by === "manual" ? "Вручную" : "Авто (Wordstat)"}
                          </span>
                        </td>
                        {/* Duration */}
                        <td className="px-4 py-2.5 text-right text-slate-600 text-xs tabular-nums">{durationSec}</td>
                        {/* Suggestions created */}
                        <td className="px-4 py-2.5 text-right">
                          {run.suggestions_created != null ? (
                            <span className={`font-bold text-sm ${run.suggestions_created > 0 ? "text-[#0070b8]" : "text-slate-400"}`}>
                              {run.suggestions_created}
                            </span>
                          ) : "—"}
                        </td>
                        {/* Applied count */}
                        <td className="px-4 py-2.5 text-right">
                          {run.applied_count != null && run.applied_count > 0 ? (
                            <span className="inline-flex items-center gap-0.5 font-bold text-sm text-green-600"><Check className="w-3 h-3" />{run.applied_count}</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        {/* Wordstat rows */}
                        <td className="px-4 py-2.5 text-right text-slate-500 text-xs tabular-nums">
                          {run.wordstat_rows ?? "—"}
                        </td>
                        {/* Webmaster rows */}
                        <td className="px-4 py-2.5 text-right text-slate-500 text-xs tabular-nums">
                          {run.webmaster_rows ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Error details expandable */}
              {(gapRunsData.data as GapRun[]).some(r => r.error_message) && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Сообщения об ошибках</div>
                  {(gapRunsData.data as GapRun[]).filter(r => r.error_message).map(run => (
                    <div key={run.id} className="bg-red-50 border border-red-100 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 mb-0.5 font-mono">
                        #{run.id} · {new Date(run.started_at).toLocaleString("ru-RU")}
                      </div>
                      <div className="text-[11px] text-red-700 font-mono whitespace-pre-wrap break-all">
                        {run.error_message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Alerts tab ── */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {!alertsData?.data.length ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
              Нет алертов
            </div>
          ) : (
            (alertsData.data as OauthAlert[]).map(alert => (
              <div key={alert.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${alert.resolved_at ? "border-slate-200 opacity-60" : "border-red-200 bg-red-50/30"}`}>
                <ShieldAlert className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alert.resolved_at ? "text-slate-400" : "text-red-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${alert.status === "resolved" ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-700"}`}>
                      {alert.service}
                    </Badge>
                    <span className="text-xs text-slate-500">{new Date(alert.created_at).toLocaleString("ru-RU")}</span>
                  </div>
                  <p className="text-sm text-slate-700">{alert.message}</p>
                  {alert.resolved_at && (
                    <p className="text-xs text-green-600 mt-1">Resolved {new Date(alert.resolved_at).toLocaleString("ru-RU")}</p>
                  )}
                </div>
                {!alert.resolved_at && (
                  <Button
                    size="sm" variant="outline" className="border-slate-200 text-slate-600 text-xs flex-shrink-0"
                    onClick={() => resolveMutation.mutate(alert.id)}
                    disabled={resolveMutation.isPending}
                  >
                    Закрыть
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Quota tab ── */}
      {tab === "quota" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">История запросов к Wordstat API</h2>
            <p className="text-xs text-slate-500 mt-0.5">Лимит: 10 запросов/сек на токен. Плановый запуск: среда 03:00 МСК.</p>
          </div>
          {!quotaData?.data.length ? (
            <div className="p-10 text-center text-slate-400 text-sm">Нет данных. Запустите Wordstat.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="text-left px-5 py-3">Дата</th>
                  <th className="text-right px-5 py-3">Использовано</th>
                  <th className="text-right px-5 py-3">Оценка</th>
                  <th className="text-right px-5 py-3">Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {(quotaData.data as WordstatQuotaEntry[]).map((q, i) => (
                  <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                    <td className="px-5 py-2.5 font-mono text-slate-700">{q.date}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-slate-800">{q.calls_used}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{q.calls_estimated}</td>
                    <td className="px-5 py-2.5 text-right text-slate-400 text-xs">
                      {new Date(q.updated_at).toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
