import assert from "node:assert/strict";
import test from "node:test";
import {
  clearNewCarsCache,
  getCmBusinessFeedState,
  getCmBusinessPublicIdSet,
  getTenetPlusPublicIdSet,
  isCmBusinessDealer,
  isPublicNewCarEligible,
  toPublicNewCar,
  type NewCarRecord,
} from "./new-cars";

const tenetPlus = {
  dealer: "Tenet Plus",
  stockState: "in",
  model: "L6",
  modification: "1.5 AMT (147 л.с.)",
  complectation: "",
  images: ["https://cdn.example/car.jpg"],
};

test("Tenet Plus public stock needs an in-stock CM record, usable photo, model, and trim or modification name", () => {
  assert.equal(isPublicNewCarEligible(tenetPlus), true);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, complectation: "Комфорт", modification: "" }), true);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, stockState: "out" }), false);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, stockState: null }), false);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, images: [] }), false);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, images: ["javascript:alert(1)"] }), false);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, images: [], imageUrl: "https://cdn.example/car.jpg" }), true);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, model: "" }), false);
  assert.equal(isPublicNewCarEligible({ ...tenetPlus, modification: "", complectation: "" }), false);
});

test("other new-car dealers retain their existing public eligibility", () => {
  assert.equal(isPublicNewCarEligible({
    dealer: "Tenet", stockState: null, model: "", modification: "",
    complectation: "", images: [],
  }), true);
});

test("Jeland CM Business public stock requires in-stock, HTTPS photo, model and trim or modification", () => {
  const jeland = {
    dealer: "Jeland",
    stockState: "in",
    model: "J6",
    modification: "1.5T",
    complectation: "",
    images: ["https://cdn.example/car.jpg"],
  };
  assert.equal(isPublicNewCarEligible(jeland), true);
  assert.equal(isPublicNewCarEligible({ ...jeland, stockState: "out" }), false);
  assert.equal(isPublicNewCarEligible({ ...jeland, images: ["http://cdn.example/car.jpg"] }), false);
  assert.equal(isPublicNewCarEligible({ ...jeland, images: [], imageUrl: "https://cdn.example/car.jpg" }), true);
  assert.equal(isPublicNewCarEligible({ ...jeland, model: "" }), false);
  assert.equal(isPublicNewCarEligible({ ...jeland, modification: "", complectation: "" }), false);
  assert.equal(isPublicNewCarEligible({ ...jeland, modification: "", complectation: "Luxury" }), true);
});

test("CM Business dealer contract recognizes both dealers and scopes feed state by dealer", () => {
  clearNewCarsCache();
  assert.equal(isCmBusinessDealer(" Tenet Plus "), true);
  assert.equal(isCmBusinessDealer("JELAND"), true);
  assert.equal(isCmBusinessDealer(null), false);
  assert.deepEqual(getCmBusinessFeedState("Jeland"), { complete: false, cachedCount: 0 });
  assert.deepEqual(getCmBusinessFeedState("Tenet Plus"), { complete: false, cachedCount: 0 });
  assert.equal(getCmBusinessPublicIdSet("Jeland").size, 0);
  assert.equal(getCmBusinessPublicIdSet("Tenet Plus").size, 0);
  assert.equal(getTenetPlusPublicIdSet().size, 0);
});

test("DB-backed public pages have no confirmed Tenet Plus IDs before a completed source scan", () => {
  clearNewCarsCache();
  assert.equal(getTenetPlusPublicIdSet().size, 0);
});

test("public new-car records never expose CM inventory identifiers or freshness metadata", () => {
  const car = {
    ...tenetPlus,
    id: "tenet-plus-cme-83183067",
    catalogSource: "cm_business",
    cmStockId: "83183067",
    cmDmsCarId: "private-dms-id",
    sourceUpdatedAt: "2026-09-24T00:00:00.000Z",
  } as NewCarRecord;
  const publicCar = toPublicNewCar(car);
  assert.equal(publicCar.id, car.id);
  assert.deepEqual(
    ["catalogSource", "cmStockId", "cmDmsCarId", "stockState", "sourceUpdatedAt"]
      .filter(key => key in publicCar),
    [],
  );
});