import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  brandsTable,
  db,
  locationsTable,
  locationBrandsTable,
  managerClientCardOnecChangesTable,
  managerClientCardOnecWorksheetsTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import { normalizeManagerQuoteBrand } from "./manager-quote-brand";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OneCBrandLocationMapping = {
  brandId: number;
  brandName: string;
  departmentCode: string | null;
  departmentCodeConfirmed: boolean;
  locationId: number | null;
  locationTitle: string | null;
  organizationCode: string | null;
  organizationCodeConfirmed: boolean | null;
};

type OneCNeed = {
  brand: string | null;
  model: string | null;
  undecided: boolean;
  budgetRange: string | null;
  plannedPurchaseDate: string | null;
};

type OneCCardRow = {
  id: number;
  managerId: number;
  managerName: string | null;
  clientName: string;
  clientPhone: string;
  clientGender: string | null;
  desiredBrand: string | null;
  desiredModel: string | null;
  desiredVehicleUndecided: boolean;
  budgetRange: string | null;
  needs: unknown;
  currentCars: unknown;
  commercialBrand: string | null;
  commercialModel: string | null;
  commercialCarId: number | null;
  commercialCarSnapshot: unknown;
  paymentMethod: string | null;
  comment: string | null;
  createdAt: Date;
  onecDealerManager: string | null;
  onecWorksheetStatus: string | null;
  onecArchiveReason: string | null;
  onecUpdatedAt: Date | null;
};

type OneCDivisionNeed = {
  brand: string | null;
  model: string | null;
  undecided: boolean;
  budget_range: string | null;
  planned_purchase_date: string | null;
  organization_code: string | null;
  department_code: string | null;
};

type OneCDivisionOffer = {
  brand: string | null;
  model: string | null;
  car_vin: string | null;
  car: Record<string, unknown> | null;
  organization_code: string | null;
  department_code: string | null;
};

type OneCDivisionGroup = {
  sourceKey: string;
  organizationCode: string;
  departmentCode: string;
  brandNames: string[];
  needs: OneCDivisionNeed[];
  commercialOffer: OneCDivisionOffer | null;
};

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

function needsForCard(card: OneCCardRow): OneCNeed[] {
  if (Array.isArray(card.needs) && card.needs.length > 0) {
    return card.needs.map(raw => {
      const need = asRecord(raw);
      return {
        brand: asString(need["brand"]),
        model: asString(need["model"]),
        undecided: need["undecided"] === true,
        budgetRange: asString(need["budgetRange"]),
        plannedPurchaseDate: asString(need["plannedPurchaseDate"]),
      };
    });
  }
  return [{
    brand: card.desiredBrand,
    model: card.desiredModel,
    undecided: card.desiredVehicleUndecided,
    budgetRange: card.budgetRange,
    plannedPurchaseDate: null,
  }];
}

function mappingForBrand(brandName: string | null, mappings: OneCBrandLocationMapping[]) {
  if (!brandName) return { mapping: null, missingFields: ["department_code", "organization_code"] };
  const matching = mappings.filter(
    mapping => normalizeManagerQuoteBrand(mapping.brandName) === normalizeManagerQuoteBrand(brandName),
  );
  if (matching.length === 0) {
    return { mapping: null, missingFields: ["department_code", "organization_mapping"] };
  }

  const mappedLocations = new Map<number, OneCBrandLocationMapping>();
  for (const mapping of matching) {
    if (mapping.locationId !== null) mappedLocations.set(mapping.locationId, mapping);
  }
  if (mappedLocations.size !== 1) {
    return { mapping: null, missingFields: ["organization_mapping"] };
  }

  const mapping = [...mappedLocations.values()][0]!;
  const missingFields: string[] = [];
  if (!mapping.departmentCode || !mapping.departmentCodeConfirmed || mapping.departmentCode.startsWith("TMP1C-")) {
    missingFields.push("department_code");
  }
  if (
    !mapping.organizationCode ||
    !mapping.organizationCodeConfirmed ||
    mapping.organizationCode.startsWith("TMP1C-")
  ) {
    missingFields.push("organization_code");
  }
  return missingFields.length ? { mapping: null, missingFields } : { mapping, missingFields: [] };
}

function oneCDivisionSourceKey(cardId: number, organizationCode: string, departmentCode: string): string {
  const divisionKey = Buffer.from(`${organizationCode}\u001f${departmentCode}`, "utf8").toString("hex");
  return `${cardId}:division:${divisionKey}`;
}

function commercialCarSummary(value: unknown): Record<string, unknown> | null {
  const snapshot = asRecord(value);
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

function resolveDivisionGroups(card: OneCCardRow, mappings: OneCBrandLocationMapping[]) {
  const groups = new Map<string, OneCDivisionGroup>();
  const missingFields = new Set<string>();
  const needs = needsForCard(card);
  const targetBrands = new Set(needs.map(need => need.brand).filter((brand): brand is string => Boolean(brand)));
  if (card.commercialBrand?.trim()) targetBrands.add(card.commercialBrand.trim());
  if (targetBrands.size === 0) {
    missingFields.add("department_code");
    missingFields.add("organization_code");
  }

  const groupFor = (brandName: string | null): OneCDivisionGroup | null => {
    const resolved = mappingForBrand(brandName, mappings);
    if (!resolved.mapping) {
      for (const field of resolved.missingFields) missingFields.add(field);
      return null;
    }
    const mapping = resolved.mapping;
    const organizationCode = mapping.organizationCode!;
    const departmentCode = mapping.departmentCode!;
    const key = `${organizationCode}\u001f${departmentCode}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        sourceKey: oneCDivisionSourceKey(card.id, organizationCode, departmentCode),
        organizationCode,
        departmentCode,
        brandNames: [],
        needs: [],
        commercialOffer: null,
      };
      groups.set(key, group);
    }
    if (!group.brandNames.includes(mapping.brandName)) group.brandNames.push(mapping.brandName);
    return group;
  };

  needs.forEach(need => {
    const group = need.brand ? groupFor(need.brand) : null;
    const mapping = need.brand ? mappingForBrand(need.brand, mappings).mapping : null;
    const value: OneCDivisionNeed = {
      brand: need.brand,
      model: need.model,
      undecided: need.undecided,
      budget_range: need.budgetRange,
      planned_purchase_date: need.plannedPurchaseDate,
      organization_code: mapping?.organizationCode ?? null,
      department_code: mapping?.departmentCode ?? null,
    };
    if (group) group.needs.push(value);
  });

  let commercialOffer: OneCDivisionOffer | null = null;
  if (card.commercialBrand || card.commercialModel || card.commercialCarId) {
    const group = card.commercialBrand ? groupFor(card.commercialBrand) : null;
    const resolved = card.commercialBrand ? mappingForBrand(card.commercialBrand, mappings).mapping : null;
    const snapshot = asRecord(card.commercialCarSnapshot);
    const vin = asString(snapshot["vin"]);
    commercialOffer = {
      brand: card.commercialBrand,
      model: card.commercialModel,
      car_vin: vin,
      car: commercialCarSummary(card.commercialCarSnapshot),
      organization_code: resolved?.organizationCode ?? null,
      department_code: resolved?.departmentCode ?? null,
    };
    if (group) group.commercialOffer = commercialOffer;
  }

  return {
    groups: [...groups.values()].map(group => ({
      ...group,
      brandNames: group.brandNames.sort((a, b) => a.localeCompare(b, "ru")),
    })),
    missingFields: [...missingFields],
  };
}

async function getMappings(tx: DbTransaction): Promise<OneCBrandLocationMapping[]> {
  const rows = await tx.select({
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

function contentHash(card: OneCCardRow, group: OneCDivisionGroup): string {
  const payload = {
    created_at: card.createdAt.toISOString(),
    manager_id: card.managerId,
    manager_name: card.managerName,
    client_name: card.clientName,
    client_phone: card.clientPhone,
    client_gender: card.clientGender,
    brand_names: group.brandNames,
    needs: group.needs,
    current_cars: card.currentCars,
    commercial_offer: group.commercialOffer,
    payment_method: card.paymentMethod,
    comment: card.comment,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function syncOneCClientCardWorksheets(
  tx: DbTransaction,
  cardId: number,
  mappings?: OneCBrandLocationMapping[],
): Promise<void> {
  const [card] = await tx.select({
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
    needs: managerClientCardsTable.needs,
    currentCars: managerClientCardsTable.currentCars,
    commercialBrand: managerClientCardsTable.commercialBrand,
    commercialModel: managerClientCardsTable.commercialModel,
    commercialCarId: managerClientCardsTable.commercialCarId,
    commercialCarSnapshot: managerClientCardsTable.commercialCarSnapshot,
    paymentMethod: managerClientCardsTable.paymentMethod,
    comment: managerClientCardsTable.comment,
    createdAt: managerClientCardsTable.createdAt,
    onecDealerManager: managerClientCardsTable.onecDealerManager,
    onecWorksheetStatus: managerClientCardsTable.onecWorksheetStatus,
    onecArchiveReason: managerClientCardsTable.onecArchiveReason,
    onecUpdatedAt: managerClientCardsTable.onecUpdatedAt,
  })
    .from(managerClientCardsTable)
    .leftJoin(managersTable, eq(managersTable.id, managerClientCardsTable.managerId))
    .where(eq(managerClientCardsTable.id, cardId))
    .limit(1);

  if (!card) return;
  const resolvedMappings = mappings ?? await getMappings(tx);
  const resolution = resolveDivisionGroups(card, resolvedMappings);
  const existing = await tx.select()
    .from(managerClientCardOnecWorksheetsTable)
    .where(eq(managerClientCardOnecWorksheetsTable.cardId, cardId))
    .for("update");
  const existingBySourceKey = new Map(existing.map(row => [row.sourceKey, row]));
  const desiredSourceKeys = new Set<string>();

  for (const group of resolution.groups) {
    desiredSourceKeys.add(group.sourceKey);
    const hash = contentHash(card, group);
    const previous = existingBySourceKey.get(group.sourceKey);
    if (!previous) {
      const [created] = await tx.insert(managerClientCardOnecWorksheetsTable).values({
        cardId,
        sourceKey: group.sourceKey,
        organizationCode: group.organizationCode,
        departmentCode: group.departmentCode,
        brandNames: group.brandNames,
        contentHash: hash,
        isActive: true,
        dealerManager: card.onecDealerManager,
        worksheetStatus: card.onecWorksheetStatus,
        archiveReason: card.onecArchiveReason,
        onecUpdatedAt: card.onecUpdatedAt,
      }).returning({ id: managerClientCardOnecWorksheetsTable.id });
      if (created) {
        await tx.insert(managerClientCardOnecChangesTable).values({
          worksheetId: created.id,
          action: "upsert",
        });
      }
      continue;
    }

    const groupChanged = previous.contentHash !== hash ||
      JSON.stringify(previous.brandNames) !== JSON.stringify(group.brandNames);
    const wasInactive = !previous.isActive;
    if (groupChanged || wasInactive) {
      await tx.update(managerClientCardOnecWorksheetsTable)
        .set({
          brandNames: group.brandNames,
          contentHash: hash,
          isActive: true,
          ...(wasInactive ? {
            dealerManager: null,
            worksheetStatus: null,
            archiveReason: null,
            onecUpdatedAt: null,
          } : {}),
          updatedAt: new Date(),
        })
        .where(eq(managerClientCardOnecWorksheetsTable.id, previous.id));
      await tx.insert(managerClientCardOnecChangesTable).values({
        worksheetId: previous.id,
        action: "upsert",
      });
    }
  }

  for (const worksheet of existing) {
    if (!worksheet.isActive || desiredSourceKeys.has(worksheet.sourceKey)) continue;
    await tx.update(managerClientCardOnecWorksheetsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(managerClientCardOnecWorksheetsTable.id, worksheet.id));
    await tx.insert(managerClientCardOnecChangesTable).values({
      worksheetId: worksheet.id,
      action: "delete",
    });
  }

  await tx.update(managerClientCardsTable)
    .set({ onecSyncPending: resolution.missingFields.length > 0 })
    .where(eq(managerClientCardsTable.id, cardId));
}

export async function syncAllOneCClientCardWorksheets(tx: DbTransaction): Promise<void> {
  const mappings = await getMappings(tx);
  const cards = await tx.select({ id: managerClientCardsTable.id })
    .from(managerClientCardsTable)
    .orderBy(managerClientCardsTable.id);
  for (const card of cards) {
    await syncOneCClientCardWorksheets(tx, card.id, mappings);
  }
}
