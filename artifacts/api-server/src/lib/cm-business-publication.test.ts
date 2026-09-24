import assert from "node:assert/strict";
import test from "node:test";
import { filterIndexableNewCarIds, isManagedCmDetailPath } from "./cm-business-publication";

test("SEO extras cannot restore old or manager-only Jeland detail URLs", () => {
  assert.equal(isManagedCmDetailPath("/new-cars/jeland-old-xml-car"), true);
  assert.equal(isManagedCmDetailPath("/new-cars/jeland-cme-123"), true);
  assert.equal(isManagedCmDetailPath("/new-cars/tenet-plus-cme-123"), true);
  assert.equal(isManagedCmDetailPath("/new-cars/tenet-cme-123"), false);
  assert.equal(isManagedCmDetailPath("/brands/jeland"), false);
});

test("IndexNow excludes incomplete Jeland cars but preserves confirmed stock and other dealers", () => {
  assert.deepEqual(
    filterIndexableNewCarIds(
      ["jeland-cme-1", "jeland-cme-2", "jeland-dms-3", "tenet-plus-cme-4", "jaecoo-5"],
      new Set(["jeland-cme-2"]),
    ),
    ["jeland-cme-2", "tenet-plus-cme-4", "jaecoo-5"],
  );
  assert.deepEqual(filterIndexableNewCarIds(["jeland-cme-2"], new Set()), []);
});