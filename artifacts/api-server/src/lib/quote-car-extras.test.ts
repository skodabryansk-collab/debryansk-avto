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

test("Tenet Plus options are also gated by CM provenance, without restoring old snapshots", () => {
  assert.equal(verifiedQuoteExtras({ dealer: "Tenet Plus", extras: "Подогрев сидений" },
    { extras: "ABS" }), "");
  assert.equal(verifiedQuoteExtras({ dealer: "Tenet Plus", catalogSource: "cm_business", extras: "ABS" }), "ABS");
  assert.equal(verifiedQuoteExtras({ dealer: "Tenet Plus", catalogSource: "cm_business", extras: null },
    { catalogSource: "cm_business", extras: "ABS" }), "");
  assert.equal(verifiedQuoteExtras(null,
    { dealer: "Tenet Plus", catalogSource: "cm_business", extras: "ABS" }), "ABS");
  assert.equal(verifiedQuoteExtras(null,
    { dealer: "Tenet Plus", extras: "Подогрев сидений" }), "");
});

test("other dealers retain their quote equipment fallback", () => {
  assert.equal(verifiedQuoteExtras({ dealer: "Tenet", extras: null },
    { extras: "Подогрев сидений" }), "Подогрев сидений");
});