import { Router } from "express";
import { and, count, desc, eq, gte, ilike, isNotNull, lt, or } from "drizzle-orm";
import {
  carsTable,
  db,
  managerClientCardHistoryTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import {
  CreateManagerClientCardBody,
  GetManagerClientCardResponse,
  ListManagerClientCardManagersResponse,
  ListManagerClientNeedsBrandsResponse,
  ListManagerClientNeedsModelsResponse,
  ListManagerClientCardsResponse,
  SearchManagerClientCardInventoryResponse,
  SearchManagerClientCardInventoryQueryParams,
  ListManagerClientCardsQueryParams,
} from "@workspace/api-zod";
import { normalizeManagerQuoteBrand } from "../lib/manager-quote-brand";
import { normalizeRussianPhone, validateClientName } from "../lib/manager-client-cards-validation";
import { getManagerPayload, requireManager } from "../middlewares/requireManager";

const router = Router();
router.use(requireManager);

const budgetRanges = ["Не указан", "до 2 млн", "2–3 млн", "3–5 млн", "5+ млн"] as const;
const tradeInPlans = ["Да", "Нет", "Пока не решил"] as const;
const paymentMethods = ["Кредит", "Лизинг", "Наличные / Безнал"] as const;
const genders = ["male", "female"] as const;
const auditedCardFields = [
  "clientName",
  "clientPhone",
  "clientGender",
  "needs",
  "currentCars",
  "commercialBrand",
  "commercialModel",
  "commercialCarId",
  "commercialCarSnapshot",
  "paymentMethod",
  "comment",
] as const;

type CreateClientCardInput = {
  clientName: string;
  clientPhone: string;
  clientGender: typeof genders[number] | null;
  needs: Array<{
    brand: string | null;
    model: string | null;
    undecided: boolean;
    budgetRange: typeof budgetRanges[number] | null;
    plannedPurchaseDate: string | null;
  }>;
  currentCars: Array<{
    brand: string;
    model: string;
    year: number;
    mileage: number;
    generation: string | null;
    bodyType: string | null;
    ownersCount: "1" | "2" | "3" | "4+" | null;
    snapshot: Record<string, unknown> | null;
    tradeInPlan: typeof tradeInPlans[number] | null;
  }>;
  desiredBrand: string | null;
  desiredModel: string | null;
  desiredVehicleUndecided: boolean;
  budgetRange: typeof budgetRanges[number] | null;
  currentCar: string | null;
  currentCarBrand: string | null;
  currentCarModel: string | null;
  currentCarYear: number | null;
  currentCarMileage: number | null;
  currentCarGeneration: string | null;
  currentCarBodyType: string | null;
  currentCarOwnersCount: "1" | "2" | "3" | "4+" | null;
  tradeInPlan: typeof tradeInPlans[number] | null;
  commercialBrand: string | null;
  commercialModel: string | null;
  commercialCarId: number | null;
  paymentMethod: typeof paymentMethods[number] | null;
  comment: string;
};

function parseCreateClientCardInput(body: unknown): { data?: CreateClientCardInput; error?: string } {
  const validated = CreateManagerClientCardBody.safeParse(body);
  if (!validated.success) return { error: "Проверьте заполненные данные" };
  const value = validated.data as unknown as Record<string, unknown>;
  const text = (raw: unknown, label: string, maxLength: number, required = false): string | null => {
    if (raw == null) {
      if (required) throw new Error(`Укажите ${label}`);
      return null;
    }
    if (typeof raw !== "string") throw new Error(`Проверьте поле «${label}»`);
    const trimmed = raw.trim();
    if (trimmed.length > maxLength) throw new Error(`Слишком длинное значение в поле «${label}»`);
    if (required && trimmed.length < 2) throw new Error(`Укажите ${label}`);
    return trimmed || null;
  };
  const enumValue = <T extends string>(raw: unknown, allowed: readonly T[], label: string): T | null => {
    if (raw == null || raw === "") return null;
    if (typeof raw !== "string" || !allowed.includes(raw as T)) {
      throw new Error(`Проверьте значение поля «${label}»`);
    }
    return raw as T;
  };

  try {
    const clientName = text(value["clientName"], "ФИО клиента", 120, true)!;
    const nameError = validateClientName(clientName);
    if (nameError) throw new Error(nameError);
    const rawPhone = text(value["clientPhone"], "номер телефона", 40, true)!;
    const clientPhone = normalizeRussianPhone(rawPhone);
    if (!clientPhone) throw new Error("Проверьте номер телефона: нужен действующий номер +7");

    const legacyBrand = text(value["desiredBrand"], "марку автомобиля", 180);
    const legacyModel = text(value["desiredModel"], "модель автомобиля", 180);
    const needsRaw = value["needs"];
    const rawNeeds = needsRaw === undefined
      ? [{
          brand: legacyBrand,
          model: legacyModel,
          undecided: value["desiredVehicleUndecided"] === true,
          budgetRange: value["budgetRange"],
          plannedPurchaseDate: null,
        }]
      : needsRaw;
    if (!Array.isArray(rawNeeds) || rawNeeds.length === 0 || rawNeeds.length > 20) {
      throw new Error("Добавьте от одной до 20 потребностей клиента");
    }
    const needs = rawNeeds.map((rawNeed, index) => {
      const need = rawNeed && typeof rawNeed === "object" && !Array.isArray(rawNeed)
        ? rawNeed as Record<string, unknown>
        : {};
      const brand = text(need["brand"], `марку в потребности ${index + 1}`, 180);
      const model = text(need["model"], `модель в потребности ${index + 1}`, 180);
      if (Boolean(brand) !== Boolean(model)) {
        throw new Error(`В потребности ${index + 1} укажите и марку, и модель`);
      }
      if (need["undecided"] != null && typeof need["undecided"] !== "boolean") {
        throw new Error(`Проверьте выбор автомобиля в потребности ${index + 1}`);
      }
      const undecided = need["undecided"] === true;
      if (undecided === Boolean(brand)) {
        throw new Error(`Выберите модель в потребности ${index + 1} или отметьте «Пока не определился»`);
      }
      const budgetRange = enumValue(need["budgetRange"], budgetRanges, `бюджет в потребности ${index + 1}`);
      if (!budgetRange) throw new Error(`Укажите бюджет в потребности ${index + 1}`);
      const plannedPurchaseDateValue = need["plannedPurchaseDate"];
      let plannedPurchaseDate: string | null = null;
      if (plannedPurchaseDateValue != null && plannedPurchaseDateValue !== "") {
        const plannedDate = typeof plannedPurchaseDateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(plannedPurchaseDateValue)
          ? new Date(`${plannedPurchaseDateValue}T00:00:00.000Z`)
          : null;
        if (
          !plannedDate ||
          !Number.isFinite(plannedDate.getTime()) ||
          plannedDate.toISOString().slice(0, 10) !== plannedPurchaseDateValue
        ) {
          throw new Error(`Проверьте планируемую дату покупки в потребности ${index + 1}`);
        }
        plannedPurchaseDate = plannedDate.toISOString().slice(0, 10);
      }
      return {
        brand,
        model,
        undecided,
        budgetRange,
        plannedPurchaseDate,
      };
    });
    const commercialBrand = text(value["commercialBrand"], "марку предложения", 180);
    const commercialModel = text(value["commercialModel"], "модель предложения", 180);
    if (Boolean(commercialBrand) !== Boolean(commercialModel)) {
      throw new Error("Для предложения укажите и марку, и модель");
    }

    const currentCarText = text(value["currentCar"], "текущий автомобиль", 180);
    const legacyCurrentCar = {
      brand: value["currentCarBrand"],
      model: value["currentCarModel"],
      year: value["currentCarYear"],
      mileage: value["currentCarMileage"],
      generation: value["currentCarGeneration"],
      bodyType: value["currentCarBodyType"],
      ownersCount: value["currentCarOwnersCount"],
      snapshot: value["currentCarSnapshot"],
      tradeInPlan: value["tradeInPlan"],
    };
    const hasLegacyCurrentCar = Object.values(legacyCurrentCar)
      .some(item => item != null && item !== "") || Boolean(currentCarText);
    const currentCarsRaw = value["currentCars"] === undefined
      ? (hasLegacyCurrentCar ? [legacyCurrentCar] : [])
      : value["currentCars"];
    if (!Array.isArray(currentCarsRaw) || currentCarsRaw.length > 10) {
      throw new Error("Можно добавить не более 10 текущих автомобилей");
    }
    const currentCars = currentCarsRaw.map((rawCar, index) => {
      const car = rawCar && typeof rawCar === "object" && !Array.isArray(rawCar)
        ? rawCar as Record<string, unknown>
        : {};
      const label = `текущего автомобиля ${index + 1}`;
      const brand = text(car["brand"], `марку ${label}`, 120);
      const model = text(car["model"], `модель ${label}`, 120);
      const year = Number(car["year"]);
      const mileage = Number(car["mileage"]);
      if (
        !brand || !model ||
        car["year"] == null || car["year"] === "" || !Number.isInteger(year) || year < 1950 || year > 2100 ||
        car["mileage"] == null || car["mileage"] === "" || !Number.isInteger(mileage) || mileage < 0 || mileage > 2_000_000
      ) {
        throw new Error("Для каждого текущего автомобиля заполните марку, модель, год и пробег");
      }
      const snapshot = car["snapshot"] && typeof car["snapshot"] === "object" && !Array.isArray(car["snapshot"])
        ? car["snapshot"] as Record<string, unknown>
        : null;
      return {
        brand,
        model,
        year,
        mileage,
        generation: text(car["generation"], `поколение ${label}`, 120),
        bodyType: text(car["bodyType"], `тип кузова ${label}`, 120),
        ownersCount: enumValue(car["ownersCount"], ["1", "2", "3", "4+"] as const, `количество владельцев ${label}`),
        snapshot,
        tradeInPlan: enumValue(car["tradeInPlan"], tradeInPlans, `трейд-ин ${label}`),
      };
    });

    let commercialCarId: number | null = null;
    if (value["commercialCarId"] != null && value["commercialCarId"] !== "") {
      const parsedId = Number(value["commercialCarId"]);
      if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
        throw new Error("Некорректный выбранный автомобиль");
      }
      commercialCarId = parsedId;
    }

    const comment = value["comment"] == null ? "" : value["comment"];
    if (typeof comment !== "string" || comment.trim().length > 4000) {
      throw new Error("Комментарий должен быть не длиннее 4000 символов");
    }

    return {
      data: {
        clientName,
        clientPhone,
        clientGender: enumValue(value["clientGender"], genders, "пол"),
        needs,
        currentCars,
        desiredBrand: needs[0]?.brand ?? null,
        desiredModel: needs[0]?.model ?? null,
        desiredVehicleUndecided: needs[0]?.undecided ?? false,
        budgetRange: needs[0]?.budgetRange ?? null,
        currentCar: currentCarText || (
          currentCars[0] ? [currentCars[0].brand, currentCars[0].model].join(" ") : null
        ),
        currentCarBrand: currentCars[0]?.brand ?? null,
        currentCarModel: currentCars[0]?.model ?? null,
        currentCarYear: currentCars[0]?.year ?? null,
        currentCarMileage: currentCars[0]?.mileage ?? null,
        currentCarGeneration: currentCars[0]?.generation ?? null,
        currentCarBodyType: currentCars[0]?.bodyType ?? null,
        currentCarOwnersCount: currentCars[0]?.ownersCount ?? null,
        tradeInPlan: currentCars[0]?.tradeInPlan ?? null,
        commercialBrand,
        commercialModel,
        commercialCarId,
        paymentMethod: enumValue(value["paymentMethod"], paymentMethods, "способ оплаты"),
        comment: comment.trim(),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Проверьте заполненные данные" };
  }
}

type ManagerScope = {
  managerId?: number;
  isAdmin: boolean;
};

type ClientCardFilters = {
  client: string;
  phone: string;
  dateFrom: Date | null;
  dateToExclusive: Date | null;
  managerId: number | null;
  page: number;
  pageSize: number;
};

function getScope(req: Parameters<typeof getManagerPayload>[0]): ManagerScope {
  const payload = getManagerPayload(req) as unknown as Record<string, unknown>;
  return {
    managerId: typeof payload["managerId"] === "number" ? payload["managerId"] : undefined,
    isAdmin: payload["isAdmin"] === true,
  };
}

function normalizeAuditValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeAuditValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalizeAuditValue(item)]),
    );
  }
  return value;
}

function getCardChanges(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  return auditedCardFields.flatMap(field => {
    const oldValue = normalizeAuditValue(previous[field]);
    const newValue = normalizeAuditValue(next[field]);
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field, oldValue, newValue }];
  });
}

function cardBrands(value: {
  needs?: unknown;
  desiredBrand?: unknown;
  commercialBrand?: unknown;
}): string[] {
  const needs = Array.isArray(value.needs) ? value.needs : [];
  const brands = needs
    .map(need => need && typeof need === "object" ? (need as Record<string, unknown>)["brand"] : null)
    .filter((brand): brand is string => typeof brand === "string" && Boolean(brand.trim()));
  if (brands.length === 0 && typeof value.desiredBrand === "string" && value.desiredBrand.trim()) {
    brands.push(value.desiredBrand.trim());
  }
  if (typeof value.commercialBrand === "string" && value.commercialBrand.trim()) {
    brands.push(value.commercialBrand.trim());
  }
  return [...new Set(brands)];
}

function isCarVisibleToManager(
  car: { type: string; brand: string | null },
  assignedBrands: string[],
): boolean {
  // The manager settings screen explicitly defines an empty selection as access to all brands.
  if (assignedBrands.length === 0) return true;
  if (car.type === "used") return assignedBrands.includes("С пробегом");
  const normalizedCarBrand = normalizeManagerQuoteBrand(car.brand ?? "");
  return assignedBrands
    .filter(brand => brand !== "С пробегом")
    .some(brand => normalizeManagerQuoteBrand(brand) === normalizedCarBrand);
}

function parseMoscowDate(value: unknown, exclusiveEnd: boolean): Date | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) return undefined;
  const moscowOffsetMs = 3 * 60 * 60 * 1000;
  const result = new Date(Date.UTC(year, month - 1, day) - moscowOffsetMs);
  if (exclusiveEnd) result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
  return result;
}

function parseClientCardFilters(query: Record<string, unknown>, scope: ManagerScope):
  { data?: ClientCardFilters; error?: string } {
  const dateFrom = parseMoscowDate(query["dateFrom"], false);
  const dateToExclusive = parseMoscowDate(query["dateTo"], true);
  if (dateFrom === undefined || dateToExclusive === undefined) {
    return { error: "Проверьте формат даты" };
  }

  if (dateFrom && dateToExclusive && dateFrom >= dateToExclusive) {
    return { error: "Дата начала периода позже даты окончания" };
  }

  const rawManagerId = scope.isAdmin && query["managerId"] != null && query["managerId"] !== ""
    ? Number(query["managerId"])
    : undefined;
  const validated = ListManagerClientCardsQueryParams.safeParse({
    client: String(query["client"] ?? "").trim().slice(0, 100),
    phone: String(query["phone"] ?? "").trim().slice(0, 40),
    dateFrom: dateFrom ?? undefined,
    dateTo: dateToExclusive ?? undefined,
    managerId: rawManagerId,
    page: query["page"] ?? 1,
    pageSize: query["pageSize"] ?? 25,
  });
  if (!validated.success) return { error: "Проверьте параметры фильтра" };

  return {
    data: {
      client: validated.data.client ?? "",
      phone: validated.data.phone ?? "",
      dateFrom: validated.data.dateFrom ?? null,
      dateToExclusive: validated.data.dateTo ?? null,
      managerId: validated.data.managerId ?? null,
      page: validated.data.page,
      pageSize: validated.data.pageSize,
    },
  };
}

function cardWhere(scope: ManagerScope, filters: ClientCardFilters) {
  const conditions = [];
  if (!scope.isAdmin && scope.managerId) {
    conditions.push(eq(managerClientCardsTable.managerId, scope.managerId));
  } else if (scope.isAdmin && filters.managerId) {
    conditions.push(eq(managerClientCardsTable.managerId, filters.managerId));
  }
  if (filters.client) conditions.push(ilike(managerClientCardsTable.clientName, `%${filters.client}%`));
  if (filters.phone) conditions.push(ilike(managerClientCardsTable.clientPhone, `%${filters.phone}%`));
  if (filters.dateFrom) conditions.push(gte(managerClientCardsTable.createdAt, filters.dateFrom));
  if (filters.dateToExclusive) conditions.push(lt(managerClientCardsTable.createdAt, filters.dateToExclusive));
  return conditions.length ? and(...conditions) : undefined;
}

const cardProjection = {
  id: managerClientCardsTable.id,
  managerId: managerClientCardsTable.managerId,
  managerName: managersTable.name,
  clientName: managerClientCardsTable.clientName,
  clientPhone: managerClientCardsTable.clientPhone,
  clientGender: managerClientCardsTable.clientGender,
  desiredBrand: managerClientCardsTable.desiredBrand,
  desiredModel: managerClientCardsTable.desiredModel,
  desiredVehicleUndecided: managerClientCardsTable.desiredVehicleUndecided,
  budgetRange: managerClientCardsTable.budgetRange,
  currentCar: managerClientCardsTable.currentCar,
  currentCarBrand: managerClientCardsTable.currentCarBrand,
  currentCarModel: managerClientCardsTable.currentCarModel,
  currentCarYear: managerClientCardsTable.currentCarYear,
  currentCarMileage: managerClientCardsTable.currentCarMileage,
  currentCarGeneration: managerClientCardsTable.currentCarGeneration,
  currentCarBodyType: managerClientCardsTable.currentCarBodyType,
  currentCarOwnersCount: managerClientCardsTable.currentCarOwnersCount,
  currentCarSnapshot: managerClientCardsTable.currentCarSnapshot,
  tradeInPlan: managerClientCardsTable.tradeInPlan,
  needs: managerClientCardsTable.needs,
  currentCars: managerClientCardsTable.currentCars,
  commercialBrand: managerClientCardsTable.commercialBrand,
  commercialModel: managerClientCardsTable.commercialModel,
  commercialCarId: managerClientCardsTable.commercialCarId,
  commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
  paymentMethod: managerClientCardsTable.paymentMethod,
  comment: managerClientCardsTable.comment,
  onecDealerManager: managerClientCardsTable.onecDealerManager,
  onecWorksheetStatus: managerClientCardsTable.onecWorksheetStatus,
  onecArchiveReason: managerClientCardsTable.onecArchiveReason,
  onecUpdatedAt: managerClientCardsTable.onecUpdatedAt,
  createdAt: managerClientCardsTable.createdAt,
  updatedAt: managerClientCardsTable.updatedAt,
};

function csvCell(value: unknown): string {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, "");
}

function matchesCatalogVehicle(car: { brand: string | null; model: string | null }, brand: string, model: string): boolean {
  const wantedBrand = normalizeSearchText(brand);
  const wantedModel = normalizeSearchText(model);
  const actualBrand = normalizeSearchText(car.brand ?? "");
  const actualModel = normalizeSearchText(car.model ?? "");
  if ((!wantedBrand && !wantedModel) || (wantedBrand && !actualBrand) || (wantedModel && !actualModel)) return false;
  const brandMatches = !wantedBrand || actualBrand.includes(wantedBrand) || wantedBrand.includes(actualBrand);
  const modelMatches = !wantedModel || actualModel.includes(wantedModel) || wantedModel.includes(actualModel);
  return brandMatches && modelMatches;
}

function isCurrentInventoryCar(car: { type: string; catalogSource: string | null; cmStockState: string | null }): boolean {
  return car.type === "used" || (
    car.type === "new" &&
    car.catalogSource === "cm_business" &&
    car.cmStockState === "in"
  );
}

const inventoryCarProjection = {
  id: carsTable.id,
  externalId: carsTable.externalId,
  type: carsTable.type,
  brand: carsTable.brand,
  model: carsTable.model,
  year: carsTable.year,
  modification: carsTable.modification,
  complectation: carsTable.complectation,
  color: carsTable.color,
  price: carsTable.price,
  imageUrl: carsTable.imageUrl,
  vin: carsTable.vin,
  catalogSource: carsTable.catalogSource,
  cmStockState: carsTable.cmStockState,
};

async function getInventoryCar(id: number) {
  const [car] = await db.select(inventoryCarProjection)
    .from(carsTable)
    .where(eq(carsTable.id, id))
    .limit(1);
  return car ?? null;
}

router.get("/client-cards", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить менеджера" });
    return;
  }

  const parsedFilters = parseClientCardFilters(req.query as Record<string, unknown>, scope);
  if (!parsedFilters.data) {
    res.status(400).json({ ok: false, error: parsedFilters.error });
    return;
  }
  const filters = parsedFilters.data;
  const where = cardWhere(scope, filters);

  try {
    const [totalRow] = await db.select({ total: count() })
      .from(managerClientCardsTable)
      .where(where);
    const cards = await db.select(cardProjection)
      .from(managerClientCardsTable)
      .leftJoin(managersTable, eq(managerClientCardsTable.managerId, managersTable.id))
      .where(where)
      .orderBy(desc(managerClientCardsTable.createdAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize);

    res.json(ListManagerClientCardsResponse.parse({
      ok: true,
      data: {
        items: cards,
        total: totalRow?.total ?? 0,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    }));
  } catch (error) {
    req.log.error({ err: error }, "Manager client card list failed");
    res.status(500).json({ ok: false, error: "Не удалось загрузить рабочие листы" });
  }
});

router.get("/client-cards/managers", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить пользователя" });
    return;
  }
  try {
    if (!scope.isAdmin) {
      const [manager] = await db.select({ id: managersTable.id, name: managersTable.name })
        .from(managersTable)
        .where(eq(managersTable.id, scope.managerId!))
        .limit(1);
      res.json(ListManagerClientCardManagersResponse.parse({ ok: true, data: manager ? [manager] : [] }));
      return;
    }
    const managers = await db.select({ id: managersTable.id, name: managersTable.name })
      .from(managersTable)
      .orderBy(managersTable.name);
    res.json(ListManagerClientCardManagersResponse.parse({ ok: true, data: managers }));
  } catch (error) {
    req.log.error({ err: error }, "Manager client card manager filter failed");
    res.status(500).json({ ok: false, error: "Не удалось загрузить список менеджеров" });
  }
});

router.get("/client-cards/needs/brands", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить менеджера" });
    return;
  }
  try {
    const rows = await db.select({ brand: carsTable.brand, type: carsTable.type })
      .from(carsTable)
      .where(and(
        eq(carsTable.type, "new"),
        eq(carsTable.catalogSource, "cm_business"),
        eq(carsTable.cmStockState, "in"),
        isNotNull(carsTable.brand),
      ));
    let assignedBrands: string[] = [];
    if (!scope.isAdmin) {
      const [manager] = await db.select({ brands: managersTable.brands })
        .from(managersTable)
        .where(eq(managersTable.id, scope.managerId!))
        .limit(1);
      assignedBrands = Array.isArray(manager?.brands) ? manager.brands : [];
    }
    const brands = Array.from(new Set(
      rows
        .filter(row => scope.isAdmin || isCarVisibleToManager(row, assignedBrands))
        .map(row => row.brand)
        .filter((brand): brand is string => Boolean(brand)),
    )).sort((a, b) => a.localeCompare(b, "ru"));
    res.json(ListManagerClientNeedsBrandsResponse.parse({ ok: true, data: brands }));
  } catch (error) {
    req.log.error({ err: error }, "Manager client card need brands failed");
    res.status(500).json({ ok: false, error: "Не удалось загрузить марки" });
  }
});

router.get("/client-cards/needs/models", async (req, res): Promise<void> => {
  const scope = getScope(req);
  const brand = String(req.query["brand"] ?? "").trim().slice(0, 180);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить менеджера" });
    return;
  }
  if (!brand) {
    res.status(400).json({ ok: false, error: "Укажите марку" });
    return;
  }
  try {
    const rows = await db.select({ brand: carsTable.brand, model: carsTable.model, type: carsTable.type })
      .from(carsTable)
      .where(and(
        eq(carsTable.type, "new"),
        eq(carsTable.catalogSource, "cm_business"),
        eq(carsTable.cmStockState, "in"),
        isNotNull(carsTable.model),
      ));
    let assignedBrands: string[] = [];
    if (!scope.isAdmin) {
      const [manager] = await db.select({ brands: managersTable.brands })
        .from(managersTable)
        .where(eq(managersTable.id, scope.managerId!))
        .limit(1);
      assignedBrands = Array.isArray(manager?.brands) ? manager.brands : [];
    }
    const models = Array.from(new Set(
      rows
        .filter(row => row.brand && normalizeManagerQuoteBrand(row.brand) === normalizeManagerQuoteBrand(brand))
        .filter(row => scope.isAdmin || isCarVisibleToManager(row, assignedBrands))
        .map(row => row.model)
        .filter((model): model is string => Boolean(model)),
    )).sort((a, b) => a.localeCompare(b, "ru"));
    res.json(ListManagerClientNeedsModelsResponse.parse({ ok: true, data: models }));
  } catch (error) {
    req.log.error({ err: error }, "Manager client card need models failed");
    res.status(500).json({ ok: false, error: "Не удалось загрузить модели" });
  }
});

router.get("/client-cards/inventory", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить менеджера" });
    return;
  }
  const query = SearchManagerClientCardInventoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ ok: false, error: "Проверьте параметры поиска автомобиля" });
    return;
  }
  const brand = query.data.brand?.trim() ?? "";
  const model = query.data.model?.trim() ?? "";
  const search = query.data.q?.trim() ?? "";
  const vin = query.data.vin?.replace(/\s/g, "") ?? "";
  const type = query.data.type ?? "";
  const hasBrandModelSearch = brand.length >= 2 || model.length >= 2;
  if (!vin && !search && !hasBrandModelSearch) {
    res.status(400).json({ ok: false, error: "Введите минимум два символа марки или модели" });
    return;
  }

  try {
    const stockCondition = or(
      and(
        eq(carsTable.type, "new"),
        eq(carsTable.catalogSource, "cm_business"),
        eq(carsTable.cmStockState, "in"),
      ),
      eq(carsTable.type, "used"),
    )!;
    const conditions = [stockCondition];
    if (type) conditions.push(eq(carsTable.type, type));
    if (vin) conditions.push(ilike(carsTable.vin, `%${vin}%`));
    if (search) {
      conditions.push(or(
        ilike(carsTable.brand, `%${search}%`),
        ilike(carsTable.model, `%${search}%`),
        ilike(carsTable.modification, `%${search}%`),
        ilike(carsTable.complectation, `%${search}%`),
        ilike(carsTable.externalId, `%${search}%`),
        ilike(carsTable.vin, `%${search}%`),
      )!);
    }
    const rows = await db.select({
      id: carsTable.id,
      externalId: carsTable.externalId,
      type: carsTable.type,
      brand: carsTable.brand,
      model: carsTable.model,
      year: carsTable.year,
      modification: carsTable.modification,
      complectation: carsTable.complectation,
      color: carsTable.color,
      price: carsTable.price,
      imageUrl: carsTable.imageUrl,
      vin: carsTable.vin,
      dealer: carsTable.dealer,
      catalogSource: carsTable.catalogSource,
      cmStockState: carsTable.cmStockState,
    }).from(carsTable).where(and(...conditions)).orderBy(desc(carsTable.syncedAt)).limit(1000);
    let assignedBrands: string[] = [];
    if (!scope.isAdmin) {
      const [manager] = await db.select({ brands: managersTable.brands })
        .from(managersTable)
        .where(eq(managersTable.id, scope.managerId!))
        .limit(1);
      assignedBrands = Array.isArray(manager?.brands) ? manager.brands : [];
    }
    const visible = rows
      .filter(row => isCurrentInventoryCar(row))
      .filter(row => scope.isAdmin || isCarVisibleToManager(row, assignedBrands))
      .filter(row => (
        (brand.length < 2 && model.length < 2) ||
        matchesCatalogVehicle(row, brand.length >= 2 ? brand : "", model.length >= 2 ? model : "")
      ))
      .slice(0, 50)
      .map(({ catalogSource: _catalogSource, cmStockState: _cmStockState, ...car }) => car);
    res.json(SearchManagerClientCardInventoryResponse.parse({ ok: true, data: visible }));
  } catch (error) {
    req.log.error({ err: error }, "Manager client card inventory search failed");
    res.status(500).json({ ok: false, error: "Не удалось выполнить поиск автомобиля" });
  }
});

router.get("/client-cards/export.csv", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить пользователя" });
    return;
  }
  const parsedFilters = parseClientCardFilters(
    { ...(req.query as Record<string, unknown>), page: 1, pageSize: 100 },
    scope,
  );
  if (!parsedFilters.data) {
    res.status(400).json({ ok: false, error: parsedFilters.error });
    return;
  }
  try {
    const rows = await db.select(cardProjection)
      .from(managerClientCardsTable)
      .leftJoin(managersTable, eq(managerClientCardsTable.managerId, managersTable.id))
      .where(cardWhere(scope, parsedFilters.data))
      .orderBy(desc(managerClientCardsTable.createdAt));
    const header = [
      "Дата", "Менеджер", "ФИО клиента", "Телефон", "Пол", "Марка интереса",
      "Модель интереса", "Не определился", "Бюджет", "Планируемая дата покупки", "Текущий автомобиль",
      "Марка текущего автомобиля", "Модель текущего автомобиля", "Год текущего автомобиля",
      "Пробег, км", "Поколение", "Тип кузова", "Количество владельцев", "VIN текущего автомобиля",
      "Трейд-ин", "Марка предложения", "Модель предложения",
      "Автомобиль из базы", "Способ оплаты", "Комментарий", "Все потребности", "Все текущие автомобили",
    ];
    const lines = rows.map(card => [
      card.createdAt,
      card.managerName,
      card.clientName,
      card.clientPhone,
      card.clientGender === "male" ? "Мужской" : card.clientGender === "female" ? "Женский" : "",
      card.desiredBrand,
      card.desiredModel,
      card.desiredVehicleUndecided ? "Да" : "Нет",
      card.budgetRange,
      Array.isArray(card.needs) ? (card.needs[0] as Record<string, unknown> | undefined)?.["plannedPurchaseDate"] : "",
      card.currentCar,
      card.currentCarBrand,
      card.currentCarModel,
      card.currentCarYear,
      card.currentCarMileage,
      card.currentCarGeneration,
      card.currentCarBodyType,
      card.currentCarOwnersCount,
      card.currentCarSnapshot && typeof card.currentCarSnapshot === "object"
        ? (card.currentCarSnapshot as Record<string, unknown>)["vin"]
        : "",
      card.tradeInPlan,
      card.commercialBrand,
      card.commercialModel,
      card.commercialCarSnapshot && typeof card.commercialCarSnapshot === "object"
        ? [
            (card.commercialCarSnapshot as Record<string, unknown>)["brand"],
            (card.commercialCarSnapshot as Record<string, unknown>)["model"],
            (card.commercialCarSnapshot as Record<string, unknown>)["year"],
          ].filter(Boolean).join(" ")
        : "",
      card.paymentMethod,
      card.comment,
      (Array.isArray(card.needs) ? card.needs : []).map(needValue => {
        const need = needValue as Record<string, unknown>;
        const vehicle = [need["brand"], need["model"]].filter(Boolean).join(" ") ||
          (need["undecided"] ? "Пока не определился" : "Не указано");
        const purchaseDate = typeof need["plannedPurchaseDate"] === "string"
          ? `; планируемая покупка: ${need["plannedPurchaseDate"]}`
          : "";
        return `${vehicle}; бюджет: ${String(need["budgetRange"] ?? "Не указан")}${purchaseDate}`;
      }).join(" | "),
      (Array.isArray(card.currentCars) ? card.currentCars : []).map(carValue => {
        const car = carValue as Record<string, unknown>;
        return [
          [car["brand"], car["model"], car["year"]].filter(Boolean).join(" "),
          car["mileage"] != null ? `${car["mileage"]} км` : "",
          car["generation"],
          car["bodyType"],
          car["ownersCount"],
          car["tradeInPlan"] ? `Трейд-ин: ${car["tradeInPlan"]}` : "",
        ].filter(Boolean).join(", ");
      }).join(" | "),
    ].map(csvCell).join(","));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"manager-client-cards.csv\"");
    res.send(`\uFEFF${[header.map(csvCell).join(","), ...lines].join("\r\n")}`);
  } catch (error) {
    req.log.error({ err: error }, "Manager client card CSV export failed");
    res.status(500).json({ ok: false, error: "Не удалось сформировать CSV" });
  }
});

router.get("/client-cards/:id", async (req, res): Promise<void> => {
  const scope = getScope(req);
  const id = Number(req.params["id"]);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "Некорректный номер рабочего листа" });
    return;
  }
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить пользователя" });
    return;
  }
  const conditions = [eq(managerClientCardsTable.id, id)];
  if (!scope.isAdmin) conditions.push(eq(managerClientCardsTable.managerId, scope.managerId!));
  try {
    const [card] = await db.select(cardProjection)
      .from(managerClientCardsTable)
      .leftJoin(managersTable, eq(managerClientCardsTable.managerId, managersTable.id))
      .where(and(...conditions))
      .limit(1);
    if (!card) {
      res.status(404).json({ ok: false, error: "Рабочий лист не найден" });
      return;
    }
    const editHistory = await db.select({
      id: managerClientCardHistoryTable.id,
      editorName: managerClientCardHistoryTable.editorName,
      editorRole: managerClientCardHistoryTable.editorRole,
      createdAt: managerClientCardHistoryTable.createdAt,
      changes: managerClientCardHistoryTable.changes,
    })
      .from(managerClientCardHistoryTable)
      .where(eq(managerClientCardHistoryTable.cardId, id))
      .orderBy(desc(managerClientCardHistoryTable.id));
    res.json(GetManagerClientCardResponse.parse({
      ok: true,
      data: { ...card, editHistory },
    }));
  } catch (error) {
    req.log.error({ err: error, id }, "Manager client card details failed");
    res.status(500).json({ ok: false, error: "Не удалось загрузить рабочий лист" });
  }
});

router.put("/client-cards/:id", async (req, res): Promise<void> => {
  const scope = getScope(req);
  const id = Number(req.params["id"]);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "Некорректный номер рабочего листа" });
    return;
  }
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить пользователя" });
    return;
  }

  const parsed = parseCreateClientCardInput(req.body);
  if (!parsed.data) {
    res.status(400).json({ ok: false, error: parsed.error ?? "Проверьте заполненные данные" });
    return;
  }
  const input = parsed.data;

  try {
    const result = await db.transaction(async tx => {
      const cardConditions = [eq(managerClientCardsTable.id, id)];
      if (!scope.isAdmin) cardConditions.push(eq(managerClientCardsTable.managerId, scope.managerId!));
      const [existing] = await tx.select()
        .from(managerClientCardsTable)
        .where(and(...cardConditions))
        .for("update")
        .limit(1);
      if (!existing) return { status: 404 as const, error: "Рабочий лист не найден" };

      let assignedBrands: string[] = [];
      let editorName = "Администратор";
      if (!scope.isAdmin) {
        const [manager] = await tx.select({ name: managersTable.name, brands: managersTable.brands })
          .from(managersTable)
          .where(eq(managersTable.id, scope.managerId!))
          .limit(1);
        assignedBrands = Array.isArray(manager?.brands) ? manager.brands : [];
        editorName = manager?.name || getManagerPayload(req).name || "Менеджер";
      } else {
        const payload = getManagerPayload(req) as unknown as Record<string, unknown>;
        if (typeof payload["login"] === "string" && payload["login"].trim()) {
          editorName = `Администратор (${payload["login"].trim()})`;
        }
      }

      const previousNeeds = Array.isArray(existing.needs) && existing.needs.length > 0
        ? existing.needs
        : [{
            brand: existing.desiredBrand,
            model: existing.desiredModel,
            undecided: existing.desiredVehicleUndecided,
            budgetRange: existing.budgetRange,
            plannedPurchaseDate: null,
          }];
      for (const need of input.needs) {
        if (!need.brand || !need.model) continue;
        const alreadySaved = previousNeeds.some(previous =>
          previous.brand === need.brand && previous.model === need.model,
        );
        if (alreadySaved) continue;

        const [matchingModel] = await tx.select({
          id: carsTable.id,
          brand: carsTable.brand,
          type: carsTable.type,
        })
          .from(carsTable)
          .where(and(
            eq(carsTable.brand, need.brand),
            eq(carsTable.model, need.model),
            eq(carsTable.type, "new"),
            eq(carsTable.catalogSource, "cm_business"),
            eq(carsTable.cmStockState, "in"),
          ))
          .limit(1);
        if (!matchingModel) {
          return {
            status: 400 as const,
            error: `Выберите марку и модель «${need.brand} ${need.model}» из актуального склада CM Expert`,
          };
        }
        if (!scope.isAdmin && !isCarVisibleToManager(matchingModel, assignedBrands)) {
          return { status: 403 as const, error: "У вас нет доступа к выбранной марке" };
        }
      }

      let commercialCarSnapshot: Record<string, unknown> | null = null;
      if (input.commercialCarId && input.commercialCarId === existing.commercialCarId) {
        commercialCarSnapshot = existing.commercialCarSnapshot as Record<string, unknown> | null;
      } else if (input.commercialCarId) {
        const [car] = await tx.select(inventoryCarProjection)
          .from(carsTable)
          .where(eq(carsTable.id, input.commercialCarId))
          .limit(1);
        if (!car) return { status: 400 as const, error: "Выбранный автомобиль больше не найден в базе" };
        if (!isCurrentInventoryCar(car)) {
          return { status: 400 as const, error: "Этот автомобиль больше не числится в актуальной базе" };
        }
        if (!scope.isAdmin && !isCarVisibleToManager(car, assignedBrands)) {
          return { status: 403 as const, error: "У вас нет доступа к выбранному автомобилю" };
        }
        commercialCarSnapshot = { ...car };
      }

      const firstNeed = input.needs[0]!;
      const firstCurrentCar = input.currentCars[0] ?? null;
      const commercialBrand = input.commercialBrand ||
        (commercialCarSnapshot?.["brand"] as string | null | undefined) || null;
      const commercialModel = input.commercialModel ||
        (commercialCarSnapshot?.["model"] as string | null | undefined) || null;
      const values = {
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        clientGender: input.clientGender,
        desiredBrand: firstNeed.brand,
        desiredModel: firstNeed.model,
        desiredVehicleUndecided: firstNeed.undecided,
        budgetRange: firstNeed.budgetRange,
        needs: input.needs,
        currentCar: firstCurrentCar ? [firstCurrentCar.brand, firstCurrentCar.model].join(" ") : null,
        currentCarBrand: firstCurrentCar?.brand ?? null,
        currentCarModel: firstCurrentCar?.model ?? null,
        currentCarYear: firstCurrentCar?.year ?? null,
        currentCarMileage: firstCurrentCar?.mileage ?? null,
        currentCarGeneration: firstCurrentCar?.generation ?? null,
        currentCarBodyType: firstCurrentCar?.bodyType ?? null,
        currentCarOwnersCount: firstCurrentCar?.ownersCount ?? null,
        currentCarSnapshot: firstCurrentCar?.snapshot ?? null,
        currentCars: input.currentCars,
        tradeInPlan: firstCurrentCar?.tradeInPlan ?? null,
        commercialBrand,
        commercialModel,
        commercialCarId: input.commercialCarId,
        commercialCarSnapshot,
        paymentMethod: input.paymentMethod,
        comment: input.comment,
      };
      const changes = getCardChanges(
        existing as unknown as Record<string, unknown>,
        values as unknown as Record<string, unknown>,
      );
      if (changes.length === 0) {
        return { status: 200 as const, id, changed: false, updatedAt: existing.updatedAt };
      }

      const updatedAt = new Date();
      await tx.update(managerClientCardsTable)
        .set({ ...values, updatedAt })
        .where(eq(managerClientCardsTable.id, id));
      await tx.insert(managerClientCardHistoryTable).values({
        cardId: id,
        editorManagerId: scope.managerId ?? null,
        editorName,
        editorRole: scope.isAdmin ? "admin" : "manager",
        changes,
        previousBrands: cardBrands(existing),
        currentBrands: cardBrands(values),
        createdAt: updatedAt,
      });
      return { status: 200 as const, id, changed: true, updatedAt };
    });

    if (result.status !== 200) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({
      ok: true,
      data: {
        id: result.id,
        changed: result.changed,
        updatedAt: result.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    req.log.error({ err: error, id }, "Manager client card update failed");
    res.status(500).json({ ok: false, error: "Не удалось обновить рабочий лист" });
  }
});

router.post("/client-cards", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.managerId) {
    res.status(403).json({ ok: false, error: "Для создания карточки нужен аккаунт менеджера" });
    return;
  }

  const parsed = parseCreateClientCardInput(req.body);
  if (!parsed.data) {
    res.status(400).json({ ok: false, error: parsed.error ?? "Проверьте заполненные данные" });
    return;
  }

  const input = parsed.data;

  try {
    let assignedBrands: string[] = [];
    if (!scope.isAdmin) {
      const [manager] = await db.select({ brands: managersTable.brands })
        .from(managersTable)
        .where(eq(managersTable.id, scope.managerId))
        .limit(1);
      assignedBrands = Array.isArray(manager?.brands) ? manager.brands : [];
    }

    for (const need of input.needs) {
      if (!need.brand || !need.model) continue;
      const [matchingModel] = await db.select({
        id: carsTable.id,
        brand: carsTable.brand,
        type: carsTable.type,
      })
        .from(carsTable)
        .where(and(
          eq(carsTable.brand, need.brand),
          eq(carsTable.model, need.model),
          eq(carsTable.type, "new"),
          eq(carsTable.catalogSource, "cm_business"),
          eq(carsTable.cmStockState, "in"),
        ))
        .limit(1);
      if (!matchingModel) {
        res.status(400).json({
          ok: false,
          error: `Выберите марку и модель «${need.brand} ${need.model}» из актуального склада CM Expert`,
        });
        return;
      }
      if (!scope.isAdmin && !isCarVisibleToManager(matchingModel, assignedBrands)) {
        res.status(403).json({ ok: false, error: "У вас нет доступа к выбранной марке" });
        return;
      }
    }

    const currentCars = input.currentCars;
    const firstCurrentCar = currentCars[0] ?? null;
    const currentCarSnapshot = firstCurrentCar?.snapshot ?? null;
    const currentCar = input.currentCar || (
      firstCurrentCar ? [firstCurrentCar.brand, firstCurrentCar.model].join(" ") : null
    );

    let commercialCarSnapshot: Record<string, unknown> | null = null;
    if (input.commercialCarId) {
      const car = await getInventoryCar(input.commercialCarId);

      if (!car) {
        res.status(400).json({ ok: false, error: "Выбранный автомобиль больше не найден в базе" });
        return;
      }

      if (!isCurrentInventoryCar(car)) {
        res.status(400).json({ ok: false, error: "Этот автомобиль больше не числится в актуальной базе" });
        return;
      }
      if (!scope.isAdmin && !isCarVisibleToManager(car, assignedBrands)) {
        res.status(403).json({ ok: false, error: "У вас нет доступа к выбранному автомобилю" });
        return;
      }

      commercialCarSnapshot = { ...car };
    }

    const commercialBrand = input.commercialBrand || (commercialCarSnapshot?.["brand"] as string | null | undefined) || null;
    const commercialModel = input.commercialModel || (commercialCarSnapshot?.["model"] as string | null | undefined) || null;

    const [created] = await db.insert(managerClientCardsTable).values({
      managerId: scope.managerId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientGender: input.clientGender,
      desiredBrand: input.desiredBrand,
      desiredModel: input.desiredModel,
      desiredVehicleUndecided: input.desiredVehicleUndecided,
      budgetRange: input.budgetRange,
      needs: input.needs,
      currentCar: currentCar || null,
      currentCarBrand: firstCurrentCar?.brand ?? null,
      currentCarModel: firstCurrentCar?.model ?? null,
      currentCarYear: firstCurrentCar?.year ?? null,
      currentCarMileage: firstCurrentCar?.mileage ?? null,
      currentCarGeneration: firstCurrentCar?.generation ?? null,
      currentCarBodyType: firstCurrentCar?.bodyType ?? null,
      currentCarOwnersCount: firstCurrentCar?.ownersCount ?? null,
      currentCarSnapshot,
      currentCars,
      tradeInPlan: firstCurrentCar?.tradeInPlan ?? null,
      commercialBrand,
      commercialModel,
      commercialCarId: input.commercialCarId || null,
      commercialCarSnapshot,
      paymentMethod: input.paymentMethod || null,
      comment: input.comment,
    }).returning({
      id: managerClientCardsTable.id,
      createdAt: managerClientCardsTable.createdAt,
    });

    res.status(201).json({ ok: true, data: created });
  } catch (error) {
    req.log.error({ err: error }, "Manager client card create failed");
    res.status(500).json({ ok: false, error: "Не удалось сохранить рабочий лист" });
  }
});

export default router;
