import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { asc, eq, gt, max } from "drizzle-orm";
import {
  GetOneCClientCardsInitialCursorResponse,
  GetOneCClientCardsQueryParams,
  GetOneCClientCardsResponse,
} from "@workspace/api-zod";
import {
  brandsTable,
  db,
  locationsTable,
  locationBrandsTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import { normalizeManagerQuoteBrand } from "../lib/manager-quote-brand";

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
  res: Parameters<Parameters<IRouter["get"]>[1]>[1],
  status: 401 | 503,
  error: string,
): void {
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

function getCommercialCarSummary(snapshotValue: unknown, fallbackId: number | null) {
  const snapshot = asRecord(snapshotValue);
  if (!fallbackId && Object.keys(snapshot).length === 0) return null;
  return {
    id: fallbackId ?? asNumber(snapshot["id"]),
    external_id: asString(snapshot["externalId"]) ?? asString(snapshot["external_id"]),
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
    res.json(GetOneCClientCardsInitialCursorResponse.parse({
      ok: true,
      data: {
        after_id: Number(row?.afterId ?? 0),
        as_of: new Date().toISOString(),
      },
    }));
  } catch (error) {
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
    res.status(400).json({ ok: false, error: "invalid_query" } satisfies FeedError);
    return;
  }

  try {
    const { after_id: afterId, limit } = parsedQuery.data;
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
        currentCarInventoryId: managerClientCardsTable.currentCarInventoryId,
        tradeInPlan: managerClientCardsTable.tradeInPlan,
        commercialBrand: managerClientCardsTable.commercialBrand,
        commercialModel: managerClientCardsTable.commercialModel,
        commercialCarId: managerClientCardsTable.commercialCarId,
        commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
        paymentMethod: managerClientCardsTable.paymentMethod,
        comment: managerClientCardsTable.comment,
        createdAt: managerClientCardsTable.createdAt,
      })
      .from(managerClientCardsTable)
      .leftJoin(managersTable, eq(managersTable.id, managerClientCardsTable.managerId))
      .where(gt(managerClientCardsTable.id, afterId))
      .orderBy(asc(managerClientCardsTable.id))
      .limit(limit + 1);

    const hasMore = pageRows.length > limit;
    const cards = pageRows.slice(0, limit);
    const mappings = cards.length ? await getBrandLocationMappings() : [];

    for (const card of cards) {
      const resolvedBrand = card.commercialBrand?.trim() || card.desiredBrand?.trim() || null;
      const problem = getMappingProblem(card.id, resolvedBrand, mappings);
      if (problem) {
        res.status(409).json({
          ok: false,
          error: "mapping_not_ready",
          card_id: problem.cardId,
          missing_fields: problem.missingFields,
        } satisfies FeedError);
        return;
      }
    }

    const items = cards.map(card => {
      const resolvedBrand = card.commercialBrand?.trim() || card.desiredBrand?.trim() || "";
      const matching = mappings.filter(
        mapping => normalizeManagerQuoteBrand(mapping.brandName) === normalizeManagerQuoteBrand(resolvedBrand),
      );
      const locationIds = new Set(matching.flatMap(mapping => mapping.locationId === null ? [] : [mapping.locationId]));
      const mapping = matching.find(item => item.locationId !== null && locationIds.size === 1)!;

      return {
        id: card.id,
        created_at: card.createdAt.toISOString(),
        manager_id: card.managerId,
        manager_name: card.managerName,
        organization_code: mapping.organizationCode!,
        organization_name: mapping.locationTitle!,
        department_code: mapping.departmentCode!,
        department_name: mapping.brandName,
        client_name: card.clientName,
        client_phone: card.clientPhone,
        client_gender: card.clientGender,
        desired_brand: card.desiredBrand,
        desired_model: card.desiredModel,
        desired_vehicle_undecided: card.desiredVehicleUndecided,
        budget_range: card.budgetRange,
        current_car: card.currentCar,
        current_car_brand: card.currentCarBrand,
        current_car_model: card.currentCarModel,
        current_car_year: card.currentCarYear,
        current_car_mileage: card.currentCarMileage,
        current_car_generation: card.currentCarGeneration,
        current_car_body_type: card.currentCarBodyType,
        current_car_owners_count: card.currentCarOwnersCount,
        current_car_inventory_id: card.currentCarInventoryId,
        trade_in_plan: card.tradeInPlan,
        commercial_brand: card.commercialBrand,
        commercial_model: card.commercialModel,
        commercial_car_id: card.commercialCarId,
        commercial_car: getCommercialCarSummary(card.commercialCarSnapshot, card.commercialCarId),
        payment_method: card.paymentMethod,
        comment: card.comment,
      };
    });

    res.json(GetOneCClientCardsResponse.parse({
      ok: true,
      data: {
        items,
        next_cursor: cards.length ? cards[cards.length - 1]!.id : afterId,
        has_more: hasMore,
      },
    }));
  } catch (error) {
    req.log.error({ err: error }, "1C manager client-card feed failed");
    res.status(500).json({ ok: false, error: "internal_error" } satisfies FeedError);
  }
});

export default router;
