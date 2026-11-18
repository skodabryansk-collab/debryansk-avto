import assert from "node:assert/strict";
import { renderVehicleTag } from "./render";

const html = renderVehicleTag({
  brand: "Haval",
  model: "Dargo",
  year: 2026,
  variants: [
    { name: "Оптимум", engine: "Бензин · 2,0 л · 200 л.с.", gearbox: "7DCT", drive: "4WD" },
  ],
  specs: [
    { label: "Двигатели", value: "Бензин · 2,0 л · 200 л.с." },
    { label: "Коробки передач", value: "7DCT" },
  ],
  address: "Брянск, Литейная 3/2",
  qrDataUrl: "data:image/png;base64,cW9y",
  qrLabel: "Каталог Haval Dargo",
});

assert.match(html, /Haval/);
assert.match(html, /Dargo/);
assert.match(html, /ПРОСТРАНСТВО АВТОМОБИЛЕЙ/);
assert.match(html, /Брянск, Литейная 3\/2/);
assert.match(html, /data:image\/svg\+xml;base64,/);
assert.match(html, /data:image\/png;base64,cW9y/);
assert.doesNotMatch(html, /₽|VIN|Клиент|Телефон клиента/i);

const escapedHtml = renderVehicleTag({
  brand: "<script>alert(1)</script>",
  model: "Safe & Sound",
  year: null,
  variants: [{ name: "Trim", engine: "", gearbox: "", drive: "" }],
  specs: [],
  address: "Брянск",
  qrDataUrl: "data:image/png;base64,cW9y",
  qrLabel: "Каталог",
});
assert.doesNotMatch(escapedHtml, /<script>/);
assert.match(escapedHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(escapedHtml, /Технические данные в каталоге не указаны/);

process.stdout.write("Vehicle tag renderer tests passed\n");
