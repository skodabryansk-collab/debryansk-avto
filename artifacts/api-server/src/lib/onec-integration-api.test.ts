import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import { and, eq } from "drizzle-orm";
import {
  brandsTable,
  db,
  locationsTable,
  locationBrandsTable,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import oneCIntegrationRouter from "../routes/onec-integration";

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use("/api/integrations/1c/v1", oneCIntegrationRouter);
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
  let brandId: number | undefined;
  let locationId: number | undefined;
  let originalDepartmentCode: string | null | undefined;
  let originalDepartmentCodeConfirmed: boolean | undefined;
  let originalOrganizationCode: string | null | undefined;
  let originalOrganizationCodeConfirmed: boolean | undefined;
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

    const cursorResponse = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards/initial-cursor`, {
      headers: { Authorization: "Bearer test-only-onec-token" },
    });
    assert.equal(cursorResponse.status, 200);
    const cursorBody = await cursorResponse.json() as { ok: boolean; data: { after_id: number } };
    assert.equal(cursorBody.ok, true);
    const initialCursor = cursorBody.data.after_id;
    assert.ok(Number.isInteger(initialCursor));

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

    const cards = await db.insert(managerClientCardsTable).values({
      managerId,
      clientName: "Тестовый клиент интеграции",
      clientPhone: "+7 999 000-00-00",
      desiredBrand: "Haval City",
    }).returning({ id: managerClientCardsTable.id });
    cardId = cards[0]?.id;
    assert.ok(cardId);

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

    const exported = await fetch(
      `${started.baseUrl}/api/integrations/1c/v1/client-cards?after_id=${initialCursor}&limit=10`,
      { headers: { Authorization: "Bearer test-only-onec-token" } },
    );
    assert.equal(exported.status, 200);
    const exportedBody = await exported.json() as {
      ok: boolean;
      data: { items: Array<{ id: number; organization_code: string; department_code: string; client_phone: string }> };
    };
    assert.equal(exportedBody.ok, true);
    assert.equal(exportedBody.data.items[0]?.id, cardId);
    assert.equal(exportedBody.data.items[0]?.organization_code, "TEST-ORG-LITEYNAYA");
    assert.equal(exportedBody.data.items[0]?.department_code, "TEST-DEPT-HAVAL-CITY");
    assert.equal(exportedBody.data.items[0]?.client_phone, "+7 999 000-00-00");
  } finally {
    if (server) {
      await new Promise<void>(resolve => server!.close(() => resolve()));
    }
    if (cardId) {
      await db.delete(managerClientCardsTable).where(eq(managerClientCardsTable.id, cardId));
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
    if (managerId) {
      await db.delete(managersTable).where(eq(managersTable.id, managerId));
    }
    if (previousToken === undefined) delete process.env["ONEC_CLIENT_CARDS_TOKEN"];
    else process.env["ONEC_CLIENT_CARDS_TOKEN"] = previousToken;
    if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = previousNodeEnv;
  }
});
