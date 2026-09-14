import assert from "node:assert/strict";
import test from "node:test";
import { filterManagerQuoteCarsByBrand, managerQuoteBrandMatches } from "./manager-quote-brand";

const mixedCars = [
  { externalId: "gw-1", brand: "Great Wall", model: "Poer" },
  { externalId: "haval-city-1", brand: "Haval City", model: "Jolion" },
  { externalId: "gw-2", brand: "Great Wall", model: "Wingle" },
  { externalId: "haval-city-2", brand: "Haval City", model: "F7" },
] as const;

test("Great Wall search cannot include Haval City cars", () => {
  const result = filterManagerQuoteCarsByBrand(mixedCars, "Great Wall");

  assert.deepEqual(result.map(car => car.brand), ["Great Wall", "Great Wall"]);
  assert.ok(result.every(car => managerQuoteBrandMatches(car.brand, "Great Wall")));
});

test("Haval City search cannot include Great Wall cars", () => {
  const result = filterManagerQuoteCarsByBrand(mixedCars, "Haval City");

  assert.deepEqual(result.map(car => car.brand), ["Haval City", "Haval City"]);
  assert.ok(result.every(car => managerQuoteBrandMatches(car.brand, "Haval City")));
});

test("brand matching is case-insensitive but never substring-based", () => {
  assert.equal(managerQuoteBrandMatches("great wall", "Great Wall"), true);
  assert.equal(managerQuoteBrandMatches("Haval City", "Haval"), false);
  assert.equal(managerQuoteBrandMatches("Great Wall", "Haval City"), false);
});