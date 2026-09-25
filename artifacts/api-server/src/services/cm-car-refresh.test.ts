import assert from "node:assert/strict";
import test from "node:test";
import { and } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildCmRefreshResponse,
  mergeQuoteCarWithFeed,
  projectCarSearchResult,
} from "../routes/manager-quotes";
import type { NewCarRecord } from "../routes/new-cars";
import {
  buildCmRefreshUpdate,
  buildCmRefreshGuard,
  enabledCmIntegrationForDealer,
  findCmRefreshCandidate,
  hasCmRefreshChanges,
} from "./cm-car-refresh";

const vin = "1HGCM82633A004352";

const cmRow = {
  id: 4321,
  dealerId: "dealer-1",
  vin,
  stockState: "in",
  brand: "Test",
  model: "Model",
  modificationName: "1.5T",
  equipmentName: "Comfort",
  year: 2025,
  sellingPrice: 2_000_000,
  color: "White",
  body: "SUV",
  photos: [{ cmeUrl: "https://images.example/car.jpg" }],
  hasAbs: true,
  dmsCarId: "dms-4321",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("CM refresh refuses unavailable, mismatched, and ambiguous exact matches", () => {
  const integration = {
    dealerId: "dealer-1",
    dealerName: "Dealer",
    mode: "catalog" as const,
    enabled: false,
    lastStatus: "never" as const,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastSuccessAt: null,
    lastError: null,
    stockCount: 0,
    matchedCount: 0,
    carsWithOptions: 0,
    optionsCount: 0,
    pagesFetched: 0,
    rowsScanned: 0,
    durationMs: 0,
  };
  assert.equal(enabledCmIntegrationForDealer([integration], "Dealer"), undefined);
  const local = { vin, cmStockId: null, cmDmsCarId: null };
  assert.deepEqual(findCmRefreshCandidate(local, [], "dealer-1", "Dealer").status, "no_match");

  const mismatch = findCmRefreshCandidate(
    { ...local, cmStockId: "9999" },
    [cmRow],
    "dealer-1",
    "Dealer",
  );
  assert.equal(mismatch.status, "mismatch");

  const ambiguous = findCmRefreshCandidate(local, [cmRow, { ...cmRow, id: 4322 }], "dealer-1", "Dealer");
  assert.equal(ambiguous.status, "ambiguous");

  const wrongDealer = findCmRefreshCandidate(local, [{ ...cmRow, dealerId: "other" }], "dealer-1", "Dealer");
  assert.equal(wrongDealer.status, "no_match");
});

test("options-only refresh updates only the CM overlay and preserves XML catalog fields", () => {
  const match = findCmRefreshCandidate(
    { vin, cmStockId: null, cmDmsCarId: null },
    [cmRow],
    "dealer-1",
    "Dealer",
  );
  assert.equal(match.status, "match");
  if (match.status !== "match") return;

  const updates = buildCmRefreshUpdate("options_only", match.car, "XML Brand", "in", "2026-01-02T00:00:00.000Z");
  assert.deepEqual(Object.keys(updates).sort(), ["cmDmsCarId", "cmRefreshedAt", "cmStockId", "cmVerifiedExtras"]);
  assert.equal(updates.cmVerifiedExtras, "ABS");
  assert.equal(updates.cmStockId, "4321");
  assert.equal(updates.cmRefreshedAt.toISOString(), "2026-01-02T00:00:00.000Z");

  const catalogUpdates = buildCmRefreshUpdate(
    "catalog", match.car, "XML Brand", "in", "2026-01-02T00:00:00.000Z",
  );
  assert.equal(catalogUpdates.extras, "ABS");
  assert.equal(catalogUpdates.cmVerifiedExtras, "ABS", "catalog refresh must update the PDF-preferred overlay");
  assert.equal(catalogUpdates.syncedAt.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(catalogUpdates.cmRefreshedAt.toISOString(), "2026-01-02T00:00:00.000Z");

  const noOptionCar = findCmRefreshCandidate(
    { vin, cmStockId: null, cmDmsCarId: null },
    [{ ...cmRow, hasAbs: false }],
    "dealer-1",
    "Dealer",
  );
  assert.equal(noOptionCar.status, "match");
  if (noOptionCar.status === "match") {
    const clearedCatalogUpdates = buildCmRefreshUpdate(
      "catalog", noOptionCar.car, "XML Brand", "in", "2026-01-02T00:00:00.000Z",
    );
    assert.equal(clearedCatalogUpdates.extras, null);
    assert.equal(clearedCatalogUpdates.cmVerifiedExtras, null, "missing CM options must clear stale verified PDF overlay");
  }
});

test("shared car-search projection clears catalog warnings after a successful refresh", () => {
  const row = {
    id: 7,
    externalId: "local-car",
    type: "new",
    brand: "Test",
    model: "Model",
    year: 2025,
    modification: "1.5T",
    complectation: "Comfort",
    color: "White",
    price: 2_000_000,
    imageUrl: "https://images.example/car.jpg",
    vin,
    dealer: "Dealer",
    bodyType: "SUV",
    driveType: null,
    extras: "ABS",
    cmVerifiedExtras: null,
    cmDmsCarId: "dms-4321",
    catalogSource: "cm_business",
    cmStockId: "4321",
    cmStockState: "in",
    sourceUpdatedAt: new Date("2020-01-01T00:00:00.000Z"),
    syncedAt: new Date(),
  };
  const integration = {
    dealerId: "dealer-1",
    dealerName: "Dealer",
    mode: "catalog" as const,
    enabled: true,
    lastStatus: "success" as const,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastSuccessAt: null,
    lastError: null,
    stockCount: 1,
    matchedCount: 1,
    carsWithOptions: 1,
    optionsCount: 1,
    pagesFetched: 1,
    rowsScanned: 1,
    durationMs: 1,
  };
  const result = projectCarSearchResult(row, [integration]);

  assert.deepEqual(result.inventoryWarnings, []);
  assert.equal(result.cmRefreshAvailable, true);
  assert.equal(result.id, row.id, "search projection must retain the DB car ID for selected-car actions");

  const refreshedAt = new Date().toISOString();
  const refreshResponse = buildCmRefreshResponse(row, integration, true, refreshedAt);
  assert.equal(refreshResponse.data.id, row.id, "refresh response must retain the same selected-car ID");
  assert.equal(refreshResponse.data.sourceStale, false, "a just-completed full snapshot is authoritative");
  assert.equal(refreshResponse.refreshedAt, refreshedAt);
});

test("guarded refresh update uses null-safe preimage identity for all race-sensitive columns", () => {
  const local = {
    id: 17,
    vin: null,
    cmStockId: null,
    cmDmsCarId: "dms-17",
    brand: "Test",
    dealer: "Dealer",
  };
  const where = and(...buildCmRefreshGuard(local));
  assert.ok(where);
  const query = new PgDialect().sqlToQuery(where.getSQL());
  assert.equal((query.sql.match(/IS NOT DISTINCT FROM/g) ?? []).length, 5);
  assert.deepEqual(query.params, [17, "new", null, null, "dms-17", "Test", "Dealer"]);
});

test("refresh updated flag detects timestamp-only changes", () => {
  const previous = new Date("2026-01-01T00:00:00.000Z");
  const next = new Date("2026-01-01T00:00:01.000Z");
  assert.equal(hasCmRefreshChanges({ sourceUpdatedAt: previous }, { sourceUpdatedAt: next }), true);
  assert.equal(hasCmRefreshChanges({ sourceUpdatedAt: previous }, { sourceUpdatedAt: new Date(previous) }), false);
});

test("quote enrichment preserves manually refreshed DB values but retains live-feed enrichment for unmarked rows", () => {
  const baseCar = {
    type: "new" as const,
    externalId: "quote-car",
    dealer: "Dealer",
    catalogSource: "cm_business",
    model: "DB model",
    modification: "DB trim",
    complectation: "DB package",
    year: 2025,
    price: 2_000_000,
    color: "DB color",
    imageUrl: "https://db.example/car.jpg",
    vin,
    bodyType: "SUV",
    cmStockId: "4321",
    cmStockState: "in",
    extras: "DB options",
    cmVerifiedExtras: "DB verified options",
  };
  const liveFeed = {
    id: "quote-car",
    mark: "Test",
    model: "Stale feed model",
    modification: "Stale feed trim",
    complectation: "Stale feed package",
    year: 2020,
    price: 1,
    color: "Stale feed color",
    bodyType: "Sedan",
    availability: "",
    url: "",
    images: ["https://feed.example/stale.jpg"],
    dealer: "Dealer",
    maxDiscount: 0,
    creditDiscount: 0,
    tradeinDiscount: 0,
    extras: "Stale feed options",
    description: "",
    vin: "STALE",
    doorsCount: 4,
    wheel: "",
    armored: "",
    custom: "",
    phone: "",
    notRegisteredInRussia: false,
    acceptedAutoruExclusive: false,
    popularity_score: 0,
    catalogSource: "cm_business" as const,
    cmStockId: "9999",
    stockState: "out",
    sourceUpdatedAt: null,
  } as NewCarRecord;

  const refreshedCar = { ...baseCar, cmRefreshedAt: new Date() };
  assert.equal(mergeQuoteCarWithFeed(refreshedCar, liveFeed), refreshedCar);
  const unmarkedCar = { ...baseCar, cmRefreshedAt: null };
  const enriched = mergeQuoteCarWithFeed(unmarkedCar, liveFeed);
  assert.equal(enriched.model, "Stale feed model");
  assert.equal(enriched.color, "Stale feed color");
  assert.equal(enriched.imageUrl, "https://feed.example/stale.jpg");
  assert.equal(enriched.extras, "Stale feed options");
  assert.equal(enriched.cmVerifiedExtras, "Stale feed options");
});