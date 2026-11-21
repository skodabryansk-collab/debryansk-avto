import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  History,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
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
  ManagerClientCard,
  ManagerClientCardCreatedResponse,
  ManagerClientCardInput,
  ManagerClientCardInventoryItem,
  ManagerClientCardUpdatedResponse,
  ManagerClientCarSnapshot,
} from "@workspace/api-client-react";
import {
  createManagerClientCard,
  exportManagerClientCards,
  getManagerClientCard,
  getManagerClientCardManagers,
  getManagerClientCards,
  getManagerClientNeedsBrands,
  getManagerClientNeedsModels,
  getManagerName,
  isAdminUsingManagerPortal,
  searchManagerClientCardInventory,
  updateManagerClientCard,
  useManagerAuth,
  type ManagerClientCardFilters,
} from "@/lib/manager-auth";

const steps = [
  { title: "Клиент", short: "Клиент" },
  { title: "Потребности", short: "Потребности" },
  { title: "Текущие автомобили", short: "Текущие авто" },
  { title: "Предложение", short: "Предложение" },
  { title: "Комментарий", short: "Комментарий" },
];

const budgetOptions = ["Не указан", "до 2 млн", "2–3 млн", "3–5 млн", "5+ млн"] as const;
const paymentOptions = ["Кредит", "Лизинг", "Наличные / Безнал"] as const;
const tradeInOptions = ["Да", "Нет", "Пока не решил"] as const;
const pageSize = 25;
const offerResultsPageSize = 10;

type FormState = {
  clientName: string;
  clientPhone: string;
  clientGender: "" | "male" | "female";
  needs: Array<{
    localId: string;
    brand: string;
    model: string;
    undecided: boolean;
    budgetRange: "" | typeof budgetOptions[number];
    plannedPurchaseDate: string;
  }>;
  currentCars: Array<{
    localId: string;
    brandId: string;
    modelId: string;
    brandSearch: string;
    modelSearch: string;
    brand: string;
    model: string;
    year: string;
    mileage: string;
    generationId: string;
    bodyTypeId: string;
    generation: string;
    bodyType: string;
    ownersCount: "" | "1" | "2" | "3" | "4+";
    tradeInPlan: "" | typeof tradeInOptions[number];
    snapshot: ManagerClientCarSnapshot | null;
  }>;
  commercialBrand: string;
  commercialModel: string;
  paymentMethod: "" | typeof paymentOptions[number];
  comment: string;
};

const emptyForm: FormState = {
  clientName: "",
  clientPhone: "+7",
  clientGender: "",
  needs: [{ localId: "need-initial", brand: "", model: "", undecided: false, budgetRange: "", plannedPurchaseDate: "" }],
  currentCars: [],
  commercialBrand: "",
  commercialModel: "",
  paymentMethod: "",
  comment: "",
};

function newLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyCurrentCar(localId = newLocalId("car")): FormState["currentCars"][number] {
  return {
    localId,
    brandId: "",
    modelId: "",
    brandSearch: "",
    modelSearch: "",
    brand: "",
    model: "",
    year: "",
    mileage: "",
    generationId: "",
    bodyTypeId: "",
    generation: "",
    bodyType: "",
    ownersCount: "",
    tradeInPlan: "",
    snapshot: null,
  };
}

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

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "Не указана";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(year!, month! - 1, day!));
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

function formatOwnersCount(value: string | null | undefined): string {
  if (value === "1") return "1 владелец";
  if (value === "2" || value === "3") return `${value} владельца`;
  if (value === "4+") return "4 и более";
  return "";
}

function makeFormFromCard(card: ManagerClientCard): FormState {
  const savedNeeds = card.needs?.length ? card.needs : [{
    brand: card.desiredBrand,
    model: card.desiredModel,
    undecided: card.desiredVehicleUndecided,
    budgetRange: card.budgetRange,
    plannedPurchaseDate: null,
  }];
  const legacyCar = {
    brand: card.currentCarBrand ?? card.currentCar ?? "",
    model: card.currentCarModel ?? "",
    year: card.currentCarYear,
    mileage: card.currentCarMileage,
    generation: card.currentCarGeneration,
    bodyType: card.currentCarBodyType,
    ownersCount: card.currentCarOwnersCount,
    snapshot: card.currentCarSnapshot,
    tradeInPlan: card.tradeInPlan,
  };
  const savedCars = card.currentCars?.length
    ? card.currentCars
    : Object.values(legacyCar).some(value => value != null && value !== "")
      ? [legacyCar]
      : [];

  return {
    clientName: card.clientName,
    clientPhone: card.clientPhone,
    clientGender: card.clientGender ?? "",
    needs: savedNeeds.map(need => ({
      localId: newLocalId("need"),
      brand: need.brand ?? "",
      model: need.model ?? "",
      undecided: need.undecided,
      budgetRange: (need.budgetRange ?? "") as FormState["needs"][number]["budgetRange"],
      plannedPurchaseDate: need.plannedPurchaseDate ?? "",
    })),
    currentCars: savedCars.map(car => ({
      localId: newLocalId("car"),
      brandId: "",
      modelId: "",
      brandSearch: car.brand,
      modelSearch: car.model,
      brand: car.brand,
      model: car.model,
      year: car.year == null ? "" : String(car.year),
      mileage: car.mileage == null ? "" : String(car.mileage),
      generationId: car.generation ?? "",
      bodyTypeId: car.bodyType ?? "",
      generation: car.generation ?? "",
      bodyType: car.bodyType ?? "",
      ownersCount: (car.ownersCount ?? "") as FormState["currentCars"][number]["ownersCount"],
      tradeInPlan: (car.tradeInPlan ?? "") as FormState["currentCars"][number]["tradeInPlan"],
      snapshot: car.snapshot as ManagerClientCarSnapshot | null,
    })),
    commercialBrand: card.commercialBrand ?? "",
    commercialModel: card.commercialModel ?? "",
    paymentMethod: (card.paymentMethod ?? "") as FormState["paymentMethod"],
    comment: card.comment ?? "",
  };
}

function makeSelectedOfferCar(card: ManagerClientCard): ManagerClientCardInventoryItem | null {
  const snapshot = card.commercialCarSnapshot as Record<string, unknown> | null;
  if (card.commercialCarId == null && !snapshot) return null;
  const value = snapshot ?? {};
  const asNullableString = (key: string) => typeof value[key] === "string" ? value[key] as string : null;
  const asNullableNumber = (key: string) => typeof value[key] === "number" ? value[key] as number : null;
  return {
    id: card.commercialCarId ?? (typeof value["id"] === "number" ? value["id"] : 0),
    externalId: typeof value["externalId"] === "string" ? value["externalId"] : "",
    type: typeof value["type"] === "string" ? value["type"] : "new",
    brand: asNullableString("brand") ?? card.commercialBrand,
    model: asNullableString("model") ?? card.commercialModel,
    year: asNullableNumber("year"),
    modification: asNullableString("modification"),
    complectation: asNullableString("complectation"),
    color: asNullableString("color"),
    price: asNullableNumber("price"),
    imageUrl: asNullableString("imageUrl"),
    vin: asNullableString("vin"),
    dealer: null,
  };
}

function auditFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    clientName: "ФИО клиента",
    clientPhone: "Телефон",
    clientGender: "Пол",
    needs: "Потребности",
    currentCars: "Текущие автомобили",
    commercialBrand: "Марка предложения",
    commercialModel: "Модель предложения",
    commercialCarId: "Выбранный автомобиль из склада",
    commercialCarSnapshot: "Автомобиль из склада",
    paymentMethod: "Способ оплаты",
    comment: "Комментарий",
  };
  return labels[field] ?? field;
}

function formatAuditValue(field: string, value: unknown): string {
  if (value == null || value === "") return "Не указано";
  if (field === "commercialCarId") return `Внутренний ID автомобиля: ${String(value)}`;
  if (field === "clientGender") return value === "male" ? "Мужской" : value === "female" ? "Женский" : String(value);
  if (field === "needs" && Array.isArray(value)) {
    return value.map((raw, index) => {
      const need = raw as Record<string, unknown>;
      const title = [need["brand"], need["model"]].filter(Boolean).join(" ") ||
        (need["undecided"] ? "Пока не определился" : "Без выбранной модели");
      const details = [
        need["budgetRange"] ? `бюджет ${String(need["budgetRange"])}` : "",
        need["plannedPurchaseDate"] ? `покупка ${formatDateOnly(String(need["plannedPurchaseDate"]))}` : "",
      ].filter(Boolean);
      return `${index + 1}. ${title}${details.length ? ` (${details.join(", ")})` : ""}`;
    }).join("\n") || "Не указано";
  }
  if (field === "currentCars" && Array.isArray(value)) {
    return value.map((raw, index) => {
      const car = raw as Record<string, unknown>;
      const title = [car["brand"], car["model"], car["year"]].filter(Boolean).join(" ") || "Автомобиль";
      const details = [
        car["mileage"] != null ? `${Number(car["mileage"]).toLocaleString("ru-RU")} км` : "",
        car["tradeInPlan"] ? `Трейд-ин: ${String(car["tradeInPlan"])}` : "",
      ].filter(Boolean);
      return `${index + 1}. ${title}${details.length ? ` (${details.join(", ")})` : ""}`;
    }).join("\n") || "Не указано";
  }
  if (field === "commercialCarSnapshot" && typeof value === "object") {
    const car = value as Record<string, unknown>;
    return [
      [car["brand"], car["model"], car["year"]].filter(Boolean).join(" "),
      car["vin"] ? `VIN ${String(car["vin"])}` : "",
      car["price"] ? rub(Number(car["price"])) : "",
    ].filter(Boolean).join(" · ") || "Не указано";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

type CmCatalogItem = { id: string; name: string };

async function fetchCmCatalogItems(path: string): Promise<CmCatalogItem[]> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Не удалось загрузить каталог автомобилей");
  const payload = await response.json() as { ok?: boolean; data?: unknown };
  if (!payload.ok || !Array.isArray(payload.data)) throw new Error("Каталог автомобилей недоступен");
  return payload.data.filter((item): item is CmCatalogItem =>
    Boolean(item && typeof item === "object" &&
      typeof (item as Record<string, unknown>)["id"] === "string" &&
      typeof (item as Record<string, unknown>)["name"] === "string")
  );
}

async function fetchCmYears(brand: string, model: string): Promise<number[]> {
  const params = new URLSearchParams({ brand, model });
  const response = await fetch(`/api/car-catalog/cm-years?${params}`);
  if (!response.ok) throw new Error("Не удалось загрузить годы выпуска");
  const payload = await response.json() as { ok?: boolean; data?: unknown };
  return payload.ok && Array.isArray(payload.data)
    ? payload.data.filter((year): year is number => Number.isInteger(year))
    : [];
}

function validateStep(
  form: FormState,
  step: number,
  selectedOfferCar: ManagerClientCardInventoryItem | null,
  offerBrandSearch: string,
  offerModelSearch: string,
  offerVinSearch: string,
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
    if (form.needs.length === 0) errors.push("Добавьте хотя бы одну потребность клиента.");
    form.needs.forEach((need, index) => {
      const hasBrandModel = Boolean(need.brand && need.model);
      if (!need.undecided && !hasBrandModel) {
        errors.push(`В потребности ${index + 1} выберите марку и модель или отметьте, что клиент пока не определился.`);
      }
      if (need.undecided && (need.brand || need.model)) {
        errors.push(`В потребности ${index + 1} очистите марку и модель или снимите отметку «Пока не определился».`);
      }
      if (!need.budgetRange) errors.push(`Укажите бюджет в потребности ${index + 1}.`);
    });
    return errors;
  }
  if (step === 2) {
    const errors: string[] = [];
    form.currentCars.forEach((car, index) => {
      const hasData = Boolean(
        car.brandSearch.trim() || car.modelSearch.trim() || car.brand || car.model || car.year ||
        car.mileage || car.generation || car.bodyType || car.ownersCount || car.tradeInPlan,
      );
      if (!hasData) return;
      const label = `текущем автомобиле ${index + 1}`;
      if (!car.brandId || !car.brand) errors.push(`Выберите марку в ${label}.`);
      if (!car.modelId || !car.model) errors.push(`Выберите модель в ${label}.`);
      if (!car.year) errors.push(`Укажите год в ${label}.`);
      else {
        const year = Number(car.year);
        if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
          errors.push(`Проверьте год в ${label}.`);
        }
      }
      if (car.mileage === "") errors.push(`Укажите пробег в ${label}.`);
      else {
        const mileage = Number(car.mileage);
        if (!Number.isInteger(mileage) || mileage < 0 || mileage > 2_000_000) {
          errors.push(`Проверьте пробег в ${label}.`);
        }
      }
      if (car.brandSearch.trim() && !car.brandId) errors.push(`Выберите марку из списка в ${label}.`);
      if (car.modelSearch.trim() && !car.modelId) errors.push(`Выберите модель из списка в ${label}.`);
    });
    return errors;
  }
  if (step === 3) {
    const hasCatalogSelection = Boolean(form.commercialBrand || form.commercialModel);
    if (Boolean(form.commercialBrand) !== Boolean(form.commercialModel)) {
      return ["Выберите и марку, и модель предложения."];
    }
    if ((offerBrandSearch.trim() || offerModelSearch.trim() || offerVinSearch.trim()) && !selectedOfferCar) {
      return ["Выберите новый автомобиль из базы или очистите поля поиска."];
    }
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
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={`${fieldClass} ${invalid ? "border-red-400 focus:border-red-500 focus:ring-red-300" : ""}`}
        aria-invalid={invalid}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function CascadeField({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="manager-form-cascade" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function useKeyboardAwareForm(enabled: boolean) {
  const [keyboardSpacer, setKeyboardSpacer] = useState(0);
  const focusScrollTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setKeyboardSpacer(0);
      return;
    }

    const viewport = window.visualViewport;
    const isTextEntry = (element: Element | null): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea');

    const getKeyboardMetrics = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const inset = Math.max(0, window.innerHeight - viewportHeight - viewportTop);
      const touchDevice = window.matchMedia("(pointer: coarse)").matches;
      const keyboardOpen = isTextEntry(document.activeElement) &&
        touchDevice &&
        (inset > 80 || viewportHeight < Math.max(window.screen.height, viewportHeight) * 0.78);

      return {
        keyboardOpen,
        inset,
        viewportHeight,
        viewportTop,
      };
    };

    const updateSpacer = () => {
      const metrics = getKeyboardMetrics();
      const nextSpacer = metrics.keyboardOpen
        ? Math.max(160, Math.ceil(Math.max(metrics.inset, metrics.viewportHeight * 0.48)))
        : 0;

      setKeyboardSpacer(previous => previous === nextSpacer ? previous : nextSpacer);
      return metrics;
    };

    const scrollFocusedField = (element: Element | null) => {
      if (!isTextEntry(element) || document.activeElement !== element || !getKeyboardMetrics().keyboardOpen) return;

      const { viewportHeight, viewportTop } = getKeyboardMetrics();
      const rect = element.getBoundingClientRect();
      const viewportBottom = viewportTop + viewportHeight;
      const preferredTop = viewportTop + Math.min(128, Math.max(56, viewportHeight * 0.18));
      const safeTop = viewportTop + 12;
      const safeBottom = viewportBottom - 16;
      let scrollBy = 0;

      if (rect.bottom > safeBottom) {
        scrollBy = rect.bottom - safeBottom;
      } else if (rect.top > preferredTop) {
        scrollBy = rect.top - preferredTop;
      } else if (rect.top < safeTop) {
        scrollBy = rect.top - safeTop;
      }

      if (Math.abs(scrollBy) > 2) window.scrollBy({ top: scrollBy, behavior: "smooth" });
    };

    const onFocusIn = (event: FocusEvent) => {
      updateSpacer();
      const target = event.target instanceof Element ? event.target : null;
      if (focusScrollTimer.current !== null) window.clearTimeout(focusScrollTimer.current);
      focusScrollTimer.current = window.setTimeout(() => scrollFocusedField(target), 280);
    };

    const onFocusOut = () => {
      window.setTimeout(updateSpacer, 120);
    };

    const onViewportResize = () => {
      updateSpacer();
      window.requestAnimationFrame(() => scrollFocusedField(document.activeElement));
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", onViewportResize);
    viewport?.addEventListener("resize", onViewportResize);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onViewportResize);
      viewport?.removeEventListener("resize", onViewportResize);
      if (focusScrollTimer.current !== null) window.clearTimeout(focusScrollTimer.current);
    };
  }, [enabled]);

  return { keyboardSpacer };
}

type SearchSuggestion = { value: string; label: string };

function SearchSuggestionField({
  id,
  label,
  value,
  placeholder,
  options,
  loading = false,
  disabled = false,
  invalid = false,
  onChange,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: SearchSuggestion[];
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onSelect: (option: SearchSuggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listMaxHeight, setListMaxHeight] = useState(240);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchingOptions = options
    .filter(option => option.label.toLocaleLowerCase("ru").includes(value.trim().toLocaleLowerCase("ru")))
    .slice(0, 20);
  const listId = `${id}-suggestions`;
  const active = activeIndex >= 0 ? matchingOptions[activeIndex] : undefined;

  useEffect(() => {
    if (!open || disabled) return;

    const viewport = window.visualViewport;
    const measureAvailableHeight = () => {
      const inputBottom = inputRef.current?.getBoundingClientRect().bottom;
      if (inputBottom === undefined) return;

      const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const availableHeight = Math.floor(viewportBottom - inputBottom - 12);
      const nextHeight = Math.min(240, Math.max(96, availableHeight));
      setListMaxHeight(previous => previous === nextHeight ? previous : nextHeight);
    };

    const frame = window.requestAnimationFrame(measureAvailableHeight);
    window.addEventListener("resize", measureAvailableHeight);
    window.addEventListener("scroll", measureAvailableHeight, true);
    viewport?.addEventListener("resize", measureAvailableHeight);
    viewport?.addEventListener("scroll", measureAvailableHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureAvailableHeight);
      window.removeEventListener("scroll", measureAvailableHeight, true);
      viewport?.removeEventListener("resize", measureAvailableHeight);
      viewport?.removeEventListener("scroll", measureAvailableHeight);
    };
  }, [open, disabled, matchingOptions.length]);

  function choose(option: SearchSuggestion) {
    onSelect(option);
    setOpen(false);
  }

  return (
    <div className="relative min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !disabled}
        aria-controls={listId}
        aria-activedescendant={open && active ? `${listId}-${activeIndex}` : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onChange={event => {
          onChange(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" && matchingOptions.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => index < 0 ? 0 : Math.min(index + 1, matchingOptions.length - 1));
          } else if (event.key === "ArrowUp" && matchingOptions.length) {
            event.preventDefault();
            setActiveIndex(index => index < 0 ? matchingOptions.length - 1 : Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && (active || matchingOptions[0])) {
            event.preventDefault();
            choose(active ?? matchingOptions[0]!);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`h-11 ${invalid ? "border-red-400 focus-visible:ring-red-300" : ""}`}
        aria-invalid={invalid}
      />
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="relative z-40 mt-1 w-full touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          style={{ maxHeight: listMaxHeight, WebkitOverflowScrolling: "touch" }}
        >
          {loading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Загружаем варианты…</p>
          ) : matchingOptions.length ? (
            matchingOptions.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onPointerDown={event => event.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`block min-h-11 w-full rounded-md px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-sky-50 text-[#005a94]" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))
          ) : value.trim().length >= 1 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Совпадений не найдено</p>
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">Начните вводить текст для поиска</p>
          )}
        </div>
      )}
    </div>
  );
}

function NeedEditor({
  need,
  index,
  brands,
  canRemove,
  invalid,
  onChange,
  onRemove,
}: {
  need: FormState["needs"][number];
  index: number;
  brands: string[];
  canRemove: boolean;
  invalid: boolean;
  onChange: (patch: Partial<FormState["needs"][number]>) => void;
  onRemove: () => void;
}) {
  const modelsQuery = useQuery({
    queryKey: ["manager-client-card-models", need.brand],
    queryFn: () => getManagerClientNeedsModels(need.brand),
    enabled: Boolean(need.brand && !need.undecided),
  });
  const models = modelsQuery.data?.data ?? [];
  const visibleBrands = need.brand && !brands.includes(need.brand)
    ? [...brands, need.brand]
    : brands;
  const visibleModels = need.model && !models.includes(need.model)
    ? [...models, need.model]
    : models;
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Потребность {index + 1}</h3>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove} aria-label={`Удалить потребность ${index + 1}`} className="min-h-11">
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить
        </Button>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <SelectField
          id={`need-brand-${need.localId}`}
          label="Марка"
          value={need.brand}
          disabled={need.undecided}
          invalid={invalid && !need.undecided && !need.brand}
          onChange={brand => onChange({ brand, model: "" })}
        >
          <option value="">Выберите марку</option>
          {visibleBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
        </SelectField>
        <SelectField
          id={`need-model-${need.localId}`}
          label="Модель"
          value={need.model}
          disabled={!need.brand || need.undecided || modelsQuery.isLoading}
          invalid={invalid && !need.undecided && !need.model}
          onChange={model => onChange({ model })}
        >
          <option value="">{need.brand ? "Выберите модель" : "Сначала выберите марку"}</option>
          {visibleModels.map(model => <option key={model} value={model}>{model}</option>)}
        </SelectField>
      </div>
      {modelsQuery.isLoading && <p className="text-xs text-slate-500">Загружаем модели…</p>}
      {modelsQuery.isError && <p role="alert" className="text-sm text-red-600">Не удалось загрузить модели для выбранной марки.</p>}
      <div className="space-y-2">
        <Label>Бюджет клиента</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {budgetOptions.map(option => (
            <button
              type="button"
              key={option}
              onClick={() => onChange({ budgetRange: option })}
              className={`min-h-11 rounded-lg border px-4 text-left text-sm font-medium transition ${
                need.budgetRange === option ? "border-[#0070b8] bg-sky-50 text-[#005a94]" : "border-slate-200 hover:bg-slate-50"
              }`}
              aria-pressed={need.budgetRange === option}
            >
              {option}
            </button>
          ))}
        </div>
        {invalid && !need.budgetRange && <p className="text-sm text-red-600">Укажите бюджет.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`need-purchase-date-${need.localId}`}>Планируемая дата покупки · необязательно</Label>
        <Input
          id={`need-purchase-date-${need.localId}`}
          type="date"
          value={need.plannedPurchaseDate}
          onChange={event => onChange({ plannedPurchaseDate: event.target.value })}
          className="h-11"
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={need.undecided}
          onChange={event => onChange({
            undecided: event.target.checked,
            brand: event.target.checked ? "" : need.brand,
            model: event.target.checked ? "" : need.model,
          })}
          className="h-4 w-4 rounded border-slate-300 text-[#0070b8] focus:ring-[#0070b8]"
        />
        Клиент пока не определился с моделью
      </label>
    </section>
  );
}

function CurrentCarEditor({
  car,
  index,
  invalid,
  onChange,
  onRemove,
}: {
  car: FormState["currentCars"][number];
  index: number;
  invalid: boolean;
  onChange: (patch: Partial<FormState["currentCars"][number]>) => void;
  onRemove: () => void;
}) {
  const brandsQuery = useQuery({
    queryKey: ["manager-client-card-current-car-cm-brands"],
    queryFn: () => fetchCmCatalogItems("/api/car-catalog/cm-brands"),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const modelsQuery = useQuery({
    queryKey: ["manager-client-card-current-car-cm-models", car.brandId],
    queryFn: () => fetchCmCatalogItems(`/api/car-catalog/cm-models?${new URLSearchParams({ brand: car.brandId })}`),
    enabled: Boolean(car.brandId),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const yearsQuery = useQuery({
    queryKey: ["manager-client-card-current-car-cm-years", car.brandId, car.modelId],
    queryFn: () => fetchCmYears(car.brandId, car.modelId),
    enabled: Boolean(car.brandId && car.modelId),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const generationsQuery = useQuery({
    queryKey: ["manager-client-card-current-car-cm-generations", car.brandId, car.modelId, car.year],
    queryFn: () => fetchCmCatalogItems(`/api/car-catalog/cm-generations?${new URLSearchParams({
      brand: car.brandId,
      model: car.modelId,
      creationYear: car.year,
    })}`),
    enabled: Boolean(car.brandId && car.modelId && car.year),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const bodiesQuery = useQuery({
    queryKey: ["manager-client-card-current-car-cm-bodies", car.brandId, car.modelId],
    queryFn: () => fetchCmCatalogItems(`/api/car-catalog/cm-bodies?${new URLSearchParams({
      brand: car.brandId,
      model: car.modelId,
    })}`),
    enabled: Boolean(car.brandId && car.modelId),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const brandOptions = (brandsQuery.data ?? []).map(item => ({ value: item.id, label: item.name }));
  const modelOptions = (modelsQuery.data ?? []).map(item => ({ value: item.id, label: item.name }));
  const generations = generationsQuery.data ?? [];
  const bodies = bodiesQuery.data ?? [];
  useEffect(() => {
    if (car.brandId || !car.brand || brandsQuery.isLoading) return;
    const match = brandOptions.find(item => item.label.toLocaleLowerCase("ru") === car.brand.toLocaleLowerCase("ru"));
    if (match) onChange({ brandId: match.value, brandSearch: match.label, brand: match.label });
  }, [car.brand, car.brandId, brandsQuery.isLoading, brandOptions, onChange]);
  useEffect(() => {
    if (car.modelId || !car.model || !car.brandId || modelsQuery.isLoading) return;
    const match = modelOptions.find(item => item.label.toLocaleLowerCase("ru") === car.model.toLocaleLowerCase("ru"));
    if (match) onChange({ modelId: match.value, modelSearch: match.label, model: match.label });
  }, [car.brandId, car.model, car.modelId, modelOptions, modelsQuery.isLoading, onChange]);
  const fieldError = (part: string) => invalid && (
    part === "brand" ? !car.brandId :
    part === "model" ? !car.modelId :
    part === "year" ? !car.year :
    part === "mileage" ? car.mileage === "" : false
  );
  const clearAfterBrand = {
    modelId: "",
    modelSearch: "",
    model: "",
    year: "",
    mileage: "",
    generationId: "",
    bodyTypeId: "",
    generation: "",
    bodyType: "",
    ownersCount: "",
    tradeInPlan: "",
  } as const;
  const clearAfterModel = {
    year: "",
    mileage: "",
    generationId: "",
    bodyTypeId: "",
    generation: "",
    bodyType: "",
    ownersCount: "",
    tradeInPlan: "",
  } as const;
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Текущий автомобиль {index + 1}</h3>
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Удалить текущий автомобиль ${index + 1}`} className="min-h-11">
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить
        </Button>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <CascadeField>
          <SearchSuggestionField
            id={`current-car-brand-${car.localId}`}
            label="Марка *"
            value={car.brandSearch}
            placeholder="Выберите марку"
            options={brandOptions}
            loading={brandsQuery.isLoading}
            invalid={fieldError("brand")}
            onChange={brandSearch => onChange({
              brandSearch, brandId: "", brand: "", ...clearAfterBrand,
            })}
            onSelect={option => onChange({
              brandSearch: option.label,
              brandId: option.value,
              brand: option.label,
              ...clearAfterBrand,
            })}
          />
        </CascadeField>
        {car.brandId && (
          <CascadeField delay={50}>
            <SearchSuggestionField
              id={`current-car-model-${car.localId}`}
              label="Модель *"
              value={car.modelSearch}
              placeholder="Начните вводить модель"
              options={modelOptions}
              loading={modelsQuery.isLoading}
              invalid={fieldError("model")}
              onChange={modelSearch => onChange({
                modelSearch, modelId: "", model: "", ...clearAfterModel,
              })}
              onSelect={option => onChange({
                modelSearch: option.label,
                modelId: option.value,
                model: option.label,
                ...clearAfterModel,
              })}
            />
          </CascadeField>
        )}
      </div>
      {(brandsQuery.isError || modelsQuery.isError) && (
        <p role="alert" className="text-sm text-red-600">Не удалось загрузить каталог марок и моделей.</p>
      )}
      {car.modelId && (
        <>
          <div className="grid min-w-0 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <CascadeField>
              <SelectField
                id={`current-car-year-${car.localId}`}
                label="Год *"
                value={car.year}
                invalid={fieldError("year")}
                onChange={year => onChange({ year, generationId: "", generation: "" })}
                disabled={yearsQuery.isLoading}
              >
                <option value="">{yearsQuery.isLoading ? "Загружаем годы…" : "Выберите год"}</option>
                {car.year && !(yearsQuery.data ?? []).includes(Number(car.year)) && (
                  <option value={car.year}>{car.year}</option>
                )}
                {(yearsQuery.data ?? []).map(year => <option key={year} value={year}>{year}</option>)}
              </SelectField>
            </CascadeField>
            <CascadeField delay={50}>
              <div className="space-y-2">
                <Label htmlFor={`current-car-mileage-${car.localId}`}>Пробег, км *</Label>
                <Input
                  id={`current-car-mileage-${car.localId}`}
                  type="number"
                  min={0}
                  max={2_000_000}
                  step={1}
                  inputMode="numeric"
                  value={car.mileage}
                  onChange={event => onChange({ mileage: event.target.value })}
                  placeholder="Например, 75 000"
                  className={`h-11 ${fieldError("mileage") ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                  aria-invalid={fieldError("mileage")}
                />
              </div>
            </CascadeField>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {car.year && (
              <CascadeField>
                <SelectField
                  id={`current-car-generation-${car.localId}`}
                  label="Поколение · необязательно"
                  value={car.generationId}
                  onChange={value => onChange({
                    generationId: value,
                    generation: generations.find(item => item.id === value)?.name ?? "",
                  })}
                  disabled={generationsQuery.isLoading}
                >
                  <option value="">{generationsQuery.isLoading ? "Загружаем поколения…" : "Не указано"}</option>
                  {car.generationId && !generations.some(item => item.id === car.generationId) && (
                    <option value={car.generationId}>{car.generation}</option>
                  )}
                  {generations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </SelectField>
              </CascadeField>
            )}
            <CascadeField delay={50}>
              <SelectField
                id={`current-car-body-${car.localId}`}
                label="Тип кузова · необязательно"
                value={car.bodyTypeId}
                onChange={value => onChange({
                  bodyTypeId: value,
                  bodyType: bodies.find(item => item.id === value)?.name ?? "",
                })}
                disabled={bodiesQuery.isLoading}
              >
                <option value="">{bodiesQuery.isLoading ? "Загружаем типы кузова…" : "Не указано"}</option>
                {car.bodyTypeId && !bodies.some(item => item.id === car.bodyTypeId) && (
                  <option value={car.bodyTypeId}>{car.bodyType}</option>
                )}
                {bodies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </SelectField>
            </CascadeField>
            <CascadeField delay={100}>
              <SelectField
                id={`current-car-owners-${car.localId}`}
                label="Кол-во владельцев · необязательно"
                value={car.ownersCount}
                onChange={value => onChange({ ownersCount: value as FormState["currentCars"][number]["ownersCount"] })}
              >
                <option value="">Не указано</option>
                <option value="1">1 владелец</option>
                <option value="2">2 владельца</option>
                <option value="3">3 владельца</option>
                <option value="4+">4 и более</option>
              </SelectField>
            </CascadeField>
            <CascadeField delay={150}>
              <SelectField
                id={`current-car-trade-in-${car.localId}`}
                label="Планирует сдать в трейд-ин? · необязательно"
                value={car.tradeInPlan}
                onChange={value => onChange({ tradeInPlan: value as FormState["currentCars"][number]["tradeInPlan"] })}
              >
                <option value="">Не указано</option>
                {tradeInOptions.map(value => <option key={value} value={value}>{value}</option>)}
              </SelectField>
            </CascadeField>
          </div>
          {(yearsQuery.isError || generationsQuery.isError || bodiesQuery.isError) && (
            <p role="alert" className="text-sm text-red-600">Не удалось загрузить данные автомобиля.</p>
          )}
        </>
      )}
    </section>
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
  const { keyboardSpacer } = useKeyboardAwareForm(mode === "form");
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState<ListFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [selectedCard, setSelectedCard] = useState<ManagerClientCard | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedOfferCar, setSelectedOfferCar] = useState<ManagerClientCardInventoryItem | null>(null);
  const [offerBrandSearch, setOfferBrandSearch] = useState("");
  const [offerModelSearch, setOfferModelSearch] = useState("");
  const [offerVinSearch, setOfferVinSearch] = useState("");
  const [offerPage, setOfferPage] = useState(1);
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
  const offerInventoryQuery = useQuery({
    queryKey: ["manager-client-card-offer-vehicle", offerBrandSearch.trim(), offerModelSearch.trim(), offerVinSearch.trim()],
    queryFn: () => offerVinSearch.trim().length >= 4
      ? searchManagerClientCardInventory({ vin: offerVinSearch.trim(), type: "new" })
      : searchManagerClientCardInventory({
          brand: offerBrandSearch.trim().length >= 2 ? offerBrandSearch.trim() : undefined,
          model: offerModelSearch.trim().length >= 2 ? offerModelSearch.trim() : undefined,
          type: "new",
        }),
    enabled: mode === "form" && step === 3 && (
      offerVinSearch.trim().length >= 4 ||
      offerBrandSearch.trim().length >= 2 ||
      offerModelSearch.trim().length >= 2
    ),
    staleTime: 30_000,
  });

  const saveMutation = useMutation<
    ManagerClientCardCreatedResponse | ManagerClientCardUpdatedResponse,
    Error,
    { cardId: number | null; payload: ManagerClientCardInput }
  >({
    mutationFn: ({ cardId, payload }: { cardId: number | null; payload: ManagerClientCardInput }) =>
      cardId ? updateManagerClientCard(cardId, payload) : createManagerClientCard(payload),
    onSuccess: (result, variables) => {
      const changed = "changed" in result.data ? result.data.changed : true;
      toast({
        title: variables.cardId
          ? changed ? "Изменения сохранены" : "Изменений нет"
          : "Рабочий лист сохранён",
      });
      setForm(emptyForm);
      setEditingCardId(null);
      setSelectedOfferCar(null);
      setStep(0);
      resetCurrentVehicle();
      setOfferBrandSearch("");
      setOfferModelSearch("");
      setOfferVinSearch("");
      setFormError("");
      setSaveAttempted(false);
      setMode("list");
      setSelectedCard(null);
      void queryClient.invalidateQueries({ queryKey: ["manager-client-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["manager-client-card-detail"] });
    },
    onError: error => {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить рабочий лист");
    },
  });

  const brands = brandsQuery.data?.data ?? [];
  const managers = managersQuery.data?.data ?? [];
  const offerInventory = offerInventoryQuery.data?.data ?? [];
  const offerPageCount = Math.max(1, Math.ceil(offerInventory.length / offerResultsPageSize));
  const currentOfferPage = Math.min(offerPage, offerPageCount);
  const visibleOfferInventory = offerInventory.slice(
    (currentOfferPage - 1) * offerResultsPageSize,
    currentOfferPage * offerResultsPageSize,
  );
  const offerBrandSuggestions = Array.from(new Set(offerInventory.map(car => car.brand).filter((brand): brand is string => Boolean(brand))))
    .map(brand => ({ value: brand, label: brand }));
  const offerModelSuggestions = Array.from(new Set(offerInventory.map(car => car.model).filter((model): model is string => Boolean(model))))
    .map(model => ({ value: model, label: model }));
  const cardsPage = cardsQuery.data?.data;
  const cards = cardsPage?.items ?? [];
  const detailCard = detailQuery.data?.data ?? selectedCard;
  const detailNeeds = detailCard?.needs?.length ? detailCard.needs : detailCard ? [{
    brand: detailCard.desiredBrand,
    model: detailCard.desiredModel,
    undecided: detailCard.desiredVehicleUndecided,
    budgetRange: detailCard.budgetRange,
    plannedPurchaseDate: null,
  }] : [];
  const detailCurrentCars = detailCard?.currentCars?.length ? detailCard.currentCars : detailCard && (
    detailCard.currentCarBrand || detailCard.currentCarModel || detailCard.currentCarYear != null ||
    detailCard.currentCarMileage != null || detailCard.currentCar
  ) ? [{
    brand: detailCard.currentCarBrand ?? detailCard.currentCar ?? "",
    model: detailCard.currentCarModel ?? "",
    year: detailCard.currentCarYear,
    mileage: detailCard.currentCarMileage,
    generation: detailCard.currentCarGeneration,
    bodyType: detailCard.currentCarBodyType,
    ownersCount: detailCard.currentCarOwnersCount,
    snapshot: detailCard.currentCarSnapshot,
    tradeInPlan: detailCard.tradeInPlan,
  }] : [];
  const totalPages = Math.max(1, Math.ceil((cardsPage?.total ?? 0) / pageSize));
  const stepErrors = useMemo(
    () => steps.map((_, index) => saveAttempted
      ? validateStep(
          form,
          index,
          selectedOfferCar,
          offerBrandSearch,
          offerModelSearch,
          offerVinSearch,
        )
      : []),
    [
      form,
      selectedOfferCar,
      offerBrandSearch,
      offerModelSearch,
      offerVinSearch,
      saveAttempted,
    ],
  );
  const progress = useMemo(() => `${step + 1} из ${steps.length}`, [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
    setFormError("");
  }

  function resetCurrentVehicle() {
    setForm(previous => ({ ...previous, currentCars: [] }));
  }

  function updateFilters(patch: Partial<ListFilters>) {
    setFilters(previous => ({ ...previous, ...patch }));
    setPage(1);
  }

  function currentFilterParams(): ManagerClientCardFilters {
    return { ...filters, page: 1, pageSize };
  }

  function startNewCard() {
    setEditingCardId(null);
    setForm(emptyForm);
    setSelectedOfferCar(null);
    resetCurrentVehicle();
    setOfferBrandSearch("");
    setOfferModelSearch("");
    setOfferVinSearch("");
    setStep(0);
    setFormError("");
    setSaveAttempted(false);
    setMode("form");
  }

  function startEditCard(card: ManagerClientCard) {
    const selectedCar = makeSelectedOfferCar(card);
    setForm(makeFormFromCard(card));
    setEditingCardId(card.id);
    setSelectedOfferCar(selectedCar);
    setOfferBrandSearch(selectedCar?.brand ?? card.commercialBrand ?? "");
    setOfferModelSearch(selectedCar?.model ?? card.commercialModel ?? "");
    setOfferVinSearch("");
    setStep(0);
    setFormError("");
    setSaveAttempted(false);
    setSelectedCard(null);
    setMode("form");
  }

  function goNext() {
    setFormError("");
    setStep(current => Math.min(current + 1, steps.length - 1));
  }

  function skipOptionalStep() {
    if (step === 2) {
      resetCurrentVehicle();
    }
    if (step === 3) {
      setSelectedOfferCar(null);
      setOfferBrandSearch("");
      setOfferModelSearch("");
      setOfferVinSearch("");
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
      selectedOfferCar,
      offerBrandSearch,
      offerModelSearch,
      offerVinSearch,
    ));
    const firstInvalid = allErrors.findIndex(errors => errors.length > 0);
    if (firstInvalid >= 0) {
      setStep(firstInvalid);
      setFormError(allErrors[firstInvalid].join(" "));
      return;
    }
    const needs = form.needs.map(need => ({
      brand: need.brand || null,
      model: need.model || null,
      undecided: need.undecided,
      budgetRange: need.budgetRange || null,
      plannedPurchaseDate: need.plannedPurchaseDate || null,
    }));
    const currentCars = form.currentCars
      .filter(car => Boolean(
        car.brandSearch.trim() || car.modelSearch.trim() || car.brand || car.model || car.year ||
        car.mileage || car.generation || car.bodyType || car.ownersCount || car.tradeInPlan,
      ))
      .map(car => ({
        brand: car.brand,
        model: car.model,
        year: Number(car.year),
        mileage: Number(car.mileage),
        generation: car.generation || null,
        bodyType: car.bodyType || null,
        ownersCount: car.ownersCount || null,
        snapshot: car.snapshot,
        tradeInPlan: car.tradeInPlan || null,
      }));
    const firstNeed = needs[0]!;
    const firstCar = currentCars[0] ?? null;
    saveMutation.mutate({ cardId: editingCardId, payload: {
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      clientGender: form.clientGender || null,
      needs,
      currentCars,
      desiredBrand: firstNeed.brand,
      desiredModel: firstNeed.model,
      desiredVehicleUndecided: firstNeed.undecided,
      budgetRange: firstNeed.budgetRange,
      currentCar: firstCar ? [firstCar.brand, firstCar.model].join(" ") : null,
      currentCarBrand: firstCar?.brand ?? null,
      currentCarModel: firstCar?.model ?? null,
      currentCarYear: firstCar?.year ?? null,
      currentCarMileage: firstCar?.mileage ?? null,
      currentCarGeneration: firstCar?.generation ?? null,
      currentCarBodyType: firstCar?.bodyType ?? null,
      currentCarOwnersCount: firstCar?.ownersCount ?? null,
      tradeInPlan: firstCar?.tradeInPlan ?? null,
      commercialBrand: form.commercialBrand || null,
      commercialModel: form.commercialModel || null,
      commercialCarId: selectedOfferCar?.id ?? null,
      paymentMethod: form.paymentMethod || null,
      comment: form.comment.trim(),
    } });
  }

  function selectOfferCar(car: ManagerClientCardInventoryItem) {
    setSelectedOfferCar(car);
    setOfferBrandSearch(car.brand ?? "");
    setOfferModelSearch(car.model ?? "");
    setOfferVinSearch("");
    update("commercialBrand", car.brand ?? "");
    update("commercialModel", car.model ?? "");
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
    <div className="min-h-[100dvh] bg-[#f2f5f8]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
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

      <main
        className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-6 sm:py-7"
        style={keyboardSpacer ? { paddingBottom: keyboardSpacer + 28 } : undefined}
      >
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
                  const cardNeeds = card.needs?.length ? card.needs : [{
                    brand: card.desiredBrand,
                    model: card.desiredModel,
                    undecided: card.desiredVehicleUndecided,
                    budgetRange: card.budgetRange,
                  }];
                  const desired = cardNeeds.map(need =>
                    [need.brand, need.model].filter(Boolean).join(" ") || (need.undecided ? "Пока не определился" : "Не указано"),
                  ).join(" · ");
                  const budgets = [...new Set(cardNeeds.map(need => need.budgetRange).filter((value): value is string => Boolean(value)))];
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
                          {desired || "Не указан"}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {budgets.map(budget => <Badge key={budget} variant="secondary">{budget}</Badge>)}
                        {card.currentCars?.length > 0 && (
                          <Badge variant="outline">Текущих авто: {card.currentCars.length}</Badge>
                        )}
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
                    onClick={() => {
                      setEditingCardId(null);
                      setMode("list");
                    }}
                    className="-ml-2 mb-2 text-slate-600"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    К списку
                  </Button>
                  <CardTitle className="text-xl">
                    {editingCardId ? `Редактирование рабочего листа №${editingCardId}` : "Новая карточка клиента"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingCardId ? "Измените данные и сохраните обновлённую карточку." : "Сохраните основные данные разговора с клиентом."}
                  </p>
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
                              selectedOfferCar,
                              offerBrandSearch,
                              offerModelSearch,
                              offerVinSearch,
                            ).length === 0
                            ? "bg-emerald-500"
                            : "bg-slate-200"
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3 xl:grid-cols-5">
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
                    className={`min-h-11 rounded-lg border px-3 text-left transition ${
                      stepErrors[index].length
                        ? "border-red-200 bg-red-50 font-semibold text-red-700"
                        : index === step
                          ? "border-sky-200 bg-sky-50 font-semibold text-[#0070b8]"
                          : validateStep(
                              form,
                              index,
                              selectedOfferCar,
                              offerBrandSearch,
                              offerModelSearch,
                              offerVinSearch,
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

            <CardContent className="space-y-5 p-4 sm:p-6 md:p-7">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{steps[step]?.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {step === 0 && "Укажите контактные данные клиента. Пол можно не заполнять."}
                  {step === 1 && "Добавьте все интересующие модели клиента. Для разных марок 1С получит отдельные записи."}
                  {step === 2 && "Добавьте один или несколько автомобилей клиента. Для каждого указанные марка, модель, год и пробег обязательны."}
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
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Потребности клиента</h3>
                    <p className="mt-1 text-sm text-slate-500">Добавляйте разные модели и марки — каждая потребность попадёт в отдельную запись 1С по своей марке.</p>
                  </div>
                  {form.needs.map((need, index) => (
                    <NeedEditor
                      key={need.localId}
                      need={need}
                      index={index}
                      brands={brands}
                      canRemove={form.needs.length > 1}
                      invalid={saveAttempted && stepErrors[1].length > 0}
                      onChange={patch => {
                        setForm(previous => ({
                          ...previous,
                          needs: previous.needs.map(item => item.localId === need.localId ? { ...item, ...patch } : item),
                        }));
                        setFormError("");
                      }}
                      onRemove={() => {
                        setForm(previous => ({
                          ...previous,
                          needs: previous.needs.filter(item => item.localId !== need.localId),
                        }));
                        setFormError("");
                      }}
                    />
                  ))}
                  {brandsQuery.isLoading && <p className="text-xs text-slate-500">Загружаем марки из активного склада…</p>}
                  {brandsQuery.isError && <p role="alert" className="text-sm text-red-600">Не удалось загрузить марки из склада CM Expert.</p>}
                  {brands.length === 0 && !brandsQuery.isLoading && !brandsQuery.isError && (
                    <p className="text-sm text-slate-500">Для этого аккаунта нет доступных новых автомобилей из CM Expert.</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setForm(previous => ({
                        ...previous,
                        needs: [...previous.needs, {
                          localId: newLocalId("need"),
                          brand: "",
                          model: "",
                          undecided: false,
                          budgetRange: "",
                          plannedPurchaseDate: "",
                        }],
                      }));
                      setFormError("");
                    }}
                    disabled={form.needs.length >= 20}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить потребность
                  </Button>
                  {saveAttempted && stepErrors[1].length > 0 && (
                    <p role="alert" className="text-sm text-red-600">{stepErrors[1].join(" ")}</p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Текущие автомобили клиента</h3>
                    <p className="mt-1 text-sm text-slate-500">Раздел необязательный. Если добавили автомобиль, заполните марку, модель, год и пробег.</p>
                  </div>
                  {form.currentCars.map((car, index) => (
                    <CurrentCarEditor
                      key={car.localId}
                      car={car}
                      index={index}
                      invalid={saveAttempted && stepErrors[2].length > 0}
                      onChange={patch => {
                        setForm(previous => ({
                          ...previous,
                          currentCars: previous.currentCars.map(item => item.localId === car.localId ? { ...item, ...patch } : item),
                        }));
                        setFormError("");
                      }}
                      onRemove={() => {
                        setForm(previous => ({
                          ...previous,
                          currentCars: previous.currentCars.filter(item => item.localId !== car.localId),
                        }));
                        setFormError("");
                      }}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setForm(previous => ({
                        ...previous,
                        currentCars: [...previous.currentCars, emptyCurrentCar()],
                      }));
                      setFormError("");
                    }}
                    disabled={form.currentCars.length >= 10}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить автомобиль
                  </Button>
                  {saveAttempted && stepErrors[2].length > 0 && (
                    <p role="alert" className="text-sm text-red-600">{stepErrors[2].join(" ")}</p>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <SearchSuggestionField
                      id="offer-brand-search"
                      label="Марка нового автомобиля"
                      value={offerBrandSearch}
                      placeholder="Начните вводить марку"
                      options={offerBrandSuggestions}
                      loading={offerInventoryQuery.isLoading && offerBrandSearch.trim().length >= 2}
                      onChange={value => {
                        setOfferBrandSearch(value);
                         setOfferPage(1);
                        setOfferVinSearch("");
                        setSelectedOfferCar(null);
                        update("commercialBrand", "");
                        update("commercialModel", "");
                      }}
                      onSelect={option => {
                        setOfferBrandSearch(option.label);
                         setOfferPage(1);
                        setOfferVinSearch("");
                        setSelectedOfferCar(null);
                        update("commercialBrand", "");
                        update("commercialModel", "");
                      }}
                    />
                    <SearchSuggestionField
                      id="offer-model-search"
                      label="Модель"
                      value={offerModelSearch}
                      placeholder="Начните вводить модель"
                      options={offerModelSuggestions}
                      loading={offerInventoryQuery.isLoading && offerModelSearch.trim().length >= 2}
                      onChange={value => {
                        setOfferModelSearch(value);
                         setOfferPage(1);
                        setOfferVinSearch("");
                        setSelectedOfferCar(null);
                        update("commercialBrand", "");
                        update("commercialModel", "");
                      }}
                      onSelect={option => {
                        setOfferModelSearch(option.label);
                         setOfferPage(1);
                        setOfferVinSearch("");
                        setSelectedOfferCar(null);
                        update("commercialBrand", "");
                        update("commercialModel", "");
                      }}
                    />
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="offer-vin-search">Или поиск по VIN</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="offer-vin-search"
                          value={offerVinSearch}
                          onChange={event => {
                            setOfferVinSearch(event.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, "").slice(0, 32));
                            setOfferPage(1);
                            setOfferBrandSearch("");
                            setOfferModelSearch("");
                            setSelectedOfferCar(null);
                            update("commercialBrand", "");
                            update("commercialModel", "");
                          }}
                          placeholder="Введите минимум 4 символа"
                          autoCapitalize="characters"
                          className="h-11 pl-9 uppercase"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 sm:col-span-2">Совпадения и выбранный автомобиль берутся только из новых машин нашего склада.</p>
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
                  ) : offerVinSearch.trim().length > 0 && offerVinSearch.trim().length < 4 ? (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Для поиска по VIN введите минимум четыре символа.
                    </p>
                  ) : offerBrandSearch.trim().length < 2 && offerModelSearch.trim().length < 2 && offerVinSearch.trim().length < 4 ? (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Введите минимум два символа марки или модели либо четыре символа VIN.
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
                      {visibleOfferInventory.map(car => (
                        <InventoryResult key={car.id} car={car} selected={false} onSelect={selectOfferCar} />
                      ))}
                      {offerPageCount > 1 && (
                        <nav
                          aria-label="Страницы результатов поиска автомобилей"
                          className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                        >
                          <p className="text-center text-sm text-slate-500 sm:text-left">
                            Показано {(currentOfferPage - 1) * offerResultsPageSize + 1}–{Math.min(currentOfferPage * offerResultsPageSize, offerInventory.length)} из {offerInventory.length}
                          </p>
                          <span aria-live="polite" className="order-first text-center text-sm font-medium text-slate-700 sm:order-none">
                            Страница {currentOfferPage} из {offerPageCount}
                          </span>
                          <div className="grid grid-cols-2 gap-2 sm:justify-self-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              disabled={currentOfferPage === 1}
                              onClick={() => setOfferPage(current => Math.max(1, current - 1))}
                            >
                              <ChevronLeft className="mr-1 h-4 w-4" />
                              Назад
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              disabled={currentOfferPage === offerPageCount}
                              onClick={() => setOfferPage(current => Math.min(offerPageCount, current + 1))}
                            >
                              Далее
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </div>
                        </nav>
                      )}
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
                      {form.needs.map((need, index) => (
                        <div key={need.localId}>
                          <dt className="text-xs text-slate-500">Потребность {index + 1}</dt>
                          <dd className="break-words font-medium">
                            {[need.brand, need.model].filter(Boolean).join(" ") || (need.undecided ? "Пока не определился" : "Не указана")}
                          </dd>
                          <dd className="mt-1 text-xs text-slate-500">Бюджет: {need.budgetRange || "Не указан"}</dd>
                          <dd className="mt-1 text-xs text-slate-500">Покупка: {formatDateOnly(need.plannedPurchaseDate || null)}</dd>
                        </div>
                      ))}
                      {form.currentCars.filter(car => car.brand || car.model || car.year).map((car, index) => (
                        <div key={car.localId}>
                          <dt className="text-xs text-slate-500">Текущий автомобиль {index + 1}</dt>
                          <dd className="break-words font-medium">
                            {[car.brand, car.model, car.year].filter(Boolean).join(" ")}
                          </dd>
                          <dd className="mt-1 text-xs text-slate-500">
                            {[
                              car.mileage ? `${Number(car.mileage).toLocaleString("ru-RU")} км` : "",
                              car.generation,
                              car.bodyType,
                              formatOwnersCount(car.ownersCount),
                              car.tradeInPlan ? `Трейд-ин: ${car.tradeInPlan}` : "",
                            ].filter(Boolean).join(" · ")}
                          </dd>
                        </div>
                      ))}
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
                  className="min-h-11"
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
                    <Button variant="ghost" className="min-h-11" onClick={skipOptionalStep} disabled={saveMutation.isPending}>
                      Пропустить
                    </Button>
                  )}
                  {step < steps.length - 1 ? (
                    <Button onClick={goNext} className="min-h-11 bg-[#0070b8] hover:bg-[#005a94]">
                      Далее
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={saveCard} disabled={saveMutation.isPending} className="min-h-11 bg-[#0070b8] hover:bg-[#005a94]">
                      {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {editingCardId ? "Сохранить изменения" : "Сохранить рабочий лист"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Dialog open={Boolean(selectedCard)} onOpenChange={open => { if (!open) setSelectedCard(null); }}>
        <DialogContent
          className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button:last-child]:right-3 [&>button:last-child]:top-3 [&>button:last-child]:grid [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:place-items-center [&>button:last-child]:rounded-lg [&>button:last-child]:bg-slate-50 [&>button:last-child]:opacity-100"
        >
          {selectedCard && detailCard && (
            <>
              <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6 md:px-7">
                <div className="flex flex-col gap-3 pr-11 sm:flex-row sm:items-center sm:justify-between">
                  <DialogHeader className="min-w-0 flex-1">
                    <DialogTitle className="break-words text-lg sm:text-xl">
                      Рабочий лист №{detailCard.id}
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap gap-x-2 gap-y-1">
                      <span>Создан {formatDate(detailCard.createdAt)}</span>
                      {detailCard.managerName && <span>{detailCard.managerName}</span>}
                      {new Date(detailCard.updatedAt).getTime() > new Date(detailCard.createdAt).getTime() && (
                        <span>Обновлён {formatDate(detailCard.updatedAt)}</span>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full shrink-0 sm:w-auto"
                    data-testid={`button-edit-client-card-${detailCard.id}`}
                    onClick={() => startEditCard(detailCard)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Редактировать
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 md:px-7">
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="font-semibold text-slate-900">Клиент</h3>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs font-medium text-slate-500">ФИО</dt>
                        <dd className="mt-1 break-words text-base font-semibold text-slate-900">{detailCard.clientName}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-slate-500">Телефон</dt>
                        <dd className="mt-1 break-words font-medium tabular-nums text-slate-900">{detailCard.clientPhone}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-slate-500">Пол</dt>
                        <dd className="mt-1 font-medium text-slate-900">
                          {detailCard.clientGender === "male" ? "Мужской" : detailCard.clientGender === "female" ? "Женский" : "Не указан"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">Потребности</h3>
                      <Badge variant="secondary">{detailNeeds.length}</Badge>
                    </div>
                    {detailNeeds.length ? (
                      <div className="mt-4 space-y-3">
                        {detailNeeds.map((need, index) => (
                          <article key={`${need.brand ?? "undecided"}-${need.model ?? index}-${index}`} className="min-w-0 rounded-lg bg-slate-50 p-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-slate-600">
                                {index + 1}
                              </span>
                              <p className="min-w-0 break-words font-semibold text-slate-900">
                                {[need.brand, need.model].filter(Boolean).join(" ") ||
                                  (need.undecided ? "Пока не определился" : "Не указана")}
                              </p>
                            </div>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div>
                                <dt className="text-xs text-slate-500">Бюджет</dt>
                                <dd className="mt-1 break-words text-sm font-medium text-slate-800">{need.budgetRange || "Не указан"}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-slate-500">Планируемая покупка</dt>
                                <dd className="mt-1 break-words text-sm font-medium text-slate-800">{formatDateOnly(need.plannedPurchaseDate)}</dd>
                              </div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Потребности не указаны.</p>
                    )}
                  </section>

                  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">Текущие автомобили</h3>
                      <Badge variant="secondary">{detailCurrentCars.length}</Badge>
                    </div>
                    {detailCurrentCars.length ? (
                      <div className="mt-4 space-y-3">
                        {detailCurrentCars.map((car, index) => (
                          <article key={`${car.brand}-${car.model}-${index}`} className="min-w-0 rounded-lg bg-slate-50 p-3">
                            <p className="break-words font-semibold text-slate-900">
                              {[car.brand || detailCard.currentCar, car.model, car.year].filter(Boolean).join(" ") || `Автомобиль ${index + 1}`}
                            </p>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div>
                                <dt className="text-xs text-slate-500">Пробег</dt>
                                <dd className="mt-1 text-sm font-medium text-slate-800">
                                  {car.mileage != null ? `${car.mileage.toLocaleString("ru-RU")} км` : "Не указан"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-slate-500">Трейд-ин</dt>
                                <dd className="mt-1 text-sm font-medium text-slate-800">{car.tradeInPlan || "Не указано"}</dd>
                              </div>
                              {(car.generation || car.bodyType || car.ownersCount) && (
                                <div className="sm:col-span-2">
                                  <dt className="text-xs text-slate-500">Дополнительные данные</dt>
                                  <dd className="mt-1 break-words text-sm text-slate-700">
                                    {[
                                      car.generation,
                                      car.bodyType,
                                      car.ownersCount ? formatOwnersCount(car.ownersCount) : "",
                                    ].filter(Boolean).join(" · ")}
                                  </dd>
                                </div>
                              )}
                              {car.snapshot?.vin && (
                                <div className="min-w-0 sm:col-span-2">
                                  <dt className="text-xs text-slate-500">VIN из базы</dt>
                                  <dd className="mt-1 break-all font-mono text-xs text-slate-700">{car.snapshot.vin}</dd>
                                </div>
                              )}
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Текущие автомобили не указаны.</p>
                    )}
                  </section>

                  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="font-semibold text-slate-900">Предложение</h3>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs font-medium text-slate-500">Автомобиль</dt>
                        <dd className="mt-1 break-words font-semibold text-slate-900">
                          {[detailCard.commercialBrand || detailCard.commercialCarSnapshot?.brand,
                            detailCard.commercialModel || detailCard.commercialCarSnapshot?.model,
                            detailCard.commercialCarSnapshot?.year].filter(Boolean).join(" ") || "Не выбран"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Цена</dt>
                        <dd className="mt-1 font-semibold text-[#0070b8]">
                          {detailCard.commercialCarSnapshot?.price != null ? rub(detailCard.commercialCarSnapshot.price) : "Не указана"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Способ оплаты</dt>
                        <dd className="mt-1 break-words font-medium text-slate-900">{detailCard.paymentMethod || "Не указан"}</dd>
                      </div>
                      {detailCard.commercialCarSnapshot?.vin && (
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-xs font-medium text-slate-500">VIN автомобиля из базы</dt>
                          <dd className="mt-1 break-all font-mono text-xs text-slate-700">{detailCard.commercialCarSnapshot.vin}</dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  {detailCard.comment && (
                    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 sm:p-5">
                      <h3 className="font-semibold text-slate-900">Комментарий менеджера</h3>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{detailCard.comment}</p>
                    </section>
                  )}

                  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 sm:p-5" data-testid={`section-client-card-history-${detailCard.id}`}>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">История изменений</h3>
                      <Badge variant="secondary">{detailCard.editHistory?.length ?? 0}</Badge>
                    </div>
                    {detailCard.editHistory?.length ? (
                      <ol className="mt-4 space-y-2">
                        {detailCard.editHistory.map((entry, entryIndex) => (
                          <li key={entry.id} data-testid={`history-entry-${entry.id}`}>
                            <details open={entryIndex === 0} className="group rounded-lg border border-slate-200">
                              <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                                <span className="min-w-0 break-words text-sm font-medium text-slate-800">
                                  {entry.editorName}{entry.editorRole === "admin" ? " · администратор" : " · менеджер"}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <time>{formatDate(entry.createdAt)}</time>
                                  <span>
                                    {entry.changes.length} {entry.changes.length === 1 ? "изменение" : entry.changes.length < 5 ? "изменения" : "изменений"}
                                  </span>
                                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                                </span>
                              </summary>
                              <ul className="space-y-3 border-t border-slate-100 px-3 py-3">
                                {entry.changes.map((change, index) => (
                                  <li key={`${entry.id}-${change.field}-${index}`} className="min-w-0 text-sm">
                                    <p className="font-medium text-slate-700">{auditFieldLabel(change.field)}</p>
                                    <div className="mt-2 grid gap-2 xl:grid-cols-2">
                                      <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                                        <span className="block text-xs font-medium text-slate-500">Было</span>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                                          {formatAuditValue(change.field, change.oldValue)}
                                        </p>
                                      </div>
                                      <div className="min-w-0 rounded-lg bg-sky-50/70 px-3 py-2">
                                        <span className="block text-xs font-medium text-slate-500">Стало</span>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                                          {formatAuditValue(change.field, change.newValue)}
                                        </p>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Правок пока нет.</p>
                    )}
                  </section>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
