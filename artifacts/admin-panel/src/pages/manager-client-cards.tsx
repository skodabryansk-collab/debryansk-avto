import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  CheckCircle2,
  FileText,
  Loader2,
  LogOut,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createManagerClientCard,
  fetchCarBrands,
  fetchCarModels,
  getManagerClientCards,
  getManagerName,
  isAdminUsingManagerPortal,
  searchCars,
  useManagerAuth,
  type CarSearchResult,
  type NewManagerClientCard,
} from "@/lib/manager-auth";

const steps = [
  { title: "Клиент и автомобиль", short: "Клиент" },
  { title: "Потребности", short: "Потребности" },
  { title: "Текущий автомобиль", short: "Текущий авто" },
  { title: "Предложение", short: "Предложение" },
  { title: "Комментарий", short: "Комментарий" },
];

const budgetOptions = ["до 2 млн", "2–3 млн", "3–5 млн", "5+ млн"] as const;
const paymentOptions = ["Кредит", "Лизинг", "Наличные / Безнал"] as const;
const tradeInOptions = ["Да", "Нет", "Пока не решил"] as const;

type FormState = {
  clientName: string;
  clientPhone: string;
  desiredBrand: string;
  desiredModel: string;
  budgetRange: string;
  currentCar: string;
  currentCarYear: string;
  tradeInPlan: string;
  paymentMethod: string;
  comment: string;
};

const emptyForm: FormState = {
  clientName: "",
  clientPhone: "",
  desiredBrand: "",
  desiredModel: "",
  budgetRange: "",
  currentCar: "",
  currentCarYear: "",
  tradeInPlan: "",
  paymentMethod: "",
  comment: "",
};

const fieldClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#0070b8] focus:ring-2 focus:ring-[#0070b8]/15";
const textAreaClass =
  "min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#0070b8] focus:ring-2 focus:ring-[#0070b8]/15";

function rub(value: number | null | undefined): string {
  if (value == null || value <= 0) return "Цена не указана";
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={fieldClass}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function InventoryResult({
  car,
  selected,
  onSelect,
}: {
  car: CarSearchResult;
  selected: boolean;
  onSelect: (car: CarSearchResult) => void;
}) {
  const title = [car.brand, car.model, car.year].filter(Boolean).join(" ");
  const details = [car.modification, car.complectation, car.color].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onSelect(car)}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        selected
          ? "border-[#0070b8] bg-sky-50 ring-2 ring-[#0070b8]/10"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
      aria-pressed={selected}
    >
      {car.imageUrl ? (
        <img
          src={car.imageUrl}
          alt=""
          className="h-16 w-20 shrink-0 rounded-lg bg-slate-100 object-cover"
        />
      ) : (
        <span className="grid h-16 w-20 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
          <CarFront className="h-6 w-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900">{title || "Автомобиль из каталога"}</span>
        {details && <span className="mt-1 block text-xs text-slate-500">{details}</span>}
        <span className="mt-1.5 block text-sm font-semibold text-[#0070b8]">{rub(car.price)}</span>
      </span>
      {selected && <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#0070b8]" />}
    </button>
  );
}

export default function ManagerClientCardsPage() {
  const [, setLocation] = useLocation();
  const { logout } = useManagerAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminPortal = isAdminUsingManagerPortal();

  const [mode, setMode] = useState<"list" | "form">("list");
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedCar, setSelectedCar] = useState<CarSearchResult | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryType, setInventoryType] = useState<"new" | "used">("new");
  const [formError, setFormError] = useState("");

  const cardsQuery = useQuery({
    queryKey: ["manager-client-cards", search],
    queryFn: () => getManagerClientCards(search),
    enabled: mode === "list",
  });
  const brandsQuery = useQuery({
    queryKey: ["manager-client-card-brands"],
    queryFn: () => fetchCarBrands(),
    enabled: mode === "form",
  });
  const modelsQuery = useQuery({
    queryKey: ["manager-client-card-models", form.desiredBrand],
    queryFn: () => fetchCarModels(form.desiredBrand),
    enabled: mode === "form" && Boolean(form.desiredBrand),
  });
  const inventoryQuery = useQuery({
    queryKey: ["manager-client-card-inventory", inventoryType, inventorySearch.trim()],
    queryFn: () => searchCars({ q: inventorySearch.trim(), type: inventoryType }),
    enabled: mode === "form" && step === 3 && inventorySearch.trim().length >= 2,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: NewManagerClientCard) => createManagerClientCard(payload),
    onSuccess: () => {
      toast({ title: "Рабочий лист сохранён" });
      setForm(emptyForm);
      setSelectedCar(null);
      setStep(0);
      setInventorySearch("");
      setFormError("");
      setMode("list");
      void queryClient.invalidateQueries({ queryKey: ["manager-client-cards"] });
    },
    onError: error => {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить рабочий лист");
    },
  });

  const brands = brandsQuery.data?.data ?? [];
  const models = modelsQuery.data?.data ?? [];
  const inventory = inventoryQuery.data?.data ?? [];
  const cards = cardsQuery.data?.data ?? [];
  const progress = useMemo(() => `${step + 1} из ${steps.length}`, [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
    setFormError("");
  }

  function startNewCard() {
    setForm(emptyForm);
    setSelectedCar(null);
    setInventorySearch("");
    setInventoryType("new");
    setStep(0);
    setFormError("");
    setMode("form");
  }

  function goNext() {
    setFormError("");
    if (step === 0) {
      if (form.clientName.trim().length < 2) {
        setFormError("Укажите ФИО клиента");
        return;
      }
      const digits = form.clientPhone.replace(/\D/g, "").length;
      if (digits < 10 || digits > 15) {
        setFormError("Проверьте номер телефона");
        return;
      }
    }
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function skipOptionalStep() {
    if (step === 2) {
      update("currentCar", "");
      update("currentCarYear", "");
      update("tradeInPlan", "");
    }
    if (step === 3) {
      setSelectedCar(null);
      update("paymentMethod", "");
    }
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function saveCard() {
    setFormError("");
    saveMutation.mutate({
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      desiredBrand: form.desiredBrand || null,
      desiredModel: form.desiredModel || null,
      budgetRange: form.budgetRange || null,
      currentCar: form.currentCar.trim() || null,
      currentCarYear: form.currentCarYear ? Number(form.currentCarYear) : null,
      tradeInPlan: form.tradeInPlan || null,
      commercialCarId: selectedCar?.id ?? null,
      paymentMethod: form.paymentMethod || null,
      comment: form.comment.trim(),
    });
  }

  function handleLogout() {
    logout();
    setLocation("/manager/login");
  }

  return (
    <div className="min-h-screen bg-[#f2f5f8]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <svg viewBox="0 0 200 33" className="h-6 w-6 shrink-0 text-[#0070b8]" fill="currentColor" aria-hidden="true">
              <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z" />
            </svg>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 sm:text-base">Карточки клиентов</span>
              <span className="block truncate text-xs text-slate-500">{getManagerName()}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/manager/quotes")} className="px-2 text-slate-600 sm:px-3">
              КП
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/manager/profile")} className="px-2 text-slate-600 sm:px-3">
              <UserRound className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Профиль</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Выйти" className="px-2 text-slate-600">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:ml-1.5 sm:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-3 py-5 sm:px-6 sm:py-7">
        {mode === "list" ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Внутренний рабочий лист менеджера</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Клиентские карточки</h1>
              </div>
              {!adminPortal && (
                <Button onClick={startNewCard} className="h-11 bg-[#0070b8] hover:bg-[#005a94]">
                  <Plus className="mr-2 h-4 w-4" />
                  Новая карточка
                </Button>
              )}
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Найти по имени или телефону"
                    className="h-11 pl-9"
                    aria-label="Поиск по карточкам клиентов"
                  />
                </div>
              </CardContent>
            </Card>

            {cardsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Загружаем карточки…
              </div>
            ) : cardsQuery.isError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-5 text-sm text-red-700">
                  Не удалось загрузить список. Проверьте соединение и попробуйте снова.
                </CardContent>
              </Card>
            ) : cards.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center px-5 py-12 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-sky-50 text-[#0070b8]">
                    <FileText className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 font-semibold text-slate-900">
                    {search ? "Совпадений не найдено" : "Карточек пока нет"}
                  </h2>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    {search ? "Измените запрос поиска." : "Создайте рабочий лист во время разговора с клиентом."}
                  </p>
                  {!search && !adminPortal && (
                    <Button onClick={startNewCard} className="mt-5 bg-[#0070b8] hover:bg-[#005a94]">
                      <Plus className="mr-2 h-4 w-4" />
                      Создать карточку
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {cards.map(card => {
                  const offer = card.commercialCarSnapshot;
                  const desired = [card.desiredBrand, card.desiredModel].filter(Boolean).join(" ");
                  const offerTitle = offer ? [offer.brand, offer.model, offer.year].filter(Boolean).join(" ") : "";
                  return (
                    <Card key={card.id} className="overflow-hidden border-0 shadow-sm">
                      <CardHeader className="space-y-3 p-4 pb-3 sm:p-5 sm:pb-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <CardTitle className="break-words text-base">{card.clientName}</CardTitle>
                            <p className="mt-1 text-sm text-slate-600">{card.clientPhone}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {card.budgetRange && <Badge variant="secondary">{card.budgetRange}</Badge>}
                            <span className="text-xs text-slate-500">{formatDate(card.createdAt)}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Интерес клиента</p>
                            <p className="mt-1 break-words text-sm font-medium text-slate-900">{desired || "Модель пока не выбрана"}</p>
                          </div>
                          {card.currentCar && (
                            <div className="rounded-lg bg-slate-50 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Текущий автомобиль</p>
                              <p className="mt-1 break-words text-sm font-medium text-slate-900">
                                {[card.currentCar, card.currentCarYear].filter(Boolean).join(", ")}
                              </p>
                              {card.tradeInPlan && <p className="mt-1 text-xs text-slate-500">Трейд-ин: {card.tradeInPlan}</p>}
                            </div>
                          )}
                        </div>
                        {offer && (
                          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="break-words text-sm font-medium text-slate-900">{offerTitle}</span>
                            <span className="text-sm font-semibold text-[#0070b8]">{rub(offer.price)}</span>
                          </div>
                        )}
                        {card.paymentMethod && <p className="text-sm text-slate-600">Оплата: {card.paymentMethod}</p>}
                        {card.comment && (
                          <p className="whitespace-pre-wrap break-words border-t border-slate-100 pt-3 text-sm text-slate-600">{card.comment}</p>
                        )}
                        {card.managerName && (
                          <p className="text-xs text-slate-400">Менеджер: {card.managerName}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardHeader className="space-y-4 border-b border-slate-100 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode("list")}
                    className="-ml-2 mb-2 text-slate-600"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    К списку
                  </Button>
                  <CardTitle className="text-xl">Новая карточка клиента</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Сохраните основные данные разговора с клиентом.</p>
                </div>
                <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#0070b8]">{progress}</span>
              </div>
              <div className="flex gap-1.5" aria-label={`Шаг ${progress}`}>
                {steps.map((item, index) => (
                  <span
                    key={item.short}
                    className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[#0070b8]" : "bg-slate-200"}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {steps.map((item, index) => (
                  <span key={item.short} className={index === step ? "font-semibold text-[#0070b8]" : ""}>
                    {item.short}
                  </span>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{steps[step]?.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {step === 0 && "Имя и телефон обязательны. Если модель ещё не выбрана, оставьте поля автомобиля пустыми."}
                  {step === 1 && "Отметьте бюджет, который назвал клиент."}
                  {step === 2 && "Раздел необязательный — заполните, если клиент рассказал о своём автомобиле."}
                  {step === 3 && "Подберите автомобиль из доступного вам каталога. Цена берётся из карточки автомобиля."}
                  {step === 4 && "Добавьте важные детали разговора, которые помогут продолжить общение."}
                </p>
              </div>

              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="client-name">ФИО клиента *</Label>
                    <Input
                      id="client-name"
                      autoComplete="name"
                      value={form.clientName}
                      onChange={event => update("clientName", event.target.value)}
                      placeholder="Например, Иванов Иван Иванович"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="client-phone">Номер телефона *</Label>
                    <Input
                      id="client-phone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={form.clientPhone}
                      onChange={event => update("clientPhone", event.target.value)}
                      placeholder="+7 (___) ___-__-__"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desired-brand">Марка автомобиля</Label>
                    <select
                      id="desired-brand"
                      className={fieldClass}
                      value={form.desiredBrand}
                      onChange={event => {
                        update("desiredBrand", event.target.value);
                        update("desiredModel", "");
                      }}
                    >
                      <option value="">Пока не определился</option>
                      {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                    {brandsQuery.isError && <p className="text-xs text-red-600">Не удалось загрузить марки из каталога.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desired-model">Модель</Label>
                    <select
                      id="desired-model"
                      className={fieldClass}
                      value={form.desiredModel}
                      disabled={!form.desiredBrand || modelsQuery.isLoading}
                      onChange={event => update("desiredModel", event.target.value)}
                    >
                      <option value="">{form.desiredBrand ? "Выберите модель" : "Сначала выберите марку"}</option>
                      {models.map(model => <option key={model} value={model}>{model}</option>)}
                    </select>
                    {modelsQuery.isLoading && <p className="text-xs text-slate-500">Загружаем модели…</p>}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => update("budgetRange", "")}
                    className={`min-h-12 rounded-lg border px-4 text-left text-sm font-medium transition ${
                      form.budgetRange === "" ? "border-[#0070b8] bg-sky-50 text-[#005a94]" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Не указан
                  </button>
                  {budgetOptions.map(option => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => update("budgetRange", option)}
                      className={`min-h-12 rounded-lg border px-4 text-left text-sm font-medium transition ${
                        form.budgetRange === option ? "border-[#0070b8] bg-sky-50 text-[#005a94]" : "border-slate-200 hover:bg-slate-50"
                      }`}
                      aria-pressed={form.budgetRange === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="current-car">Марка и модель</Label>
                    <Input
                      id="current-car"
                      value={form.currentCar}
                      onChange={event => update("currentCar", event.target.value)}
                      placeholder="Например, Kia Sportage"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current-car-year">Год выпуска</Label>
                    <Input
                      id="current-car-year"
                      type="number"
                      min={1950}
                      max={new Date().getFullYear() + 1}
                      value={form.currentCarYear}
                      onChange={event => update("currentCarYear", event.target.value)}
                      placeholder="Например, 2019"
                      className="h-11"
                    />
                  </div>
                  <SelectField
                    id="trade-in-plan"
                    label="Планирует сдать в трейд-ин?"
                    value={form.tradeInPlan}
                    onChange={value => update("tradeInPlan", value)}
                  >
                    <option value="">Не указано</option>
                    {tradeInOptions.map(value => <option key={value} value={value}>{value}</option>)}
                  </SelectField>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  {!selectedCar ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                        <SelectField
                          id="inventory-type"
                          label="Каталог"
                          value={inventoryType}
                          onChange={value => setInventoryType(value as "new" | "used")}
                        >
                          <option value="new">Новые автомобили</option>
                          <option value="used">Автомобили с пробегом</option>
                        </SelectField>
                        <div className="space-y-2">
                          <Label htmlFor="inventory-search">Поиск автомобиля</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              id="inventory-search"
                              value={inventorySearch}
                              onChange={event => setInventorySearch(event.target.value)}
                              placeholder="Марка, модель или модификация"
                              className="h-11 pl-9"
                            />
                          </div>
                        </div>
                      </div>
                      {inventorySearch.trim().length < 2 ? (
                        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                          Введите хотя бы два символа, чтобы найти автомобиль в базе.
                        </p>
                      ) : inventoryQuery.isLoading ? (
                        <div className="flex items-center gap-2 py-5 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Ищем автомобили…
                        </div>
                      ) : inventoryQuery.isError ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          Не удалось загрузить каталог. Попробуйте изменить запрос.
                        </p>
                      ) : inventory.length ? (
                        <div className="space-y-2">
                          {inventory.slice(0, 12).map(car => (
                            <InventoryResult
                              key={car.id}
                              car={car}
                              selected={false}
                              onSelect={chosen => setSelectedCar(chosen)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Ничего не найдено.</p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <InventoryResult car={selectedCar} selected onSelect={() => setSelectedCar(null)} />
                      <Button variant="outline" onClick={() => setSelectedCar(null)}>Выбрать другой автомобиль</Button>
                      <SelectField
                        id="payment-method"
                        label="Предпочтительный способ оплаты"
                        value={form.paymentMethod}
                        onChange={value => update("paymentMethod", value)}
                      >
                        <option value="">Не указано</option>
                        {paymentOptions.map(value => <option key={value} value={value}>{value}</option>)}
                      </SelectField>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manager-comment">Комментарий менеджера</Label>
                    <textarea
                      id="manager-comment"
                      className={textAreaClass}
                      value={form.comment}
                      onChange={event => update("comment", event.target.value)}
                      placeholder="Что важно помнить при продолжении общения?"
                      maxLength={4000}
                    />
                    <p className="text-right text-xs text-slate-400">{form.comment.length} / 4000</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Проверьте перед сохранением</h3>
                    <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs text-slate-500">Клиент</dt><dd className="break-words font-medium">{form.clientName}</dd></div>
                      <div><dt className="text-xs text-slate-500">Телефон</dt><dd className="font-medium">{form.clientPhone}</dd></div>
                      <div><dt className="text-xs text-slate-500">Интересующая модель</dt><dd className="break-words font-medium">{[form.desiredBrand, form.desiredModel].filter(Boolean).join(" ") || "Не указана"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Бюджет</dt><dd className="font-medium">{form.budgetRange || "Не указан"}</dd></div>
                      {form.currentCar && <div><dt className="text-xs text-slate-500">Текущий автомобиль</dt><dd className="break-words font-medium">{[form.currentCar, form.currentCarYear].filter(Boolean).join(", ")}</dd></div>}
                      {selectedCar && <div><dt className="text-xs text-slate-500">Предложение</dt><dd className="break-words font-medium">{[selectedCar.brand, selectedCar.model, selectedCar.year].filter(Boolean).join(" ")}</dd></div>}
                    </dl>
                  </div>
                </div>
              )}

              {formError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormError("");
                    setStep(current => Math.max(current - 1, 0));
                  }}
                  disabled={step === 0 || saveMutation.isPending}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {(step === 2 || step === 3) && (
                    <Button variant="ghost" onClick={skipOptionalStep} disabled={saveMutation.isPending}>
                      Пропустить
                    </Button>
                  )}
                  {step < steps.length - 1 ? (
                    <Button onClick={goNext} className="bg-[#0070b8] hover:bg-[#005a94]">
                      Далее
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={saveCard} disabled={saveMutation.isPending} className="bg-[#0070b8] hover:bg-[#005a94]">
                      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Сохранить рабочий лист
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
