import { Router, type IRouter } from "express";

const router: IRouter = Router();

const XML_URL =
  "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/used/55c50e2b8b4277d96c5dde95c3c16421.xml";

interface CarRecord {
  id: string;
  mark: string;
  model: string;
  modification: string;
  year: number;
  price: number;
  run: number;
  color: string;
  bodyType: string;
  availability: string;
  url: string;
  images: string[];
  ownersNumber: string;
  state: string;
}

let cache: { data: CarRecord[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function getField(xml: string, field: string): string {
  const m = xml.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`));
  return m ? m[1].trim() : "";
}

function getImages(xml: string): string[] {
  return [...xml.matchAll(/<image>([^<]+)<\/image>/g)].map((m) => m[1].trim());
}

function parseXml(text: string): CarRecord[] {
  const cars: CarRecord[] = [];
  const blocks = text.match(/<car>[\s\S]*?<\/car>/g) ?? [];
  for (const block of blocks) {
    const action = getField(block, "action");
    if (action !== "show") continue;
    cars.push({
      id: getField(block, "unique_id"),
      mark: getField(block, "mark_id"),
      model: getField(block, "folder_id"),
      modification: getField(block, "modification_id"),
      year: parseInt(getField(block, "year")) || 0,
      price: parseInt(getField(block, "price")) || 0,
      run: parseInt(getField(block, "run")) || 0,
      color: getField(block, "color"),
      bodyType: getField(block, "body_type"),
      availability: getField(block, "availability"),
      url: getField(block, "url"),
      images: getImages(block),
      ownersNumber: getField(block, "owners_number"),
      state: getField(block, "state"),
    });
  }
  return cars;
}

router.get("/cars/used", async (_req, res) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return res.json({ ok: true, data: cache.data, total: cache.data.length });
    }
    const r = await fetch(XML_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`XML fetch failed: ${r.status}`);
    const text = await r.text();
    const data = parseXml(text);
    cache = { data, ts: Date.now() };
    return res.json({ ok: true, data, total: data.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
