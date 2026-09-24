import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchTenetPlusStockWith,
  mapTenetPlusStockCar,
} from "./tenet-plus-stock";

test("maps only allowlisted fields and preserves incomplete in-stock records", () => {
  const mapped = mapTenetPlusStockCar({
    id: 12345,
    dmsCarId: "dms-uuid",
    model: "L6",
    modificationName: "1.5T",
    equipmentName: undefined,
    year: undefined,
    sellingPrice: null,
    photosUrls: ["https://cdn.example/photo.jpg", "http://not-secure.example/photo.jpg"],
    dealerId: "private",
    customerPhone: "+70000000000",
    margin: 123,
  });

  assert.deepEqual(mapped, {
    id: "tenet-plus-cme-12345",
    cmStockId: "12345",
    cmDmsCarId: "dms-uuid",
    model: "L6",
    modification: "1.5T",
    complectation: "",
    year: 0,
    price: 0,
    color: "",
    bodyType: "",
    images: ["https://cdn.example/photo.jpg"],
    vin: "",
    sourceUpdatedAt: "",
  });
  assert.equal("customerPhone" in (mapped ?? {}), false);
  assert.equal("margin" in (mapped ?? {}), false);
});

test("prefers CM HTTPS photos over HTTP source URLs without leaking source metadata", () => {
  const mapped = mapTenetPlusStockCar({
    id: 83183067,
    photosUrls: ["http://sme.example/source.jpg"],
    photos: [{ sourceUrl: "http://sme.example/source.jpg", cmeUrl: "https://avatars.example/cm.jpg", internalId: 9 }],
  });
  assert.deepEqual(mapped?.images, ["https://avatars.example/cm.jpg"]);
  assert.equal("photos" in (mapped ?? {}), false);
  assert.deepEqual(mapTenetPlusStockCar({
    id: 83183068,
    photosUrls: ["http://sme.example/source.jpg"],
    photos: [{ cmeUrl: "http://avatars.example/cm.jpg" }],
  })?.images, []);
});

test("uses a distinct DMS fallback identifier without inventing a stock-card link", () => {
  const mapped = mapTenetPlusStockCar({ dmsCarId: "dms-uuid", photosUrls: [] });
  assert.equal(mapped?.id, "tenet-plus-dms-dms-uuid");
  assert.equal(mapped?.cmStockId, null);
  assert.equal(mapped?.cmDmsCarId, "dms-uuid");
  assert.equal(mapTenetPlusStockCar({ vin: "VIN-WITHOUT-ID" }), null);
});

test("scans through the terminal page, filters locally, and deduplicates stable IDs", async () => {
  const calls: Array<{ page: string; perPage: string }> = [];
  const firstPage = Array.from({ length: 50 }, (_, index) => ({
    id: index < 2 ? 100 : 100 + index,
    dmsCarId: `dms-${index}`,
    dealerId: index === 3 ? 99 : 28263,
    stockState: index === 4 ? "out" : "In",
  }));
  const secondPage = [
    { id: 100, dealerId: "28263", stockState: "in" },
    { dmsCarId: "fallback-id", dealerId: 28263, stockState: "in" },
    { dealerId: 28263, stockState: "out" },
  ];

  const result = await fetchTenetPlusStockWith(async (_path, params) => {
    assert.equal(_path, "/dealers/dms/cars");
    assert.ok(params);
    calls.push({ page: params.page, perPage: params.perPage });
    return params.page === "1" ? firstPage : params.page === "2" ? secondPage : [];
  }, { concurrency: 2, now: () => "2025-01-02T03:04:05.000Z" });

  assert.deepEqual(calls, [
    { page: "1", perPage: "50" },
    { page: "2", perPage: "50" },
    { page: "3", perPage: "50" },
    { page: "4", perPage: "50" },
  ]);
  assert.equal(result.pagesFetched, 3);
  assert.equal(result.rowsScanned, 53);
  assert.equal(result.fetchedAt, "2025-01-02T03:04:05.000Z");
  assert.deepEqual(result.cars.map(car => car.id), [
    "tenet-plus-cme-100",
    "tenet-plus-cme-102",
    ...Array.from({ length: 45 }, (_, index) => `tenet-plus-cme-${105 + index}`),
    "tenet-plus-dms-fallback-id",
  ]);
  assert.equal(result.cars.find(car => car.id === "tenet-plus-cme-100")?.cmStockId, "100");
});

test("rejects empty first pages, malformed payloads, request failures, and truncated scans", async () => {
  await assert.rejects(
    fetchTenetPlusStockWith(async () => [], { maxPages: 700 }),
    /empty first page/,
  );
  await assert.rejects(
    fetchTenetPlusStockWith(async () => ({ data: [] })),
    /unexpected payload/,
  );
  await assert.rejects(
    fetchTenetPlusStockWith(async () => { throw new Error("request failed"); }),
    /request failed/,
  );
  await assert.rejects(
    fetchTenetPlusStockWith(async () => Array.from({ length: 50 }, () => ({})), {
      maxPages: 2,
      concurrency: 1,
    }),
    /page limit/,
  );
  await assert.rejects(
    fetchTenetPlusStockWith(async (_path, params) => params?.page === "1"
      ? [{ id: 1, dealerId: 123, stockState: "in" }]
      : []),
    /dealer was absent/,
  );
  await assert.rejects(
    fetchTenetPlusStockWith(async (_path, params) => params?.page === "1"
      ? [{ dealerId: 28263, stockState: "in" }]
      : []),
    /without a stable identifier/,
  );
});

test("ignores speculative page failures only after the terminal page is confirmed", async () => {
  const result = await fetchTenetPlusStockWith(async (_path, params) => {
    const page = Number(params?.page);
    if (page === 1) return Array.from({ length: 50 }, (_, i) => ({
      id: i + 1, dealerId: 28263, stockState: "in",
    }));
    if (page === 2) return [{ id: 51, dealerId: 28263, stockState: "in" }];
    if (page === 3) return [];
    throw new Error("speculative request failed");
  }, { concurrency: 4 });
  assert.equal(result.cars.length, 51);
  assert.equal(result.pagesFetched, 3);

  await assert.rejects(fetchTenetPlusStockWith(async (_path, params) => {
    if (params?.page === "1") return [{ id: 1, dealerId: 28263, stockState: "in" }];
    throw new Error("confirmation request failed");
  }, { concurrency: 2 }), /request failed on page 2/);
});

test("refuses a short nonterminal page instead of deleting unseen stock", async () => {
  await assert.rejects(fetchTenetPlusStockWith(async (_path, params) => {
    if (params?.page === "1") return [{ id: 1, dealerId: 28263, stockState: "in" }];
    return Array.from({ length: 50 }, (_, i) => ({
      id: 100 + i, dealerId: 28263, stockState: "in",
    }));
  }, { concurrency: 2 }), /short page 1 was followed by data on page 2/);
});