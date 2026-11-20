import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
  getGetCustomerSurveyQueryKey,
  getGetCustomerSurveyStatsQueryKey,
  getListCustomerSurveyResponsesQueryKey,
  getListCustomerSurveysQueryKey,
  useGetCustomerSurvey,
  useGetCustomerSurveyStats,
  useGetShowroomSurveyModels,
  useListCustomerSurveyResponses,
  useUpdateCustomerSurvey,
} from "@workspace/api-client-react";
import type { CustomerSurveyDefinition, CustomerSurveyInput, CustomerSurveyQuestion } from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ExternalLink, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SurveyMeta = Pick<CustomerSurveyInput, "title" | "slug" | "status">;
type Status = CustomerSurveyInput["status"];

const statusLabels: Record<Status, string> = { draft: "Черновик", published: "Опубликован", archived: "В архиве" };
const questionTypes: { value: CustomerSurveyQuestion["type"]; label: string }[] = [
  { value: "rating", label: "Оценка по шкале" },
  { value: "single_choice", label: "Один вариант" },
  { value: "multiple_choice", label: "Несколько вариантов" },
  { value: "text", label: "Текстовый ответ" },
  { value: "brand_picker", label: "Выбор бренда" },
  { value: "model_picker", label: "Выбор модели" },
];

function newQuestion(type: CustomerSurveyQuestion["type"] = "rating"): CustomerSurveyQuestion {
  const id = `${type.replace("_", "-")}-${Date.now().toString(36)}`;
  return {
    id, type, label: "", description: "", required: false,
    ...(type === "rating" ? { min: 1, max: 5, minLabel: "", maxLabel: "" } : {}),
    ...(type === "single_choice" || type === "multiple_choice" ? { options: ["Вариант 1", "Вариант 2"] } : {}),
  };
}

function answerText(answer: unknown): string {
  if (answer === undefined || answer === null || answer === "") return "—";
  if (Array.isArray(answer)) return answer.map((value) => String(value)).join(", ");
  if (typeof answer === "object") return JSON.stringify(answer);
  return String(answer);
}

export default function SurveyEditorPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<CustomerSurveyQuestion[]>([]);
  const [mode, setMode] = useState<CustomerSurveyDefinition["mode"]>("standard");
  const [collectContact, setCollectContact] = useState(false);
  const [processingConsent, setProcessingConsent] = useState(false);
  const [communicationsConsent, setCommunicationsConsent] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [saveError, setSaveError] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<CustomerSurveyQuestion["type"]>("rating");
  const initializedFor = useRef<number | null>(null);
  const metaForm = useForm<SurveyMeta>({ defaultValues: { title: "", slug: "", status: "draft" } });

  const surveyQuery = useGetCustomerSurvey(id, { query: { enabled: validId, queryKey: getGetCustomerSurveyQueryKey(id) } });
  const survey = surveyQuery.data?.data;
  const modelDirectory = useGetShowroomSurveyModels();
  const statsParams = useMemo(() => ({ id, ...(from ? { from } : {}), ...(to ? { to } : {}) }), [id, from, to]);
  const responseParams = useMemo(() => ({ ...statsParams, page }), [statsParams, page]);
  const statsQuery = useGetCustomerSurveyStats(statsParams, {
    query: { enabled: validId, queryKey: getGetCustomerSurveyStatsQueryKey(statsParams) },
  });
  const responsesQuery = useListCustomerSurveyResponses(responseParams, {
    query: { enabled: validId, queryKey: getListCustomerSurveyResponsesQueryKey(responseParams) },
  });
  const updateSurvey = useUpdateCustomerSurvey();

  useEffect(() => {
    if (!survey || initializedFor.current === survey.id) return;
    initializedFor.current = survey.id;
    metaForm.reset({ title: survey.title, slug: survey.slug, status: survey.status });
    setQuestions(survey.definition.questions);
    setMode(survey.definition.mode);
    setCollectContact(survey.definition.collectContact);
    setProcessingConsent(survey.definition.processingConsent);
    setCommunicationsConsent(survey.definition.communicationsConsent);
  }, [survey, metaForm]);

  const directoryData = modelDirectory.data?.data ?? [];
  const brandNames = useMemo(() => Array.from(new Set(directoryData.map((model) => model.brand))).sort(), [directoryData]);
  const brandQuestionOptions = useMemo(() => brandNames, [brandNames]);
  const modelQuestionOptions = useMemo(
    () => directoryData.map((model) => `${model.id}|${model.brand}|${model.model}`),
    [directoryData],
  );
  const availableQuestionTypes = mode === "showroom"
    ? questionTypes.filter((type) => type.value === "rating")
    : questionTypes;

  const makePayload = (values: SurveyMeta): CustomerSurveyInput => ({
    title: values.title.trim(),
    slug: values.slug.trim().toLowerCase(),
    status: values.status,
    definition: {
      mode,
      questions,
      collectContact: mode === "showroom" ? true : collectContact,
      processingConsent: mode === "showroom" ? true : (collectContact || processingConsent),
      communicationsConsent: mode === "showroom" ? true : communicationsConsent,
    },
  });

  const save = metaForm.handleSubmit((values) => {
    setSaveError("");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim().toLowerCase())) {
      metaForm.setError("slug", { message: "Адрес: латинские буквы, цифры и дефисы." });
      return;
    }
    if (questions.length < 1) {
      setSaveError("Добавьте хотя бы один вопрос перед сохранением.");
      return;
    }
    const invalidScale = questions.findIndex((question) => question.type === "rating" &&
      (question.min === undefined || question.max === undefined || question.min < 0 || question.max > 10 || question.min >= question.max));
    if (invalidScale >= 0) {
      setSaveError(`Проверьте границы шкалы в вопросе №${invalidScale + 1}: минимум должен быть меньше максимума (0–10).`);
      return;
    }
    const blank = questions.findIndex((question) => question.label.trim().length < 2);
    if (blank >= 0) {
      setSaveError(`Заполните формулировку вопроса №${blank + 1}.`);
      return;
    }
    if (questions.some((question) => question.type === "model_picker" && (!question.dependsOn || !questions.some((candidate) => candidate.id === question.dependsOn && candidate.type === "brand_picker")))) {
      setSaveError("Для каждого блока выбора модели укажите вопрос выбора бренда.");
      return;
    }
    updateSurvey.mutate({ id, data: makePayload(values) }, {
      onSuccess: (response) => {
        if (!response.ok) {
          setSaveError("Сервер не подтвердил сохранение.");
          return;
        }
        void queryClient.invalidateQueries({ queryKey: getGetCustomerSurveyQueryKey(id) });
        void queryClient.invalidateQueries({ queryKey: getListCustomerSurveysQueryKey() });
        toast({ title: "Изменения сохранены", description: `Статус: ${statusLabels[response.data.status]}.` });
      },
      onError: (error) => setSaveError(error.message || "Не удалось сохранить изменения."),
    });
  });

  const updateQuestion = (questionId: string, patch: Partial<CustomerSurveyQuestion>) => {
    setQuestions((current) => current.map((question) => question.id === questionId ? { ...question, ...patch } : question));
  };
  const addQuestion = (type: CustomerSurveyQuestion["type"]) => {
    if (mode === "showroom" && type !== "rating") return;
    const question = newQuestion(type);
    if (type === "brand_picker") question.options = brandQuestionOptions;
    if (type === "model_picker") {
      question.options = modelQuestionOptions;
      question.dependsOn = questions.find((item) => item.type === "brand_picker")?.id;
    }
    setQuestions((current) => [...current, question]);
  };
  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  };
  const publicPath = survey?.definition.mode === "showroom" ? "/showroom-survey" : `/surveys/${survey?.slug ?? ""}`;
  const publicUrl = typeof window !== "undefined" && survey ? `${window.location.origin}${publicPath}` : "";
  const stats = statsQuery.data?.data;
  const responses = responsesQuery.data;

  if (!validId) {
    return <Alert variant="destructive"><AlertTitle>Некорректный адрес</AlertTitle><AlertDescription>Идентификатор опроса должен быть положительным числом.</AlertDescription></Alert>;
  }

  if (surveyQuery.isLoading) {
    return <div className="space-y-4" aria-label="Загрузка анкеты"><Skeleton className="h-10 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-72 w-full" /></div>;
  }

  if (surveyQuery.isError || !survey) {
    return (
      <Alert variant="destructive" data-testid="status-survey-load-error">
        <AlertTitle>Не удалось открыть опрос</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          Данные не изменены. Повторите загрузку или вернитесь к списку.
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void surveyQuery.refetch()} data-testid="button-retry-survey"><RefreshCw className="mr-2 h-4 w-4" />Повторить</Button>
            <Button size="sm" variant="outline" onClick={() => setLocation("/surveys")} data-testid="button-back-surveys">К списку</Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const questionBlocks = questions.map((question, index) => (
    <Card key={question.id} className="min-w-0 max-w-full overflow-hidden" data-testid={`card-question-${question.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b bg-slate-50/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="shrink-0">Вопрос {index + 1}</Badge>
          <span className="truncate text-xs text-slate-500">{questionTypes.find((type) => type.value === question.type)?.label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Переместить вопрос вверх" disabled={index === 0} onClick={() => moveQuestion(index, -1)} data-testid={`button-question-up-${question.id}`}><ArrowUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Переместить вопрос вниз" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} data-testid={`button-question-down-${question.id}`}><ArrowDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Удалить вопрос" onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))} data-testid={`button-question-delete-${question.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 grid gap-4 p-4">
        <div className="min-w-0 grid gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`label-${question.id}`}>Формулировка</Label>
            <Input id={`label-${question.id}`} value={question.label} maxLength={180} onChange={(event) => updateQuestion(question.id, { label: event.target.value })} data-testid={`input-question-label-${question.id}`} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`type-${question.id}`}>Тип вопроса</Label>
            <Select value={question.type} onValueChange={(value) => {
              const nextType = value as CustomerSurveyQuestion["type"];
              const base = newQuestion(nextType);
              const replacement: CustomerSurveyQuestion = { ...base, id: question.id, label: question.label, description: question.description, required: question.required,
                ...(nextType === "brand_picker" ? { options: brandQuestionOptions } : {}),
                ...(nextType === "model_picker" ? { options: modelQuestionOptions, dependsOn: questions.find((item) => item.type === "brand_picker")?.id } : {}),
              };
              setQuestions((current) => current.map((item) => item.id === question.id ? replacement : item));
            }}>
              <SelectTrigger id={`type-${question.id}`} data-testid={`select-question-type-${question.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>{availableQuestionTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`description-${question.id}`}>Подсказка <span className="font-normal text-slate-400">необязательно</span></Label>
          <Input id={`description-${question.id}`} value={question.description ?? ""} maxLength={300} onChange={(event) => updateQuestion(question.id, { description: event.target.value })} data-testid={`input-question-description-${question.id}`} />
        </div>
        {question.type === "rating" && (
          <div className="min-w-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-2"><Label htmlFor={`min-${question.id}`}>Минимум</Label><Input id={`min-${question.id}`} type="number" min={0} max={9} value={question.min ?? 1} onChange={(event) => updateQuestion(question.id, { min: Number(event.target.value) })} data-testid={`input-question-min-${question.id}`} /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor={`max-${question.id}`}>Максимум</Label><Input id={`max-${question.id}`} type="number" min={1} max={10} value={question.max ?? 5} onChange={(event) => updateQuestion(question.id, { max: Number(event.target.value) })} data-testid={`input-question-max-${question.id}`} /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor={`min-label-${question.id}`}>Подпись минимума</Label><Input id={`min-label-${question.id}`} maxLength={50} value={question.minLabel ?? ""} onChange={(event) => updateQuestion(question.id, { minLabel: event.target.value })} data-testid={`input-question-min-label-${question.id}`} /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor={`max-label-${question.id}`}>Подпись максимума</Label><Input id={`max-label-${question.id}`} maxLength={50} value={question.maxLabel ?? ""} onChange={(event) => updateQuestion(question.id, { maxLabel: event.target.value })} data-testid={`input-question-max-label-${question.id}`} /></div>
          </div>
        )}
        {(question.type === "single_choice" || question.type === "multiple_choice") && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`options-${question.id}`}>Варианты ответа <span className="font-normal text-slate-400">по одному на строку</span></Label>
            <Textarea id={`options-${question.id}`} rows={4} value={(question.options ?? []).join("\n")} onChange={(event) => updateQuestion(question.id, { options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })} data-testid={`textarea-question-options-${question.id}`} />
          </div>
        )}
        {(question.type === "brand_picker" || question.type === "model_picker") && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {modelDirectory.isLoading
              ? "Загружаем справочник новых автомобилей…"
              : modelDirectory.isError
                ? <span className="text-destructive">Справочник недоступен. Повторите загрузку страницы.</span>
                : <>Варианты будут браться из текущего каталога: {brandNames.length} брендов и {directoryData.length} моделей.</>}
          </div>
        )}
        {question.type === "model_picker" && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`depends-${question.id}`}>Зависит от блока выбора бренда</Label>
            <Select value={question.dependsOn ?? "none"} onValueChange={(value) => updateQuestion(question.id, { dependsOn: value === "none" ? undefined : value })}>
              <SelectTrigger id={`depends-${question.id}`} data-testid={`select-question-brand-dependency-${question.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Выберите вопрос о бренде</SelectItem>
                {questions.filter((item) => item.type === "brand_picker").map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.label || brand.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={question.required} onCheckedChange={(checked) => updateQuestion(question.id, { required: checked === true })} data-testid={`checkbox-question-required-${question.id}`} />
          Обязательный вопрос
        </label>
      </CardContent>
    </Card>
  ));

  return (
    <div className="w-full min-w-0 space-y-5" data-testid="page-survey-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => setLocation("/surveys")} aria-label="Назад к опросам" data-testid="button-back-to-surveys"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <p className="text-xs font-medium text-slate-500">Управление опросом / {survey.definition.mode === "showroom" ? "Шоурум" : "Обычный"}</p>
            <h1 className="mt-1 break-words text-xl font-bold text-slate-900">{survey.title}</h1>
            <div className="mt-1 flex items-center gap-2"><Badge variant={survey.status === "published" ? "default" : "secondary"} data-testid="status-current-survey">{statusLabels[survey.status]}</Badge><span className="text-xs text-slate-500">Версия {survey.version} · {survey.responseCount} ответов</span></div>
          </div>
        </div>
        <Button onClick={save} disabled={updateSurvey.isPending} className="w-full gap-2 sm:w-auto" data-testid="button-save-survey"><Save className="h-4 w-4" />{updateSurvey.isPending ? "Сохранение…" : "Сохранить изменения"}</Button>
      </div>

      {saveError && <Alert variant="destructive" data-testid="status-survey-validation-error"><AlertTitle>Проверьте данные</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert>}
      {updateSurvey.isError && !saveError && <Alert variant="destructive"><AlertTitle>Ошибка сохранения</AlertTitle><AlertDescription>Изменения не подтверждены сервером. Повторите попытку.</AlertDescription></Alert>}

      <div className="min-w-0 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(350px,0.85fr)]">
        <form onSubmit={save} className="min-w-0 space-y-5">
          <Card className="min-w-0">
            <CardHeader><CardTitle className="text-base">Основные настройки</CardTitle><CardDescription>Название, публичная ссылка и состояние анкеты.</CardDescription></CardHeader>
            <CardContent className="min-w-0 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-2 md:col-span-2">
                <Label htmlFor="meta-title">Название</Label>
                <Input id="meta-title" maxLength={120} {...metaForm.register("title", { required: "Укажите название.", minLength: { value: 2, message: "Минимум 2 символа." } })} data-testid="input-survey-title" />
                {metaForm.formState.errors.title && <p className="text-xs text-destructive">{metaForm.formState.errors.title.message}</p>}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="meta-slug">Slug</Label>
                <Input id="meta-slug" maxLength={100} {...metaForm.register("slug", { required: "Укажите публичный адрес.", minLength: { value: 2, message: "Минимум 2 символа." } })} data-testid="input-survey-slug" />
                {metaForm.formState.errors.slug && <p className="text-xs text-destructive">{metaForm.formState.errors.slug.message}</p>}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="meta-status">Состояние</Label>
                <Controller control={metaForm.control} name="status" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="meta-status" data-testid="select-survey-status"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">Черновик</SelectItem><SelectItem value="published">Опубликован</SelectItem><SelectItem value="archived">В архиве</SelectItem></SelectContent>
                  </Select>
                )} />
              </div>
              <div className="min-w-0 w-full max-w-full rounded-md bg-slate-50 p-3 md:col-span-2">
                <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 w-full sm:flex-1"><p className="text-xs font-medium text-slate-500">Публичный адрес</p><p className="block max-w-full truncate text-sm text-slate-800" data-testid="text-public-survey-url">{publicUrl}</p></div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5" data-testid="link-preview-survey">
                    <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Предпросмотр</a>
                  </Button>
                </div>
                {survey.status !== "published" && <p className="mt-2 text-xs text-amber-700">Публичный просмотр доступен только после публикации.</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader><CardTitle className="text-base">Контакты и согласия</CardTitle><CardDescription>Настройки сбора контактных данных и разрешений.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Собирать имя и телефон", checked: mode === "showroom" || collectContact, setter: setCollectContact, id: "collect-contact", description: "Поля контакта появятся в анкете и ответах." },
                { label: "Согласие на обработку персональных данных", checked: mode === "showroom" || processingConsent, setter: setProcessingConsent, id: "processing-consent", description: "Для сценария шоурума обязательно." },
                { label: "Согласие на коммуникации", checked: mode === "showroom" || communicationsConsent, setter: setCommunicationsConsent, id: "communications-consent", description: "Разрешение связаться с посетителем по выбранным автомобилям." },
              ].map((setting) => (
                <div key={setting.id} className="flex min-w-0 items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0 sm:items-center">
                  <div className="min-w-0 flex-1"><Label htmlFor={setting.id}>{setting.label}</Label><p className="mt-0.5 text-xs text-slate-500">{setting.description}</p></div>
                  <Switch
                    id={setting.id}
                    checked={setting.checked}
                    disabled={mode === "showroom" || (setting.id === "processing-consent" && collectContact)}
                    onCheckedChange={(checked) => {
                      if (setting.id === "collect-contact" && !checked) {
                        setProcessingConsent(false);
                        setCommunicationsConsent(false);
                      }
                      if (setting.id === "collect-contact" && checked) setProcessingConsent(true);
                      setting.setter(checked);
                    }}
                    className="shrink-0"
                    data-testid={`switch-${setting.id}`}
                  />
                </div>
              ))}
              {mode === "showroom" && <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">В режиме шоурума контактные данные и оба типа согласий обязательны и остаются включёнными.</p>}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader><CardTitle className="text-base">Вопросы анкеты</CardTitle><CardDescription>Порядок блоков определяет порядок вопросов на публичной странице.</CardDescription></CardHeader>
            <CardContent className="min-w-0 space-y-3">
              {questions.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500" data-testid="empty-survey-questions">Добавьте первый вопрос в анкету.</div>}
              {questionBlocks}
              <div className="flex min-w-0 flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
                <Select value={newQuestionType} onValueChange={(value) => setNewQuestionType(value as CustomerSurveyQuestion["type"])}>
                  <SelectTrigger id="new-question-type" className="w-full min-w-0 sm:w-auto sm:min-w-48" data-testid="select-new-question-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{availableQuestionTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => {
                  addQuestion(newQuestionType);
                }} data-testid="button-add-question"><Plus className="h-4 w-4" />Добавить вопрос</Button>
                {mode === "standard" && <>
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => addQuestion("brand_picker")} data-testid="button-add-brand-picker">Добавить выбор бренда</Button>
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => addQuestion("model_picker")} data-testid="button-add-model-picker">Добавить выбор модели</Button>
                </>}
              </div>
              {modelDirectory.isLoading && <p className="text-xs text-slate-500">Загружаем актуальный справочник новых автомобилей…</p>}
              {modelDirectory.isError && <Alert variant="destructive"><AlertTitle>Справочник недоступен</AlertTitle><AlertDescription>Выбор бренда и модели можно добавить, но для заполнения каталога повторно откройте редактор после восстановления соединения.</AlertDescription></Alert>}
            </CardContent>
          </Card>
          <Button type="submit" disabled={updateSurvey.isPending} className="w-full gap-2 sm:w-auto" data-testid="button-save-survey-bottom"><Save className="h-4 w-4" />{updateSurvey.isPending ? "Сохранение…" : "Сохранить изменения"}</Button>
        </form>

        <div className="space-y-5">
          <Card className="min-w-0">
            <CardHeader><CardTitle className="text-base">Статистика ответов</CardTitle><CardDescription>Результаты по выбранному периоду.</CardDescription></CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1"><Label htmlFor="stats-from">С даты</Label><Input id="stats-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} data-testid="input-survey-date-from" /></div>
                <div className="min-w-0 space-y-1"><Label htmlFor="stats-to">По дату</Label><Input id="stats-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} data-testid="input-survey-date-to" /></div>
              </div>
              {statsQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-28 w-full" /></div> :
                statsQuery.isError ? <Alert variant="destructive"><AlertTitle>Статистика недоступна</AlertTitle><AlertDescription className="space-y-2"><span>Не удалось загрузить агрегаты.</span><Button size="sm" variant="outline" onClick={() => void statsQuery.refetch()} data-testid="button-retry-survey-stats">Повторить</Button></AlertDescription></Alert> :
                !stats ? <p className="text-sm text-slate-500">Статистика не получена.</p> : (
                  <>
                    <div className="rounded-lg bg-primary/5 p-4">
                      <p className="text-xs font-medium text-slate-500">Ответов за период</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-primary" data-testid="text-survey-total-responses">{stats.totalResponses}</p>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Ответы по дням</h3>
                      {stats.byDate.length ? <div className="space-y-2">
                        {stats.byDate.slice(-8).map((item) => {
                          const max = Math.max(1, ...stats.byDate.map((entry) => entry.count));
                          return <div key={item.date} className="grid grid-cols-[72px_1fr_32px] items-center gap-2 text-xs" data-testid={`stat-date-${item.date}`}>
                            <span className="text-slate-500">{new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</span>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, item.count / max * 100)}%` }} /></div>
                            <span className="text-right tabular-nums text-slate-700">{item.count}</span>
                          </div>;
                        })}
                      </div> : <p className="text-sm text-slate-500">За выбранный период ответов нет.</p>}
                    </div>
                    {stats.questions.length > 0 && <div className="min-w-0 space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold text-slate-800">Разбивка по вопросам</h3>
                      <div className="min-w-0 divide-y divide-slate-100">
                        {stats.questions.map((item) => <details key={item.questionId} className="group min-w-0 py-2.5 first:pt-0 last:pb-0" data-testid={`stat-question-${item.questionId}`}>
                          <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-start justify-between gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0 flex-1 break-words text-sm font-medium leading-5 text-slate-700">{item.label}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="whitespace-nowrap text-xs text-slate-500">{item.answered} ответов</span>
                              {item.average !== null && <span aria-label={`Средняя оценка ${item.average.toFixed(1)}`} className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-1 text-center text-xs font-semibold tabular-nums text-primary">ср. {item.average.toFixed(1)}</span>}
                              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                            </span>
                          </summary>
                          <div className="mt-2 flex min-w-0 flex-wrap gap-2 pb-1">
                            {item.buckets.map((bucket) => <span key={bucket.value} className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md bg-slate-100/70 px-2.5 py-1.5 text-xs text-slate-600">
                              <span className="break-words">{bucket.value}</span>
                              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{bucket.count}</span>
                            </span>)}
                          </div>
                        </details>)}
                      </div>
                    </div>}
                  </>
                )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader><CardTitle className="text-base">Ответы посетителей</CardTitle><CardDescription>{responses ? `Всего: ${responses.total}` : "Ответы и их исходная версия анкеты."}</CardDescription></CardHeader>
            <CardContent className="min-w-0 space-y-3">
              {responsesQuery.isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div> :
                responsesQuery.isError ? <Alert variant="destructive"><AlertTitle>Не удалось загрузить ответы</AlertTitle><AlertDescription className="space-y-2"><span>Фильтр и сохранённые данные не изменены.</span><Button size="sm" variant="outline" onClick={() => void responsesQuery.refetch()} data-testid="button-retry-survey-responses">Повторить</Button></AlertDescription></Alert> :
                !responses?.data.length ? <div className="rounded-md border border-dashed p-7 text-center" data-testid="empty-survey-responses"><p className="font-medium text-slate-700">Ответов за выбранный период нет</p><p className="mt-1 text-xs text-slate-500">Измените даты или дождитесь новых ответов.</p></div> :
                <div className="space-y-3">
                  {responses.data.map((response) => <details key={response.id} className="rounded-lg border p-3" data-testid={`response-item-${response.id}`}>
                    <summary className="cursor-pointer list-none" data-testid={`button-expand-response-${response.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="font-medium text-slate-800">{response.name || "Посетитель без имени"}</p><p className="text-xs text-slate-500">{new Date(response.submittedAt).toLocaleString("ru-RU")} · версия {response.surveyVersion}</p></div>
                        <Badge variant="outline">{response.source || "Источник не указан"}</Badge>
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {response.phone && <p className="text-xs text-slate-600">Телефон: {response.phone}</p>}
                      {response.definitionSnapshot.mode === "showroom" && Array.isArray(response.answers["evaluations"])
                        ? (response.answers["evaluations"] as Array<Record<string, unknown>>).map((evaluation, evaluationIndex) => {
                            const evaluationAnswers = evaluation.answers && typeof evaluation.answers === "object"
                              ? evaluation.answers as Record<string, unknown>
                              : {};
                            return <div key={`${String(evaluation.modelId)}-${evaluationIndex}`} className="space-y-2 rounded-md bg-slate-50 p-3">
                              <p className="font-medium text-slate-800">{String(evaluation.brand ?? "")} {String(evaluation.model ?? "")}</p>
                              {response.definitionSnapshot.questions.map((question) => <div key={question.id} className="text-sm">
                                <p className="text-xs font-medium text-slate-500">{question.label}</p>
                                <p className="break-words text-slate-800">{answerText(evaluationAnswers[question.id])}</p>
                              </div>)}
                            </div>;
                          })
                        : response.definitionSnapshot.questions.map((question) => <div key={question.id} className="text-sm">
                            <p className="text-xs font-medium text-slate-500">{question.label}</p><p className="break-words text-slate-800">{answerText(response.answers[question.id])}</p>
                          </div>)}
                      <div className="border-t pt-2 text-xs text-slate-500">В анкете было {response.definitionSnapshot.questions.length} вопросов.</div>
                      <div className="grid gap-1 border-t pt-2 text-xs text-slate-500 sm:grid-cols-2">
                        <span>Обработка данных: {response.processingConsent === null ? "не запрашивалось" : response.processingConsent ? "согласие получено" : "не дано"}</span>
                        <span>Связь: {response.communicationsConsent === null ? "не запрашивалось" : response.communicationsConsent ? "согласие получено" : "не дано"}</span>
                      </div>
                    </div>
                  </details>)}
                  {responses.pages > 1 && <div className="flex items-center justify-between border-t pt-3">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} data-testid="button-responses-previous">Назад</Button>
                    <span className="text-xs text-slate-500" data-testid="text-responses-pagination">Страница {responses.page} из {responses.pages}</span>
                    <Button variant="outline" size="sm" disabled={page >= responses.pages} onClick={() => setPage((current) => Math.min(responses.pages, current + 1))} data-testid="button-responses-next">Вперёд</Button>
                  </div>}
                </div>
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
