import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

export interface VehicleTagVariant {
  name: string;
  engine: string;
  gearbox: string;
  drive: string;
}

export interface VehicleTagSpec {
  label: string;
  value: string;
}

export interface VehicleTagData {
  brand: string;
  model: string;
  year: number | null;
  variants: VehicleTagVariant[];
  specs: VehicleTagSpec[];
  address: string;
  qrDataUrl: string;
  qrLabel: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requiredText(value: string): string {
  return escapeHtml(value.trim());
}

function getCompanyLogoDataUrl(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const logoCandidates = [
    path.join(moduleDirectory, "logo-da.svg"),
    path.resolve(moduleDirectory, "../kp/logo-da.svg"),
  ];
  const logoPath = logoCandidates.find(candidate => existsSync(candidate));
  if (!logoPath) {
    throw new Error("Company logo for vehicle tag PDF was not found");
  }

  const encodedLogo = readFileSync(logoPath).toString("base64");
  return `data:image/svg+xml;base64,${encodedLogo}`;
}

export function renderVehicleTag(data: VehicleTagData): string {
  const logoDataUrl = getCompanyLogoDataUrl();
  const dense = data.variants.length > 6;
  const ultraDense = data.variants.length > 12;
  const modelSize = data.model.length > 17 ? 30 : data.model.length > 11 ? 36 : 42;
  const specColumns = Math.max(1, Math.min(4, data.specs.length));
  const variantsHtml = data.variants.length
    ? data.variants.map(variant => `
      <article class="variant">
        <h3>${requiredText(variant.name)}</h3>
        ${variant.engine ? `<p>${requiredText(variant.engine)}</p>` : ""}
        ${variant.gearbox ? `<p>${requiredText(variant.gearbox)}</p>` : ""}
        ${variant.drive ? `<p class="drive">${requiredText(variant.drive)}</p>` : ""}
      </article>
    `).join("")
    : `<p class="empty">Данные о комплектациях в каталоге не указаны.</p>`;
  const specsHtml = data.specs.length
    ? data.specs.map(spec => `
      <div class="spec">
        <dt>${requiredText(spec.label)}</dt>
        <dd>${requiredText(spec.value)}</dd>
      </div>
    `).join("")
    : `<p class="empty">Технические данные в каталоге не указаны.</p>`;
  const yearHtml = data.year
    ? `<div class="year"><span>Модельный год</span><strong>${data.year}</strong></div>`
    : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${requiredText(data.brand)} ${requiredText(data.model)} — Дебрянск Авто</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
    body {
      color: #17191c;
      background: #fff;
      font-family: Arial, "DejaVu Sans", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      padding: 11mm 13mm 9mm;
    }
    .rail { position: absolute; inset: 0 auto 0 0; width: 1.4mm; background: #4a4d52; }
    .brand-lockup {
      position: relative;
      width: 54mm;
      height: 9mm;
      flex: 0 0 auto;
      overflow: hidden;
    }
    .logo { display: block; width: 100%; height: 100%; object-fit: fill; filter: brightness(0); }
    .tagline {
      position: absolute;
      top: 76%;
      right: 0;
      left: 22.1%;
      height: 24%;
      overflow: hidden;
      margin: 0;
      background: #fff;
      color: #17191c;
      font-size: 5.8pt;
      font-weight: 600;
      line-height: 1;
      letter-spacing: .08em;
      white-space: nowrap;
    }
    .top-rule { height: 0; margin-top: 5mm; border: 0; border-top: .45pt solid #c9cdd1; }
    .identity {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 32mm;
      align-items: end;
      gap: 7mm;
      padding: 8mm 0;
      border-bottom: 1.2pt solid #17191c;
    }
    .identity.no-year { grid-template-columns: 1fr; }
    .brand-name {
      margin: 0 0 2mm;
      color: #45494f;
      font-family: "DejaVu Sans Mono", monospace;
      font-size: 17pt;
      font-weight: 700;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: ${modelSize}pt;
      font-weight: 800;
      line-height: .9;
      letter-spacing: -.055em;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .year { padding: 0 0 1mm 4mm; border-left: .6pt solid #aeb4ba; }
    .year span {
      display: block;
      color: #686d73;
      font-family: "DejaVu Sans Mono", monospace;
      font-size: 7.5pt;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .year strong { display: block; margin-top: 1.5mm; font-size: 23pt; line-height: 1; }
    .config {
      display: grid;
      grid-template-columns: 35mm minmax(0, 1fr);
      gap: 6mm;
      padding: 6mm 0;
      border-bottom: .5pt solid #c9cdd1;
    }
    .config-label { padding-top: 3.5mm; }
    .config-label h2, .specs-title, .qr-title { margin: 0; font-size: 12pt; font-weight: 700; line-height: 1.2; }
    .variants { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.5mm; align-content: start; }
    .variant { min-width: 0; padding: 3mm; border: .5pt solid #c7ccd1; border-radius: 1.5mm; }
    .variant h3 { margin: 0; font-size: 9.5pt; line-height: 1.2; overflow-wrap: anywhere; }
    .variant p { margin: 2mm 0 0; color: #555b62; font-size: 8pt; line-height: 1.3; overflow-wrap: anywhere; }
    .variant .drive { color: #17191c; font-family: "DejaVu Sans Mono", monospace; font-weight: 700; }
    .specs { padding: 6mm 0; }
    .specs-title { margin-bottom: 3mm; font-size: 14pt; }
    .spec-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; border-top: .5pt solid #c9cdd1; border-left: .5pt solid #c9cdd1; }
    .spec { min-height: 21mm; padding: 3mm; border-right: .5pt solid #c9cdd1; border-bottom: .5pt solid #c9cdd1; }
    .spec dt { margin: 0 0 2mm; color: #646a70; font-size: 7.5pt; line-height: 1.25; }
    .spec dd { margin: 0; font-size: 10pt; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
    .empty { margin: 0; color: #646a70; font-size: 9pt; line-height: 1.4; }
    .qr-section { margin-top: 2mm; padding: 3.5mm; border: .65pt solid #b9bec4; border-radius: 1.5mm; }
    .qr-layout { display: grid; grid-template-columns: minmax(0, 1fr) 36mm; align-items: center; gap: 5mm; }
    .qr-copy { display: flex; flex-direction: column; justify-content: center; }
    .qr-title { font-size: 14pt; }
    .qr-copy p { max-width: 78mm; margin: 2mm 0 0; color: #565c62; font-size: 9pt; line-height: 1.4; }
    .qr-box { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .qr-image { display: block; width: 29mm; height: 29mm; object-fit: contain; }
    .qr-label { margin: 1.5mm 0 0; font-size: 7.5pt; font-weight: 700; line-height: 1.2; }
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 5mm;
      margin-top: 0;
      padding-top: 3mm;
      border-top: .65pt solid #17191c;
      color: #535960;
      font-family: "DejaVu Sans Mono", monospace;
      font-size: 7.5pt;
    }
    .dense .config { padding: 4mm 0; }
    .dense .config-label { padding-top: 2mm; }
    .dense .variants { gap: 1.7mm; }
    .dense .variant { padding: 2mm; }
    .dense .variant h3 { font-size: 8pt; }
    .dense .variant p { margin-top: 1mm; font-size: 7pt; }
    .dense .specs { padding: 4mm 0; }
    .dense .spec { min-height: 18mm; padding: 2.3mm; }
    .dense .qr-section { margin-top: 1mm; padding: 2.5mm; }
    .ultra-dense .config { padding: 3mm 0; }
    .ultra-dense .variants { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.2mm; }
    .ultra-dense .variant { padding: 1.4mm; }
    .ultra-dense .variant h3 { font-size: 7pt; }
    .ultra-dense .variant p { margin-top: .7mm; font-size: 6.3pt; }
  </style>
</head>
<body>
  <main class="sheet${dense ? " dense" : ""}${ultraDense ? " ultra-dense" : ""}">
    <div class="rail" aria-hidden="true"></div>
    <header><div class="brand-lockup">
      <img class="logo" src="${logoDataUrl}" alt="Дебрянск Авто">
      <p class="tagline">ПРОСТРАНСТВО АВТОМОБИЛЕЙ</p>
    </div></header>
    <hr class="top-rule">
    <section class="identity${data.year ? "" : " no-year"}">
      <div>
        <p class="brand-name">${requiredText(data.brand)}</p>
        <h1>${requiredText(data.model)}</h1>
      </div>
      ${yearHtml}
    </section>
    <section class="config" aria-label="Доступные комплектации и агрегаты">
      <div class="config-label"><h2>Комплектации<br>и агрегаты</h2></div>
      <div class="variants">${variantsHtml}</div>
    </section>
    <section class="specs" aria-label="Технические характеристики">
      <h2 class="specs-title">Технические характеристики</h2>
      <dl class="spec-grid" style="grid-template-columns:repeat(${specColumns}, minmax(0, 1fr))">${specsHtml}</dl>
    </section>
    <section class="qr-section" aria-label="Подборка модели">
      <div class="qr-layout">
        <div class="qr-copy">
          <h2 class="qr-title">Подборка модели</h2>
          <p>Комплектации и модификации</p>
        </div>
        <div class="qr-box">
          <img class="qr-image" src="${requiredText(data.qrDataUrl)}" alt="${requiredText(data.qrLabel)}">
          <p class="qr-label">${requiredText(data.qrLabel)}</p>
        </div>
      </div>
    </section>
    <footer>
      <span>${requiredText(data.address)}</span>
      <span>debryansk-auto.ru</span>
    </footer>
  </main>
</body>
</html>`;
}
