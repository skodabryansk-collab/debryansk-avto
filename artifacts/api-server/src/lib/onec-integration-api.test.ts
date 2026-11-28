import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  brandsTable,
  carsTable,
  db,
  locationsTable,
  locationBrandsTable,
  managerClientCardHistoryTable,
  managerClientCardOnecWorksheetsTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import oneCIntegrationRouter from "../routes/onec-integration";
import oneCIntegrationV2Router from "../routes/onec-integration-v2";
import { syncOneCClientCardWorksheets } from "./onec-client-card-divisions";

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use("/api/integrations/1c/v1", oneCIntegrationRouter);
  app.use("/api/integrations/1c/v2", oneCIntegrationV2Router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

test("1C client-card feed uses its own bearer token and blocks provisional codes", async () => {
  const previousToken = process.env["ONEC_CLIENT_CARDS_TOKEN"];
  const previousNodeEnv = process.env["NODE_ENV"];
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const managerLogin = `onec-feed-test-${suffix}`;
  let managerId: number | undefined;
  let cardId: number | undefined;
  let commercialCarId: number | undefined;
  let brandId: number | undefined;
  let locationId: number | undefined;
  let jetourBrandId: number | undefined;
  let jetourLocationId: number | undefined;
  let originalDepartmentCode: string | null | undefined;
  let originalDepartmentCodeConfirmed: boolean | undefined;
  let originalOrganizationCode: string | null | undefined;
  let originalOrganizationCodeConfirmed: boolean | undefined;
  let originalJetourDepartmentCode: string | null | undefined;
  let originalJetourDepartmentCodeConfirmed: boolean | undefined;
  let originalJetourOrganizationCode: string | null | undefined;
  let originalJetourOrganizationCodeConfirmed: boolean | undefined;
  let server: Server | undefined;

  try {
    delete process.env["ONEC_CLIENT_CARDS_TOKEN"];
    process.env["NODE_ENV"] = "production";
    const started = await startServer();
    server = started.server;

    const unconfigured = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards/initial-cursor`);
    assert.equal(unconfigured.status, 503);

    process.env["ONEC_CLIENT_CARDS_TOKEN"] = "test-only-onec-token";
    const unauthorized = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards/initial-cursor`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    assert.equal(unauthorized.status, 401);
    const unauthorizedMetadata = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards/1/onec-data`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer wrong-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealer_manager: "Не должно сохраниться" }),
    });
    assert.equal(unauthorizedMetadata.status, 401);

    const cursorResponse = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards/initial-cursor`, {
      headers: { Authorization: "Bearer test-only-onec-token" },
    });
    assert.equal(cursorResponse.status, 200);
    const cursorBody = await cursorResponse.json() as { ok: boolean; data: { after_id: number } };
    assert.equal(cursorBody.ok, true);
    const initialCursor = cursorBody.data.after_id;
    assert.ok(Number.isInteger(initialCursor));

    const changesCursorResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/changes/initial-cursor`,
      { headers: { Authorization: "Bearer test-only-onec-token" } },
    );
    assert.equal(changesCursorResponse.status, 200);
    const changesCursorBody = await changesCursorResponse.json() as {
      ok: boolean;
      data: { after_change_id: number };
    };
    const initialChangeCursor = changesCursorBody.data.after_change_id;
    assert.ok(Number.isInteger(initialChangeCursor));

    const missingCursor = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards`, {
      headers: { Authorization: "Bearer test-only-onec-token" },
    });
    assert.equal(missingCursor.status, 400);

    const managers = await db.insert(managersTable).values({
      name: "Тест 1С",
      login: managerLogin,
      passwordHash: "test-only",
      brands: ["Haval City"],
    }).returning({ id: managersTable.id });
    managerId = managers[0]?.id;
    assert.ok(managerId);

    const [commercialCar] = await db.insert(carsTable).values({
      externalId: `onec-feed-car-${suffix}`,
      type: "new",
      brand: "Haval City",
      model: "Jolion",
      year: 2026,
      vin: "XW8ZZZ61ZHG000456",
    }).returning({ id: carsTable.id });
    commercialCarId = commercialCar?.id;
    assert.ok(commercialCarId);

    const cardInsert: typeof managerClientCardsTable.$inferInsert = {
      managerId,
      clientName: "Тестовый клиент интеграции",
      clientPhone: "+7 999 000-00-00",
      desiredBrand: "Haval City",
      desiredModel: "Jolion",
      needs: [
        { brand: "Haval City", model: "Jolion", undecided: false, budgetRange: "2–3 млн", plannedPurchaseDate: "2027-05-21" },
        { brand: "Jetour", model: "DASHING", undecided: false, budgetRange: "3–5 млн", plannedPurchaseDate: null },
      ],
      currentCars: [
        {
          brand: "Toyota",
          model: "Camry",
          year: 2019,
          mileage: 75000,
          generation: null,
          bodyType: "Седан",
          ownersCount: "2",
          snapshot: null,
          tradeInPlan: "Да",
        },
      ],
      commercialBrand: "Haval City",
      commercialModel: "Jolion",
      commercialCarId,
      commercialCarSnapshot: {
        vin: "XW8ZZZ61ZHG000456",
        brand: "Haval City",
        model: "Jolion",
        year: 2026,
      },
    };
    const cards = await db.insert(managerClientCardsTable).values(cardInsert).returning({ id: managerClientCardsTable.id });
    cardId = cards[0]?.id;
    assert.ok(cardId);

    const metadataResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/${cardId}/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealer_manager: "  Иванов Иван  ",
          worksheet_status: "  В работе  ",
        }),
      },
    );
    assert.equal(metadataResponse.status, 200);
    const metadataBody = await metadataResponse.json() as {
      ok: boolean;
      data: {
        worksheet_id: number;
        dealer_manager: string | null;
        worksheet_status: string | null;
        archive_reason: string | null;
        received_at: string;
      };
    };
    assert.equal(metadataBody.ok, true);
    assert.equal(metadataBody.data.worksheet_id, cardId);
    assert.equal(metadataBody.data.dealer_manager, "Иванов Иван");
    assert.equal(metadataBody.data.worksheet_status, "В работе");
    assert.equal(metadataBody.data.archive_reason, null);
    assert.ok(Number.isFinite(Date.parse(metadataBody.data.received_at)));

    const partialMetadataResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/${cardId}/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ worksheet_status: "Завершен" }),
      },
    );
    assert.equal(partialMetadataResponse.status, 200);
    const [updatedMetadataCard] = await db.select({
      dealerManager: managerClientCardsTable.onecDealerManager,
      worksheetStatus: managerClientCardsTable.onecWorksheetStatus,
      updatedAt: managerClientCardsTable.onecUpdatedAt,
    }).from(managerClientCardsTable).where(eq(managerClientCardsTable.id, cardId)).limit(1);
    assert.equal(updatedMetadataCard?.dealerManager, "Иванов Иван");
    assert.equal(updatedMetadataCard?.worksheetStatus, "Завершен");
    assert.ok(updatedMetadataCard?.updatedAt instanceof Date);

    const archiveWithoutReasonResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/${cardId}/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ worksheet_status: "Архив" }),
      },
    );
    assert.equal(archiveWithoutReasonResponse.status, 400);

    const archiveResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/${cardId}/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ worksheet_status: "Архив", archive_reason: "Клиент отказался от покупки" }),
      },
    );
    assert.equal(archiveResponse.status, 200);
    const archiveBody = await archiveResponse.json() as { data: { archive_reason: string | null } };
    assert.equal(archiveBody.data.archive_reason, "Клиент отказался от покупки");

    const invalidStatusResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/${cardId}/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ worksheet_status: "Сделка оформлена" }),
      },
    );
    assert.equal(invalidStatusResponse.status, 400);

    const emptyMetadataResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/${cardId}/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    assert.equal(emptyMetadataResponse.status, 400);

    const missingCardMetadataResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/999999999/onec-data`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-only-onec-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ worksheet_status: "Завершен" }),
      },
    );
    assert.equal(missingCardMetadataResponse.status, 404);

    const blocked = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards?after_id=${initialCursor}&limit=10`,
      { headers: { Authorization: "Bearer test-only-onec-token" } },
    );
    assert.equal(blocked.status, 409);
    const blockedBody = await blocked.json() as { ok: boolean; error: string; card_id: number };
    assert.equal(blockedBody.ok, false);
    assert.equal(blockedBody.error, "mapping_not_ready");
    assert.equal(blockedBody.card_id, cardId);

    const [brand] = await db.select({
      id: brandsTable.id,
      code: brandsTable.onecDepartmentCode,
      confirmed: brandsTable.onecDepartmentCodeConfirmed,
    }).from(brandsTable).where(eq(brandsTable.name, "Haval City")).limit(1);
    assert.ok(brand);
    brandId = brand.id;
    originalDepartmentCode = brand.code;
    originalDepartmentCodeConfirmed = brand.confirmed;

    const [location] = await db.select({
      id: locationsTable.id,
      code: locationsTable.onecOrganizationCode,
      confirmed: locationsTable.onecOrganizationCodeConfirmed,
    })
      .from(locationBrandsTable)
      .innerJoin(locationsTable, eq(locationsTable.id, locationBrandsTable.locationId))
      .where(and(
        eq(locationBrandsTable.brandId, brand.id),
        eq(locationBrandsTable.isService, false),
      ))
      .limit(1);
    assert.ok(location);
    locationId = location.id;
    originalOrganizationCode = location.code;
    originalOrganizationCodeConfirmed = location.confirmed;

    const [jetour] = await db.select({
      id: brandsTable.id,
      code: brandsTable.onecDepartmentCode,
      confirmed: brandsTable.onecDepartmentCodeConfirmed,
    }).from(brandsTable).where(eq(brandsTable.name, "Jetour")).limit(1);
    assert.ok(jetour);
    jetourBrandId = jetour.id;
    originalJetourDepartmentCode = jetour.code;
    originalJetourDepartmentCodeConfirmed = jetour.confirmed;
    const [jetourLocation] = await db.select({
      id: locationsTable.id,
      code: locationsTable.onecOrganizationCode,
      confirmed: locationsTable.onecOrganizationCodeConfirmed,
    })
      .from(locationBrandsTable)
      .innerJoin(locationsTable, eq(locationsTable.id, locationBrandsTable.locationId))
      .where(and(
        eq(locationBrandsTable.brandId, jetour.id),
        eq(locationBrandsTable.isService, false),
      ))
      .limit(1);
    assert.ok(jetourLocation);
    jetourLocationId = jetourLocation.id;
    originalJetourOrganizationCode = jetourLocation.code;
    originalJetourOrganizationCodeConfirmed = jetourLocation.confirmed;

    await db.update(brandsTable).set({
      onecDepartmentCodeConfirmed: true,
    }).where(eq(brandsTable.id, brand.id));
    await db.update(locationsTable).set({
      onecOrganizationCodeConfirmed: true,
    }).where(eq(locationsTable.id, location.id));
    const provisionalStillBlocked = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards?after_id=${initialCursor}&limit=10`,
      { headers: { Authorization: "Bearer test-only-onec-token" } },
    );
    assert.equal(provisionalStillBlocked.status, 409);

    await db.update(brandsTable).set({
      onecDepartmentCode: "TEST-DEPT-HAVAL-CITY",
      onecDepartmentCodeConfirmed: true,
    }).where(eq(brandsTable.id, brand.id));
    await db.update(locationsTable).set({
      onecOrganizationCode: "TEST-ORG-LITEYNAYA",
      onecOrganizationCodeConfirmed: true,
    }).where(eq(locationsTable.id, location.id));
    await db.update(brandsTable).set({
      onecDepartmentCode: "TEST-DEPT-JETOUR",
      onecDepartmentCodeConfirmed: true,
    }).where(eq(brandsTable.id, jetour.id));
    await db.update(locationsTable).set({
      onecOrganizationCode: "TEST-ORG-MOSKOVSKIY",
      onecOrganizationCodeConfirmed: true,
    }).where(eq(locationsTable.id, jetourLocation.id));

    const exported = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards?after_id=${initialCursor}&limit=10`,
      { headers: { Authorization: "Bearer test-only-onec-token" } },
    );
    assert.equal(exported.status, 200);
    const exportedBody = await exported.json() as {
      ok: boolean;
      data: { items: Array<{
        id: number;
        organization_code: string;
        department_code: string;
        client_phone: string;
        needs: Array<{ brand: string; model: string; planned_purchase_date: string | null }>;
        current_cars: Array<{ brand: string; mileage: number }>;
        commercial_car_vin: string | null;
        commercial_car_id?: number;
        current_car_inventory_id?: number | null;
        commercial_car: { vin: string | null } | null;
        commercial_offer: { car_vin: string | null } | null;
        brand_records: Array<{ source_key: string; brand_name: string; department_code: string }>;
      }> };
    };
    const exportedItem = exportedBody.data.items[0]!;
    assert.equal(exportedBody.ok, true);
    assert.equal(exportedItem.id, cardId);
    assert.equal(exportedItem.organization_code, "TEST-ORG-LITEYNAYA");
    assert.equal(exportedItem.department_code, "TEST-DEPT-HAVAL-CITY");
    assert.equal(exportedItem.client_phone, "+7 999 000-00-00");
    assert.equal(exportedItem.needs.length, 2);
    assert.equal(exportedItem.needs[0]?.planned_purchase_date, "2027-05-21");
    assert.equal(exportedItem.current_cars[0]?.brand, "Toyota");
    assert.equal(exportedItem.current_cars[0]?.mileage, 75000);
    assert.equal(exportedItem.commercial_car_vin, "XW8ZZZ61ZHG000456");
    assert.equal(exportedItem.commercial_car?.vin, "XW8ZZZ61ZHG000456");
    assert.equal(exportedItem.commercial_offer?.car_vin, "XW8ZZZ61ZHG000456");
    assert.equal("commercial_car_id" in (exportedItem as object), false);
    assert.equal("current_car_inventory_id" in (exportedItem as object), false);
    assert.equal("inventory_id" in (exportedItem.current_cars[0] as object), false);
    assert.equal("brand_id" in (exportedItem as object), false);
    assert.equal("organization_name" in (exportedItem as object), false);
    assert.equal("department_name" in (exportedItem as object), false);
    assert.equal("brand_id" in (exportedItem.needs[0] as object), false);
    assert.equal("organization_name" in (exportedItem.needs[0] as object), false);
    assert.equal("department_name" in (exportedItem.needs[0] as object), false);
    assert.equal("brand_id" in (exportedItem.commercial_offer as object), false);
    assert.equal("organization_name" in (exportedItem.commercial_offer as object), false);
    assert.equal("department_name" in (exportedItem.commercial_offer as object), false);
    assert.equal(exportedItem.brand_records.length, 2);
    assert.equal(exportedItem.brand_records[0]?.source_key, `${cardId}:haval-city`);
    assert.equal(exportedItem.brand_records[1]?.department_code, "TEST-DEPT-JETOUR");
    assert.equal("brand_id" in (exportedItem.brand_records[0] as object), false);
    assert.equal("organization_name" in (exportedItem.brand_records[0] as object), false);
    assert.equal("department_name" in (exportedItem.brand_records[0] as object), false);

    await db.update(managerClientCardsTable).set({
      desiredBrand: "Haval City",
      desiredModel: "Jolion",
      needs: [
        { brand: "Haval City", model: "Jolion", undecided: false, budgetRange: "2–3 млн", plannedPurchaseDate: "2027-05-21" },
      ],
      updatedAt: new Date(),
    }).where(eq(managerClientCardsTable.id, cardId));
    await db.insert(managerClientCardHistoryTable).values({
      cardId,
      editorName: "Менеджер 1С",
      editorRole: "manager",
      changes: [{ field: "needs", oldValue: ["Haval City", "Jetour"], newValue: ["Haval City"] }],
      previousBrands: ["Haval City", "Jetour"],
      currentBrands: ["Haval City"],
    });

    const changesResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards/changes?after_change_id=${initialChangeCursor}&limit=10`,
      { headers: { Authorization: "Bearer test-only-onec-token" } },
    );
    assert.equal(changesResponse.status, 200);
    const changesBody = await changesResponse.json() as {
      ok: boolean;
      data: {
        events: Array<{
          change_id: number;
          worksheet_id: number;
          deleted_source_keys: string[];
          item: { needs: Array<{ brand: string | null }>; brand_records: Array<{ source_key: string }> };
        }>;
        next_cursor: number;
        has_more: boolean;
      };
    };
    assert.equal(changesBody.ok, true);
    assert.equal(changesBody.data.events.length, 1);
    assert.equal(changesBody.data.events[0]?.worksheet_id, cardId);
    assert.equal(changesBody.data.events[0]?.item.needs.length, 1);
    assert.equal(changesBody.data.events[0]?.item.brand_records.length, 1);
    assert.deepEqual(changesBody.data.events[0]?.deleted_source_keys, [`${cardId}:jetour`]);
    assert.equal(changesBody.data.next_cursor, changesBody.data.events[0]?.change_id);
    assert.equal(changesBody.data.has_more, false);
  } finally {
    if (server) {
      await new Promise<void>(resolve => server!.close(() => resolve()));
    }
    if (cardId) {
      await db.delete(managerClientCardsTable).where(eq(managerClientCardsTable.id, cardId));
    }
    if (commercialCarId) {
      await db.delete(carsTable).where(eq(carsTable.id, commercialCarId));
    }
    if (brandId !== undefined) {
      await db.update(brandsTable).set({
        onecDepartmentCode: originalDepartmentCode ?? null,
        onecDepartmentCodeConfirmed: originalDepartmentCodeConfirmed ?? false,
      }).where(eq(brandsTable.id, brandId));
    }
    if (locationId !== undefined) {
      await db.update(locationsTable).set({
        onecOrganizationCode: originalOrganizationCode ?? null,
        onecOrganizationCodeConfirmed: originalOrganizationCodeConfirmed ?? false,
      }).where(eq(locationsTable.id, locationId));
    }
    if (jetourBrandId !== undefined) {
      await db.update(brandsTable).set({
        onecDepartmentCode: originalJetourDepartmentCode ?? null,
        onecDepartmentCodeConfirmed: originalJetourDepartmentCodeConfirmed ?? false,
      }).where(eq(brandsTable.id, jetourBrandId));
    }
    if (jetourLocationId !== undefined) {
      await db.update(locationsTable).set({
        onecOrganizationCode: originalJetourOrganizationCode ?? null,
        onecOrganizationCodeConfirmed: originalJetourOrganizationCodeConfirmed ?? false,
      }).where(eq(locationsTable.id, jetourLocationId));
    }
    if (managerId) {
      await db.delete(managersTable).where(eq(managersTable.id, managerId));
    }
    if (previousToken === undefined) delete process.env["ONEC_CLIENT_CARDS_TOKEN"];
    else process.env["ONEC_CLIENT_CARDS_TOKEN"] = previousToken;
    if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = previousNodeEnv;
  }
});

test("1C v2 creates one integration worksheet per unique organization and department pair", async () => {
  const previousToken = process.env["ONEC_CLIENT_CARDS_TOKEN"];
  const previousNodeEnv = process.env["NODE_ENV"];
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const managerLogin = `onec-v2-test-${suffix}`;
  const locationName = `1С v2 test ${suffix}`;
  const brandNames = [`V2 Brand A ${suffix}`, `V2 Brand B ${suffix}`, `V2 Brand C ${suffix}`];
  let managerId: number | undefined;
  let cardId: number | undefined;
  let locationId: number | undefined;
  let createdBrandIds: number[] = [];
  let server: Server | undefined;

  try {
    process.env["NODE_ENV"] = "production";
    process.env["ONEC_CLIENT_CARDS_TOKEN"] = "test-only-onec-v2-token";
    const started = await startServer();
    server = started.server;
    const headers = {
      Authorization: "Bearer test-only-onec-v2-token",
      "Content-Type": "application/json",
    };

    const initialChangeCursorResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v2/client-cards/changes/initial-cursor`,
      { headers },
    );
    assert.equal(initialChangeCursorResponse.status, 200);
    const initialChangeCursorBody = await initialChangeCursorResponse.json() as {
      data: { after_change_id: number };
    };

    const [manager] = await db.insert(managersTable).values({
      name: "Тест v2",
      login: managerLogin,
      passwordHash: "test-only",
      brands: brandNames,
    }).returning({ id: managersTable.id });
    managerId = manager?.id;
    assert.ok(managerId);

    const [location] = await db.insert(locationsTable).values({
      title: locationName,
      address: "Тестовый адрес",
      onecOrganizationCode: `TEST-ORG-V2-${suffix}`,
      onecOrganizationCodeConfirmed: true,
    }).returning({ id: locationsTable.id });
    locationId = location?.id;
    assert.ok(locationId);

    const insertedBrands = await db.insert(brandsTable).values(brandNames.map((name, index) => ({
      name,
      onecDepartmentCode: index < 2 ? `TEST-DEPT-V2-SHARED-${suffix}` : `TEST-DEPT-V2-OTHER-${suffix}`,
      onecDepartmentCodeConfirmed: true,
    }))).returning({ id: brandsTable.id });
    createdBrandIds = insertedBrands.map(brand => brand.id);
    assert.equal(createdBrandIds.length, 3);
    await db.insert(locationBrandsTable).values(createdBrandIds.map(brandId => ({
      locationId: locationId!,
      brandId,
      isService: false,
    })));

    const [card] = await db.insert(managerClientCardsTable).values({
      managerId,
      clientName: "Тестовый клиент v2",
      clientPhone: "+7 999 111-22-33",
      desiredBrand: brandNames[0]!,
      desiredModel: "Модель A",
      needs: [
        { brand: brandNames[0]!, model: "Модель A", undecided: false, budgetRange: "Не указан", plannedPurchaseDate: null },
        { brand: brandNames[1]!, model: "Модель B", undecided: false, budgetRange: "2–3 млн", plannedPurchaseDate: null },
        { brand: brandNames[2]!, model: "Модель C", undecided: false, budgetRange: "3–5 млн", plannedPurchaseDate: null },
      ],
      currentCars: [],
      commercialBrand: brandNames[2]!,
      commercialModel: "Модель C",
      commercialCarSnapshot: { vin: "TESTVIN0000000001", brand: brandNames[2]!, model: "Модель C" },
      paymentMethod: "Кредит",
    }).returning({ id: managerClientCardsTable.id });
    cardId = card?.id;
    assert.ok(cardId);

    await db.transaction(tx => syncOneCClientCardWorksheets(tx, cardId!));

    const feedResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v2/client-cards?limit=100`,
      { headers },
    );
    assert.equal(feedResponse.status, 200);
    const feedBody = await feedResponse.json() as {
      data: {
        items: Array<{
          id: number;
          source_key: string;
          manager_worksheet_id: number;
          organization_code: string;
          department_code: string;
          brand_names: string[];
          needs: Array<{ brand: string | null }>;
          commercial_offer: { car_vin: string | null } | null;
        }>;
        pending_count: number;
      };
    };
    const cardItems = feedBody.data.items.filter(item => item.manager_worksheet_id === cardId);
    assert.equal(cardItems.length, 2);
    assert.equal(new Set(cardItems.map(item => item.id)).size, 2);
    assert.equal(new Set(cardItems.map(item => item.source_key)).size, 2);

    const sharedDivision = cardItems.find(item => item.department_code === `TEST-DEPT-V2-SHARED-${suffix}`);
    const separateDivision = cardItems.find(item => item.department_code === `TEST-DEPT-V2-OTHER-${suffix}`);
    assert.ok(sharedDivision);
    assert.ok(separateDivision);
    assert.deepEqual(sharedDivision.brand_names, brandNames.slice(0, 2));
    assert.deepEqual(sharedDivision.needs.map(need => need.brand), brandNames.slice(0, 2));
    assert.deepEqual(separateDivision.brand_names, [brandNames[2]]);
    assert.equal(separateDivision.needs.length, 1);
    assert.equal(separateDivision.commercial_offer?.car_vin, "TESTVIN0000000001");
    assert.equal(feedBody.data.pending_count >= 0, true);

    const receivedResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v2/client-cards/${sharedDivision.id}/onec-data`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ dealer_manager: "Менеджер подразделения", worksheet_status: "Создан" }),
      },
    );
    assert.equal(receivedResponse.status, 200);
    const remainingPendingResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v2/client-cards?limit=100`,
      { headers },
    );
    assert.equal(remainingPendingResponse.status, 200);
    const remainingPendingBody = await remainingPendingResponse.json() as {
      data: { items: Array<{ id: number }> };
    };
    assert.deepEqual(remainingPendingBody.data.items.map(item => item.id), [separateDivision.id]);

    const statusResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v2/client-cards/${sharedDivision.id}/onec-data`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ worksheet_status: "В работе" }),
      },
    );
    assert.equal(statusResponse.status, 200);
    const [savedStatus] = await db.select({
      dealerManager: managerClientCardOnecWorksheetsTable.dealerManager,
      worksheetStatus: managerClientCardOnecWorksheetsTable.worksheetStatus,
    }).from(managerClientCardOnecWorksheetsTable)
      .where(eq(managerClientCardOnecWorksheetsTable.id, sharedDivision.id))
      .limit(1);
    assert.equal(savedStatus?.dealerManager, "Менеджер подразделения");
    assert.equal(savedStatus?.worksheetStatus, "В работе");
    const [parentStatus] = await db.select({
      worksheetStatus: managerClientCardsTable.onecWorksheetStatus,
    }).from(managerClientCardsTable).where(eq(managerClientCardsTable.id, cardId)).limit(1);
    assert.equal(parentStatus?.worksheetStatus, null);

    await db.transaction(async tx => {
      await tx.update(managerClientCardsTable).set({
        desiredBrand: brandNames[0]!,
        desiredModel: "Модель A",
        needs: [
          { brand: brandNames[0]!, model: "Модель A", undecided: false, budgetRange: "Не указан", plannedPurchaseDate: null },
          { brand: brandNames[1]!, model: "Модель B", undecided: false, budgetRange: "2–3 млн", plannedPurchaseDate: null },
        ],
        commercialBrand: null,
        commercialModel: null,
        commercialCarSnapshot: null,
        updatedAt: new Date(),
      }).where(eq(managerClientCardsTable.id, cardId!));
      await syncOneCClientCardWorksheets(tx, cardId!);
    });

    const changesResponse = await fetch(
      `${started.baseUrl}/api/integrations/1c/v2/client-cards/changes?after_change_id=${initialChangeCursorBody.data.after_change_id}&limit=100`,
      { headers },
    );
    assert.equal(changesResponse.status, 200);
    const changesBody = await changesResponse.json() as {
      data: {
        events: Array<{
          action: "upsert" | "delete";
          worksheet_id: number;
          manager_worksheet_id: number;
          source_key: string;
          item: unknown | null;
        }>;
      };
    };
    const deletedDivision = changesBody.data.events.find(event =>
      event.action === "delete" && event.manager_worksheet_id === cardId &&
      event.source_key === separateDivision.source_key,
    );
    assert.ok(deletedDivision);
    assert.equal(deletedDivision.item, null);
    assert.equal(deletedDivision.worksheet_id, separateDivision.id);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (cardId) await db.delete(managerClientCardsTable).where(eq(managerClientCardsTable.id, cardId));
    if (locationId) await db.delete(locationsTable).where(eq(locationsTable.id, locationId));
    if (createdBrandIds.length) await db.delete(brandsTable).where(inArray(brandsTable.id, createdBrandIds));
    if (managerId) await db.delete(managersTable).where(eq(managersTable.id, managerId));
    if (previousToken === undefined) delete process.env["ONEC_CLIENT_CARDS_TOKEN"];
    else process.env["ONEC_CLIENT_CARDS_TOKEN"] = previousToken;
    if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = previousNodeEnv;
  }
});
