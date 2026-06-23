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

    const offerLines: string[] = [];
    let offerIndex = 0;

    for (const c of newCars) {
      offerIndex++;
      const pictures = (c.images ?? [])
        .slice(0, 10)
        .map((img) => `      <picture>${esc(img)}</picture>`)
        .join("\n");

      const params = [
        param("Год выпуска", c.year),
        param("Цвет", c.color),
        param("Тип кузова", c.bodyType),
        param("Комплектация", c.complectation),
        param("Состояние", "новый"),
        param("VIN", c.vin),
        param("Дилер", c.dealer),
        c.maxDiscount ? param("Максимальная скидка", c.maxDiscount) : "",
      ].filter(Boolean).join("\n");

      offerLines.push(`    <offer id="${esc(c.id)}" available="true">
      <url>${esc(carUrl("new", c.id))}</url>
      <price>${c.price}</price>
      <currencyId>RUR</currencyId>
      <categoryId>1</categoryId>
${pictures}
      <vendor>${esc(c.mark)}</vendor>
      <model>${esc(c.model)}</model>
      <typePrefix>Легковой автомобиль</typePrefix>
      <name>${esc(c.mark)} ${esc(c.model)}${c.modification ? " " + esc(c.modification) : ""} ${c.year}</name>
      <description>${esc(c.description || `${c.mark} ${c.model} ${c.year} года в наличии у официального дилера Дебрянск Авто. Цена ${c.price.toLocaleString("ru")} руб.`)}</description>
      <конверсия>заявка</конверсия>
${params}
    </offer>`);
    }

    for (const c of usedCars) {
      offerIndex++;
      const pictures = (c.images ?? [])
        .slice(0, 10)
        .map((img) => `      <picture>${esc(img)}</picture>`)
        .join("\n");

      const params = [
        param("Год выпуска", c.year),
        param("Цвет", c.color),
        param("Тип кузова", c.bodyType),
        param("Пробег", c.run ? `${c.run} км` : null),
        param("Комплектация", c.complectation),
        param("Состояние", "с пробегом"),
        param("VIN", c.vin),
        c.maxDiscount ? param("Максимальная скидка", c.maxDiscount) : "",
      ].filter(Boolean).join("\n");

      offerLines.push(`    <offer id="${esc(c.id)}" available="true">
      <url>${esc(carUrl("used", c.id))}</url>
      <price>${c.price}</price>
      <currencyId>RUR</currencyId>
      <categoryId>2</categoryId>
${pictures}
      <vendor>${esc(c.mark)}</vendor>
      <model>${esc(c.model)}</model>
      <typePrefix>Легковой автомобиль</typePrefix>
      <name>${esc(c.mark)} ${esc(c.model)}${c.modification ? " " + esc(c.modification) : ""} ${c.year}</name>
      <description>${esc(c.description || `${c.mark} ${c.model} ${c.year} года с пробегом у дилера Дебрянск Авто. Цена ${c.price.toLocaleString("ru")} руб.`)}</description>
      <конверсия>заявка</конверсия>
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
      <category id="1">Новые автомобили</category>
      <category id="2">Автомобили с пробегом</category>
    </categories>
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
