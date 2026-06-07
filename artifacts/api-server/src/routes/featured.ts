import { Router, type IRouter } from "express";
import type { NewCarRecord } from "./new-cars";

const router: IRouter = Router();

const FEEDS = [
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/2c3eb21beb9caa23118a56e042a13187.xml", dealer: "Jaecoo" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/9a822bd39911d610b99ad1b477ec9356.xml", dealer: "Omoda" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/710fe0a03b5a1e47458161bfbfaa9355.xml", dealer: "Tenet" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/f8056db2c70dba547744e2e4aaa20556.xml", dealer: "Haval Pro" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/53fe918374eb87e8f6536b8c3bb21937.xml", dealer: "Haval City" },
  { url: "https://media.cm.expert/stock/export/cmexpert/auto.ru/pc/new/913211584f8ad577ee76a703f2f13186.xml", dealer: "Jetour" },
];

let cache: { data: NewCarRecord[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function getField(xml: string, field: string): string {
  const m = xml.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`));
  return m ? m[1].trim() : "";
}

function getImages(xml: string): string[] {
  return [...xml.matchAll(/<image>([^<]+)<\/image>/g)].map((m) => m[1].trim());
}

function parseFeed(text: string, dealer: string): NewCarRecord[] {
  const cars: NewCarRecord[] = [];
  const blocks = text.match(/<car>[\s\S]*?<\/car>/g) ?? [];
  for (const block of blocks) {
    const action = getField(block, "action");
    if (action !== "show") continue;
    cars.push({
      id: `${dealer}-${getField(block, "unique_id")}`,
      mark: getField(block, "mark_id"),
      model: getField(block, "folder_id"),
      modification: getField(block, "modification_id"),
      complectation: getField(block, "complectation_name"),
      year: parseInt(getField(block, "year")) || 0,
      price: parseInt(getField(block, "price")) || 0,
      color: getField(block, "color"),
      bodyType: getField(block, "body_type"),
      availability: getField(block, "availability"),
      url: getField(block, "url"),
      images: getImages(block),
      dealer,
      maxDiscount: parseInt(getField(block, "max_discount")) || 0,
      creditDiscount: parseInt(getField(block, "credit_discount")) || 0,
      tradeinDiscount: parseInt(getField(block, "tradein_discount")) || 0,
    });
  }
  return cars;
}

async function getAllCars(): Promise<NewCarRecord[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetch(f.url).then((r) => r.text()).then((t) => parseFeed(t, f.dealer)))
  );
  const data = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  cache = { data, ts: Date.now() };
  return data;
}

router.get("/cars/featured", async (_req, res) => {
  try {
    const all = await getAllCars();
    const inStock = all.filter((c) => c.availability === "В наличии" && c.images.length > 0);
    const withDiscount = inStock.filter((c) => c.maxDiscount > 0);
    const sorted = [...withDiscount].sort((a, b) => b.maxDiscount - a.maxDiscount);
    let featured = sorted.slice(0, 6);
    if (featured.length < 6) {
      const rest = inStock.filter((c) => !featured.find((f) => f.id === c.id));
      const need = 6 - featured.length;
      const byDealer = new Map<string, NewCarRecord>();
      for (const c of rest) {
        if (!byDealer.has(c.dealer)) byDealer.set(c.dealer, c);
      }
      featured = [...featured, ...Array.from(byDealer.values()).slice(0, need)];
    }
    res.json({ ok: true, data: featured });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
