import assert from "node:assert/strict";
import test from "node:test";
import { verifiedQuoteExtras } from "./quote-car-extras";

test("legacy Jeland XML equipment is not passed into a new or regenerated quote", () => {
  assert.equal(verifiedQuoteExtras({ dealer: "Jeland", catalogSource: null, extras: "Круиз-контроль" }), "");
  assert.equal(verifiedQuoteExtras({ dealer: "Jeland", catalogSource: null, extras: "Круиз-контроль" },
    { dealer: "Jeland", catalogSource: "cm_business", extras: "Камера заднего вида" }), "");
  assert.equal(verifiedQuoteExtras(null,
    { dealer: "Jeland", catalogSource: null, extras: "Круиз-контроль" }), "");
});

test("verified CM Jeland options survive a missing DB row via the saved quote snapshot", () => {
  assert.equal(verifiedQuoteExtras({ dealer: "Jeland", catalogSource: "cm_business", extras: "ABS" }), "ABS");
  assert.equal(verifiedQuoteExtras(null,
    { dealer: "Jeland", catalogSource: "cm_business", extras: "ABS" }), "ABS");
  assert.equal(verifiedQuoteExtras({ dealer: "Jeland", catalogSource: "cm_business", extras: "" },
    { dealer: "Jeland", catalogSource: "cm_business", extras: "ABS" }), "");
});

test("non-Jeland quote equipment keeps its existing fallback behavior", () => {
  assert.equal(verifiedQuoteExtras({ dealer: "Tenet Plus", extras: null },
    { extras: "Подогрев сидений" }), "Подогрев сидений");
});