import { Router, type IRouter } from "express";
import { getUsedCars } from "./cars";
import { getNewCars } from "./new-cars";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SITE_URL = "https://debryansk-auto.ru";
const SHOP_NAME = "Дебрянск Авто";
const COMPANY = "ООО Дебрянск Авто";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function param(name: string, value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return `      <param name="${name}">${esc(String(value))}</param>`;
}

function carUrl(type: "new" | "used", id: string): string {
  return type === "new"
    ? `${SITE_URL}/new-cars/${id}`
    : `${SITE_URL}/cars/${id}`;
}

/* ── Map body_type string → Yandex category id ── */
function bodyCategoryId(bodyType: string | null | undefined): number {
  if (!bodyType) return 11;
  const b = bodyType.toLowerCase();
  if (b.includes("внедорожник") || b.includes("suv") || b.includes("crossover") || b.includes("кроссовер")) return 101;
  if (b.includes("седан")) return 102;
  if (b.includes("хэтчбек") || b.includes("хетчбэк")) return 103;
  if (b.includes("лифтбек")) return 104;
  if (b.includes("универсал")) return 105;
  if (b.includes("минивэн") || b.includes("минивен") || b.includes("mpv")) return 106;
  if (b.includes("купе")) return 107;
  if (b.includes("пикап")) return 108;
  if (b.includes("кабриолет")) return 109;
  if (b.includes("фургон")) return 110;
  return 11;
}

/* ── Parse transmission from modification string ── */
function parseTransmission(mod: string | null | undefined): string {
  if (!mod) return "";
  const m = mod.toUpperCase();
  if (m.includes("AMT") || m.includes("РОБОТ") || m.includes("ROBOT")) return "Робот";
  if (m.includes("CVT") || m.includes("ВАРИАТОР")) return "Вариатор";
  if (m.includes("AT ") || m.includes("(AT)") || m.includes("АКПП") || m.includes("АВТОМАТ") || m.includes("AUTO")) return "Автомат";
  if (m.includes("MT ") || m.includes("(MT)") || m.includes("МКПП") || m.includes("МЕХАНИК")) return "Механика";
  return "";
}

/* ── Parse drive type from modification string ── */
function parseDrive(mod: string | null | undefined): string {
  if (!mod) return "";
  const m = mod.toUpperCase();
  if (m.includes("4WD") || m.includes("AWD") || m.includes("4X4") || m.includes("ПОЛНЫЙ")) return "Полный";
  if (m.includes("FWD") || m.includes("ПЕРЕДНИЙ")) return "Передний";
  if (m.includes("RWD") || m.includes("ЗАДНИЙ")) return "Задний";
  return "";
}

/* ── Parse engine hp from modification string ── */
function parseHp(mod: string | null | undefined): string {
  if (!mod) return "";
  const match = mod.match(/(\d{2,4})\s*л\.с\./i);
  return match ? match[1] : "";
}

/* ── Parse engine volume from modification string ── */
function parseVolume(mod: string | null | undefined): string {
  if (!mod) return "";
  const match = mod.match(/(\d+[.,]\d+)\s*(?:л\b|l\b)/i);
  return match ? match[1].replace(",", ".") : "";
}

/* ── Parse fuel type ── */
function parseFuel(mod: string | null | undefined): string {
  if (!mod) return "";
  const m = mod.toUpperCase();
  if (m.includes("ЭЛЕКТР") || m.includes("EV") || m.includes("BEV")) return "Электро";
  if (m.includes("ГИБРИД") || m.includes("HYBRID") || m.includes("HEV") || m.includes("PHEV")) return "Гибрид";
  if (m.includes("ДИЗЕЛ") || m.includes("DIESEL")) return "Дизель";
  return "Бензин";
}

/* ── Collect unique dealers/brands for sets ── */
function buildSets(newDealers: string[], usedBrands: string[]): string {
  const lines: string[] = [];
  lines.push(`      <set id="new"><name>Новые автомобили — Дебрянск Авто</name><url>${SITE_URL}/new-cars/</url></set>`);
  lines.push(`      <set id="used"><name>Автомобили с пробегом — Дебрянск Авто</name><url>${SITE_URL}/cars/</url></set>`);

  for (const dealer of newDealers) {
    const slug = dealer.toLowerCase().replace(/\s+/g, "-");
    lines.push(`      <set id="new-${slug}"><name>Новые ${dealer} — Дебрянск Авто</name><url>${SITE_URL}/new-cars/?dealer=${encodeURIComponent(dealer)}</url></set>`);
  }
  for (const brand of usedBrands) {
    const slug = brand.toLowerCase().replace(/\s+/g, "-");
    lines.push(`      <set id="used-${slug}"><name>${brand} с пробегом — Дебрянск Авто</name><url>${SITE_URL}/cars/?brand=${encodeURIComponent(brand)}</url></set>`);
  }

  return `    <sets>\n${lines.join("\n")}\n    </sets>`;
}

router.get("/feed/yml", async (_req, res) => {
  try {
    const [usedCars, newCars] = await Promise.all([
      getUsedCars().catch((e) => {
        logger.warn({ err: e }, "feed-yml: used cars fetch failed");
        return [];
      }),
      getNewCars().catch((e) => {
        logger.warn({ err: e }, "feed-yml: new cars fetch failed");
        return [];
      }),
    ]);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    /* collect unique sets */
    const uniqueDealers = [...new Set(newCars.map(c => c.dealer).filter(Boolean))];
    const uniqueBrands  = [...new Set(usedCars.map(c => c.mark).filter(Boolean))];
    const setsXml = buildSets(uniqueDealers, uniqueBrands);

    const offerLines: string[] = [];
    let offerIndex = 0;

    for (const c of newCars) {
      offerIndex++;
      const pictures = (c.images ?? [])
        .slice(0, 10)
        .map((img) => `      <picture>${esc(img)}</picture>`)
        .join("\n");

      const dealerSlug = (c.dealer ?? "").toLowerCase().replace(/\s+/g, "-");
      const setIds = dealerSlug ? `new,new-${dealerSlug}` : "new";
      const catId  = bodyCategoryId(c.bodyType);

      const transmission = parseTransmission(c.modification);
      const drive        = parseDrive(c.modification);
      const hp           = parseHp(c.modification);
      const volume       = parseVolume(c.modification);
      const fuel         = parseFuel(c.modification);

      const params = [
        param("Конверсия", "3"),
        param("Год создания", c.year),
        param("Пробег", "0"),
        param("Комплектация", c.complectation),
        transmission ? param("Коробка передач", transmission) : "",
        drive         ? param("Привод", drive)                 : "",
        hp            ? param("Двигатель, л.с.", hp)           : "",
        volume        ? param("Двигатель, литры", volume)      : "",
        fuel          ? param("Топливо", fuel)                 : "",
        param("Состояние", "Не требует ремонта"),
        c.vin         ? param("VIN", c.vin)                    : "",
        c.maxDiscount ? param("Максимальная скидка", c.maxDiscount) : "",
      ].filter(Boolean).join("\n");

      offerLines.push(`    <offer id="${esc(c.id)}" available="true">
      <name>${esc(c.mark)} ${esc(c.model)}${c.year ? " " + c.year : ""}</name>
      <vendor>${esc(c.mark)}</vendor>
      <url>${esc(carUrl("new", c.id))}</url>
      <price>${c.price}</price>
      <currencyId>RUR</currencyId>
      <categoryId>${catId}</categoryId>
      <set-ids>${setIds}</set-ids>
${pictures}
      <typePrefix>Легковой автомобиль</typePrefix>
      <description>${esc(c.description || `${c.mark} ${c.model} ${c.year} года в наличии у официального дилера Дебрянск Авто. Цена ${c.price.toLocaleString("ru")} руб.`)}</description>
${params}
    </offer>`);
    }

    for (const c of usedCars) {
      offerIndex++;
      const pictures = (c.images ?? [])
        .slice(0, 10)
        .map((img) => `      <picture>${esc(img)}</picture>`)
        .join("\n");

      const brandSlug = (c.mark ?? "").toLowerCase().replace(/\s+/g, "-");
      const setIds = brandSlug ? `used,used-${brandSlug}` : "used";
      const catId  = bodyCategoryId(c.bodyType);

      const transmission = parseTransmission(c.modification);
      const drive        = parseDrive(c.modification);
      const hp           = parseHp(c.modification);
      const volume       = parseVolume(c.modification);
      const fuel         = parseFuel(c.modification);

      const params = [
        param("Конверсия", "2"),
        param("Год создания", c.year),
        c.run ? param("Пробег", c.run) : "",
        param("Комплектация", c.complectation),
        transmission ? param("Коробка передач", transmission) : "",
        drive         ? param("Привод", drive)                 : "",
        hp            ? param("Двигатель, л.с.", hp)           : "",
        volume        ? param("Двигатель, литры", volume)      : "",
        fuel          ? param("Топливо", fuel)                 : "",
        param("Состояние", "Не требует ремонта"),
        c.vin         ? param("VIN", c.vin)                    : "",
        c.maxDiscount ? param("Максимальная скидка", c.maxDiscount) : "",
      ].filter(Boolean).join("\n");

      offerLines.push(`    <offer id="${esc(c.id)}" available="true">
      <name>${esc(c.mark)} ${esc(c.model)}${c.year ? " " + c.year : ""}${c.run ? ", " + Number(c.run).toLocaleString("ru") + " км" : ""}</name>
      <vendor>${esc(c.mark)}</vendor>
      <url>${esc(carUrl("used", c.id))}</url>
      <price>${c.price}</price>
      <currencyId>RUR</currencyId>
      <categoryId>${catId}</categoryId>
      <set-ids>${setIds}</set-ids>
${pictures}
      <typePrefix>Легковой автомобиль</typePrefix>
      <description>${esc(c.description || `${c.mark} ${c.model} ${c.year} года с пробегом у дилера Дебрянск Авто. Цена ${c.price.toLocaleString("ru")} руб.`)}</description>
${params}
    </offer>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${dateStr}">
  <shop>
    <name>${esc(SHOP_NAME)}</name>
    <company>${esc(COMPANY)}</company>
    <url>${SITE_URL}</url>
    <currencies>
      <currency id="RUR" rate="1"/>
    </currencies>
    <categories>
      <category id="1">Автодилер</category>
      <category id="2" parentId="1">Официальный автодилер</category>
      <category id="3">Автотранспорт</category>
      <category id="11" parentId="3">Легковой автомобиль</category>
      <category id="101" parentId="11">Внедорожник</category>
      <category id="102" parentId="11">Седан</category>
      <category id="103" parentId="11">Хэтчбек</category>
      <category id="104" parentId="11">Лифтбек</category>
      <category id="105" parentId="11">Универсал</category>
      <category id="106" parentId="11">Минивэн</category>
      <category id="107" parentId="11">Купе</category>
      <category id="108" parentId="11">Пикап</category>
      <category id="109" parentId="11">Кабриолет</category>
      <category id="110" parentId="11">Фургон</category>
    </categories>
${setsXml}
    <offers>
${offerLines.join("\n")}
    </offers>
  </shop>
</yml_catalog>`;

    logger.info(
      { newCount: newCars.length, usedCount: usedCars.length, total: offerIndex },
      "feed-yml: generated"
    );

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.send(xml);
  } catch (err) {
    logger.error({ err }, "feed-yml: error");
    res.status(500).send("<?xml version=\"1.0\"?><error>Internal Server Error</error>");
  }
});

export default router;
