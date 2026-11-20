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
  const managerLogins = [`client-card-a-${suffix}`, `client-card-b-${suffix}`];
  let managerIds: number[] = [];
  let server: Server | undefined;

  try {
    const managers = await db.insert(managersTable).values([
      {
        name: "Client card manager A",
        login: managerLogins[0]!,
        passwordHash: "test-only",
        brands: ["Haval City"],
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
    }).returning({ id: carsTable.id });
    assert.ok(car);

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
        clientPhone: "+7 900 000-00-00",
        desiredBrand: "Haval City",
        desiredModel: "Jolion",
        budgetRange: "2–3 млн",
        currentCar: null,
        currentCarYear: null,
        tradeInPlan: null,
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
    const own = await ownResponse.json() as ApiEnvelope<Array<{ id: number; commercialCarSnapshot: { model: string } }>>;
    assert.equal(ownResponse.status, 200);
    assert.equal(own.data?.length, 1);
    assert.equal(own.data?.[0]?.commercialCarSnapshot.model, "Jolion");

    const otherResponse = await fetch(`${started.baseUrl}/api/manager/client-cards`, {
      headers: { authorization: `Bearer ${managerToken(managerIds[1]!)}` },
    });
    const other = await otherResponse.json() as ApiEnvelope<unknown[]>;
    assert.equal(otherResponse.status, 200);
    assert.equal(other.data?.length, 0);

    const forbiddenResponse = await fetch(`${started.baseUrl}/api/manager/client-cards`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${managerToken(managerIds[1]!)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        clientName: "Другой клиент",
        clientPhone: "+7 900 111-11-11",
        desiredBrand: "Haval City",
        desiredModel: "Jolion",
        commercialCarId: car.id,
      }),
    });
    assert.equal(forbiddenResponse.status, 403);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (managerIds.length) {
      await db.delete(managerClientCardsTable).where(inArray(managerClientCardsTable.managerId, managerIds));
    }
    await db.delete(carsTable).where(eq(carsTable.externalId, externalId));
    if (managerIds.length) {
      await db.delete(managersTable).where(inArray(managersTable.id, managerIds));
    }
  }
});
