import assert from "node:assert/strict";
import test from "node:test";
import { formatManagerQuoteCarTitle } from "./manager-quote-display";

test("quote form displays the selected car's original Great Wall brand", () => {
  assert.equal(
    formatManagerQuoteCarTitle({ brand: "Great Wall", model: "Poer", year: 2025 }),
    "Great Wall Poer 2025",
  );
});

test("quote form displays the selected car's original Haval City brand", () => {
  assert.equal(
    formatManagerQuoteCarTitle({ brand: "Haval City", model: "Jolion", year: 2025 }),
    "Haval City Jolion 2025",
  );
});