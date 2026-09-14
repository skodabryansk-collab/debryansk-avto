import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import jwt from "jsonwebtoken";
import express from "express";
import { and, inArray } from "drizzle-orm";
import managerQuotesRouter from "../routes/manager-quotes";
import { db, managersTable, carsTable, pool } from "@workspace/db";

type ApiResponse<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

type SearchCar = {
  externalId: string;
  brand: string | null;
  model: string | null;
};

function managerToken(managerId: number): string {
  const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"] || "dev-only-secret-key";
  return jwt.sign({ managerId, name: "Task 508 test manager", role: "manager" }, secret);
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/manager", managerQuotesRouter);

  const server = testApp.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>(resolve => server.close(() => resolve()));
    throw new Error("The test server did not expose a TCP address");
  }

  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function request<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json() as ApiResponse<T> | { ok: false; error?: string };

  assert.equal(
    response.status,
    200,
    `GET ${path} failed with ${response.status}: ${JSON.stringify(body)}`,
  );
  assert.equal(body.ok, true, `GET ${path} returned an unsuccessful response`);
  return (body as ApiResponse<T>).data;
}

test("manager quote car endpoints keep Great Wall and Haval City isolated", async () => {
  const runId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testType = `task-508-${runId}`;
  const marker = `task508-${runId}`;
  const managerLogins = {
    greatWall: `task508-great-wall-${runId}`,
    havalCity: `task508-haval-city-${runId}`,
  };
  const carIds = {
    greatWall: `task508-great-wall-${runId}`,
    havalCity: `task508-haval-city-${runId}`,
  };
  const models = {
    greatWall: `Task 508 Great Wall ${runId}`,
    havalCity: `Task 508 Haval City ${runId}`,
  };

  let server: Server | undefined;
  let managerIds: number[] = [];

  try {
    const managers = await db.insert(managersTable).values([
      {
        name: "Task 508 Great Wall manager",
        login: managerLogins.greatWall,
        passwordHash: "test-only",
        brands: ["Great Wall"],
      },
      {
        name: "Task 508 Haval City manager",
        login: managerLogins.havalCity,
        passwordHash: "test-only",
        brands: ["Haval City"],
      },
    ]).returning({ id: managersTable.id });
    managerIds = managers.map(manager => manager.id);

    await db.insert(carsTable).values([
      {
        externalId: carIds.greatWall,
        type: testType,
        brand: "Great Wall",
        model: models.greatWall,
        modification: marker,
        price: 1,
      },
      {
        externalId: carIds.havalCity,
        type: testType,
        brand: "Haval City",
        model: models.havalCity,
        modification: marker,
        price: 2,
      },
    ]);

    const started = await startServer();
    server = started.server;

    const assertBrandEndpoints = async (
      brand: "Great Wall" | "Haval City",
      model: string,
      externalId: string,
      managerId: number,
    ) => {
      const token = managerToken(managerId);
      const query = new URLSearchParams({ type: testType, brand });

      const brands = await request<string[]>(
        started.baseUrl,
        token,
        `/api/manager/cars/brands?type=${encodeURIComponent(testType)}`,
      );
      assert.deepEqual(brands, [brand]);

      const modelsResult = await request<string[]>(
        started.baseUrl,
        token,
        `/api/manager/cars/models?${query.toString()}`,
      );
      assert.deepEqual(modelsResult, [model]);

      const searchQuery = new URLSearchParams({ ...Object.fromEntries(query), q: marker });
      const cars = await request<SearchCar[]>(
        started.baseUrl,
        token,
        `/api/manager/cars/search?${searchQuery.toString()}`,
      );
      assert.equal(cars.length, 1);
      assert.deepEqual(cars.map(car => car.externalId), [externalId]);
      assert.ok(cars.every(car => car.brand === brand));
    };

    await assertBrandEndpoints("Great Wall", models.greatWall, carIds.greatWall, managerIds[0]!);
    await assertBrandEndpoints("Haval City", models.havalCity, carIds.havalCity, managerIds[1]!);
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close(error => error ? reject(error) : resolve());
      });
    }

    await db.delete(carsTable).where(
      inArray(carsTable.externalId, [carIds.greatWall, carIds.havalCity]),
    );
    await db.delete(managersTable).where(
      and(
        inArray(managersTable.id, managerIds.length ? managerIds : [-1]),
        inArray(managersTable.login, Object.values(managerLogins)),
      ),
    );
    await pool.end();
  }
});