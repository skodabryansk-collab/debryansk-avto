import assert from "node:assert/strict";
import {
  enrichVehicleTagData,
  loadVehicleTagSpecRecords,
  parseVehicleSpecCsv,
} from "./vehicle-tag-enrichment";

const csv = [
  "source_brand_label,model,model_year,production_year,trim_name_ru,trim_name_en,variant_key,scope,spec_key,label_ru,value,unit,source_file,page,notes",
  'HAVAL,H7,2026,2026,Премиум,Premium,,trim,transmission,Коробка передач,7DCT,,source.pdf,1,',
  'HAVAL,H7,2026,2026,Премиум,Premium,,trim,drive_type,Тип привода,Полный привод,,source.pdf,1,',
  'HAVAL,H7,2026,2026,Премиум,Premium,,trim,fuel_type,Тип топлива,АИ-95,,source.pdf,1,',
  'HAVAL,H7,2026,2026,Премиум,Premium,,trim,engine_displacement,Рабочий объём,1998,см³,source.pdf,1,',
  'HAVAL,H7,2026,2026,Премиум,Premium,,trim,max_power_hp,Максимальная мощность,200,л.с.,source.pdf,1,',
  'HAVAL,H7,2026,2026,,,,model,dimensions_l_w_h,Длина × ширина × высота,"4700 × 1900 × 1700",мм,source.pdf,1,',
  'HAVAL,H7,2025,2025,Премиум,Premium,,trim,transmission,Коробка передач,6MT,,old-source.pdf,1,',
].join("\n");

const records = parseVehicleSpecCsv(csv);
assert.equal(records.length, 7);
assert.equal(records.at(-1)?.value, "6MT");

const activeRows = [{
  complectation: "Премиум",
  modification: null,
  fuelType: null,
  engineVolume: null,
  enginePower: null,
  driveType: null,
  bodyType: null,
}];

const enriched = enrichVehicleTagData({
  records,
  brand: "Haval",
  model: "H7",
  year: 2026,
  variants: [{ name: "Премиум", engine: "", gearbox: "", drive: "" }],
  activeRows,
  activeSpecs: [],
});

assert.deepEqual(enriched.variants[0], {
  name: "Премиум",
  engine: "АИ-95 · 2,0 л · 200 л.с.",
  gearbox: "7DCT",
  drive: "Полный привод",
});
assert.ok(enriched.specs.some(spec => spec.label === "Длина × ширина × высота" && spec.value === "4700 × 1900 × 1700 мм"));
assert.ok(!enriched.specs.some(spec => spec.value.includes("6MT")));

const authoritative = enrichVehicleTagData({
  records,
  brand: "HAVAL",
  model: "H7",
  year: 2026,
  variants: [{ name: "Премиум", engine: "2.0T · 200 л.с.", gearbox: "8AT", drive: "4WD" }],
  activeRows: [{
    ...activeRows[0]!,
    fuelType: "Бензин",
    engineVolume: 2,
    enginePower: 245,
    driveType: "Передний привод",
    modification: "2.0T 8AT",
  }],
  activeSpecs: [
    { label: "Двигатели", value: "2.0T · 245 л.с." },
    { label: "Коробки передач", value: "8AT" },
    { label: "Привод", value: "Передний привод" },
  ],
});

assert.deepEqual(authoritative.variants[0], {
  name: "Премиум",
  engine: "2.0T · 200 л.с.",
  gearbox: "8AT",
  drive: "4WD",
});
assert.equal(authoritative.specs.find(spec => spec.label === "Коробки передач")?.value, "8AT");
assert.ok(!authoritative.specs.some(spec => spec.label === "Максимальная мощность"));
assert.ok(!authoritative.specs.some(spec => spec.label === "Тип топлива"));

const productionRecords = loadVehicleTagSpecRecords();
assert.ok(productionRecords.length > 1_000);
const actualH9 = enrichVehicleTagData({
  records: productionRecords,
  brand: "Haval",
  model: "H9",
  year: 2026,
  variants: [{ name: "Премиум", engine: "", gearbox: "", drive: "" }],
  activeRows: [{
    complectation: "Премиум",
    modification: null,
    fuelType: null,
    engineVolume: null,
    enginePower: null,
    driveType: null,
    bodyType: null,
  }],
  activeSpecs: [],
});
assert.ok(actualH9.variants[0]?.engine);
assert.ok(actualH9.variants[0]?.gearbox);
assert.ok(actualH9.variants[0]?.drive);
assert.ok(actualH9.specs.some(spec => spec.label === "Длина × ширина × высота"));

assert.throws(() => parseVehicleSpecCsv("missing,headers\n1,2"), /missing required columns/i);
process.stdout.write("Vehicle tag enrichment tests passed\n");
