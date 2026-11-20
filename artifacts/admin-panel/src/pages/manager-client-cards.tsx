import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type {
  AutoRuCatalogBrand,
  AutoRuCatalogModel,
  ManagerClientCard,
  ManagerClientCardInput,
  ManagerClientCardInventoryItem,
} from "@workspace/api-client-react";
import {
  createManagerClientCard,
  exportManagerClientCards,
  getAutoRuCatalogBrands,
  getAutoRuCatalogModels,
  getManagerClientCard,
  getManagerClientCardManagers,
  getManagerClientCards,
  getManagerClientNeedsBrands,
  getManagerClientNeedsModels,
  getManagerName,
  isAdminUsingManagerPortal,
  searchManagerClientCardInventory,
  useManagerAuth,
  type ManagerClientCardFilters,
} from "@/lib/manager-auth";

const steps = [
  { title: "Клиент", short: "Клиент" },
  { title: "Потребности", short: "Потребности" },
  { title: "Текущий автомобиль", short: "Текущий авто" },
  { title: "Предложение", short: "Предложение" },
  { title: "Комментарий", short: "Комментарий" },
];

const budgetOptions = ["Не указан", "до 2 млн", "2–3 млн", "3–5 млн", "5+ млн"] as const;
const paymentOptions = ["Кредит", "Лизинг", "Наличные / Безнал"] as const;
const tradeInOptions = ["Да", "Нет", "Пока не решил"] as const;
const pageSize = 25;

type FormState = {
  clientName: string;
  clientPhone: string;
  clientGender: "" | "male" | "female";
  desiredBrand: string;
  desiredModel: string;
  desiredVehicleUndecided: boolean;
  budgetRange: "" | typeof budgetOptions[number];
  currentCar: string;
  currentCarYear: string;
  tradeInPlan: "" | typeof tradeInOptions[number];
  commercialBrand: string;
  commercialModel: string;
  paymentMethod: "" | typeof paymentOptions[number];
  comment: string;
};

const emptyForm: FormState = {
  clientName: "",
  clientPhone: "+7",
  clientGender: "",
  desiredBrand: "",
  desiredModel: "",
  desiredVehicleUndecided: false,
  budgetRange: "",
  currentCar: "",
  currentCarYear: "",
  tradeInPlan: "",
  commercialBrand: "",
  commercialModel: "",
  paymentMethod: "",
  comment: "",
};

type ListFilters = {
  client: string;
  phone: string;
  dateFrom: string;
  dateTo: string;
  managerId: number | "";
};

const emptyFilters: ListFilters = {
  client: "",
  phone: "",
  dateFrom: "",
  dateTo: "",
  managerId: "",
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

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  const hasInternationalPrefix = /^\s*\+?7/.test(value);
  const hasDomesticPrefix = /^\s*8/.test(value) && digits.length === 11;
  const national = (
    (hasInternationalPrefix || hasDomesticPrefix) && (digits.startsWith("7") || digits.startsWith("8"))
      ? digits.slice(1)
      : digits
  ).slice(0, 10);
  const area = national.slice(0, 3);
  const first = national.slice(3, 6);
  const second = national.slice(6, 8);
  const third = national.slice(8, 10);
  let formatted = "+7";
  if (area) formatted += ` (${area}`;
  if (national.length >= 3) formatted += ")";
  if (first) formatted += ` ${first}`;
  if (second) formatted += `-${second}`;
  if (third) formatted += `-${third}`;
  return formatted;
}

function validateStep(
  form: FormState,
  step: number,
  selectedCurrentCar: ManagerClientCardInventoryItem | null,
  currentVehicleMode: "model" | "vin",
  autoRuBrandId: string,
  autoRuModelId: string,
  currentVinSearch: string,
  selectedOfferCar: ManagerClientCardInventoryItem | null,
  offerSearch: string,
): string[] {
  if (step === 0) {
    const errors: string[] = [];
    const name = form.clientName.trim();
    if (name.length < 2) errors.push("Укажите ФИО клиента.");
    else if (/\p{N}/u.test(name)) errors.push("В ФИО не должно быть цифр.");
    const digits = form.clientPhone.replace(/\D/g, "");
    const national = digits.startsWith("7") ? digits.slice(1) : "";
    const fake = /^(\d)\1{9}$/.test(national) || /(\d)\1{6,}/.test(national) || new Set([
      "0000000000", "1234567890", "0123456789", "9876543210", "0987654321", "1231231231",
    ]).has(national);
    if (digits.length !== 11 || !/^7[3-9]\d{9}$/.test(digits) || fake) {
      errors.push("Введите действующий номер телефона в формате +7.");
    }
    return errors;
  }
  if (step === 1) {
    const errors: string[] = [];
    const hasBrandModel = Boolean(form.desiredBrand && form.desiredModel);
    if (!form.desiredVehicleUndecided && !hasBrandModel) {
      errors.push("Выберите марку и модель или отметьте, что клиент пока не определился.");
    }
    if (form.desiredVehicleUndecided && (form.desiredBrand || form.desiredModel)) {
      errors.push("Снимите отметку «Пока не определился» или очистите выбранную модель.");
    }
    if (!form.budgetRange) errors.push("Укажите бюджет или выберите «Не указан».");
    return errors;
  }
  if (step === 2) {
    const errors: string[] = [];
    if (form.currentCarYear) {
      const year = Number(form.currentCarYear);
      if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
        errors.push("Проверьте год выпуска текущего автомобиля.");
      }
    }
    if (currentVehicleMode === "model" && autoRuBrandId && !autoRuModelId) {
      errors.push("Выберите модель текущего автомобиля или очистите марку.");
    }
    if (currentVehicleMode === "vin" && currentVinSearch.trim() && !selectedCurrentCar) {
      errors.push("Выберите найденный автомобиль по VIN или очистите поле.");
    }
    return errors;
  }
  if (step === 3) {
    const hasCatalogSelection = Boolean(form.commercialBrand || form.commercialModel);
    if (Boolean(form.commercialBrand) !== Boolean(form.commercialModel)) {
      return ["Выберите и марку, и модель предложения."];
    }
    if (offerSearch.trim() && !selectedOfferCar) return ["Выберите новый автомобиль из базы или очистите поиск."];
    if (selectedOfferCar || hasCatalogSelection) return [];
    return [];
  }
  return [];
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
  car: ManagerClientCardInventoryItem;
  selected: boolean;
  onSelect: (car: ManagerClientCardInventoryItem) => void;
}) {
  const title = [car.brand, car.model, car.year].filter(Boolean).join(" ");
  const details = [
    car.type === "used" ? "С пробегом" : "Новый автомобиль",
    car.modification,
    car.complectation,
    car.color,
    car.vin ? `VIN ${car.vin}` : "",
  ].filter(Boolean).join(" · ");
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
        <span className="block break-words font-semibold text-slate-900">{title || "Автомобиль из каталога"}</span>
        {details && <span className="mt-1 block break-all text-xs text-slate-500">{details}</span>}
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
  const [filters, setFilters] = useState<ListFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [selectedCard, setSelectedCard] = useState<ManagerClientCard | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedCurrentCar, setSelectedCurrentCar] = useState<ManagerClientCardInventoryItem | null>(null);
  const [selectedOfferCar, setSelectedOfferCar] = useState<ManagerClientCardInventoryItem | null>(null);
  const [currentVehicleMode, setCurrentVehicleMode] = useState<"model" | "vin">("model");
  const [autoRuBrandId, setAutoRuBrandId] = useState("");
  const [autoRuBrandName, setAutoRuBrandName] = useState("");
  const [autoRuModelId, setAutoRuModelId] = useState("");
  const [autoRuModelName, setAutoRuModelName] = useState("");
  const [currentVinSearch, setCurrentVinSearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [saveAttempted, setSaveAttempted] = useState(false);

  const cardsQuery = useQuery({
    queryKey: ["manager-client-cards", filters, page],
    queryFn: () => getManagerClientCards({ ...filters, page, pageSize }),
    enabled: mode === "list",
  });
  const detailQuery = useQuery({
    queryKey: ["manager-client-card-detail", selectedCard?.id],
    queryFn: () => getManagerClientCard(selectedCard!.id),
    enabled: Boolean(selectedCard),
    staleTime: 15_000,
  });
  const managersQuery = useQuery({
    queryKey: ["manager-client-card-managers"],
    queryFn: getManagerClientCardManagers,
    enabled: mode === "list" && adminPortal,
  });
  const brandsQuery = useQuery({
    queryKey: ["manager-client-card-brands"],
    queryFn: getManagerClientNeedsBrands,
    enabled: mode === "form",
  });
  const modelsQuery = useQuery({
    queryKey: ["manager-client-card-models", form.desiredBrand],
    queryFn: () => getManagerClientNeedsModels(form.desiredBrand),
    enabled: mode === "form" && Boolean(form.desiredBrand),
  });
  const autoRuBrandsQuery = useQuery({
    queryKey: ["manager-client-card-autoru-brands"],
    queryFn: getAutoRuCatalogBrands,
    enabled: mode === "form" && step === 2 && currentVehicleMode === "model",
    staleTime: 60 * 60 * 1000,
  });
  const autoRuModelsQuery = useQuery({
    queryKey: ["manager-client-card-autoru-models", autoRuBrandId],
    queryFn: () => getAutoRuCatalogModels(autoRuBrandId),
    enabled: mode === "form" && step === 2 && currentVehicleMode === "model" && Boolean(autoRuBrandId),
    staleTime: 30 * 60 * 1000,
  });
  const currentCarInventoryQuery = useQuery({
    queryKey: ["manager-client-card-current-vehicle", currentVehicleMode, autoRuBrandName, autoRuModelName, currentVinSearch.trim()],
    queryFn: () => currentVehicleMode === "vin"
      ? searchManagerClientCardInventory({ vin: currentVinSearch.trim(), type: "used" })
      : searchManagerClientCardInventory({
          brand: autoRuBrandName,
          model: autoRuModelName,
          type: "used",
        }),
    enabled: mode === "form" && step === 2 && (
      currentVehicleMode === "vin"
        ? currentVinSearch.trim().length >= 4
        : Boolean(autoRuBrandName && autoRuModelName)
    ),
    staleTime: 30_000,
  });
  const offerInventoryQuery = useQuery({
    queryKey: ["manager-client-card-offer-vehicle", offerSearch.trim()],
    queryFn: () => searchManagerClientCardInventory({ q: offerSearch.trim(), type: "new" }),
    enabled: mode === "form" && step === 3 && offerSearch.trim().length >= 2,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: ManagerClientCardInput) => createManagerClientCard(payload),
    onSuccess: () => {
      toast({ title: "Рабочий лист сохранён" });
      setForm(emptyForm);
      setSelectedCurrentCar(null);
      setSelectedOfferCar(null);
      setStep(0);
      setCurrentVinSearch("");
      setOfferSearch("");
      setAutoRuBrandId("");
      setAutoRuBrandName("");
      setAutoRuModelId("");
      setAutoRuModelName("");
      setCurrentVehicleMode("model");
      setFormError("");
      setSaveAttempted(false);
      setMode("list");
      void queryClient.invalidateQueries({ queryKey: ["manager-client-cards"] });
    },
    onError: error => {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить рабочий лист");
    },
  });

  const brands = brandsQuery.data?.data ?? [];
  const models = modelsQuery.data?.data ?? [];
  const autoRuBrands = autoRuBrandsQuery.data?.data ?? [];
  const autoRuModels = autoRuModelsQuery.data?.data ?? [];
  const managers = managersQuery.data?.data ?? [];
  const currentCarInventory = currentCarInventoryQuery.data?.data ?? [];
  const offerInventory = offerInventoryQuery.data?.data ?? [];
  const cardsPage = cardsQuery.data?.data;
  const cards = cardsPage?.items ?? [];
  const detailCard = detailQuery.data?.data ?? selectedCard;
  const totalPages = Math.max(1, Math.ceil((cardsPage?.total ?? 0) / pageSize));
  const stepErrors = useMemo(
    () => steps.map((_, index) => saveAttempted
      ? validateStep(
          form,
          index,
          selectedCurrentCar,
          currentVehicleMode,
          autoRuBrandId,
          autoRuModelId,
          currentVinSearch,
          selectedOfferCar,
          offerSearch,
        )
      : []),
    [
      form,
      selectedCurrentCar,
      currentVehicleMode,
      autoRuBrandId,
      autoRuModelId,
      currentVinSearch,
      selectedOfferCar,
      offerSearch,
      saveAttempted,
    ],
  );
  const progress = useMemo(() => `${step + 1} из ${steps.length}`, [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
    setFormError("");
  }

  function updateFilters(patch: Partial<ListFilters>) {
    setFilters(previous => ({ ...previous, ...patch }));
    setPage(1);
  }

  function currentFilterParams(): ManagerClientCardFilters {
    return { ...filters, page: 1, pageSize };
  }

  function startNewCard() {
    setForm(emptyForm);
    setSelectedCurrentCar(null);
    setSelectedOfferCar(null);
    setCurrentVehicleMode("model");
    setOfferSearch("");
    setAutoRuBrandId("");
    setAutoRuBrandName("");
    setAutoRuModelId("");
    setAutoRuModelName("");
    setCurrentVinSearch("");
    setStep(0);
    setFormError("");
    setSaveAttempted(false);
    setMode("form");
  }

  function goNext() {
    setFormError("");
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function skipOptionalStep() {
    if (step === 2) {
      update("currentCar", "");
      update("currentCarYear", "");
      update("tradeInPlan", "");
      setSelectedCurrentCar(null);
      setCurrentVinSearch("");
      setAutoRuBrandId("");
      setAutoRuBrandName("");
      setAutoRuModelId("");
      setAutoRuModelName("");
    }
    if (step === 3) {
      setSelectedOfferCar(null);
      setOfferSearch("");
      update("commercialBrand", "");
      update("commercialModel", "");
      update("paymentMethod", "");
    }
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function saveCard() {
    setFormError("");
    setSaveAttempted(true);
    const allErrors = steps.map((_, index) => validateStep(
      form,
      index,
      selectedCurrentCar,
      currentVehicleMode,
      autoRuBrandId,
      autoRuModelId,
      currentVinSearch,
      selectedOfferCar,
      offerSearch,
    ));
    const firstInvalid = allErrors.findIndex(errors => errors.length > 0);
    if (firstInvalid >= 0) {
      setStep(firstInvalid);
      setFormError(allErrors[firstInvalid].join(" "));
      return;
    }
    saveMutation.mutate({
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientGender: form.clientGender || null,
      desiredBrand: form.desiredBrand || null,
      desiredModel: form.desiredModel || null,
      desiredVehicleUndecided: form.desiredVehicleUndecided,
      budgetRange: form.budgetRange || null,
      currentCar: form.currentCar.trim() || null,
      currentCarYear: form.currentCarYear ? Number(form.currentCarYear) : null,
      currentCarInventoryId: selectedCurrentCar?.id ?? null,
      tradeInPlan: form.tradeInPlan || null,
      commercialBrand: form.commercialBrand || null,
      commercialModel: form.commercialModel || null,
      commercialCarId: selectedOfferCar?.id ?? null,
      paymentMethod: form.paymentMethod || null,
      comment: form.comment.trim(),
    });
  }

  function selectOfferCar(car: ManagerClientCardInventoryItem) {
    setSelectedOfferCar(car);
    update("commercialBrand", car.brand ?? "");
    update("commercialModel", car.model ?? "");
  }

  function selectCurrentCar(car: ManagerClientCardInventoryItem) {
    setSelectedCurrentCar(car);
    update("currentCar", [car.brand, car.model].filter(Boolean).join(" "));
    update("currentCarYear", car.year ? String(car.year) : "");
  }

  function downloadCsv(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "рабочие-листы-клиентов.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const exportMutation = useMutation({
    mutationFn: () => exportManagerClientCards(currentFilterParams()),
    onSuccess: downloadCsv,
    onError: error => toast({
      title: "Не удалось выгрузить CSV",
      description: error instanceof Error ? error.message : "Повторите попытку.",
      variant: "destructive",
    }),
  });

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
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className={`grid min-w-0 gap-3 ${adminPortal ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="filter-client">Клиент</Label>
                    <Input
                      id="filter-client"
                      value={filters.client}
                      onChange={event => updateFilters({ client: event.target.value })}
                      placeholder="ФИО"
                      className="h-10 min-w-0"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="filter-phone">Телефон</Label>
                    <Input
                      id="filter-phone"
                      value={filters.phone}
                      onChange={event => updateFilters({ phone: event.target.value })}
                      placeholder="+7 или часть номера"
                      inputMode="tel"
                      className="h-10 min-w-0"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="filter-date-from">С даты</Label>
                    <Input
                      id="filter-date-from"
                      type="date"
                      value={filters.dateFrom}
                      onChange={event => updateFilters({ dateFrom: event.target.value })}
                      className="h-10 min-w-0"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="filter-date-to">По дату</Label>
                    <Input
                      id="filter-date-to"
                      type="date"
                      value={filters.dateTo}
                      onChange={event => updateFilters({ dateTo: event.target.value })}
                      className="h-10 min-w-0"
                    />
                  </div>
                  {adminPortal && (
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="filter-manager">Менеджер</Label>
                      <select
                        id="filter-manager"
                        value={filters.managerId}
                        onChange={event => updateFilters({ managerId: event.target.value ? Number(event.target.value) : "" })}
                        className={fieldClass}
                      >
                        <option value="">Все менеджеры</option>
                        {managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {cardsPage ? `Найдено: ${cardsPage.total}` : "Фильтры списка"}
                    </span>
                    {Object.values(filters).some(Boolean) && (
                      <Button variant="ghost" size="sm" onClick={() => updateFilters(emptyFilters)} className="h-8 px-2 text-slate-500">
                        Сбросить
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {exportMutation.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Download className="mr-2 h-4 w-4" />}
                    Выгрузить CSV
                  </Button>
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
                    {cardsPage?.total ? "Совпадений не найдено" : "Карточек пока нет"}
                  </h2>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    {cardsPage?.total ? "Измените фильтры и повторите поиск." : "Создайте рабочий лист во время разговора с клиентом."}
                  </p>
                  {!cardsPage?.total && !adminPortal && (
                    <Button onClick={startNewCard} className="mt-5 bg-[#0070b8] hover:bg-[#005a94]">
                      <Plus className="mr-2 h-4 w-4" />
                      Создать карточку
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {cards.map(card => {
                  const desired = [card.desiredBrand, card.desiredModel].filter(Boolean).join(" ");
                  const offer = card.commercialCarSnapshot;
                  const offerTitle = [
                    card.commercialBrand || offer?.brand,
                    card.commercialModel || offer?.model,
                    offer?.year,
                  ].filter(Boolean).join(" ");
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCard(card)}
                      className="grid w-full min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_20px] sm:items-center sm:gap-4 sm:px-4"
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-semibold text-slate-900">{card.clientName}</span>
                        <span className="mt-0.5 block text-sm text-slate-600">{card.clientPhone}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">Интерес</span>
                        <span className="mt-0.5 block break-words text-sm text-slate-700">
                          {desired || (card.desiredVehicleUndecided ? "Пока не определился" : "Не указан")}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {card.budgetRange && <Badge variant="secondary">{card.budgetRange}</Badge>}
                        <span className="text-xs text-slate-500">{formatDate(card.createdAt)}</span>
                        {adminPortal && card.managerName && (
                          <span className="w-full truncate text-xs text-slate-500">{card.managerName}</span>
                        )}
                      </span>
                      <ChevronRight className="hidden h-4 w-4 text-slate-400 sm:block" />
                      {offerTitle && (
                        <span className="col-span-full truncate border-t border-slate-100 pt-2 text-xs text-slate-500 sm:hidden">
                          Предложение: {offerTitle}{offer?.price ? ` · ${rub(offer.price)}` : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {!cardsQuery.isLoading && !cardsQuery.isError && cardsPage && cardsPage.total > pageSize && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm text-slate-500">Страница {page} из {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Назад</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
                    <span className="hidden sm:inline">Далее</span>
                    <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </div>
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
                    className={`h-1.5 flex-1 rounded-full ${
                      stepErrors[index].length
                        ? "bg-red-500"
                        : index === step
                          ? "bg-[#0070b8]"
                          : validateStep(
                              form,
                              index,
                              selectedCurrentCar,
                              currentVehicleMode,
                              autoRuBrandId,
                              autoRuModelId,
                              currentVinSearch,
                              selectedOfferCar,
                              offerSearch,
                            ).length === 0
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {steps.map((item, index) => (
                  <button
                    key={item.short}
                    type="button"
                    onClick={() => {
                      setStep(index);
                      setFormError("");
                    }}
                    disabled={saveMutation.isPending}
                    aria-current={index === step ? "step" : undefined}
                    className={`min-h-9 rounded-md border px-2 text-left transition ${
                      stepErrors[index].length
                        ? "border-red-200 bg-red-50 font-semibold text-red-700"
                        : index === step
                          ? "border-sky-200 bg-sky-50 font-semibold text-[#0070b8]"
                          : validateStep(
                              form,
                              index,
                              selectedCurrentCar,
                              currentVehicleMode,
                              autoRuBrandId,
                              autoRuModelId,
                              currentVinSearch,
                              selectedOfferCar,
                              offerSearch,
                            ).length === 0
                            ? "border-emerald-100 bg-emerald-50/60 text-emerald-800"
                            : "border-transparent text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {item.short}
                    {stepErrors[index].length > 0 && <span className="ml-1" aria-label="Есть незаполненные обязательные поля">!</span>}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{steps[step]?.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {step === 0 && "Укажите контактные данные клиента. Пол можно не заполнять."}
                  {step === 1 && "Выберите модель из доступного склада или отметьте, что клиент пока не определился."}
                  {step === 2 && "Выберите марку и модель текущего автомобиля в каталоге Auto.ru или найдите его по VIN."}
                  {step === 3 && "Выберите конкретный новый автомобиль из активного склада."}
                  {step === 4 && "Добавьте важные детали разговора, которые помогут продолжить общение."}
                </p>
              </div>

              {step === 0 && (
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <Label htmlFor="client-name">ФИО клиента *</Label>
                    <Input
                      id="client-name"
                      autoComplete="name"
                      value={form.clientName}
                      onChange={event => update("clientName", event.target.value)}
                      placeholder="Например, Иванов Иван Иванович"
                      className={`h-11 min-w-0 ${saveAttempted && stepErrors[0].some(error => error.includes("ФИО")) ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                    />
                    {saveAttempted && stepErrors[0].some(error => error.includes("ФИО")) && (
                      <p className="text-xs text-red-600">{stepErrors[0].find(error => error.includes("ФИО"))}</p>
                    )}
                  </div>
                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <Label htmlFor="client-phone">Номер телефона *</Label>
                    <Input
                      id="client-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={form.clientPhone}
                      onChange={event => update("clientPhone", formatPhoneInput(event.target.value))}
                      placeholder="+7 (___) ___-__-__"
                      className={`h-11 min-w-0 ${saveAttempted && stepErrors[0].some(error => error.includes("телефон")) ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                    />
                    {saveAttempted && stepErrors[0].some(error => error.includes("телефон")) && (
                      <p className="text-xs text-red-600">{stepErrors[0].find(error => error.includes("телефон"))}</p>
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Пол клиента <span className="font-normal text-slate-400">· необязательно</span></Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([{ value: "male", label: "Мужской" }, { value: "female", label: "Женский" }] as const).map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => update("clientGender", form.clientGender === option.value ? "" : option.value)}
                          aria-pressed={form.clientGender === option.value}
                          className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition ${
                            form.clientGender === option.value
                              ? "border-[#0070b8] bg-sky-50 text-[#005a94]"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Label htmlFor="desired-brand">Марка и модель нового автомобиля</Label>
                      <button
                        type="button"
                        aria-pressed={form.desiredVehicleUndecided}
                        onClick={() => {
                          update("desiredVehicleUndecided", !form.desiredVehicleUndecided);
                          if (!form.desiredVehicleUndecided) {
                            update("desiredBrand", "");
                            update("desiredModel", "");
                          }
                        }}
                        className={`min-h-9 rounded-lg border px-3 text-sm transition ${
                          form.desiredVehicleUndecided
                            ? "border-[#0070b8] bg-sky-50 font-medium text-[#005a94]"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Пока не определился
                      </button>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor="desired-brand">Марка</Label>
                        <select
                          id="desired-brand"
                          className={fieldClass}
                          value={form.desiredBrand}
                          disabled={form.desiredVehicleUndecided || brandsQuery.isLoading}
                          onChange={event => {
                            update("desiredVehicleUndecided", false);
                            update("desiredBrand", event.target.value);
                            update("desiredModel", "");
                          }}
                        >
                          <option value="">Выберите марку</option>
                          {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                        </select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor="desired-model">Модель</Label>
                        <select
                          id="desired-model"
                          className={fieldClass}
                          value={form.desiredModel}
                          disabled={!form.desiredBrand || form.desiredVehicleUndecided || modelsQuery.isLoading}
                          onChange={event => update("desiredModel", event.target.value)}
                        >
                          <option value="">{form.desiredBrand ? "Выберите модель" : "Сначала выберите марку"}</option>
                          {models.map(model => <option key={model} value={model}>{model}</option>)}
                        </select>
                      </div>
                    </div>
                    {brandsQuery.isLoading && <p className="text-xs text-slate-500">Загружаем марки из активного склада…</p>}
                    {modelsQuery.isLoading && <p className="text-xs text-slate-500">Загружаем модели…</p>}
                    {brandsQuery.isError && <p role="alert" className="text-sm text-red-600">Не удалось загрузить марки из склада CM Expert.</p>}
                    {brands.length === 0 && !brandsQuery.isLoading && !brandsQuery.isError && (
                      <p className="text-sm text-slate-500">Для этого аккаунта нет доступных новых автомобилей из CM Expert.</p>
                    )}
                    {saveAttempted && stepErrors[1].some(error => error.includes("марку")) && (
                      <p className="text-sm text-red-600">{stepErrors[1].find(error => error.includes("марку"))}</p>
                    )}
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <Label>Бюджет клиента</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {budgetOptions.map(option => (
                        <button
                          type="button"
                          key={option}
                          onClick={() => update("budgetRange", option)}
                          className={`min-h-11 rounded-lg border px-4 text-left text-sm font-medium transition ${
                            form.budgetRange === option ? "border-[#0070b8] bg-sky-50 text-[#005a94]" : "border-slate-200 hover:bg-slate-50"
                          }`}
                          aria-pressed={form.budgetRange === option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {saveAttempted && stepErrors[1].some(error => error.includes("бюджет")) && (
                      <p className="text-sm text-red-600">{stepErrors[1].find(error => error.includes("бюджет"))}</p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Способ поиска текущего автомобиля">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={currentVehicleMode === "model"}
                      onClick={() => {
                        setCurrentVehicleMode("model");
                        setCurrentVinSearch("");
                        setSelectedCurrentCar(null);
                        update("currentCar", "");
                        update("currentCarYear", "");
                      }}
                      className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition ${
                        currentVehicleMode === "model" ? "border-[#0070b8] bg-sky-50 text-[#005a94]" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      По марке и модели
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={currentVehicleMode === "vin"}
                      onClick={() => {
                        setCurrentVehicleMode("vin");
                        setAutoRuBrandId("");
                        setAutoRuBrandName("");
                        setAutoRuModelId("");
                        setAutoRuModelName("");
                        setSelectedCurrentCar(null);
                        setCurrentVinSearch("");
                        update("currentCar", "");
                        update("currentCarYear", "");
                      }}
                      className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition ${
                        currentVehicleMode === "vin" ? "border-[#0070b8] bg-sky-50 text-[#005a94]" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      По VIN
                    </button>
                  </div>

                  {currentVehicleMode === "model" ? (
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <SelectField
                        id="current-autoru-brand"
                        label="Марка · Auto.ru"
                        value={autoRuBrandId}
                        disabled={autoRuBrandsQuery.isLoading}
                        onChange={id => {
                          const brand = autoRuBrands.find(item => item.id === id);
                          const brandName = brand?.cyrillicName || brand?.name || "";
                          setAutoRuBrandId(id);
                          setAutoRuBrandName(brandName);
                          setAutoRuModelId("");
                          setAutoRuModelName("");
                          setSelectedCurrentCar(null);
                          update("currentCar", brandName);
                          update("currentCarYear", "");
                        }}
                      >
                        <option value="">{autoRuBrandsQuery.isLoading ? "Загружаем марки…" : "Выберите марку"}</option>
                        {autoRuBrands.map(brand => (
                          <option key={brand.id} value={brand.id}>{brand.cyrillicName || brand.name}</option>
                        ))}
                      </SelectField>
                      <SelectField
                        id="current-autoru-model"
                        label="Модель"
                        value={autoRuModelId}
                        disabled={!autoRuBrandId || autoRuModelsQuery.isLoading}
                        onChange={id => {
                          const model = autoRuModels.find(item => item.id === id);
                          const modelName = model?.name || "";
                          setAutoRuModelId(id);
                          setAutoRuModelName(modelName);
                          setSelectedCurrentCar(null);
                          update("currentCar", [autoRuBrandName, modelName].filter(Boolean).join(" "));
                          update("currentCarYear", "");
                        }}
                      >
                        <option value="">
                          {autoRuModelsQuery.isLoading ? "Загружаем модели…" : autoRuBrandId ? "Выберите модель" : "Сначала выберите марку"}
                        </option>
                        {autoRuModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                      </SelectField>
                      {autoRuBrandsQuery.isError && (
                        <p role="alert" className="text-sm text-red-600 sm:col-span-2">Не удалось загрузить марки из Auto.ru.</p>
                      )}
                      {autoRuModelsQuery.isError && (
                        <p role="alert" className="text-sm text-red-600 sm:col-span-2">Не удалось загрузить модели из Auto.ru.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="current-vin">VIN или его часть</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="current-vin"
                          value={currentVinSearch}
                          onChange={event => {
                            setCurrentVinSearch(event.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, "").slice(0, 32));
                            setSelectedCurrentCar(null);
                            update("currentCar", "");
                            update("currentCarYear", "");
                          }}
                          placeholder="Введите минимум 4 символа"
                          autoCapitalize="characters"
                          className="h-11 pl-9 uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {selectedCurrentCar ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">Текущий автомобиль из базы с пробегом</p>
                      <InventoryResult car={selectedCurrentCar} selected onSelect={() => setSelectedCurrentCar(null)} />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCurrentCar(null);
                          if (currentVehicleMode === "vin") {
                            update("currentCar", "");
                            update("currentCarYear", "");
                          }
                        }}
                      >
                        Снять выбор автомобиля из базы
                      </Button>
                    </div>
                  ) : currentVehicleMode === "vin" && currentVinSearch.trim().length < 4 ? (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Поиск по VIN работает по базе автомобилей с пробегом и доступен от 4 символов.
                    </p>
                  ) : currentVehicleMode === "model" && (!autoRuBrandName || !autoRuModelName) ? (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Выберите марку и модель в Auto.ru. Если похожий автомобиль есть в нашей базе с пробегом, его можно привязать к листу.
                    </p>
                  ) : currentCarInventoryQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-5 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Ищем в базе автомобилей с пробегом…
                    </div>
                  ) : currentCarInventoryQuery.isError ? (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Не удалось выполнить поиск. Измените запрос и попробуйте снова.
                    </p>
                  ) : currentCarInventory.length ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        Совпадения в базе с пробегом: {currentCarInventory.length}. Выбор конкретной машины необязателен.
                      </p>
                      {currentCarInventory.map(car => (
                        <InventoryResult key={car.id} car={car} selected={false} onSelect={selectCurrentCar} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      {currentVehicleMode === "model"
                        ? "Совпадений в базе с пробегом нет. Марка и модель из Auto.ru всё равно сохранятся."
                        : "Автомобиль с таким VIN в базе не найден. Проверьте VIN или выполните поиск по марке и модели."}
                    </p>
                  )}

                  <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
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
                      onChange={value => update("tradeInPlan", value as FormState["tradeInPlan"])}
                    >
                      <option value="">Не указано</option>
                      {tradeInOptions.map(value => <option key={value} value={value}>{value}</option>)}
                    </SelectField>
                  </div>
                  {saveAttempted && stepErrors[2].length > 0 && (
                    <p className="text-sm text-red-600">{stepErrors[2].join(" ")}</p>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="offer-car-search">Поиск нового автомобиля по марке, модели, комплектации или VIN</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="offer-car-search"
                        value={offerSearch}
                        onChange={event => {
                          setOfferSearch(event.target.value);
                          setSelectedOfferCar(null);
                          update("commercialBrand", "");
                          update("commercialModel", "");
                        }}
                        placeholder="Например, HAVAL DARGO"
                        className="h-11 pl-9"
                      />
                    </div>
                    <p className="text-xs text-slate-500">Поиск выполняется только по новым автомобилям из доступного склада.</p>
                  </div>

                  {selectedOfferCar ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">Выбранный новый автомобиль</p>
                      <InventoryResult
                        car={selectedOfferCar}
                        selected
                        onSelect={() => {
                          setSelectedOfferCar(null);
                          update("commercialBrand", "");
                          update("commercialModel", "");
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedOfferCar(null);
                          update("commercialBrand", "");
                          update("commercialModel", "");
                        }}
                      >
                        Снять выбор автомобиля
                      </Button>
                    </div>
                  ) : offerSearch.trim().length < 2 ? (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Введите не менее двух символов. Здесь отображаются только новые автомобили из базы.
                    </p>
                  ) : offerInventoryQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-5 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Ищем новые автомобили…
                    </div>
                  ) : offerInventoryQuery.isError ? (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Не удалось выполнить поиск. Измените запрос и попробуйте снова.
                    </p>
                  ) : offerInventory.length ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Найдено новых автомобилей: {offerInventory.length}.</p>
                      {offerInventory.map(car => (
                        <InventoryResult key={car.id} car={car} selected={false} onSelect={selectOfferCar} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Новые автомобили по запросу не найдены. Проверьте, что модель есть в актуальном складе.
                    </p>
                  )}

                  <SelectField
                    id="payment-method"
                    label="Предпочтительный способ оплаты"
                    value={form.paymentMethod}
                    onChange={value => update("paymentMethod", value as FormState["paymentMethod"])}
                  >
                    <option value="">Не указано</option>
                    {paymentOptions.map(value => <option key={value} value={value}>{value}</option>)}
                  </SelectField>
                  {saveAttempted && stepErrors[3].length > 0 && (
                    <p className="text-sm text-red-600">{stepErrors[3].join(" ")}</p>
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
                      {form.clientGender && <div><dt className="text-xs text-slate-500">Пол</dt><dd className="font-medium">{form.clientGender === "male" ? "Мужской" : "Женский"}</dd></div>}
                      <div><dt className="text-xs text-slate-500">Интересующая модель</dt><dd className="break-words font-medium">{[form.desiredBrand, form.desiredModel].filter(Boolean).join(" ") || (form.desiredVehicleUndecided ? "Пока не определился" : "Не указана")}</dd></div>
                      <div><dt className="text-xs text-slate-500">Бюджет</dt><dd className="font-medium">{form.budgetRange || "Не указан"}</dd></div>
                      {form.currentCar && (
                        <div>
                          <dt className="text-xs text-slate-500">Текущий автомобиль</dt>
                          <dd className="break-words font-medium">{[form.currentCar, form.currentCarYear].filter(Boolean).join(", ")}</dd>
                          {selectedCurrentCar?.vin && <dd className="mt-1 break-all font-mono text-xs text-slate-500">VIN {selectedCurrentCar.vin}</dd>}
                        </div>
                      )}
                      {(form.commercialBrand || form.commercialModel) && (
                        <div>
                          <dt className="text-xs text-slate-500">Предложение</dt>
                          <dd className="break-words font-medium">
                            {[form.commercialBrand, form.commercialModel, selectedOfferCar?.year].filter(Boolean).join(" ")}
                            {selectedOfferCar && <span className="block text-xs font-normal text-slate-500">{rub(selectedOfferCar.price)}</span>}
                          </dd>
                        </div>
                      )}
                      {form.paymentMethod && <div><dt className="text-xs text-slate-500">Способ оплаты</dt><dd className="font-medium">{form.paymentMethod}</dd></div>}
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
      <Dialog open={Boolean(selectedCard)} onOpenChange={open => { if (!open) setSelectedCard(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedCard && detailCard && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">Рабочий лист №{detailCard.id}</DialogTitle>
                <DialogDescription>
                  Создан {formatDate(detailCard.createdAt)}
                  {detailCard.managerName ? ` · ${detailCard.managerName}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Клиент</h3>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div><dt className="text-xs text-slate-500">ФИО</dt><dd className="break-words font-medium">{detailCard.clientName}</dd></div>
                    <div><dt className="text-xs text-slate-500">Телефон</dt><dd className="font-medium">{detailCard.clientPhone}</dd></div>
                    {detailCard.clientGender && (
                      <div><dt className="text-xs text-slate-500">Пол</dt><dd className="font-medium">{detailCard.clientGender === "male" ? "Мужской" : "Женский"}</dd></div>
                    )}
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Потребности</h3>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Модель</dt>
                      <dd className="break-words font-medium">
                        {[detailCard.desiredBrand, detailCard.desiredModel].filter(Boolean).join(" ") ||
                          (detailCard.desiredVehicleUndecided ? "Пока не определился" : "Не указана")}
                      </dd>
                    </div>
                    <div><dt className="text-xs text-slate-500">Бюджет</dt><dd className="font-medium">{detailCard.budgetRange || "Не указан"}</dd></div>
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Текущий автомобиль</h3>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Автомобиль</dt>
                      <dd className="break-words font-medium">
                        {[detailCard.currentCar, detailCard.currentCarYear].filter(Boolean).join(", ") || "Не указан"}
                      </dd>
                    </div>
                    {detailCard.currentCarSnapshot?.vin && (
                      <div>
                        <dt className="text-xs text-slate-500">VIN из базы</dt>
                        <dd className="break-all font-mono text-xs">{detailCard.currentCarSnapshot.vin}</dd>
                      </div>
                    )}
                    <div><dt className="text-xs text-slate-500">Трейд-ин</dt><dd className="font-medium">{detailCard.tradeInPlan || "Не указано"}</dd></div>
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">Предложение</h3>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Марка и модель</dt>
                      <dd className="break-words font-medium">
                        {[detailCard.commercialBrand || detailCard.commercialCarSnapshot?.brand,
                          detailCard.commercialModel || detailCard.commercialCarSnapshot?.model,
                          detailCard.commercialCarSnapshot?.year].filter(Boolean).join(" ") || "Не выбрано"}
                      </dd>
                    </div>
                    {detailCard.commercialCarSnapshot?.price != null && (
                      <div><dt className="text-xs text-slate-500">Цена автомобиля из базы</dt><dd className="font-semibold text-[#0070b8]">{rub(detailCard.commercialCarSnapshot.price)}</dd></div>
                    )}
                    {detailCard.commercialCarSnapshot?.vin && (
                      <div><dt className="text-xs text-slate-500">VIN автомобиля из базы</dt><dd className="break-all font-mono text-xs">{detailCard.commercialCarSnapshot.vin}</dd></div>
                    )}
                    <div><dt className="text-xs text-slate-500">Способ оплаты</dt><dd className="font-medium">{detailCard.paymentMethod || "Не указан"}</dd></div>
                  </dl>
                </section>
                {detailCard.comment && (
                  <section className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                    <h3 className="font-semibold text-slate-900">Комментарий менеджера</h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{detailCard.comment}</p>
                  </section>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
