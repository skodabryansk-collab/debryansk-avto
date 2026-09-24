import { Router, type IRouter } from "express";
import { getPublicNewCars, type NewCarRecord } from "./new-cars";

const router: IRouter = Router();

// Keep the existing featured-card mapping for the six XML dealers unchanged.
// Tenet Plus and Jeland are supplied by the shared CM Business catalog.
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
    if (getField(block, "action") !== "show") continue;
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
      extras: getField(block, "extras"),
      description: getField(block, "description"),
      vin: getField(block, "vin"),
      doorsCount: parseInt(getField(block, "doors_count")) || 0,
      wheel: getField(block, "wheel"),
      armored: getField(block, "armored"),
      custom: getField(block, "custom"),
      phone: getField(block, "phone"),
      notRegisteredInRussia: getField(block, "not_registered_in_russia") === "true",
      acceptedAutoruExclusive: getField(block, "accepted_autoru_exclusive") === "true",
      popularity_score: 0,
    });
  }
  return cars;
}

async function getXmlFeaturedCars(): Promise<NewCarRecord[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetch(f.url).then((r) => r.text()).then((t) => parseFeed(t, f.dealer)))
  );
  const data = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  cache = { data, ts: Date.now() };
  return data;
}

const FEATURED_DEALERS = new Set([
  "jaecoo",
  "omoda",
  "tenet",
  "haval pro",
  "haval city",
  "jetour",
  "tenet plus",
  "jeland",
]);

router.get("/cars/featured", async (_req, res) => {
  try {
    const [xmlCars, cmBusinessCars] = await Promise.all([
      getXmlFeaturedCars(),
      getPublicNewCars().then(cars => cars.filter(c => ["tenet plus", "jeland"].includes(c.dealer.trim().toLowerCase()))).catch(() => [] as NewCarRecord[]),
    ]);
    const all = [...xmlCars, ...cmBusinessCars].filter(c => FEATURED_DEALERS.has(c.dealer.trim().toLowerCase()));
    const inStock = all.filter((c) => c.availability === "В наличии" && c.images.length > 0);
    const jelandCars = inStock.filter(c =>
      c.dealer.trim().toLowerCase() === "jeland"
      && c.images.some(image => /^https:\/\/[^/\s]+/i.test(image.trim()))
    );
    // Do not interpret Jeland CM Business inventory as a discount.
    const withDiscount = inStock.filter((c) =>
      c.maxDiscount > 0 && c.dealer.trim().toLowerCase() !== "jeland"
    );
    const sorted = [...withDiscount].sort((a, b) => b.maxDiscount - a.maxDiscount);
    let featured = sorted.slice(0, 6);
    // Business API does not provide a Tenet Plus discount. Keep one available
    // Tenet Plus card visible without inventing a discount or changing XML sorting.
    const tenetPlusFeatured = inStock.find(c => c.dealer.trim().toLowerCase() === "tenet plus");
    if (tenetPlusFeatured && !featured.some(c => c.id === tenetPlusFeatured.id)) {
      featured = featured.length === 6
        ? [...featured.slice(0, 5), tenetPlusFeatured]
        : [...featured, tenetPlusFeatured];
    }
    if (featured.length < 6) {
      const rest = inStock.filter((c) =>
        !["tenet plus", "jeland"].includes(c.dealer.trim().toLowerCase())
        && !featured.find((f) => f.id === c.id)
      );
      const need = 6 - featured.length;
      const byDealer = new Map<string, NewCarRecord>();
      for (const c of rest) {
        if (!byDealer.has(c.dealer)) byDealer.set(c.dealer, c);
      }
      featured = [...featured, ...Array.from(byDealer.values()).slice(0, need)];
    }
    // Like Tenet Plus, include one Jeland in-stock card even though the CM API
    // does not supply a promotional discount. Require a secure usable photo.
    const jelandFeatured = jelandCars[0];
    if (jelandFeatured && !featured.some(c => c.id === jelandFeatured.id)) {
      if (featured.length < 6) {
        featured = [...featured, jelandFeatured];
      } else {
        let targetIndex = -1;
        for (let index = featured.length - 1; index >= 0; index--) {
          if (!["tenet plus", "jeland"].includes(featured[index]!.dealer.trim().toLowerCase())) {
            targetIndex = index;
            break;
          }
        }
        if (targetIndex >= 0) featured = featured.map((c, index) => index === targetIndex ? jelandFeatured : c);
      }
    }
    res.json({ ok: true, data: featured });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
