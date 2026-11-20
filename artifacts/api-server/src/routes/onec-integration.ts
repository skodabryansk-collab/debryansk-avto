import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { asc, eq, gt, max } from "drizzle-orm";
import {
  GetOneCClientCardsInitialCursorResponse,
  GetOneCClientCardsQueryParams,
  GetOneCClientCardsResponse,
} from "@workspace/api-zod";
import {
  brandsTable,
  carsTable,
  db,
  locationsTable,
  locationBrandsTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import { normalizeManagerQuoteBrand } from "../lib/manager-quote-brand";
import { recordOneCExchangeLog } from "../lib/onec-exchange-log";

const router: IRouter = Router();

type FeedError = {
  ok: false;
  error: string;
  card_id?: number;
  missing_fields?: string[];
};

type MappingRow = {
  brandId: number;
  brandName: string;
  departmentCode: string | null;
  departmentCodeConfirmed: boolean;
  locationId: number | null;
  locationTitle: string | null;
  organizationCode: string | null;
  organizationCodeConfirmed: boolean | null;
};

type OneCRequestAudit = {
  afterId?: number | null;
  nextCursor?: number | null;
  itemCount?: number;
  hasMore?: boolean | null;
  errorCode?: string | null;
};

function setOneCRequestAudit(res: Response, audit: OneCRequestAudit): void {
  const current = ((res.locals as Record<string, unknown>)["onecRequestAudit"] ?? {}) as OneCRequestAudit;
  (res.locals as Record<string, unknown>)["onecRequestAudit"] = { ...current, ...audit };
}

router.use((req: Request, res: Response, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const audit = ((res.locals as Record<string, unknown>)["onecRequestAudit"] ?? {}) as OneCRequestAudit;
    const requestId = (req as Request & { id?: string | number }).id;
    recordOneCExchangeLog({
      eventType: "api_request",
      endpoint: req.path,
      method: req.method,
      httpStatus: res.statusCode,
      outcome: res.statusCode < 400 ? "success" : "error",
      afterId: audit.afterId ?? null,
      nextCursor: audit.nextCursor ?? null,
      itemCount: audit.itemCount ?? 0,
      hasMore: audit.hasMore ?? null,
      durationMs: Math.max(0, Date.now() - startedAt),
      errorCode: audit.errorCode ?? null,
      requestId: requestId == null ? null : String(requestId),
      entityType: null,
      entityId: null,
      entityName: null,
      previousCode: null,
      newCode: null,
      actorLogin: null,
    }).catch(error => req.log.error({ err: error }, "1C exchange journal write failed"));
  });
  next();
});

function isTokenMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

function hasValidToken(authorization: string | undefined): "not_configured" | "invalid" | "valid" {
  if (process.env["NODE_ENV"] !== "production") return "not_configured";
  const expected = process.env["ONEC_CLIENT_CARDS_TOKEN"]?.trim();
  if (!expected) return "not_configured";
  const provided = getBearerToken(authorization);
  if (!provided || !isTokenMatch(provided, expected)) return "invalid";
  return "valid";
}

function sendTokenError(
  res: Response,
  status: 401 | 503,
  error: string,
): void {
  setOneCRequestAudit(res, { errorCode: error });
  res.status(status).json({ ok: false, error } satisfies FeedError);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/\s/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function brandKeyForSource(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "") || "brand";
}

function getCommercialCarSummary(snapshotValue: unknown) {
  const snapshot = asRecord(snapshotValue);
  if (Object.keys(snapshot).length === 0) return null;
  return {
    vin: asString(snapshot["vin"]),
    brand: asString(snapshot["brand"]),
    model: asString(snapshot["model"]),
    year: asNumber(snapshot["year"]),
    modification: asString(snapshot["modification"]),
    complectation: asString(snapshot["complectation"]),
    color: asString(snapshot["color"]),
    price: asNumber(snapshot["price"]),
  };
}

async function getBrandLocationMappings(): Promise<MappingRow[]> {
  const rows = await db
    .select({
      brandId: brandsTable.id,
      brandName: brandsTable.name,
      departmentCode: brandsTable.onecDepartmentCode,
      departmentCodeConfirmed: brandsTable.onecDepartmentCodeConfirmed,
      locationId: locationsTable.id,
      locationTitle: locationsTable.title,
      organizationCode: locationsTable.onecOrganizationCode,
      organizationCodeConfirmed: locationsTable.onecOrganizationCodeConfirmed,
    })
    .from(brandsTable)
    .leftJoin(locationBrandsTable, eq(locationBrandsTable.brandId, brandsTable.id))
    .leftJoin(locationsTable, eq(locationsTable.id, locationBrandsTable.locationId))
    .orderBy(asc(brandsTable.id), asc(locationsTable.id));

  return rows.map(row => ({
    ...row,
    departmentCodeConfirmed: row.departmentCodeConfirmed ?? false,
    organizationCodeConfirmed: row.organizationCodeConfirmed,
  }));
}

function getMappingProblem(cardId: number, brandName: string | null, mappings: MappingRow[]) {
  if (!brandName) {
    return { cardId, missingFields: ["department_code", "organization_code"] };
  }

  const matchingBrands = mappings.filter(
    mapping => normalizeManagerQuoteBrand(mapping.brandName) === normalizeManagerQuoteBrand(brandName),
  );
  const locations = matchingBrands.filter(mapping => mapping.locationId !== null);
  const distinctLocations = new Map<number, MappingRow>();
  for (const mapping of locations) {
    if (mapping.locationId !== null) distinctLocations.set(mapping.locationId, mapping);
  }

  if (matchingBrands.length === 0) {
    return { cardId, missingFields: ["department_code", "organization_mapping"] };
  }
  if (distinctLocations.size !== 1) {
    return { cardId, missingFields: ["organization_mapping"] };
  }

  const mapping = [...distinctLocations.values()][0]!;
  const missingFields: string[] = [];
  if (
    !mapping.departmentCode
    || !mapping.departmentCodeConfirmed
    || mapping.departmentCode.startsWith("TMP1C-")
  ) {
    missingFields.push("department_code");
  }
  if (
    !mapping.organizationCode
    || !mapping.organizationCodeConfirmed
    || mapping.organizationCode.startsWith("TMP1C-")
  ) {
    missingFields.push("organization_code");
  }
  return missingFields.length ? { cardId, missingFields } : null;
}

router.get("/client-cards/initial-cursor", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Authorization");

  const tokenStatus = hasValidToken(req.get("authorization"));
  if (tokenStatus === "not_configured") {
    sendTokenError(res, 503, "integration_not_configured");
    return;
  }
  if (tokenStatus === "invalid") {
    sendTokenError(res, 401, "unauthorized");
    return;
  }

  try {
    const [row] = await db
      .select({ afterId: max(managerClientCardsTable.id) })
      .from(managerClientCardsTable);
    const afterId = Number(row?.afterId ?? 0);
    setOneCRequestAudit(res, { nextCursor: afterId, hasMore: false });
    res.json(GetOneCClientCardsInitialCursorResponse.parse({
      ok: true,
      data: {
        after_id: afterId,
        as_of: new Date().toISOString(),
      },
    }));
  } catch (error) {
    setOneCRequestAudit(res, { errorCode: "internal_error" });
    req.log.error({ err: error }, "1C initial client-card cursor failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

router.get("/client-cards", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Authorization");

  const tokenStatus = hasValidToken(req.get("authorization"));
  if (tokenStatus === "not_configured") {
    sendTokenError(res, 503, "integration_not_configured");
    return;
  }
  if (tokenStatus === "invalid") {
    sendTokenError(res, 401, "unauthorized");
    return;
  }

  const parsedQuery = GetOneCClientCardsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    setOneCRequestAudit(res, { errorCode: "invalid_query" });
    res.status(400).json({ ok: false, error: "invalid_query" } satisfies FeedError);
    return;
  }

  try {
    const { after_id: afterId, limit } = parsedQuery.data;
    setOneCRequestAudit(res, { afterId });
    const pageRows = await db
      .select({
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
        tradeInPlan: managerClientCardsTable.tradeInPlan,
        needs: managerClientCardsTable.needs,
        currentCars: managerClientCardsTable.currentCars,
        commercialBrand: managerClientCardsTable.commercialBrand,
        commercialModel: managerClientCardsTable.commercialModel,
        commercialCarId: managerClientCardsTable.commercialCarId,
        commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
        paymentMethod: managerClientCardsTable.paymentMethod,
        comment: managerClientCardsTable.comment,
        createdAt: managerClientCardsTable.createdAt,
        commercialCarVin: carsTable.vin,
      })
      .from(managerClientCardsTable)
      .leftJoin(managersTable, eq(managersTable.id, managerClientCardsTable.managerId))
      .leftJoin(carsTable, eq(carsTable.id, managerClientCardsTable.commercialCarId))
      .where(gt(managerClientCardsTable.id, afterId))
      .orderBy(asc(managerClientCardsTable.id))
      .limit(limit + 1);

    const hasMore = pageRows.length > limit;
    const cards = pageRows.slice(0, limit);
    const mappings = cards.length ? await getBrandLocationMappings() : [];

    const needsForCard = (card: (typeof cards)[number]) => {
      if (Array.isArray(card.needs) && card.needs.length > 0) return card.needs.map(asRecord);
      return [{
        brand: card.desiredBrand,
        model: card.desiredModel,
        undecided: card.desiredVehicleUndecided,
        budgetRange: card.budgetRange,
        plannedPurchaseDate: null,
      }];
    };
    const currentCarsForCard = (card: (typeof cards)[number]) => {
      if (Array.isArray(card.currentCars) && card.currentCars.length > 0) return card.currentCars.map(asRecord);
      if (!card.currentCarBrand && !card.currentCarModel && card.currentCarYear == null && card.currentCarMileage == null) return [];
      return [{
        brand: card.currentCarBrand,
        model: card.currentCarModel,
        year: card.currentCarYear,
        mileage: card.currentCarMileage,
        generation: card.currentCarGeneration,
        bodyType: card.currentCarBodyType,
        ownersCount: card.currentCarOwnersCount,
        tradeInPlan: card.tradeInPlan,
      }];
    };
    const findMapping = (brandName: string | null) => {
      if (!brandName) return null;
      const matching = mappings.filter(
        mapping => normalizeManagerQuoteBrand(mapping.brandName) === normalizeManagerQuoteBrand(brandName),
      );
      const locationIds = new Set(matching.flatMap(mapping => mapping.locationId === null ? [] : [mapping.locationId]));
      return matching.find(item => item.locationId !== null && locationIds.size === 1) ?? null;
    };

    for (const card of cards) {
      const needs = needsForCard(card);
      const targetBrands = new Map<string, string>();
      for (const need of needs) {
        const brand = asString(need["brand"]);
        if (brand) targetBrands.set(normalizeManagerQuoteBrand(brand), brand);
      }
      if (card.commercialBrand?.trim()) {
        const brand = card.commercialBrand.trim();
        targetBrands.set(normalizeManagerQuoteBrand(brand), brand);
      }
      if (targetBrands.size === 0) {
        setOneCRequestAudit(res, { afterId, errorCode: "mapping_not_ready" });
        res.status(409).json({
          ok: false,
          error: "mapping_not_ready",
          card_id: card.id,
          missing_fields: ["department_code", "organization_code"],
        } satisfies FeedError);
        return;
      }
      for (const brand of targetBrands.values()) {
        const problem = getMappingProblem(card.id, brand, mappings);
        if (problem) {
          setOneCRequestAudit(res, { afterId, errorCode: "mapping_not_ready" });
          res.status(409).json({
            ok: false,
            error: "mapping_not_ready",
            card_id: problem.cardId,
            missing_fields: problem.missingFields,
          } satisfies FeedError);
          return;
        }
      }
    }

    const items = cards.map(card => {
      const needs = needsForCard(card);
      const currentCars = currentCarsForCard(card);
      const mappedNeeds = needs.map(need => {
        const brand = asString(need["brand"]);
        const mapping = findMapping(brand);
        return {
          brand,
          model: asString(need["model"]),
          undecided: need["undecided"] === true,
          budget_range: asString(need["budgetRange"]),
          planned_purchase_date: asString(need["plannedPurchaseDate"]),
          organization_code: mapping?.organizationCode ?? null,
          department_code: mapping?.departmentCode ?? null,
        };
      });
      const offerMapping = findMapping(card.commercialBrand);
      const commercialCarSnapshot = asRecord(card.commercialCarSnapshot);
      const commercialCarVin = asString(card.commercialCarVin) ?? asString(commercialCarSnapshot["vin"]);
      const commercialOffer = card.commercialBrand || card.commercialModel || card.commercialCarId
        ? {
            brand: card.commercialBrand,
            model: card.commercialModel,
            car_vin: commercialCarVin,
            car: getCommercialCarSummary(card.commercialCarSnapshot),
            organization_code: offerMapping?.organizationCode ?? null,
            department_code: offerMapping?.departmentCode ?? null,
          }
        : null;
      const recordsByBrand = new Map<number, {
        source_key: string;
        brand_name: string;
        organization_code: string;
        department_code: string;
        needs: typeof mappedNeeds;
        commercial_offer: typeof commercialOffer;
      }>();
      const addBrandRecord = (mapping: MappingRow | null) => {
        if (!mapping?.locationId || !mapping.organizationCode || !mapping.locationTitle || !mapping.departmentCode) return;
        if (!recordsByBrand.has(mapping.brandId)) {
          recordsByBrand.set(mapping.brandId, {
            source_key: `${card.id}:${brandKeyForSource(mapping.brandName)}`,
            brand_name: mapping.brandName,
            organization_code: mapping.organizationCode,
            department_code: mapping.departmentCode,
            needs: [],
            commercial_offer: null,
          });
        }
        return recordsByBrand.get(mapping.brandId)!;
      };
      for (const need of mappedNeeds) {
        const group = addBrandRecord(findMapping(need.brand));
        if (group) group.needs.push(need);
      }
      if (commercialOffer && offerMapping) {
        const group = addBrandRecord(offerMapping);
        if (group) group.commercial_offer = commercialOffer;
      }
      const brandRecords = [...recordsByBrand.values()];
      const primaryRecord = brandRecords[0];
      const firstNeed = mappedNeeds[0];
      const firstCar = currentCars[0] ?? {};
      const currentCarName = [asString(firstCar["brand"]), asString(firstCar["model"])].filter(Boolean).join(" ") || null;

      return {
        id: card.id,
        created_at: card.createdAt.toISOString(),
        manager_id: card.managerId,
        manager_name: card.managerName,
        organization_code: primaryRecord?.organization_code ?? "",
        department_code: primaryRecord?.department_code ?? "",
        client_name: card.clientName,
        client_phone: card.clientPhone,
        client_gender: card.clientGender,
        desired_brand: firstNeed?.brand ?? null,
        desired_model: firstNeed?.model ?? null,
        desired_vehicle_undecided: firstNeed?.undecided ?? false,
        budget_range: firstNeed?.budget_range ?? null,
        current_car: currentCarName,
        current_car_brand: asString(firstCar["brand"]),
        current_car_model: asString(firstCar["model"]),
        current_car_year: asNumber(firstCar["year"]),
        current_car_mileage: asNumber(firstCar["mileage"]),
        current_car_generation: asString(firstCar["generation"]),
        current_car_body_type: asString(firstCar["bodyType"]),
        current_car_owners_count: asString(firstCar["ownersCount"]),
        trade_in_plan: asString(firstCar["tradeInPlan"]),
        commercial_brand: card.commercialBrand,
        commercial_model: card.commercialModel,
        commercial_car_vin: commercialCarVin,
        commercial_car: getCommercialCarSummary(card.commercialCarSnapshot),
        needs: mappedNeeds,
        current_cars: currentCars.map(car => ({
          brand: asString(car["brand"]) ?? "",
          model: asString(car["model"]) ?? "",
          year: asNumber(car["year"]) ?? 0,
          mileage: asNumber(car["mileage"]) ?? 0,
          generation: asString(car["generation"]),
          body_type: asString(car["bodyType"]),
          owners_count: asString(car["ownersCount"]),
          trade_in_plan: asString(car["tradeInPlan"]),
        })),
        commercial_offer: commercialOffer,
        brand_records: brandRecords,
        payment_method: card.paymentMethod,
        comment: card.comment,
      };
    });

    const nextCursor = cards.length ? cards[cards.length - 1]!.id : afterId;
    setOneCRequestAudit(res, {
      afterId,
      nextCursor,
      itemCount: items.length,
      hasMore,
    });
    res.json(GetOneCClientCardsResponse.parse({
      ok: true,
      data: {
        items,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    }));
  } catch (error) {
    setOneCRequestAudit(res, { errorCode: "internal_error" });
    req.log.error({ err: error }, "1C manager client-card feed failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

export default router;
