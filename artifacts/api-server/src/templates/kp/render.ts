import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const templateHtml = fs.readFileSync(path.join(DIR, "kp-template.html"), "utf8");
const logoDA = fs.readFileSync(path.join(DIR, "logo-da.svg"), "utf8");

const NBSP = "\u00a0";
const fmtRub = (n: number) =>
  n.toLocaleString("ru-RU").replace(/\s/g, NBSP) + NBSP + "₽";

const SPEC_ICONS: Record<string, string> = {
  engine: "i-engine",
  gearbox: "i-gearbox",
  drive: "i-drive",
  vin: "i-vin",
  body: "i-body",
  seat: "i-seat",
};

interface Spec { icon: string; label: string; value: string; }
interface Discount { label: string; value: number; }
interface OptionCategory { category: string; items: string[]; }

export interface KpData {
  kpNumber: string;
  kpDate: string;
  validUntil: string;
  clientSalutation: string;
  brand: string;
  contactsTitle: string;
  brandLogo: string;
  carTitle: string;
  carTrim: string;
  carImage: string;
  qrCode: string;
  carUrl: string;
  specs: Spec[];
  priceBase: number;
  discounts: Discount[];
  options: OptionCategory[];
  extraEquipment?: { text: string; price?: number };
  creditOffer?: { term: string; rate: string; monthlyPayment: number; downPayment?: number };
  tradeIn?: { priceFrom?: number; priceTo?: number };
  salesHead?: { name: string; position: string; phone?: string; email?: string };
  dealer: {
    name: string;
    address: string;
    addressFull: string;
    hours: string;
    phone: string;
    site: string;
  };
  manager: {
    name: string;
    initials: string;
    position: string;
    phone: string;
    email: string;
    photoBase64?: string;
  };
  legal: string;
}

function specsHtml(specs: Spec[]): string {
  return specs.map(({ icon, label, value }) => `
      <div class="spec">
        <span class="spec-ico"><svg><use href="#${SPEC_ICONS[icon] ?? "i-engine"}"/></svg></span>
        <div><div class="spec-label">${label}</div><div class="spec-value">${value}</div></div>
      </div>`).join("");
}

function priceRowsHtml(priceBase: number, discounts: Discount[]): string {
  const activeDiscounts = discounts.filter(d => d.value > 0);
  const rows: Array<[string, number, boolean]> = [
    [`Цена автомобиля, вкл. НДС`, priceBase, false],
    ...activeDiscounts.map((x): [string, number, boolean] => [x.label, x.value, true]),
  ];
  return rows.map(([label, value, disc]) =>
    `\n    <div class="price-row${disc ? " is-discount" : ""}"><span>${label}</span><b>${disc ? "−" + NBSP : ""}${fmtRub(value)}</b></div>`
  ).join("");
}

function extraEquipBlock(d: KpData): string {
  if (!d.extraEquipment?.text?.trim()) return "";
  const price = d.extraEquipment.price
    ? `<div class="extra-price">Стоимость: <b>${fmtRub(d.extraEquipment.price)}</b></div>`
    : "";
  return `<div class="info-block"><div class="info-block-head">Дополнительное оборудование</div><p class="info-block-text">${d.extraEquipment.text.replace(/\n/g, "<br>")}</p>${price}</div>`;
}

function creditBlock(d: KpData): string {
  const co = d.creditOffer;
  if (!co || (!co.term && !co.rate && !co.monthlyPayment && !co.downPayment)) return "";
  const cols: Array<{ label: string; val: string }> = [];
  if (co.term) cols.push({ label: "Срок кредита", val: co.term });
  if (co.rate) {
    const rate = co.rate.trim().replace(/%$/, "").replace(".", ",");
    cols.push({ label: "Процентная ставка", val: `${rate}%` });
  }
  if (co.downPayment) cols.push({ label: "Первоначальный взнос", val: fmtRub(co.downPayment) });
  if (co.monthlyPayment) cols.push({ label: "Ежемесячный платёж", val: fmtRub(co.monthlyPayment) });
  const n = cols.length;
  const labels = cols.map(c => `<div class="cr-label">${c.label}</div>`).join("");
  const vals   = cols.map(c => `<div class="cr-val">${c.val}</div>`).join("");
  return `<div class="info-block credit-block"><div class="info-block-head">Кредитное предложение</div><div class="credit-grid" style="grid-template-columns:repeat(${n},1fr)">${labels}<div class="cr-divider"></div>${vals}</div></div>`;
}

function tradeInBlock(d: KpData): string {
  const ti = d.tradeIn;
  if (!ti || (!ti.priceFrom && !ti.priceTo)) return "";
  let display = "";
  if (ti.priceFrom && ti.priceTo) {
    display = `от${NBSP}${fmtRub(ti.priceFrom)} до${NBSP}${fmtRub(ti.priceTo)}`;
  } else if (ti.priceFrom) {
    display = fmtRub(ti.priceFrom);
  } else {
    display = `до${NBSP}${fmtRub(ti.priceTo!)}`;
  }
  return `<div class="info-block"><div class="info-block-head">Оценка вашего автомобиля</div><div class="tradein-price">${display}</div></div>`;
}

function optionalBlocksHtml(d: KpData): string {
  const extraHtml = extraEquipBlock(d);
  const creditHtml = creditBlock(d);
  const tradeHtml = tradeInBlock(d);

  let topRow = "";
  if (extraHtml && creditHtml) {
    topRow = `<div class="optional-grid">${extraHtml}${creditHtml}</div>`;
  } else if (extraHtml) {
    topRow = extraHtml;
  } else if (creditHtml) {
    topRow = creditHtml;
  }

  return topRow + tradeHtml;
}

function headManagerBlock(d: KpData): string {
  if (!d.salesHead?.name) return "";
  const initials = d.salesHead.name
    .split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const phoneRow = d.salesHead.phone
    ? `<div class="contact-row"><span class="contact-ico"><svg><use href="#i-phone"/></svg></span><div><div class="cr-label">Телефон</div><div class="cr-value">${d.salesHead.phone}</div></div></div>` : "";
  const emailRow = d.salesHead.email
    ? `<div class="contact-row"><span class="contact-ico"><svg><use href="#i-mail"/></svg></span><div><div class="cr-label">E-mail</div><div class="cr-value">${d.salesHead.email}</div></div></div>` : "";
  return `<div class="contact-card contact-card--full"><div class="contact-card-title">Руководитель отдела продаж</div><div class="head-mgr-inner"><div class="manager-head" style="margin-bottom:0"><div class="avatar">${initials}</div><div><div class="manager-name">${d.salesHead.name}</div><div class="manager-role">${d.salesHead.position}</div></div></div><div class="head-mgr-contacts">${phoneRow}${emailRow}</div></div></div>`;
}

function layoutOptionPages(categories: OptionCategory[]): OptionCategory[][] {
  const lineCost = (item: string) => Math.ceil(item.length / 52);
  const catCost = (cat: OptionCategory) =>
    4 + cat.items.reduce((s, i) => s + lineCost(i), 0) / 2;
  const pages: OptionCategory[][] = [];
  let current: OptionCategory[] = [];
  let budget = 44;
  for (const cat of categories) {
    const cost = catCost(cat);
    if (current.length && budget - cost < 0) {
      pages.push(current);
      current = [];
      budget = 52;
    }
    current.push(cat);
    budget -= cost;
  }
  if (current.length) pages.push(current);
  return pages;
}

function optionsPagesHtml(
  d: KpData,
  pagesTotal: number,
  footHtml: (num: number, total: number) => string
): string {
  const pages = layoutOptionPages(d.options);
  return pages.map((cats, i) => {
    const catsHtml = cats.map(cat => `
      <div class="opt-category">
        <div class="opt-cat-head"><span class="cat-dot"></span>${cat.category}<span class="cat-count">${cat.items.length} позиций</span></div>
        <ul class="opt-list">${cat.items.map(it => `<li>${it}</li>`).join("")}</ul>
      </div>`).join("");
    const intro = i === 0
      ? `\n      <div class="kicker section-kicker">Комплектация</div>
      <h2 class="section-title">Оснащение автомобиля</h2>
      <p class="section-sub">${d.carTitle} ${d.carTrim} — стандартное и дополнительное оборудование</p>`
      : `\n      <div class="kicker section-kicker">Комплектация — продолжение</div>`;
    return `
<div class="page">
  <header class="run-head">
    <span class="doc-ref">Коммерческое предложение № ${d.kpNumber} · ${d.carTitle}</span>
    <div class="brand-mark">${d.brandLogo}</div>
  </header>
  ${intro}
  ${catsHtml}
  <footer class="page-foot">${footHtml(2 + i, pagesTotal)}</footer>
</div>`;
  }).join("\n");
}

function carPlaceholder(title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#f8fafc"/>
    <g stroke="#cbd5e1" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M104 242c-16 0-24-8-22-26 2-16 12-26 34-32 16-6 34-10 56-12 20-24 48-38 88-38 44 0 80 14 106 40 44 4 80 16 92 44 6 16 2 24-12 24h-14"/>
      <path d="M254 242h116M154 242h-50M482 242h20"/>
      <circle cx="204" cy="242" r="40"/><circle cx="204" cy="242" r="15"/>
      <circle cx="432" cy="242" r="40"/><circle cx="432" cy="242" r="15"/>
      <path d="M262 136c14-16 36-24 62-24 32 0 58 10 78 30" opacity=".55"/>
    </g>
    <text x="320" y="330" text-anchor="middle" font-family="Manrope, sans-serif" font-size="17" font-weight="600" fill="#94a3b8">Фото автомобиля · ${title}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

export function renderKp(d: KpData): string {
  const totalBenefit = d.discounts.reduce((s, x) => s + x.value, 0);
  const priceFinal = d.priceBase - totalBenefit;
  const optionPagesCount = layoutOptionPages(d.options).length;
  const pagesTotal = 1 + optionPagesCount + 1;

  const footHtml = (num: number, total: number) => `
    <span class="dots"><span>${d.dealer.address}</span><span>${d.dealer.phone}</span><span>${d.dealer.site}</span></span>
    <span class="page-num">${num}&thinsp;/&thinsp;${total}</span>`;

  const carImage = d.carImage || carPlaceholder(d.carTitle);

  const map: Record<string, string> = {
    LOGO_DA_SVG: logoDA,
    BRAND_LOGO: d.brandLogo,
    BRAND: d.brand,
    CONTACTS_TITLE: d.contactsTitle,
    KP_NUMBER: d.kpNumber,
    KP_DATE: d.kpDate,
    VALID_UNTIL: d.validUntil,
    CLIENT_SALUTATION: d.clientSalutation,
    CAR_TITLE: d.carTitle,
    CAR_TRIM: d.carTrim,
    CAR_IMAGE: carImage,
    QR_CODE: d.qrCode,
    CAR_URL: d.carUrl,
    SPECS_HTML: specsHtml(d.specs),
    PRICE_ROWS_HTML: priceRowsHtml(d.priceBase, d.discounts),
    PRICE_FINAL: fmtRub(priceFinal),
    BENEFIT_PILL_HTML: totalBenefit > 0
      ? `<span class="benefit-pill"><svg><use href="#i-tag"/></svg>Ваша выгода — ${fmtRub(totalBenefit)}</span>`
      : "",
    TOTAL_BENEFIT: fmtRub(totalBenefit),
    OPTIONS_PAGES_HTML: optionsPagesHtml(d, pagesTotal, footHtml),
    OPTIONAL_BLOCKS_HTML: optionalBlocksHtml(d),
    HEAD_MANAGER_BLOCK: headManagerBlock(d),
    PAGES_TOTAL: String(pagesTotal),
    DEALER_NAME: d.dealer.name,
    DEALER_ADDRESS: d.dealer.address,
    DEALER_ADDRESS_FULL: d.dealer.addressFull,
    DEALER_HOURS: d.dealer.hours,
    DEALER_PHONE: d.dealer.phone,
    DEALER_SITE: d.dealer.site,
    MANAGER_AVATAR_HTML: d.manager.photoBase64
      ? `<img class="avatar avatar-photo" src="${d.manager.photoBase64}" alt="${d.manager.name}">`
      : `<div class="avatar">${d.manager.initials}</div>`,
    MANAGER_NAME: d.manager.name,
    MANAGER_INITIALS: d.manager.initials,
    MANAGER_POSITION: d.manager.position,
    MANAGER_PHONE: d.manager.phone,
    MANAGER_EMAIL: d.manager.email,
    LEGAL_NAME: d.legal,
  };

  return templateHtml.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) =>
    key in map ? map[key] : m
  );
}
