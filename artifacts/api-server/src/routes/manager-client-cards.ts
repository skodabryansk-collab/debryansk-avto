import { Router } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  carsTable,
  db,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import { normalizeManagerQuoteBrand } from "../lib/manager-quote-brand";
import { getManagerPayload, requireManager } from "../middlewares/requireManager";

const router = Router();
router.use(requireManager);

const budgetRanges = ["до 2 млн", "2–3 млн", "3–5 млн", "5+ млн"] as const;
const tradeInPlans = ["Да", "Нет", "Пока не решил"] as const;
const paymentMethods = ["Кредит", "Лизинг", "Наличные / Безнал"] as const;

type CreateClientCardInput = {
  clientName: string;
  clientPhone: string;
  desiredBrand: string | null;
  desiredModel: string | null;
  budgetRange: typeof budgetRanges[number] | null;
  currentCar: string | null;
  currentCarYear: number | null;
  tradeInPlan: typeof tradeInPlans[number] | null;
  commercialCarId: number | null;
  paymentMethod: typeof paymentMethods[number] | null;
  comment: string;
};

function parseCreateClientCardInput(body: unknown): { data?: CreateClientCardInput; error?: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Проверьте заполненные данные" };
  }
  const value = body as Record<string, unknown>;
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
    const clientPhone = text(value["clientPhone"], "номер телефона", 40, true)!;
    const phoneDigits = clientPhone.replace(/\D/g, "").length;
    if (phoneDigits < 10 || phoneDigits > 15) throw new Error("Укажите корректный номер телефона");

    const desiredBrand = text(value["desiredBrand"], "марку автомобиля", 180);
    const desiredModel = text(value["desiredModel"], "модель автомобиля", 180);
    if (Boolean(desiredBrand) !== Boolean(desiredModel)) {
      throw new Error("Выберите и марку, и модель автомобиля");
    }

    let currentCarYear: number | null = null;
    if (value["currentCarYear"] != null && value["currentCarYear"] !== "") {
      const parsedYear = Number(value["currentCarYear"]);
      if (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > 2100) {
        throw new Error("Проверьте год выпуска текущего автомобиля");
      }
      currentCarYear = parsedYear;
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
        desiredBrand,
        desiredModel,
        budgetRange: enumValue(value["budgetRange"], budgetRanges, "бюджет"),
        currentCar: text(value["currentCar"], "текущий автомобиль", 180),
        currentCarYear,
        tradeInPlan: enumValue(value["tradeInPlan"], tradeInPlans, "трейд-ин"),
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

router.get("/client-cards", async (req, res): Promise<void> => {
  const scope = getScope(req);
  if (!scope.isAdmin && !scope.managerId) {
    res.status(403).json({ ok: false, error: "Не удалось определить менеджера" });
    return;
  }

  const search = String(req.query["q"] ?? "").trim().slice(0, 100);
  const conditions = [];
  if (!scope.isAdmin && scope.managerId) {
    conditions.push(eq(managerClientCardsTable.managerId, scope.managerId));
  }
  if (search) {
    conditions.push(or(
      ilike(managerClientCardsTable.clientName, `%${search}%`),
      ilike(managerClientCardsTable.clientPhone, `%${search}%`),
    )!);
  }

  try {
    const cards = await db.select({
      id: managerClientCardsTable.id,
      managerId: managerClientCardsTable.managerId,
      managerName: managersTable.name,
      clientName: managerClientCardsTable.clientName,
      clientPhone: managerClientCardsTable.clientPhone,
      desiredBrand: managerClientCardsTable.desiredBrand,
      desiredModel: managerClientCardsTable.desiredModel,
      budgetRange: managerClientCardsTable.budgetRange,
      currentCar: managerClientCardsTable.currentCar,
      currentCarYear: managerClientCardsTable.currentCarYear,
      tradeInPlan: managerClientCardsTable.tradeInPlan,
      commercialCarId: managerClientCardsTable.commercialCarId,
      commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
      paymentMethod: managerClientCardsTable.paymentMethod,
      comment: managerClientCardsTable.comment,
      createdAt: managerClientCardsTable.createdAt,
    })
      .from(managerClientCardsTable)
      .leftJoin(managersTable, eq(managerClientCardsTable.managerId, managersTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(managerClientCardsTable.createdAt))
      .limit(100);

    res.json({ ok: true, data: cards });
  } catch (error) {
    console.error("[manager-client-cards] list failed", error);
    res.status(500).json({ ok: false, error: "Не удалось загрузить рабочие листы" });
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
    if (input.desiredBrand && input.desiredModel) {
      const [matchingModel] = await db.select({ id: carsTable.id })
        .from(carsTable)
        .where(and(
          eq(carsTable.brand, input.desiredBrand),
          eq(carsTable.model, input.desiredModel),
        ))
        .limit(1);
      if (!matchingModel) {
        res.status(400).json({ ok: false, error: "Выберите марку и модель из базы автомобилей" });
        return;
      }
    }

    let commercialCarSnapshot: Record<string, unknown> | null = null;
    if (input.commercialCarId) {
      const [car] = await db.select({
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
      })
        .from(carsTable)
        .where(eq(carsTable.id, input.commercialCarId))
        .limit(1);

      if (!car) {
        res.status(400).json({ ok: false, error: "Выбранный автомобиль больше не найден в базе" });
        return;
      }

      if (!scope.isAdmin) {
        const [manager] = await db.select({ brands: managersTable.brands })
          .from(managersTable)
          .where(eq(managersTable.id, scope.managerId))
          .limit(1);
        const assignedBrands = Array.isArray(manager?.brands) ? manager.brands : [];
        if (!isCarVisibleToManager(car, assignedBrands)) {
          res.status(403).json({ ok: false, error: "У вас нет доступа к выбранному автомобилю" });
          return;
        }
      }

      commercialCarSnapshot = { ...car };
    }

    const [created] = await db.insert(managerClientCardsTable).values({
      managerId: scope.managerId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      desiredBrand: input.desiredBrand || null,
      desiredModel: input.desiredModel || null,
      budgetRange: input.budgetRange || null,
      currentCar: input.currentCar || null,
      currentCarYear: input.currentCarYear || null,
      tradeInPlan: input.tradeInPlan || null,
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
    console.error("[manager-client-cards] create failed", error);
    res.status(500).json({ ok: false, error: "Не удалось сохранить рабочий лист" });
  }
});

export default router;
