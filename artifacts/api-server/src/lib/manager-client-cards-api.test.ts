import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import jwt from "jsonwebtoken";
import express from "express";
import { inArray, eq } from "drizzle-orm";
import {
  carsTable,
  db,
  managerClientCardsTable,
  managersTable,
} from "@workspace/db";
import managerClientCardsRouter from "../routes/manager-client-cards";

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string };

function managerToken(managerId: number): string {
  const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"] || "dev-only-secret-key";
  return jwt.sign({ managerId, name: "Client card test manager", role: "manager" }, secret);
}

function adminToken(): string {
  const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"] || "dev-only-secret-key";
  return jwt.sign({ id: 1, login: "client-card-test-admin", isAdmin: true }, secret);
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use("/api/manager", managerClientCardsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

test("manager client cards are saved and isolated by manager", async () => {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const externalId = `client-card-test-${suffix}`;
  const currentCarExternalId = `client-card-current-test-${suffix}`;
  const managerLogins = [`client-card-a-${suffix}`, `client-card-b-${suffix}`];
  let managerIds: number[] = [];
  let server: Server | undefined;

  try {
    const managers = await db.insert(managersTable).values([
      {
        name: "Client card manager A",
        login: managerLogins[0]!,
        passwordHash: "test-only",
        brands: ["Haval City", "С пробегом"],
      },
      {
        name: "Client card manager B",
        login: managerLogins[1]!,
        passwordHash: "test-only",
        brands: ["Jetour"],
      },
    ]).returning({ id: managersTable.id });
    managerIds = managers.map(manager => manager.id);

    const [car] = await db.insert(carsTable).values({
      externalId,
      type: "new",
      brand: "Haval City",
      model: "Jolion",
      year: 2026,
      price: 2_000_000,
      vin: "XW8ZZZ61ZHG000123",
      catalogSource: "cm_business",
      cmStockState: "in",
    }).returning({ id: carsTable.id });
    assert.ok(car);
    const [currentCar] = await db.insert(carsTable).values({
      externalId: currentCarExternalId,
      type: "used",
      brand: "Haval City",
      model: "Jolion",
      year: 2022,
      price: 1_400_000,
      vin: "XW8ZZZ61ZHG000456",
    }).returning({ id: carsTable.id });
    assert.ok(currentCar);

    const started = await startServer();
    server = started.server;

    const unauthorized = await fetch(`${started.baseUrl}/api/manager/client-cards`);
    assert.equal(unauthorized.status, 401);

    const createResponse = await fetch(`${started.baseUrl}/api/manager/client-cards`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${managerToken(managerIds[0]!)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        clientName: "Тестовый клиент",
        clientPhone: "+7 (920) 607-28-57",
        clientGender: "female",
        desiredBrand: "Haval City",
        desiredModel: "Jolion",
        desiredVehicleUndecided: false,
        budgetRange: "2–3 млн",
        currentCar: null,
        currentCarYear: null,
        currentCarInventoryId: currentCar.id,
        tradeInPlan: null,
        commercialBrand: null,
        commercialModel: null,
        commercialCarId: car.id,
        paymentMethod: "Кредит",
        comment: "Проверка сохранения",
      }),
    });
    const created = await createResponse.json() as ApiEnvelope<{ id: number }>;
    assert.equal(createResponse.status, 201, created.error);
    assert.equal(created.ok, true);
    assert.ok(created.data?.id);

    const ownResponse = await fetch(`${started.baseUrl}/api/manager/client-cards`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const own = await ownResponse.json() as ApiEnvelope<{
      items: Array<{
        id: number;
        clientGender: string;
        currentCar: string;
        currentCarYear: number;
        currentCarSnapshot: { vin: string };
        commercialCarSnapshot: { model: string };
      }>;
      total: number;
    }>;
    assert.equal(ownResponse.status, 200);
    assert.equal(own.data?.total, 1);
    assert.equal(own.data?.items.length, 1);
    assert.equal(own.data?.items[0]?.commercialCarSnapshot.model, "Jolion");
    assert.equal(own.data?.items[0]?.clientGender, "female");
    assert.equal(own.data?.items[0]?.currentCar, "Haval City Jolion");
    assert.equal(own.data?.items[0]?.currentCarYear, 2022);
    assert.equal(own.data?.items[0]?.currentCarSnapshot.vin, "XW8ZZZ61ZHG000456");

    const ownDetail = await fetch(`${started.baseUrl}/api/manager/client-cards/${created.data!.id}`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    assert.equal(ownDetail.status, 200);
    const hiddenDetail = await fetch(`${started.baseUrl}/api/manager/client-cards/${created.data!.id}`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[1]!)}` },
    });
    assert.equal(hiddenDetail.status, 404);

    const moscowToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
    const adminFiltered = await fetch(
      `${started.baseUrl}/api/manager/client-cards?managerId=${managerIds[0]}&client=${encodeURIComponent("Тестовый")}&dateFrom=${moscowToday}&dateTo=${moscowToday}`,
      { headers: { authorization: `Bearer ${adminToken()}` } },
    );
    const adminFilteredData = await adminFiltered.json() as ApiEnvelope<{ items: unknown[]; total: number }>;
    assert.equal(adminFiltered.status, 200);
    assert.equal(adminFilteredData.data?.total, 1);
    assert.equal(adminFilteredData.data?.items.length, 1);

    const needsBrandsResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/needs/brands`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const needsBrands = await needsBrandsResponse.json() as ApiEnvelope<string[]>;
    assert.equal(needsBrandsResponse.status, 200);
    assert.deepEqual(needsBrands.data, ["Haval City"]);

    const vinResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?vin=0001&type=new`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const vinResults = await vinResponse.json() as ApiEnvelope<Array<{ vin: string }>>;
    assert.equal(vinResponse.status, 200);
    assert.equal(vinResults.data?.[0]?.vin, "XW8ZZZ61ZHG000123");

    const currentVinResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?vin=0004&type=used`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const currentVinResults = await currentVinResponse.json() as ApiEnvelope<Array<{ vin: string }>>;
    assert.equal(currentVinResponse.status, 200);
    assert.equal(currentVinResults.data?.[0]?.vin, "XW8ZZZ61ZHG000456");

    const partialBrandResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?brand=Hav&type=new`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const partialBrand = await partialBrandResponse.json() as ApiEnvelope<Array<{ brand: string }>>;
    assert.equal(partialBrandResponse.status, 200);
    assert.equal(partialBrand.data?.some(car => car.brand === "Haval City"), true);

    const partialModelResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?model=Jol&type=new`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const partialModel = await partialModelResponse.json() as ApiEnvelope<Array<{ model: string }>>;
    assert.equal(partialModelResponse.status, 200);
    assert.equal(partialModel.data?.some(car => car.model === "Jolion"), true);

    const combinedOfferResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?brand=Hav&model=Jol&type=new`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const combinedOffer = await combinedOfferResponse.json() as ApiEnvelope<Array<{ brand: string; model: string }>>;
    assert.equal(combinedOfferResponse.status, 200);
    assert.equal(combinedOffer.data?.some(car => car.brand === "Haval City" && car.model === "Jolion"), true);

    const hiddenCurrentVinResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?vin=0004&type=used`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[1]!)}` },
    });
    const hiddenCurrentVin = await hiddenCurrentVinResponse.json() as ApiEnvelope<Array<{ vin: string }>>;
    assert.equal(hiddenCurrentVinResponse.status, 200);
    assert.equal(hiddenCurrentVin.data?.length, 0);

    const offerSearchResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?q=Jolion&type=new`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const offerSearch = await offerSearchResponse.json() as ApiEnvelope<Array<{ type: string; vin: string }>>;
    assert.equal(offerSearchResponse.status, 200);
    assert.equal(offerSearch.data?.[0]?.type, "new");
    assert.equal(offerSearch.data?.[0]?.vin, "XW8ZZZ61ZHG000123");
    const hiddenOfferResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/inventory?q=Jolion&type=new`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[1]!)}` },
    });
    const hiddenOffer = await hiddenOfferResponse.json() as ApiEnvelope<Array<unknown>>;
    assert.equal(hiddenOfferResponse.status, 200);
    assert.equal(hiddenOffer.data?.length, 0);

    const csvResponse = await fetch(`${started.baseUrl}/api/manager/client-cards/export.csv`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[0]!)}` },
    });
    const csv = await csvResponse.text();
    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(csv, /Тестовый клиент/);

    const otherResponse = await fetch(`${started.baseUrl}/api/manager/client-cards`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[1]!)}` },
    });
    const other = await otherResponse.json() as ApiEnvelope<{ items: unknown[]; total: number }>;
    assert.equal(otherResponse.status, 200);
    assert.equal(other.data?.total, 0);
    assert.equal(other.data?.items.length, 0);

    const forbiddenResponse = await fetch(`${started.baseUrl}/api/manager/client-cards`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${managerToken(managerIds[1]!)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        clientName: "Другой клиент",
        clientPhone: "+7 (921) 234-56-78",
        clientGender: null,
        desiredBrand: "Haval City",
        desiredModel: "Jolion",
        desiredVehicleUndecided: false,
        budgetRange: "Не указан",
        currentCar: null,
        currentCarYear: null,
        currentCarInventoryId: null,
        tradeInPlan: null,
        commercialBrand: null,
        commercialModel: null,
        commercialCarId: car.id,
        paymentMethod: null,
        comment: "",
      }),
    });
    assert.equal(forbiddenResponse.status, 403);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (managerIds.length) {
      await db.delete(managerClientCardsTable).where(inArray(managerClientCardsTable.managerId, managerIds));
    }
    await db.delete(carsTable).where(inArray(carsTable.externalId, [externalId, currentCarExternalId]));
    if (managerIds.length) {
      await db.delete(managersTable).where(inArray(managersTable.id, managerIds));
    }
  }
});
