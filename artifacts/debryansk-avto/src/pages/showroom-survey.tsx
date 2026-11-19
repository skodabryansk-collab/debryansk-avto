import { useEffect, useMemo, useRef, useState } from "react";
import { useGetShowroomSurveyModels, useSubmitShowroomSurvey } from "@workspace/api-client-react";
import type { ShowroomSurveyModel, ShowroomSurveyRatings } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, ChevronRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import SEO from "@/components/SEO";
import { usePhoneMask, isPhoneValid } from "@/hooks/usePhoneMask";
import "@/styles/showroom-survey.css";

const QUESTIONS: { key: keyof ShowroomSurveyRatings; title: string; description: string }[] = [
  { key: "design", title: "Внешний вид и дизайн", description: "Насколько вам понравился экстерьер автомобиля?" },
  { key: "interior", title: "Качество материалов салона", description: "Оцените материалы, качество пластика, кожи и отделки." },
  { key: "driverComfort", title: "Комфорт водителя", description: "Насколько удобно вам было за рулём?" },
  { key: "rearSeat", title: "Комфорт на заднем ряду", description: "Оцените пространство и удобство для пассажиров." },
  { key: "trunk", title: "Багажник и складывание сидений", description: "Насколько удобны багажник и трансформация салона?" },
];

type Evaluation = { modelId: string; ratings: ShowroomSurveyRatings };
type Step = "brand-intro" | "intro" | "choose-brand" | "choose-model" | "rate" | "next-model" | "contact" | "success";
type SurveyDraft = {
  evaluations: Evaluation[];
  activeModelId: string | null;
  ratings: ShowroomSurveyRatings;
};

const DRAFT_STORAGE_KEY = "showroom-survey-draft-v1";
const RATING_KEYS: (keyof ShowroomSurveyRatings)[] = ["design", "interior", "driverComfort", "rearSeat", "trunk"];
const RATING_COLORS: Record<number, string> = {
  1: "#b63b37",
  2: "#c76632",
  3: "#bd8b2f",
  4: "#668d3d",
  5: "#24815b",
};

const blankRatings = (): ShowroomSurveyRatings => ({
  design: 0, interior: 0, driverComfort: 0, rearSeat: 0, trunk: 0,
});

function isRatings(value: unknown): value is ShowroomSurveyRatings {
  if (!value || typeof value !== "object") return false;
  return RATING_KEYS.every((key) => {
    const rating = (value as Record<string, unknown>)[key];
    return typeof rating === "number" && Number.isInteger(rating) && rating >= 0 && rating <= 5;
  });
}

function readSurveyDraft(): SurveyDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const evaluations = Array.isArray(parsed.evaluations)
      ? parsed.evaluations.filter((item): item is Evaluation =>
          !!item
          && typeof item === "object"
          && typeof (item as Record<string, unknown>).modelId === "string"
          && isRatings((item as Record<string, unknown>).ratings),
        )
      : [];
    const activeModelId = typeof parsed.activeModelId === "string" ? parsed.activeModelId : null;
    const ratings = isRatings(parsed.ratings) ? parsed.ratings : blankRatings();
    if (!evaluations.length && !activeModelId) return null;
    return { evaluations, activeModelId, ratings };
  } catch {
    return null;
  }
}

function newSubmissionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `survey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ShowroomSurveyPage() {
  const modelsQuery = useGetShowroomSurveyModels();
  const submitSurvey = useSubmitShowroomSurvey();
  const models = modelsQuery.data?.ok ? modelsQuery.data.data : [];
  const [initialDraft] = useState(readSurveyDraft);
  const [step, setStep] = useState<Step>(() => {
    if (initialDraft) return "choose-brand";
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "intro" : "brand-intro";
  });
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => initialDraft?.evaluations ?? []);
  const [activeModel, setActiveModel] = useState<ShowroomSurveyModel | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(() => initialDraft?.activeModelId ?? null);
  const [ratings, setRatings] = useState<ShowroomSurveyRatings>(() => initialDraft?.ratings ?? blankRatings());
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [name, setName] = useState("");
  const phone = usePhoneMask();
  const [consent, setConsent] = useState(false);
  const [communicationsConsent, setCommunicationsConsent] = useState(false);
  const [brandIntroLeaving, setBrandIntroLeaving] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [validationField, setValidationField] = useState<"name" | "phone" | "consent" | "ratings" | "submit" | "">("");
  const [submitError, setSubmitError] = useState("");
  const submissionKey = useRef<{ fingerprint: string; id: string } | null>(null);
  const source = useMemo(() => new URLSearchParams(window.location.search).get("source") || undefined, []);
  const brands = useMemo(() => [...new Set(models.map((model) => model.brand))]
    .sort((a, b) => a.localeCompare(b, "ru")), [models]);
  const brandModels = useMemo(() => selectedBrand
    ? models.filter((model) => model.brand === selectedBrand)
    : [], [models, selectedBrand]);

  useEffect(() => {
    if (step !== "brand-intro") return;
    const timeout = window.setTimeout(() => setBrandIntroLeaving(true), 1450);
    return () => window.clearTimeout(timeout);
  }, [step]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    try {
      if (step === "success") {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      if (!evaluations.length && !activeModelId) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ evaluations, activeModelId, ratings }));
    } catch {
      // A full session-storage quota must not interrupt the survey.
    }
  }, [activeModelId, evaluations, ratings, step]);

  const completedRatings = QUESTIONS.every(({ key }) => ratings[key] >= 1 && ratings[key] <= 5);
  const phoneValid = isPhoneValid(phone.value);
  const ranking = useMemo(() => step === "success" ? [...evaluations]
    .map((evaluation, index) => ({
      ...evaluation,
      model: models.find((model) => model.id === evaluation.modelId),
      score: Object.values(evaluation.ratings).reduce((sum, value) => sum + value, 0) / 5,
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index) : [], [evaluations, models, step]);

  function beginSurvey() {
    if (modelsQuery.isLoading) return;
    setStep("choose-brand");
  }

  function startRating(model: ShowroomSurveyModel) {
    setActiveModel(model);
    setValidationError("");
    setValidationField("");
    const saved = evaluations.find((item) => item.modelId === model.id);
    const inProgress = activeModelId === model.id ? ratings : null;
    setActiveModelId(model.id);
    setRatings(inProgress ?? saved?.ratings ?? blankRatings());
    setStep("rate");
  }

  function saveEvaluation() {
    if (!activeModel || !completedRatings) {
      setValidationError("Поставьте оценку по каждому пункту, чтобы продолжить.");
      setValidationField("ratings");
      return;
    }
    setValidationError("");
    setValidationField("");
    const next = [...evaluations.filter((item) => item.modelId !== activeModel.id), { modelId: activeModel.id, ratings }];
    setEvaluations(next);
    setStep("next-model");
  }

  function submit() {
    setValidationError("");
    setValidationField("");
    setSubmitError("");
    if (name.trim().length < 2) {
      setValidationError("Укажите, пожалуйста, ваше имя.");
      setValidationField("name");
      return;
    }
    if (!phoneValid) {
      setValidationError("Проверьте номер телефона.");
      setValidationField("phone");
      return;
    }
    if (!consent) {
      setValidationError("Для получения подарка необходимо согласие на обработку персональных данных.");
      setValidationField("consent");
      return;
    }
    if (!evaluations.length) {
      setValidationError("Оцените хотя бы один автомобиль.");
      setValidationField("submit");
      return;
    }
    const fingerprint = JSON.stringify({
      name: name.trim(),
      phone: phone.value,
      source,
      consent,
      communicationsConsent,
      evaluations,
    });
    const submissionId = submissionKey.current?.fingerprint === fingerprint
      ? submissionKey.current.id
      : newSubmissionId();
    submissionKey.current = { fingerprint, id: submissionId };
    submitSurvey.mutate({
      data: {
        submissionId,
        name: name.trim(),
        phone: phone.value,
        consent: true,
        communicationsConsent,
        ...(source ? { source } : {}),
        evaluations,
      },
    }, {
      onSuccess: (response) => {
        if (response.ok) setStep("success");
        else setSubmitError("Не удалось подтвердить отправку. Попробуйте ещё раз.");
      },
      onError: () => setSubmitError("Не удалось отправить данные. Проверьте соединение и попробуйте ещё раз."),
    });
  }

  const stepNumber = step === "choose-brand" || step === "choose-model" ? 1 : step === "rate" ? 2 : step === "next-model" ? 3 : step === "contact" ? 4 : 0;
  const progress = stepNumber ? (stepNumber / 4) * 100 : 0;

  return (
    <main className="refined-survey">
      <SEO
        title="Оцените автомобили в шоуруме — Дебрянск Авто"
        description="Оцените автомобили в шоуруме Дебрянск Авто и отправьте заявку, чтобы получить подарок у сотрудника."
        canonical="/showroom-survey"
        robots="noindex, nofollow"
      />
      {step !== "brand-intro" && (
        <header className="rs-header">
          <div className="rs-header-inner">
            <img
              src="/brand/space-logo-lockup.png"
              alt="Дебрянск Авто — Пространство автомобилей"
              className="rs-logo"
              data-testid="survey-brand-logo"
            />
            {stepNumber > 0 && step !== "success" && <span className="rs-header-note">Опрос посетителей</span>}
          </div>
        </header>
      )}

      <div className={`rs-shell${step === "success" ? " rs-shell-success" : ""}`}>
        {step === "brand-intro" && (
          <div
            className={`rs-opening${brandIntroLeaving ? " rs-opening-out" : ""}`}
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget && event.propertyName === "opacity" && brandIntroLeaving) {
                setStep("intro");
              }
            }}
            data-testid="survey-brand-intro"
          >
            <div className="rs-opening-light" />
            <div className="rs-opening-mark">
              <img src="/brand/space-logo-lockup.png" alt="Дебрянск Авто — Пространство автомобилей" />
              <span className="rs-opening-sheen" />
            </div>
            <div className="rs-opening-loader" aria-hidden="true"><span /></div>
            <Button type="button" onClick={() => setBrandIntroLeaving(true)} className="rs-opening-skip" variant="ghost" data-testid="button-skip-logo-intro">Перейти к опросу <ArrowRight aria-hidden="true" /></Button>
          </div>
        )}

        {stepNumber > 0 && step !== "success" && (
          <div className="rs-progress" aria-label={`Этап ${stepNumber} из 4`}>
            <div className="rs-progress-caption">
              <span>Оценка автомобилей</span><span>{stepNumber} / 4</span>
            </div>
            <div className="rs-progress-track" role="progressbar" aria-valuenow={stepNumber} aria-valuemin={1} aria-valuemax={4}>
              <span style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
          </div>
        )}

        {step === "intro" && (
          <section className="rs-welcome rs-enter">
            <div className="rs-welcome-copy">
              <p className="rs-kicker"><span />Ваше мнение важно</p>
              <h1>Вы уже познакомились<br className="rs-desktop-break" /> с автомобилем. Расскажите,<br className="rs-desktop-break" /> каким он вам показался.</h1>
              <p className="rs-welcome-description">Выберите марку и модель, затем оцените пять впечатлений. Результат останется у вас на экране — покажите его сотруднику шоурума.</p>
              <Button onClick={beginSurvey} disabled={modelsQuery.isLoading} className="rs-primary rs-welcome-cta" data-testid="button-start-survey">
                {modelsQuery.isLoading ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Загружаем автомобили</> : <>Начать оценку <ArrowRight aria-hidden="true" /></>}
              </Button>
              <p className="rs-quiet-note">Около 2–3 минут на одну модель</p>
            </div>
            <aside className="rs-welcome-side" aria-label="Как проходит опрос">
              <div className="rs-side-topline"><span>Дебрянск Авто</span><span>01—03</span></div>
              <h2>Коротко<br />о процессе</h2>
              <ol>
                <li><span>01</span><p>Выберите марку и модель, которые посмотрели</p></li>
                <li><span>02</span><p>Оцените пять характеристик по шкале от 1 до 5</p></li>
                <li><span>03</span><p>Покажите итог сотруднику и получите подарок на месте</p></li>
              </ol>
            </aside>
          </section>
        )}

        {step === "choose-brand" && (
          <section className="rs-content rs-enter">
            <button type="button" className="rs-back" onClick={() => setStep(evaluations.length ? "next-model" : "intro")} data-testid="button-back-intro"><ArrowLeft aria-hidden="true" /> Назад</button>
            <p className="rs-kicker"><span />Шаг 1 · Марка</p>
            <h1>Какую марку вы смотрели?</h1>
            <p className="rs-lede">Можно оценить несколько автомобилей — начните с любого.</p>
            {initialDraft && (
              <p className="rs-draft-note" role="status">
                Ваши оценки сохранены в этой вкладке. Можно продолжить с выбранной модели или выбрать другую.
              </p>
            )}
            {modelsQuery.isLoading ? (
              <div className="rs-choice-list" aria-busy="true" aria-label="Загружаем модели">
                {[1, 2, 3].map((n) => <div key={n} className="rs-choice-skeleton" />)}
              </div>
            ) : modelsQuery.isError || !modelsQuery.data?.ok ? (
              <div className="rs-load-error" role="alert">
                <p>Не удалось загрузить автомобили</p>
                <span>Проверьте подключение и попробуйте ещё раз.</span>
                <Button variant="outline" className="rs-secondary" onClick={() => modelsQuery.refetch()} data-testid="button-retry-models">Повторить загрузку</Button>
              </div>
            ) : !models.length ? (
              <div className="rs-empty-state">
                <p>Сейчас нет доступных моделей для оценки</p>
                <span>Пожалуйста, обратитесь к сотруднику шоурума.</span>
              </div>
            ) : (
              <div className="rs-choice-list">
                {brands.map((brand, index) => {
                  const brandCount = models.filter((model) => model.brand === brand).length;
                  const ratedCount = models.filter((model) => model.brand === brand && evaluations.some((item) => item.modelId === model.id)).length;
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => { setSelectedBrand(brand); setStep("choose-model"); }}
                      className="rs-choice rs-stagger-item"
                      style={{ animationDelay: `${Math.min(index, 7) * 36}ms` }}
                      data-testid={`button-brand-${brand.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-")}`}
                    >
                      <span className="rs-choice-copy"><strong>{brand}</strong><small>{brandCount} {brandCount === 1 ? "модель" : "моделей"}</small></span>
                      <span className="rs-choice-meta">{ratedCount > 0 && <small className="rs-rated-label">{ratedCount} оценено</small>}<ChevronRight aria-hidden="true" /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === "choose-model" && (
          <section className="rs-content rs-enter">
            <button type="button" className="rs-back" onClick={() => setStep("choose-brand")} data-testid="button-back-brands"><ArrowLeft aria-hidden="true" /> Все марки</button>
            <p className="rs-kicker"><span />Шаг 1 · {selectedBrand}</p>
            <h1>Какая модель?</h1>
            <p className="rs-lede">Выберите автомобиль {selectedBrand}, который вы посмотрели.</p>
            {initialDraft && (
              <p className="rs-draft-note" role="status">
                Ваши оценки сохранены в этой вкладке.
              </p>
            )}
            <div className="rs-choice-list">
              {brandModels.map((model, index) => {
                const rated = evaluations.some((item) => item.modelId === model.id);
                return (
                  <button key={model.id} type="button" onClick={() => startRating(model)} className="rs-choice rs-model-choice rs-stagger-item" style={{ animationDelay: `${Math.min(index, 7) * 36}ms` }} data-testid={`button-model-${model.id}`}>
                    <span className="rs-choice-copy"><strong>{model.model}</strong><small>{rated ? "Вы уже оценивали эту модель" : "Оценить модель"}</small></span>
                    <span className="rs-choice-meta">{rated && <small className="rs-rated-label">Оценена</small>}<ChevronRight aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === "rate" && activeModel && (
          <section className="rs-content rs-rating-page rs-enter">
            <button type="button" className="rs-back" onClick={() => setStep("choose-model")} data-testid="button-back-models"><ArrowLeft aria-hidden="true" /> Все модели</button>
            <p className="rs-kicker"><span />Шаг 2 · {activeModel.brand}</p>
            <div className="rs-rating-heading">
              <div><h1>{activeModel.model}</h1><p className="rs-lede">Оцените каждое впечатление от 1 — «не понравилось» до 5 — «очень понравилось».</p></div>
              <span className="rs-rating-count">{Object.values(ratings).filter(Boolean).length}<i> / 5</i></span>
            </div>
            <div className="rs-question-list">
              {QUESTIONS.map((question, index) => (
                <fieldset key={question.key} className="rs-question">
                  <legend className="rs-sr-only">{question.title}</legend>
                  <div className="rs-question-top">
                    <span className="rs-question-index">{String(index + 1).padStart(2, "0")}</span>
                    <div><h2>{question.title}</h2><p>{question.description}</p></div>
                  </div>
                  <div className="rs-rating-row" role="group" aria-label={`Оценка: ${question.title}`}>
                    {[1, 2, 3, 4, 5].map((value) => {
                      const selected = ratings[question.key] === value;
                      return <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${value} из 5`}
                            onClick={() => {
                              setRatings((current) => ({ ...current, [question.key]: value }));
                              setValidationError("");
                              setValidationField("");
                            }}
                            style={selected ? { backgroundColor: RATING_COLORS[value], borderColor: RATING_COLORS[value] } : undefined}
                            className={`rs-rating-button${selected ? " is-selected" : ""}${selected && value === 5 ? " is-maximum" : ""}`}
                            data-testid={`rating-${question.key}-${value}`}
                      >{value}</button>;
                    })}
                  </div>
                  <div className="rs-rating-ends"><span>Не понравилось</span><span>Очень понравилось</span></div>
                  {ratings[question.key] === 5 && <p className="rs-maximum-message" role="status">Отличная оценка</p>}
                </fieldset>
              ))}
            </div>
            {validationField === "ratings" && validationError && <p className="rs-error rs-rating-error" role="alert">{validationError}</p>}
            <Button onClick={saveEvaluation} className="rs-primary rs-wide-cta" data-testid="button-save-rating">Сохранить оценку <ArrowRight aria-hidden="true" /></Button>
          </section>
        )}

        {step === "next-model" && (
          <section className="rs-next rs-enter">
            <p className="rs-kicker"><span />Шаг 3 · Продолжение</p>
            <h1>Оценка сохранена</h1>
            <p className="rs-lede">Добавьте впечатления ещё об одной модели или перейдите к итогам.</p>
            <div className="rs-evaluated-strip">
              <span>Уже оценено</span>
              <strong>{evaluations.map((entry) => models.find((model) => model.id === entry.modelId)?.model).filter(Boolean).join(" · ")}</strong>
            </div>
            <div className="rs-next-actions">
              {models.some((model) => !evaluations.some((evaluation) => evaluation.modelId === model.id)) && (
                <Button onClick={() => setStep("choose-brand")} variant="outline" className="rs-secondary" data-testid="button-rate-another">Оценить ещё модель</Button>
              )}
              <Button onClick={() => setStep("contact")} className="rs-primary" data-testid="button-continue-contact">К контактам <ArrowRight aria-hidden="true" /></Button>
            </div>
            <button type="button" className="rs-back rs-next-back" onClick={() => setStep("choose-brand")}><ArrowLeft aria-hidden="true" /> Вернуться к маркам</button>
          </section>
        )}

        {step === "contact" && (
          <section className="rs-contact rs-enter">
            <button type="button" className="rs-back" onClick={() => setStep("next-model")} data-testid="button-back-contact"><ArrowLeft aria-hidden="true" /> Назад</button>
            <div className="rs-contact-layout">
              <div className="rs-contact-intro">
                <p className="rs-kicker"><span />Шаг 4 · Завершение</p>
                <h1>Оставьте контакт для завершения</h1>
                <p className="rs-lede">После отправки появится ваш рейтинг. Покажите его сотруднику «Пространства автомобилей» — подарок выдадут на месте.</p>
                <div className="rs-contact-summary">
                  <span>Оценённые модели</span>
                  <strong>{evaluations.map((entry) => {
                    const model = models.find((item) => item.id === entry.modelId);
                    return model ? `${model.brand} ${model.model}` : "";
                  }).filter(Boolean).join(" · ")}</strong>
                </div>
              </div>
              <div className="rs-contact-form">
                <div className="rs-field">
                  <label htmlFor="visitor-name">Ваше имя <span>обязательно</span></label>
                  <Input id="visitor-name" autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); if (validationField === "name") { setValidationError(""); setValidationField(""); } }} placeholder="Например, Анна" className={`rs-input${validationField === "name" ? " has-error" : ""}`} aria-invalid={validationField === "name"} aria-describedby={validationField === "name" ? "name-error" : undefined} data-testid="input-visitor-name" />
                  {validationField === "name" && validationError && <p className="rs-error" id="name-error" role="alert">{validationError}</p>}
                </div>
                <div className="rs-field">
                  <label htmlFor="visitor-phone">Номер телефона <span>обязательно</span></label>
                  <Input id="visitor-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone.value} onChange={(event) => { phone.onChange(event); if (validationField === "phone") { setValidationError(""); setValidationField(""); } }} placeholder="+7 (___) ___-__-__" className={`rs-input${validationField === "phone" ? " has-error" : ""}`} aria-invalid={validationField === "phone"} aria-describedby={validationField === "phone" ? "phone-error" : "phone-help"} data-testid="input-visitor-phone" />
                  {validationField === "phone" ? <p className="rs-error" id="phone-error" role="alert">{validationError}</p> : <p className="rs-help" id="phone-help">Номер нужен, чтобы оформить заявку. Для рекламной связи действует отдельное согласие.</p>}
                </div>
                <div className={`rs-consent-row${validationField === "consent" ? " has-error" : ""}`}>
                  <Checkbox id="personal-consent" checked={consent} onCheckedChange={(checked) => { setConsent(checked === true); if (validationField === "consent") { setValidationError(""); setValidationField(""); } }} className="rs-checkbox" data-testid="checkbox-personal-consent" />
                  <label htmlFor="personal-consent">Даю согласие на обработку персональных данных для участия в опросе, оформления заявки и выдачи подарка. Ознакомлен(а) с <a href="/privacy">Политикой обработки персональных данных</a><span className="rs-required-note">Обязательное согласие</span></label>
                </div>
                {validationField === "consent" && validationError && <p className="rs-error rs-consent-error" role="alert">{validationError}</p>}
                <div className="rs-consent-row rs-optional-row">
                  <Checkbox id="communications-consent" checked={communicationsConsent} onCheckedChange={(checked) => setCommunicationsConsent(checked === true)} className="rs-checkbox" data-testid="checkbox-communications-consent" />
                  <label htmlFor="communications-consent">Согласен(на) на связь по выбранным автомобилям и предложениям.<span className="rs-optional-note">Необязательно</span></label>
                </div>
                {validationField === "submit" && validationError && <p className="rs-error" role="alert">{validationError}</p>}
                {submitError && <div className="rs-submit-error" role="alert">{submitError}</div>}
                <Button onClick={submit} disabled={submitSurvey.isPending} className="rs-primary rs-wide-cta" data-testid="button-submit-survey">
                  {submitSurvey.isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Отправляем…</> : <>Отправить и показать итог <ArrowRight aria-hidden="true" /></>}
                </Button>
                <p className="rs-consent-caption">Согласие на обработку данных обязательно. Согласие на связь — по желанию.</p>
              </div>
            </div>
          </section>
        )}

        {step === "success" && (
          <section className="rs-success rs-enter" aria-live="polite">
            <div className="rs-success-status"><span aria-hidden="true" />Опрос завершён</div>
            <div className="rs-success-heading">
              <h1>Спасибо за участие</h1>
              <p className="rs-lede">{name.trim()}, ваши оценки сохранены. Ниже — ваш рейтинг впечатлений.</p>
            </div>
            {ranking.length > 0 && (
              <div className="rs-ranking" aria-label="Ваш рейтинг моделей">
                {ranking.map((item, index) => <article key={item.modelId} className="rs-rank-card" data-testid={`ranking-item-${item.modelId}`}>
                  <span className="rs-rank-number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="rs-rank-name"><small>{item.model?.brand}</small><strong>{item.model?.model}</strong></div>
                  <div className="rs-score"><strong>{item.score.toFixed(1).replace(".", ",")}</strong><span>из 5</span></div>
                  <div className="rs-score-track" aria-label={`Средняя оценка ${item.score.toFixed(1)} из 5`}><span style={{ transform: `scaleX(${item.score / 5})` }} /></div>
                </article>)}
              </div>
            )}
            <div className="rs-gift-note">
              <span className="rs-gift-label">Получение подарка</span>
              <strong>Покажите этот экран сотруднику «Пространства автомобилей».</strong>
              <p>Подарок выдадут на месте.</p>
            </div>
          </section>
        )}
      </div>
      {step !== "brand-intro" && (
        <footer className="rs-footer"><span>© Дебрянск Авто · Брянск</span><a href="/privacy">Политика конфиденциальности</a></footer>
      )}
    </main>
  );
}
