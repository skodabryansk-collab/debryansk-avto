import { Router } from "express";
import { and, count, desc, eq, gte, ilike, isNotNull, lt, or } from "drizzle-orm";
import {
  carsTable,
  db,
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

type CreateClientCardInput = {
  clientName: string;
  clientPhone: string;
  clientGender: typeof genders[number] | null;
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
  currentCarInventoryId: number | null;
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

    const desiredBrand = text(value["desiredBrand"], "марку автомобиля", 180);
    const desiredModel = text(value["desiredModel"], "модель автомобиля", 180);
    if (Boolean(desiredBrand) !== Boolean(desiredModel)) {
      throw new Error("Выберите и марку, и модель автомобиля");
    }
    if (value["desiredVehicleUndecided"] != null && typeof value["desiredVehicleUndecided"] !== "boolean") {
      throw new Error("Проверьте выбор автомобиля клиента");
    }
    const desiredVehicleUndecided = value["desiredVehicleUndecided"] === true;
    if (desiredVehicleUndecided === Boolean(desiredBrand)) {
      throw new Error("Выберите модель автомобиля или отметьте «Пока не определился»");
    }
    const commercialBrand = text(value["commercialBrand"], "марку предложения", 180);
    const commercialModel = text(value["commercialModel"], "модель предложения", 180);
    if (Boolean(commercialBrand) !== Boolean(commercialModel)) {
      throw new Error("Для предложения укажите и марку, и модель");
    }

    const currentCarBrand = text(value["currentCarBrand"], "марку текущего автомобиля", 120);
    const currentCarModel = text(value["currentCarModel"], "модель текущего автомобиля", 120);
    const currentCarGeneration = text(value["currentCarGeneration"], "поколение", 120);
    const currentCarBodyType = text(value["currentCarBodyType"], "тип кузова", 120);
    const currentCarOwnersCount = enumValue(value["currentCarOwnersCount"], ["1", "2", "3", "4+"] as const, "количество владельцев");
    const tradeInPlan = enumValue(value["tradeInPlan"], tradeInPlans, "трейд-ин");

    let currentCarYear: number | null = null;
    if (value["currentCarYear"] != null && value["currentCarYear"] !== "") {
      const parsedYear = Number(value["currentCarYear"]);
      if (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > 2100) {
        throw new Error("Проверьте год выпуска текущего автомобиля");
      }
      currentCarYear = parsedYear;
    }

    let currentCarMileage: number | null = null;
    if (value["currentCarMileage"] != null && value["currentCarMileage"] !== "") {
      const parsedMileage = Number(value["currentCarMileage"]);
      if (!Number.isInteger(parsedMileage) || parsedMileage < 0 || parsedMileage > 2_000_000) {
        throw new Error("Проверьте пробег текущего автомобиля");
      }
      currentCarMileage = parsedMileage;
    }

    let currentCarInventoryId: number | null = null;
    if (value["currentCarInventoryId"] != null && value["currentCarInventoryId"] !== "") {
      const parsedId = Number(value["currentCarInventoryId"]);
      if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
        throw new Error("Некорректно выбран текущий автомобиль");
      }
      currentCarInventoryId = parsedId;
    }

    const currentCarText = text(value["currentCar"], "текущий автомобиль", 180);
    const hasEnteredCurrentCarData = Boolean(
      currentCarText || currentCarBrand || currentCarModel || currentCarYear != null ||
      currentCarMileage != null || currentCarGeneration || currentCarBodyType ||
      currentCarOwnersCount || tradeInPlan,
    );
    if (hasEnteredCurrentCarData && (
      !currentCarBrand || !currentCarModel || currentCarYear == null || currentCarMileage == null
    )) {
      throw new Error("Для текущего автомобиля заполните марку, модель, год и пробег");
    }

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
        desiredBrand,
        desiredModel,
        desiredVehicleUndecided,
        budgetRange: enumValue(value["budgetRange"], budgetRanges, "бюджет"),
        currentCar: currentCarText,
        currentCarBrand,
        currentCarModel,
        currentCarYear,
        currentCarMileage,
        currentCarGeneration,
        currentCarBodyType,
        currentCarOwnersCount,
        currentCarInventoryId,
        tradeInPlan,
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

function isCarVisibleToManager(
  car: { type: string; brand: string | null },
  assignedBrands: string[],
): boolean {
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
  currentCarInventoryId: managerClientCardsTable.currentCarInventoryId,
  currentCarSnapshot: managerClientCardsTable.currentCarSnapshot,
  tradeInPlan: managerClientCardsTable.tradeInPlan,
  commercialBrand: managerClientCardsTable.commercialBrand,
  commercialModel: managerClientCardsTable.commercialModel,
  commercialCarId: managerClientCardsTable.commercialCarId,
  commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
  paymentMethod: managerClientCardsTable.paymentMethod,
  comment: managerClientCardsTable.comment,
  createdAt: managerClientCardsTable.createdAt,
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
      "Модель интереса", "Не определился", "Бюджет", "Текущий автомобиль",
      "Марка текущего автомобиля", "Модель текущего автомобиля", "Год текущего автомобиля",
      "Пробег, км", "Поколение", "Тип кузова", "Количество владельцев", "VIN текущего автомобиля",
      "Трейд-ин", "Марка предложения", "Модель предложения",
      "Автомобиль из базы", "Способ оплаты", "Комментарий",
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
    res.json(GetManagerClientCardResponse.parse({ ok: true, data: card }));
  } catch (error) {
    req.log.error({ err: error, id }, "Manager client card details failed");
    res.status(500).json({ ok: false, error: "Не удалось загрузить рабочий лист" });
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

    if (input.desiredBrand && input.desiredModel) {
      const [matchingModel] = await db.select({
        id: carsTable.id,
        brand: carsTable.brand,
        type: carsTable.type,
      })
        .from(carsTable)
        .where(and(
          eq(carsTable.brand, input.desiredBrand),
          eq(carsTable.model, input.desiredModel),
          eq(carsTable.type, "new"),
          eq(carsTable.catalogSource, "cm_business"),
          eq(carsTable.cmStockState, "in"),
        ))
        .limit(1);
      if (!matchingModel) {
        res.status(400).json({ ok: false, error: "Выберите марку и модель из актуального склада CM Expert" });
        return;
      }
      if (!scope.isAdmin && !isCarVisibleToManager(matchingModel, assignedBrands)) {
        res.status(403).json({ ok: false, error: "У вас нет доступа к выбранной марке" });
        return;
      }
    }

    let currentCarSnapshot: Record<string, unknown> | null = null;
    let currentCar = input.currentCar;
    let currentCarBrand = input.currentCarBrand;
    let currentCarModel = input.currentCarModel;
    let currentCarYear = input.currentCarYear;
    if (input.currentCarInventoryId) {
      const car = await getInventoryCar(input.currentCarInventoryId);
      if (!car || car.type !== "used" || !isCurrentInventoryCar(car)) {
        res.status(400).json({ ok: false, error: "Выбранный текущий автомобиль больше не найден в базе" });
        return;
      }
      if (!scope.isAdmin && !isCarVisibleToManager(car, assignedBrands)) {
        res.status(403).json({ ok: false, error: "У вас нет доступа к выбранному текущему автомобилю" });
        return;
      }
      currentCarSnapshot = { ...car };
      currentCarBrand = currentCarBrand || car.brand;
      currentCarModel = currentCarModel || car.model;
      currentCar = currentCar || [car.brand, car.model].filter(Boolean).join(" ");
      currentCarYear = currentCarYear || car.year;
    }

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
      desiredBrand: input.desiredBrand || null,
      desiredModel: input.desiredModel || null,
      desiredVehicleUndecided: input.desiredVehicleUndecided,
      budgetRange: input.budgetRange || null,
      currentCar: currentCar || [currentCarBrand, currentCarModel].filter(Boolean).join(" ") || null,
      currentCarBrand: currentCarBrand || null,
      currentCarModel: currentCarModel || null,
      currentCarYear: currentCarYear || null,
      currentCarMileage: input.currentCarMileage,
      currentCarGeneration: input.currentCarGeneration || null,
      currentCarBodyType: input.currentCarBodyType || null,
      currentCarOwnersCount: input.currentCarOwnersCount || null,
      currentCarInventoryId: input.currentCarInventoryId || null,
      currentCarSnapshot,
      tradeInPlan: input.tradeInPlan || null,
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
