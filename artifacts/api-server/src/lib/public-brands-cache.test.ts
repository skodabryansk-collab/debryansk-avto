import assert from "node:assert/strict";
import test from "node:test";
import {
  brandIdsSignature,
  parsePublicBrandsCache,
  sanitizeCachedBrandData,
  type PublicBrandsCacheSnapshot,
} from "./public-brands-cache";

const snapshot: PublicBrandsCacheSnapshot = {
  data: [
    { name: "Tenet Plus", carCount: 12 },
    { name: "Jeland", carCount: 8 },
    { name: "Haval", carCount: 20 },
  ],
  ts: 100,
  tenetPlusComplete: true,
  tenetPlusIds: brandIdsSignature(new Set(["tp-1", "tp-2"])),
  jelandComplete: true,
  jelandIds: brandIdsSignature(new Set(["j-1"])),
};

test("persisted cache is rejected when its shape is invalid", () => {
  assert.equal(parsePublicBrandsCache(null), null);
  assert.equal(parsePublicBrandsCache({ ...snapshot, data: [{ name: "Haval", carCount: "20" }] }), null);
  assert.deepEqual(parsePublicBrandsCache(snapshot), snapshot);
});

test("stale or unverified Tenet Plus and Jeland counts are hidden", () => {
  const data = sanitizeCachedBrandData(snapshot, {
    tenetPlus: { complete: false, ids: new Set() },
    jeland: { complete: true, ids: new Set(["j-other"]) },
  });

  assert.deepEqual(data.map(brand => brand.carCount), [0, 0, 20]);
});

test("verified special-dealer counts are retained only for matching complete feeds", () => {
  const data = sanitizeCachedBrandData(snapshot, {
    tenetPlus: { complete: true, ids: new Set(["tp-2", "tp-1"]) },
    jeland: { complete: true, ids: new Set(["j-1"]) },
  });

  assert.deepEqual(data.map(brand => brand.carCount), [12, 8, 20]);
});
