import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, FileDown, LogOut, Car, Pencil, BookOpen, UserPlus, UserCheck, LogIn, FileText, Clock, User, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  searchCars, fetchCarBrands, fetchCarModels,
  createQuote, updateQuote, regenerateQuotePdf, getMyQuotes, getManagerName, logoutManager, pdfDownloadUrl,
  isAdminUsingManagerPortal,
  type CarSearchResult, type QuoteDiscount, type QuoteHistoryItem,
  type QuoteExtraEquipment, type QuoteCreditOffer, type QuoteTradeIn,
} from "@/lib/manager-auth";
import { useManagerAuth } from "@/lib/manager-auth";
import { useLocation } from "wouter";

const NBSP = "\u00a0";
const fmtRub = (n: number) =>
  n.toLocaleString("ru-RU") + NBSP + "₽";

const DISCOUNT_PRESETS = [
  { label: "Выгода по программе trade-in", key: "tradein" },
  { label: "Выгода при покупке в кредит", key: "credit" },
  { label: "Выгода по программе лизинга", key: "leasing" },
  { label: "Скидка дилерского центра", key: "dealer" },
];

function CarSearch({ onSelect }: { onSelect: (car: CarSearchResult) => void }) {
  const [type, setType] = React.useState<"new" | "used" | "">("");
  const [brand, setBrand] = React.useState("");
  const [model, setModel] = React.useState("");
  const [vin, setVin] = React.useState("");
  const [debouncedVin, setDebouncedVin] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedVin(vin), 400);
    return () => clearTimeout(t);
  }, [vin]);

  const qc = useQueryClient();

  React.useEffect(() => {
    qc.invalidateQueries({ queryKey: ["car-brands"] });
    qc.invalidateQueries({ queryKey: ["car-models"] });
    qc.invalidateQueries({ queryKey: ["car-search"] });
  }, []);

  const { data: brandsData } = useQuery({
    queryKey: ["car-brands", type],
    queryFn: () => fetchCarBrands(type || undefined),
    staleTime: 0,
    gcTime: 0,
  });

  const { data: modelsData } = useQuery({
    queryKey: ["car-models", brand, type],
    queryFn: () => fetchCarModels(brand, type || undefined),
    enabled: !!brand,
    staleTime: 30_000,
  });

  const searchEnabled = !!brand || debouncedVin.length >= 4;
  const { data, isFetching } = useQuery({
    queryKey: ["car-search", type, brand, model, debouncedVin],
    queryFn: () => searchCars({
      type: type || undefined,
      brand: brand || undefined,
      model: model || undefined,
      q: debouncedVin || undefined,
    }),
    enabled: searchEnabled,
    staleTime: 10_000,
  });

  const handleTypeChange = (v: "new" | "used" | "") => {
    setType(v);
    setBrand("");
    setModel("");
  };
  const handleBrandChange = (v: string) => {
    setBrand(v);
    setModel("");
  };

  return (
    <div className="space-y-3">
      {/* Строка 1: тип + VIN */}
      <div className="flex gap-2">
        <select
          value={type}
          onChange={e => handleTypeChange(e.target.value as "new" | "used" | "")}
          className="border rounded-md px-3 py-2 text-sm bg-white w-32 shrink-0"
        >
          <option value="">Все авто</option>
          <option value="new">Новые</option>
          <option value="used">Б/у</option>
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Поиск по VIN..."
            value={vin}
            onChange={e => { setVin(e.target.value); if (e.target.value) { setBrand(""); setModel(""); setType(""); } }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Кнопки брендов */}
      {!vin && brandsData?.data && brandsData.data.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {brandsData.data.map(b => (
            <button
              key={b}
              type="button"
              onClick={() => handleBrandChange(b === brand ? "" : b)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                brand === b
                  ? "bg-[#0070b8] text-white border-[#0070b8]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Строка 2: Бренд + Модель */}
      {!vin && (
        <div className="flex gap-2">
          <select
            value={brand}
            onChange={e => handleBrandChange(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-white flex-1"
          >
            <option value="">— Выберите бренд —</option>
            {(brandsData?.data ?? []).map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            disabled={!brand}
            className="border rounded-md px-3 py-2 text-sm bg-white flex-1 disabled:opacity-50"
          >
            <option value="">— Все модели —</option>
            {(modelsData?.data ?? []).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {isFetching && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Поиск...
        </div>
      )}

      {!searchEnabled && (
        <p className="text-sm text-slate-400">Выберите бренд или введите VIN для поиска</p>
      )}

      {searchEnabled && data?.data && data.data.length > 0 && (
        <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
          {data.data.map(car => (
            <button
              key={car.externalId}
              type="button"
              onClick={() => onSelect(car)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="font-medium text-sm">{car.brand} {car.model} {car.year}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {car.modification || car.complectation || "—"} · {car.type === "new" ? "Новый" : "Б/у"}
                {car.price ? ` · ${fmtRub(car.price)}` : ""}
                {car.color ? ` · ${car.color}` : ""}
              </div>
              {car.vin && <div className="text-xs text-slate-400 mt-0.5">VIN: {car.vin}</div>}
            </button>
          ))}
        </div>
      )}

      {searchEnabled && !isFetching && data?.data?.length === 0 && (
        <p className="text-sm text-slate-500">Ничего не найдено</p>
      )}
    </div>
  );
}

function snapToCar(q: QuoteHistoryItem): CarSearchResult {
  const s = q.carSnapshot;
  return {
    id: Number(s["id"] ?? 0),
    externalId: String(s["externalId"] ?? s["id"] ?? ""),
    type: q.carType as "new" | "used",
    brand: String(s["brand"] ?? ""),
    model: String(s["model"] ?? ""),
    year: Number(s["year"] ?? 0),
    price: s["price"] != null ? Number(s["price"]) : null,
    color: s["color"] ? String(s["color"]) : null,
    imageUrl: s["imageUrl"] ? String(s["imageUrl"]) : null,
    modification: s["modification"] ? String(s["modification"]) : null,
    complectation: s["complectation"] ? String(s["complectation"]) : null,
    vin: s["vin"] ? String(s["vin"]) : null,
    dealer: s["dealer"] ? String(s["dealer"]) : null,
    bodyType: s["bodyType"] ? String(s["bodyType"]) : null,
  };
}

function QuoteForm({
  onSuccess,
  initialData,
  editQuoteId,
}: {
  onSuccess: () => void;
  initialData?: QuoteHistoryItem | null;
  editQuoteId?: number | null;
}) {
  const isEditing = !!editQuoteId;

  const [selectedCar, setSelectedCar] = React.useState<CarSearchResult | null>(
    () => initialData ? snapToCar(initialData) : null
  );
  const [priceOverride, setPriceOverride] = React.useState<string>(() => {
    if (initialData) return String(initialData.priceOriginal ?? "");
    return "";
  });
  const [clientName, setClientName] = React.useState(initialData?.clientName ?? "");
  const [clientGender, setClientGender] = React.useState<"male" | "female" | "">(
    initialData?.clientGender ?? ""
  );
  const [clientPhone, setClientPhone] = React.useState(initialData?.clientPhone ?? "");
  const [validUntil, setValidUntil] = React.useState(() => {
    if (initialData?.validUntil) return initialData.validUntil;
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0]!;
  });
  const [discountValues, setDiscountValues] = React.useState<Record<string, string>>(() => {
    if (!initialData?.discounts?.length) return {};
    const map: Record<string, string> = {};
    DISCOUNT_PRESETS.forEach(p => {
      const found = initialData.discounts.find(d => d.label === p.label);
      if (found && found.value > 0) map[p.key] = String(found.value);
    });
    return map;
  });
  const [extraText, setExtraText] = React.useState(initialData?.extraEquipment?.text ?? "");
  const [extraPrice, setExtraPrice] = React.useState(
    initialData?.extraEquipment?.price != null ? String(initialData.extraEquipment.price) : ""
  );
  const [extraAddToRrp, setExtraAddToRrp] = React.useState(initialData?.extraAddToRrp ?? false);
  const [creditTerm, setCreditTerm] = React.useState(initialData?.creditOffer?.term ?? "");
  const [creditRate, setCreditRate] = React.useState(initialData?.creditOffer?.rate ?? "");
  const [creditMonthly, setCreditMonthly] = React.useState(
    initialData?.creditOffer?.monthlyPayment ? String(initialData.creditOffer.monthlyPayment) : ""
  );
  const [tradeInFrom, setTradeInFrom] = React.useState(
    initialData?.tradeIn?.priceFrom != null ? String(initialData.tradeIn.priceFrom) : ""
  );
  const [tradeInTo, setTradeInTo] = React.useState(
    initialData?.tradeIn?.priceTo != null ? String(initialData.tradeIn.priceTo) : ""
  );
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [, setLocation] = useLocation();

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createQuote>[0]) =>
      isEditing
        ? updateQuote(editQuoteId!, {
            clientName: payload.clientName,
            clientPhone: payload.clientPhone,
            clientGender: payload.clientGender,
            discounts: payload.discounts,
            validUntil: payload.validUntil,
            priceOverride: payload.priceOverride,
            extraEquipment: payload.extraEquipment,
            creditOffer: payload.creditOffer,
            tradeIn: payload.tradeIn,
          })
        : createQuote(payload),
    onSuccess: (data) => {
      setGenerating(false);
      if (data.pdfUrl && data.quoteId) {
        window.open(pdfDownloadUrl(data.quoteId), "_blank");
      }
      onSuccess();
    },
    onError: (err: Error) => {
      setGenerating(false);
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCar) { setError("Выберите автомобиль"); return; }
    if (!clientName.trim()) { setError("Укажите имя клиента"); return; }
    if (!clientPhone.trim()) { setError("Укажите телефон клиента"); return; }

    setError("");
    setGenerating(true);

    const discounts: QuoteDiscount[] = DISCOUNT_PRESETS
      .map(p => ({ label: p.label, value: Number(discountValues[p.key] || 0) }));

    const extraEquipment: QuoteExtraEquipment | undefined = extraText.trim()
      ? { text: extraText.trim(), price: extraPrice ? Number(extraPrice) : undefined }
      : undefined;
    const creditOffer: QuoteCreditOffer | undefined = (creditTerm || creditRate || creditMonthly)
      ? { term: creditTerm.trim(), rate: creditRate.trim(), monthlyPayment: Number(creditMonthly) || 0 }
      : undefined;
    const tradeIn: QuoteTradeIn | undefined = (tradeInFrom || tradeInTo)
      ? { priceFrom: tradeInFrom ? Number(tradeInFrom) : undefined, priceTo: tradeInTo ? Number(tradeInTo) : undefined }
      : undefined;

    mutation.mutate({
      carId: selectedCar.externalId,
      carType: selectedCar.type,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientGender: clientGender || undefined,
      discounts,
      validUntil,
      priceOverride: priceOverride ? Number(priceOverride) : undefined,
      extraEquipment,
      extraAddToRrp,
      creditOffer,
      tradeIn,
    });
  }

  const totalDiscount = DISCOUNT_PRESETS.reduce((s, p) => s + Number(discountValues[p.key] || 0), 0);
  const rawPrice = priceOverride ? Number(priceOverride) : (selectedCar?.price ?? null);
  const extraPriceNum = extraPrice ? Number(extraPrice) : 0;
  const effectivePrice = rawPrice != null ? (extraAddToRrp ? rawPrice + extraPriceNum : rawPrice) : null;
  const finalPrice = effectivePrice != null ? effectivePrice - totalDiscount : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-sm font-semibold text-slate-700 mb-2 block">Автомобиль</Label>
        {selectedCar ? (
          <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#0070b8]/10 rounded-lg flex items-center justify-center flex-none">
                  <Car className="w-5 h-5 text-[#0070b8]" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{selectedCar.brand} {selectedCar.model} {selectedCar.year}</div>
                  <div className="text-sm text-slate-500">{selectedCar.modification || selectedCar.complectation || "—"}</div>
                  {selectedCar.price && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Цена в каталоге: {fmtRub(selectedCar.price)}
                    </div>
                  )}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedCar(null); setPriceOverride(""); }}>
                Изменить
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 pt-1 border-t border-slate-200">
              <Label className="text-sm text-slate-600 whitespace-nowrap">Цена в КП</Label>
              <div className="relative w-full sm:w-48">
                <Input
                  type="number"
                  min={0}
                  value={priceOverride}
                  onChange={e => setPriceOverride(e.target.value)}
                  placeholder={selectedCar.price ? String(selectedCar.price) : "из каталога"}
                  className="pr-8 text-right"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₽</span>
              </div>
              {priceOverride && selectedCar.price && Number(priceOverride) !== selectedCar.price && (
                <span className="text-xs text-amber-600 font-medium">≠ каталог</span>
              )}
              {extraAddToRrp && effectivePrice != null && extraPriceNum > 0 && (
                <span className="text-xs text-emerald-600 font-medium">
                  Итоговая цена в КП: {fmtRub(effectivePrice)} (с учётом ДОП)
                </span>
              )}
            </div>
          </div>
        ) : (
          <CarSearch onSelect={(car) => { setSelectedCar(car); setPriceOverride(car.price ? String(car.price) : ""); }} />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="clientName">Имя клиента</Label>
          <Input id="clientName" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Иван Петрович" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clientPhone">Телефон клиента</Label>
          <Input
            id="clientPhone"
            type="tel"
            value={clientPhone}
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, "");
              const digits = raw.startsWith("7") ? raw.slice(1) : raw;
              let masked = "";
              if (digits.length === 0) masked = "";
              else if (digits.length <= 3) masked = `+7 (${digits}`;
              else if (digits.length <= 6) masked = `+7 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
              else if (digits.length <= 8) masked = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
              else masked = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
              setClientPhone(masked);
            }}
            placeholder="+7 (999) 000-00-00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clientGender">Обращение</Label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setClientGender("male")}
              className={`flex items-center justify-center gap-1.5 w-full rounded-md border px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                clientGender === "male"
                  ? "bg-[#0070b8] text-white border-[#0070b8]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <User className="w-4 h-4 shrink-0" /> Уважаемый
            </button>
            <button
              type="button"
              onClick={() => setClientGender("female")}
              className={`flex items-center justify-center gap-1.5 w-full rounded-md border px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                clientGender === "female"
                  ? "bg-[#0070b8] text-white border-[#0070b8]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <UserRound className="w-4 h-4 shrink-0" /> Уважаемая
            </button>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-slate-700 mb-3 block">Скидки по программам</Label>
        <div className="space-y-3">
          {DISCOUNT_PRESETS.map(p => (
            <div key={p.key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <Label className="sm:flex-1 text-sm text-slate-600">{p.label}</Label>
              <div className="relative w-full sm:w-40">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={discountValues[p.key] || ""}
                  onChange={e => setDiscountValues(v => ({ ...v, [p.key]: e.target.value }))}
                  placeholder="0"
                  className="pr-8 text-right"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₽</span>
              </div>
            </div>
          ))}
        </div>
        {totalDiscount > 0 && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Итого скидка:</span>
              <span className="font-semibold text-green-700">−{fmtRub(totalDiscount)}</span>
            </div>
            {finalPrice !== null && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Итоговая цена:</span>
                <span className="font-bold text-slate-900">{fmtRub(finalPrice)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="validUntil">Предложение действительно до</Label>
        <Input
          id="validUntil"
          type="date"
          value={validUntil}
          onChange={e => setValidUntil(e.target.value)}
          required
        />
      </div>

      {/* Дополнительное оборудование */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
        <Label className="text-sm font-semibold text-slate-700 block">
          Дополнительное оборудование
          <span className="ml-1.5 text-xs font-normal text-slate-400">(необязательно)</span>
        </Label>
        <textarea
          rows={3}
          value={extraText}
          onChange={e => setExtraText(e.target.value)}
          placeholder={"Сигнализация StarLine A95\nТонировка задних стёкол\nКоврики в салон"}
          className="w-full border rounded-md px-3 py-2 text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-[#0070b8]/30 border-slate-200"
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <Label className="text-sm text-slate-600 whitespace-nowrap">Стоимость оборудования</Label>
          <div className="relative w-full sm:w-44">
            <Input
              type="number"
              min={0}
              step={1}
              value={extraPrice}
              onChange={e => setExtraPrice(e.target.value)}
              placeholder="0"
              className="pr-8 text-right"
            />
            <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₽</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 select-none">
            <input
              type="checkbox"
              checked={extraAddToRrp}
              onChange={e => setExtraAddToRrp(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#0070b8] focus:ring-[#0070b8] accent-[#0070b8]"
            />
            Добавить к РРЦ
          </label>
        </div>
      </div>

      {/* Кредитное предложение */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
        <Label className="text-sm font-semibold text-slate-700 block">
          Кредитное предложение
          <span className="ml-1.5 text-xs font-normal text-slate-400">(необязательно)</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Срок кредита, мес.</Label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                step={1}
                value={creditTerm}
                onChange={e => setCreditTerm(e.target.value)}
                placeholder="60"
                className="pr-12 text-right"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">мес.</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Процентная ставка, %</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={0.1}
                value={creditRate}
                onChange={e => setCreditRate(e.target.value)}
                placeholder="3,9"
                className="pr-8 text-right"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Ежемесячный платёж</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={1}
                value={creditMonthly}
                onChange={e => setCreditMonthly(e.target.value)}
                placeholder="0"
                className="pr-4 text-right"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₽</span>
            </div>
          </div>
        </div>
      </div>

      {/* Оценка автомобиля (trade-in) */}
      <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
        <Label className="text-sm font-semibold text-slate-700 block">
          Оценка вашего автомобиля
          <span className="ml-1.5 text-xs font-normal text-slate-400">(необязательно)</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-600">От</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={1}
                value={tradeInFrom}
                onChange={e => setTradeInFrom(e.target.value)}
                placeholder="0"
                className="pr-8 text-right"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₽</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-600">До</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={1}
                value={tradeInTo}
                onChange={e => setTradeInTo(e.target.value)}
                placeholder="0"
                className="pr-8 text-right"
              />
              <span className="absolute right-3 top-2.5 text-slate-400 text-sm">₽</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button
        type="submit"
        disabled={generating || !selectedCar}
        className="w-full bg-[#0070b8] hover:bg-[#005a94] text-white h-11 text-base font-semibold"
      >
        {generating ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Формируется... (до 30 сек)</>
        ) : isEditing ? (
          "Сохранить изменения и скачать PDF"
        ) : (
          "Сформировать PDF"
        )}
      </Button>
    </form>
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function HistoryTable({ onEdit }: { onEdit: (q: QuoteHistoryItem) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-quotes-history"],
    queryFn: getMyQuotes,
    staleTime: 10_000,
  });
  const regeneratePdf = useMutation({
    mutationFn: regenerateQuotePdf,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manager-quotes-history"] }),
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 text-slate-500 py-6">
      <Loader2 className="h-4 w-4 animate-spin" />Загрузка...
    </div>
  );

  const quotes = data?.data ?? [];

  if (quotes.length === 0) {
    return <p className="text-sm text-slate-500 py-4">Вы пока не создавали КП</p>;
  }

  return (
    <>
      {regeneratePdf.isError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          Не удалось сформировать PDF. Попробуйте ещё раз.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-slate-500 text-xs uppercase">
            <th className="text-left py-2 pr-4 font-medium">Дата</th>
            <th className="text-left py-2 pr-4 font-medium">Авто</th>
            <th className="text-left py-2 pr-4 font-medium">Клиент</th>
            <th className="text-right py-2 pr-4 font-medium">Сумма</th>
            <th className="text-right py-2 pr-4 font-medium">Выгода</th>
            <th className="text-right py-2 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {quotes.map((q: QuoteHistoryItem) => {
            const snap = q.carSnapshot as Record<string, unknown>;
            const carName = `${snap["brand"] ?? ""} ${snap["model"] ?? ""} ${snap["year"] ?? ""}`.trim();
            const benefit = q.priceOriginal - q.priceFinal;
            const wasEdited = q.updatedAt && q.updatedAt !== q.createdAt;
            return (
              <tr key={q.id} className="hover:bg-slate-50">
                <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                  <div>{new Date(q.createdAt).toLocaleDateString("ru-RU")}</div>
                  {wasEdited && (
                    <div className="text-xs text-amber-600 mt-0.5">
                      ✎ {fmtDateTime(q.updatedAt!)}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4 font-medium">{carName}</td>
                <td className="py-3 pr-4">
                  <div>{q.clientName}</div>
                  <div className="text-xs text-slate-400">{q.clientPhone}</div>
                </td>
                <td className="py-3 pr-4 text-right font-semibold">{fmtRub(q.priceFinal)}</td>
                <td className="py-3 pr-4 text-right">
                  {benefit > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 font-medium">
                      −{fmtRub(benefit)}
                    </Badge>
                  )}
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(q)}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-[#0070b8] text-sm transition-colors"
                      title="Редактировать КП"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {q.pdfUrl ? (
                      <a
                        href={pdfDownloadUrl(q.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#0070b8] hover:underline text-sm"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => regeneratePdf.mutate(q.id)}
                        disabled={regeneratePdf.isPending}
                        className="inline-flex items-center gap-1 text-[#0070b8] hover:underline text-sm disabled:cursor-wait disabled:opacity-60"
                      >
                        {regeneratePdf.isPending && regeneratePdf.variables === q.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <FileDown className="h-3.5 w-3.5" />}
                        Сформировать
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </>
  );
}

const KP_STEPS = [
  {
    icon: UserPlus,
    title: "Регистрация",
    color: "text-[#0070b8]",
    bg: "bg-blue-50",
    content: (
      <div className="space-y-1.5 text-sm text-slate-600">
        <p>Менеджер самостоятельно регистрируется по ссылке:</p>
        <a href="https://debryansk-auto.ru/admin/manager/register" target="_blank" rel="noopener noreferrer" className="inline-block text-[#0070b8] hover:underline font-medium break-all">
          debryansk-auto.ru/admin/manager/register
        </a>
        <p className="text-slate-500">Нужно заполнить: имя, телефон, e-mail, пароль, фото профиля и выбрать бренды, с которыми работает.</p>
      </div>
    ),
  },
  {
    icon: UserCheck,
    title: "Активация",
    color: "text-amber-600",
    bg: "bg-amber-50",
    content: (
      <div className="space-y-1.5 text-sm text-slate-600">
        <p>После регистрации заявка появляется у администратора в разделе <span className="font-medium text-slate-800">«Ожидают активации»</span>.</p>
        <p>После активации менеджер получает письмо со своими данными для входа.</p>
      </div>
    ),
  },
  {
    icon: LogIn,
    title: "Вход в систему",
    color: "text-green-600",
    bg: "bg-green-50",
    content: (
      <div className="space-y-1.5 text-sm text-slate-600">
        <p>Менеджер входит по ссылке:</p>
        <a href="https://debryansk-auto.ru/admin/manager/login" target="_blank" rel="noopener noreferrer" className="inline-block text-[#0070b8] hover:underline font-medium break-all">
          debryansk-auto.ru/admin/manager/login
        </a>
        <p className="text-slate-500">Используется логин и пароль, указанные при регистрации.</p>
      </div>
    ),
  },
  {
    icon: FileText,
    title: "Создание КП",
    color: "text-purple-600",
    bg: "bg-purple-50",
    content: (
      <div className="space-y-1.5 text-sm text-slate-600">
        <p>В разделе КП менеджер:</p>
        <ol className="list-decimal list-inside space-y-1 text-slate-600">
          <li>Находит нужный автомобиль из каталога</li>
          <li>Вводит данные клиента (имя, телефон)</li>
          <li>Настраивает цену, скидки и условия</li>
          <li>Нажимает <span className="font-medium text-slate-800">«Сгенерировать PDF»</span> — готовое КП скачивается автоматически</li>
        </ol>
      </div>
    ),
  },
  {
    icon: Clock,
    title: "История КП",
    color: "text-slate-500",
    bg: "bg-slate-50",
    content: (
      <div className="space-y-1.5 text-sm text-slate-600">
        <p>Во вкладке «История КП» находится таблица со всеми созданными предложениями. Можно открыть любое КП и перегенерировать PDF с актуальными данными и отредактировать КП.</p>
      </div>
    ),
  },
];

const KP_NOTES = [
  "КП доступно для всех новых автомобилей в базе (обновление стока раз в 30 минут)",
  "КП доступно для всех автомобилей с пробегом в статусе «В продаже» (обновление стока раз в 30 минут)",
];

function KpInstructionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#0070b8]" />
            Как работать с КП
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {KP_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="flex gap-4">
                <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center flex-none mt-0.5`}>
                  <Icon className={`h-4 w-4 ${step.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 text-sm mb-1">{idx + 1}. {step.title}</div>
                  {step.content}
                </div>
              </div>
            );
          })}
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            {KP_NOTES.map((note, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-500">
                <span className="text-[#0070b8] font-bold mt-0.5">—</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ManagerQuotesPage() {
  const { logout } = useManagerAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = React.useState<"form" | "history">("form");
  const [editingQuote, setEditingQuote] = React.useState<QuoteHistoryItem | null>(null);
  const [showInstructions, setShowInstructions] = React.useState(false);
  const qc = useQueryClient();

  function handleLogout() {
    if (isAdminUsingManagerPortal()) {
      setLocation("/");
      return;
    }
    logout();
    setLocation("/manager/login");
  }

  function handleEdit(q: QuoteHistoryItem) {
    setEditingQuote(q);
    setTab("form");
  }

  function handleNewQuote() {
    setEditingQuote(null);
    setTab("form");
  }

  return (
    <div className="min-h-screen bg-[#f2f5f8]">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 200 33" className="h-5 shrink-0 text-[#0070b8]" fill="currentColor">
            <path d="M33.7,15.9C33.4,6.8,25.7-.3,16.6,0,7.5.3.3,8.1,0,17.2c.1,2.7.8,5.2,2.1,7.4l2.7-4.2c-.33-1.04-.52-2.14-.56-3.29-.23-6.72,5.04-12.35,11.76-12.58,6.72-.23,12.35,5.04,12.58,11.76.23,6.72-5.04,12.35-11.76,12.58-1.35.05-2.64-.14-3.86-.5l.05-.05,6.41-17.46-.73.02s-11.61,18.14-11.77,18.66c0,0,.63.65,1.23,1.11.62.47,1.43.92,1.43.92,2.23,1.02,4.72,1.55,7.34,1.46,9.02-.3,16.09-7.85,15.79-16.88Z"/>
          </svg>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 text-sm sm:text-base truncate block">КП</span>
            <span className="text-xs text-slate-500 truncate block">{getManagerName()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/manager/profile")} className="text-slate-500 px-2 sm:px-3">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Профиль</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 px-2 sm:px-3">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Выйти</span>
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={tab === "form" ? "default" : "outline"}
            onClick={handleNewQuote}
            className={tab === "form" && !editingQuote ? "bg-[#0070b8] hover:bg-[#005a94]" : ""}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Новое КП
          </Button>
          <Button
            variant={tab === "history" ? "default" : "outline"}
            onClick={() => setTab("history")}
            className={tab === "history" ? "bg-[#0070b8] hover:bg-[#005a94]" : ""}
          >
            История КП
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowInstructions(true)}
            className="text-slate-600 ml-auto"
          >
            <BookOpen className="h-4 w-4 mr-1.5" />
            Как работать с КП
          </Button>
        </div>

        <KpInstructionsDialog open={showInstructions} onClose={() => setShowInstructions(false)} />

        {tab === "form" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {editingQuote
                  ? `Редактирование КП №${String(editingQuote.id).padStart(10, "0")}`
                  : "Формирование КП"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteForm
                key={editingQuote?.id ?? "new"}
                initialData={editingQuote}
                editQuoteId={editingQuote?.id ?? null}
                onSuccess={() => {
                  setEditingQuote(null);
                  setTab("history");
                  qc.invalidateQueries({ queryKey: ["manager-quotes-history"] });
                }}
              />
            </CardContent>
          </Card>
        )}

        {tab === "history" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Мои КП</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTable onEdit={handleEdit} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
