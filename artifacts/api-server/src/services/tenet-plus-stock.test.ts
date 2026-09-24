import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchCmBusinessStocksWith,
  fetchTenetPlusStockWith,
  mapCmBusinessDealerStockCar,
  mapJelandStockCar,
  mapTenetPlusStockCar,
  mapCmBusinessIntegrationDealerStocksFromSnapshot,
  scanCmBusinessSnapshotWith,
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

test("generic catalog mapping uses a dealer-specific ID and keeps private row fields out", () => {
  const mapped = mapCmBusinessDealerStockCar({
    id: 20556001,
    dealerId: "private-dealer-id",
    brand: "Chery",
    model: "Haval F7",
    sellingPrice: 2_450_000,
    hasAbs: true,
    options: ["Подтверждённая неизвестная опция"],
    customerPhone: "+70000000000",
  }, "Haval Pro");

  assert.equal(mapped?.id, "haval-pro-cme-20556001");
  assert.equal(mapped?.brand, "Chery");
  assert.equal(mapped?.model, "Haval F7");
  assert.equal(mapped?.price, 2_450_000);
  assert.deepEqual(mapped?.options, ["ABS"]);
  assert.equal("dealerId" in (mapped ?? {}), false);
  assert.equal("customerPhone" in (mapped ?? {}), false);
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

test("Jeland stock identifiers are distinct from Tenet Plus identifiers", () => {
  assert.equal(mapJelandStockCar({ id: 27398001 })?.id, "jeland-cme-27398001");
  assert.equal(mapJelandStockCar({ dmsCarId: "dms-uuid" })?.id, "jeland-dms-dms-uuid");
  assert.equal(mapTenetPlusStockCar({ id: 27398001 })?.id, "tenet-plus-cme-27398001");
});

test("maps only verified Jeland booleans and enum values to Russian option labels", () => {
  const mapped = mapJelandStockCar({
    id: 27398002,
    hasOnBoardComputer: true,
    hasCruiseControl: false,
    hasAdaptiveCruiseControls: "true",
    hasWarranty: true,
    hasAftermarketImmobiliser: true,
    climate: "cc2zones",
    wheelAdjusting: "heightandlength",
    seatsHeat: "front",
    driverSeatAdjusting: "electro",
    passengerSeatAdjusting: "not-observed",
    headLightType: "led",
    wheelRimType: "alloy",
    wheelRimDiameter: 18,
    salon: "leather",
    unknownFeature: true,
  });

  assert.deepEqual(mapped?.options, [
    "Бортовой компьютер",
    "Двухзонный климат-контроль",
    "Регулировка руля по высоте и вылету",
    "Обогрев передних сидений",
    "Электрорегулировка водительского сиденья",
    "Светодиодные фары",
    "Легкосплавные диски",
    "Колёсные диски 18 дюймов",
    "Кожаный салон",
  ]);
  assert.deepEqual(mapTenetPlusStockCar({ id: 27398002, hasOnBoardComputer: true })?.options, ["Бортовой компьютер"]);
  assert.equal(mapTenetPlusStockCar({ id: 27398003 })?.options, undefined);
  assert.equal(mapJelandStockCar({ id: 27398003, hasCruiseControl: false })?.options, undefined);
  assert.equal(mapJelandStockCar({ id: 27398004 })?.options, undefined);
});

test("one complete CM snapshot validates dealer presence independently", async () => {
  const calls: string[] = [];
  const results = await fetchCmBusinessStocksWith(async (_path, params) => {
    calls.push(params?.page ?? "");
    if (params?.page === "1") return [
      { id: 1, dealerId: 28263, stockState: "in" },
      { id: 2, dealerId: 28263, stockState: "in" },
    ];
    return [];
  }, { concurrency: 2 });

  assert.deepEqual(calls, ["1", "2"]);
  assert.equal(results["Tenet Plus"].status, "fulfilled");
  if (results["Tenet Plus"].status === "fulfilled") {
    assert.deepEqual(results["Tenet Plus"].value.cars.map(car => car.id), [
      "tenet-plus-cme-1", "tenet-plus-cme-2",
    ]);
  }
  assert.equal(results.Jeland.status, "rejected");
  if (results.Jeland.status === "rejected") {
    assert.match(String(results.Jeland.reason), /Jeland dealer was absent/);
  }
});

test("shared CM snapshot returns Jeland stock when present without rescanning", async () => {
  let pageCalls = 0;
  const results = await fetchCmBusinessStocksWith(async (_path, params) => {
    pageCalls++;
    if (params?.page === "1") return [
      { id: 1, dealerId: 28263, stockState: "in" },
      { id: 2, dealerId: 27398, stockState: "in" },
    ];
    return [];
  }, { concurrency: 2 });

  assert.equal(pageCalls, 2);
  assert.equal(results["Tenet Plus"].status, "fulfilled");
  assert.equal(results.Jeland.status, "fulfilled");
  if (results.Jeland.status === "fulfilled") {
    assert.deepEqual(results.Jeland.value.cars.map(car => car.id), ["jeland-cme-2"]);
  }
});

test("one CM snapshot extracts dynamic catalog dealers independently", async () => {
  const calls: string[] = [];
  const dealers = [
    { dealerId: "27564", dealerName: "Soueast" },
    { dealerId: "9355", dealerName: "Tenet" },
    { dealerId: "9356", dealerName: "OMODA" },
    { dealerId: "13186", dealerName: "Jetour" },
    { dealerId: "13187", dealerName: "JAECOO" },
  ];
  const snapshot = await scanCmBusinessSnapshotWith(async (_path, params) => {
    calls.push(params?.page ?? "");
    if (params?.page !== "1") return [];
    return [
      { id: 1, dealerId: "9355", stockState: "in", brand: "Tenet", model: "T7" },
      { id: 2, dealerId: "9355", stockState: "in", brand: "Chery", model: "Tiggo 9" },
      { id: 3, dealerId: "9356", stockState: "in", brand: "Omoda", model: "C5" },
      { dealerId: "13186", stockState: "in", model: "Jetour X" },
      { id: 5, dealerId: "13187", stockState: "out", brand: "Jaecoo", model: "J7" },
    ];
  }, { concurrency: 2 }, dealers.map(dealer => dealer.dealerId));

  const results = mapCmBusinessIntegrationDealerStocksFromSnapshot(snapshot, dealers);
  assert.deepEqual(calls, ["1", "2"]);
  assert.equal(results.get("9355")?.status, "fulfilled");
  assert.equal(results.get("9356")?.status, "fulfilled");
  assert.equal(results.get("13187")?.status, "fulfilled");
  const tenetResult = results.get("9355");
  if (tenetResult?.status === "fulfilled") {
    assert.deepEqual(tenetResult.value.cars.map(car => car.brand), ["Tenet", "Chery"]);
  }
  assert.equal(results.get("27564")?.status, "rejected");
  assert.equal(results.get("13186")?.status, "rejected");
});

test("completed snapshots retain only target dealers and projected allowlisted fields", async () => {
  const snapshot = await scanCmBusinessSnapshotWith(async (_path, params) => {
    if (params?.page !== "1") return [];
    return [
      {
        id: 10, dealerId: 28263, stockState: "in", model: "L6",
        photos: [{ cmeUrl: "https://cdn.example/tenet.jpg", sourceUrl: "http://private.example/a.jpg", internalId: "secret" }],
        customerPhone: "+70000000000", margin: 999, hasCruiseControl: true,
      },
      {
        id: 11, dealerId: 27398, stockState: "in", model: "J6",
        photos: [{ cmeUrl: "https://cdn.example/jeland.jpg", token: "private-token" }],
        internalNotes: "private", hasOnBoardComputer: true, hasCruiseControl: false,
        climate: "cc2zones", salon: "unobserved", customerName: "private customer",
      },
      {
        id: 12, dealerId: 99123, stockState: "in", model: "unrelated",
        customerPhone: "+70000000001", margin: 1234,
      },
      { id: 13, dealerId: 87654, stockState: "in", customerPhone: "unretained override fixture" },
      { id: 14, dealerId: 28263, stockState: "out", customerPhone: "not retained" },
    ];
  }, { concurrency: 1 }, ["28263", "27398", "87654"]);

  assert.deepEqual(snapshot.rows.map(row => row.dealerId), [28263, 27398, 87654]);
  assert.deepEqual([...snapshot.presentDealerIds].sort(), ["27398", "28263", "87654"]);
  assert.equal(snapshot.rows.some(row => row.id === 14), false);
  assert.equal(snapshot.rows.some(row => "customerPhone" in row || "margin" in row || "internalNotes" in row), false);
  assert.deepEqual(snapshot.rows[0]?.photos, [{ cmeUrl: "https://cdn.example/tenet.jpg" }]);
  assert.deepEqual(snapshot.rows[0]?.options, ["Круиз-контроль"]);
  assert.deepEqual(mapTenetPlusStockCar(snapshot.rows[0])?.options, ["Круиз-контроль"]);
  assert.deepEqual(snapshot.rows[1]?.options, ["Бортовой компьютер", "Двухзонный климат-контроль"]);
  assert.deepEqual(mapJelandStockCar(snapshot.rows[1])?.options, [
    "Бортовой компьютер", "Двухзонный климат-контроль",
  ]);
  assert.equal("hasOnBoardComputer" in (snapshot.rows[1] ?? {}), false);
  assert.equal("climate" in (snapshot.rows[1] ?? {}), false);
  assert.equal("customerName" in (snapshot.rows[1] ?? {}), false);
  assert.deepEqual(Object.keys(snapshot.rows[0] ?? {}).sort(), [
    "body", "color", "dealerId", "dmsCarId", "equipmentName", "id", "model",
    "modificationName", "options", "photos", "photosUrls", "sellingPrice", "sourceUpdatedAt",
    "stockState", "updatedAt", "vin", "year",
  ].sort());
  assert.deepEqual(Object.keys(snapshot.rows[1] ?? {}).sort(), [
    "body", "color", "dealerId", "dmsCarId", "equipmentName", "id", "model",
    "modificationName", "options", "photos", "photosUrls", "sellingPrice",
    "sourceUpdatedAt", "stockState", "updatedAt", "vin", "year",
  ].sort());

  const customDealerResult = await fetchTenetPlusStockWith(async (_path, params) => (
    params?.page === "1"
      ? [{ id: 99, dealerId: "87654", stockState: "in" }]
      : []
  ), { dealerId: "87654", concurrency: 1 });
  assert.equal(customDealerResult.cars[0]?.id, "tenet-plus-cme-99");
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