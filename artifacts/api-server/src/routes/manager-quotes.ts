import { Router, type IRouter } from "express";
import { db, managersTable, quotesTable, carsTable, brandsTable, locationsTable, locationBrandsTable, salesHeadManagersTable } from "@workspace/db";
import QRCode from "qrcode";
// @ts-ignore - no types available

import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { requireManager, getManagerPayload } from "../middlewares/requireManager";
import { renderKp, type KpData } from "../templates/kp/render";
import puppeteer from "puppeteer";
import { execSync } from "child_process";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { logger } from "../lib/logger";
import fs from "fs";
import path from "path";
import { acquireChrome, isPrerendererRunning } from "../lib/chrome-semaphore";

const router: IRouter = Router();
router.use(requireManager);

const PRERENDER_PAUSE_FILE = process.env["PRERENDER_PAUSE_FILE"] || "/tmp/debryansk-prerender.pause";

function getUploadsDir(): string {
  return process.env["LOCAL_UPLOADS_DIR"] || path.resolve(__dirname, "../uploads");
}

async function requestPrerenderPauseForPdf(): Promise<void> {
  if (!isPrerendererRunning()) return;

  try {
    await writeFile(PRERENDER_PAUSE_FILE, "pdf-generation-requested\n");
    logger.info("[quotes] Requested prerender pause for an interactive PDF");
  } catch (err) {
    logger.warn({ err }, "[quotes] Could not request prerender pause before PDF generation");
  }
}

async function savePdfToLocal(managerId: number, quoteId: number, pdfBuffer: Buffer): Promise<string> {
  const uploadsDir = getUploadsDir();
  const quotesDir = path.join(uploadsDir, "quotes", String(managerId));
  await mkdir(quotesDir, { recursive: true });
  const objectName = `quotes/${managerId}/${quoteId}.pdf`;
  const filePath = path.join(uploadsDir, objectName);
  await writeFile(filePath, pdfBuffer);
  return objectName;
}

async function generatePdf(html: string): Promise<Buffer> {
  await requestPrerenderPauseForPdf();
  const release = await acquireChrome(45000);
  try {
    let executablePath: string;
    try {
      executablePath = execSync(
        "which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null",
        { encoding: "utf8" }
      ).trim().split("\n")[0]!.trim();
    } catch {
      throw new Error("No Chromium found");
    }

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.evaluateHandle("document.fonts.ready");
      const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } finally {
    release();
  }
}

async function resolveBrandName(rawBrand: string): Promise<string> {
  try {
    const rows = await db.select({ name: brandsTable.name })
      .from(brandsTable)
      .where(ilike(brandsTable.carMark, rawBrand))
      .limit(1);
    return rows[0]?.name ?? rawBrand;
  } catch {
    return rawBrand;
  }
}

async function fetchBrandLogoHtml(brand: string): Promise<string> {
  try {
    const rows = await db.select({ logoUrl: brandsTable.logoUrl })
      .from(brandsTable)
      .where(ilike(brandsTable.carMark, brand))
      .limit(1);

    const logoUrl = rows[0]?.logoUrl;
    if (!logoUrl) return `<span class="brand-word">${brand}</span>`;

    const port = process.env["PORT"] ?? "8080";
    const resp = await fetch(`http://127.0.0.1:${port}${logoUrl}`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return `<span class="brand-word">${brand}</span>`;

    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = (resp.headers.get("content-type") || "image/svg+xml").split(";")[0]!.trim();

    if (ct === "image/svg+xml" || logoUrl.toLowerCase().endsWith(".svg")) {
      return buf.toString("utf8");
    }
    return `<img src="data:${ct};base64,${buf.toString("base64")}" alt="${brand}" style="height:8mm;width:auto;display:block">`;
  } catch (err) {
    logger.warn({ err }, `[kp] fetchBrandLogoHtml failed for brand: ${brand}`);
    return `<span class="brand-word">${brand}</span>`;
  }
}

async function fetchManagerPhotoBase64(objectName: string): Promise<string> {
  if (!objectName) return "";
  try {
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, objectName);
    if (!existsSync(filePath)) return "";
    const buffer = await readFile(filePath);
    let mime = "image/jpeg";
    if (objectName.endsWith(".webp")) mime = "image/webp";
    else if (objectName.endsWith(".png")) mime = "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

async function fetchImageBase64(url: string): Promise<string> {
  if (!url) return "";
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return "";
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = (resp.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim();
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function parseExtrasToOptions(extras: string | null | undefined): Array<{ category: string; items: string[] }> {
  if (!extras) return [];
  const items = extras.split(",").map(s => s.trim()).filter(Boolean);
  if (!items.length) return [];

  const cats: Record<string, string[]> = {
    "Безопасность": [],
    "Комфорт": [],
    "Мультимедиа и навигация": [],
    "Внешний вид и освещение": [],
    "Прочее": [],
  };

  for (const item of items) {
    const lower = item.toLowerCase();
    if (/abs|подушк|иммобилайз|стабилизац|торможен|эбд|ebd|esp|aeb|блокировк|датчик парковк|ассист|мониторинг/.test(lower)) {
      cats["Безопасность"]!.push(item);
    } else if (/климат|кондиционер|подогрев|круиз|кожа|вентиляц|сиден|руль|замок|стеклоподъём|электрорегулировк|регулировк|складыван|электропривод|усилитель|зеркал/.test(lower)) {
      cats["Комфорт"]!.push(item);
    } else if (/аудио|навигац|камер|дисплей|bluetooth|usb|carplay|android|мультимедиа|экран|монитор|бортовой/.test(lower)) {
      cats["Мультимедиа и навигация"]!.push(item);
    } else if (/фар|противотуманн|led|ксенон|люк|панорам|тонировк|молдинг|диск|освещен/.test(lower)) {
      cats["Внешний вид и освещение"]!.push(item);
    } else {
      cats["Прочее"]!.push(item);
    }
  }

  return Object.entries(cats)
    .filter(([, v]) => v.length > 0)
    .map(([category, items]) => ({ category, items }));
}

function buildSpecsFromCar(car: Record<string, unknown>): Array<{ icon: string; label: string; value: string }> {
  const specs: Array<{ icon: string; label: string; value: string }> = [];
  if (car["modification"]) specs.push({ icon: "engine", label: "Двигатель / Модификация", value: String(car["modification"]) });
  if (car["bodyType"]) specs.push({ icon: "body", label: "Тип кузова", value: String(car["bodyType"]) });
  const driveRaw = car["driveType"] ? String(car["driveType"]) : (() => {
    const mod = String(car["modification"] ?? "").toUpperCase();
    if (/\b(4WD|AWD)\b/.test(mod)) return "Полный";
    if (car["modification"]) return "Передний";
    return "";
  })();
  if (driveRaw) specs.push({ icon: "drive", label: "Привод", value: driveRaw });
  if (car["color"]) specs.push({ icon: "body", label: "Цвет кузова", value: String(car["color"]) });
  if (car["vin"]) specs.push({ icon: "vin", label: "VIN", value: String(car["vin"]) });
  if (car["year"]) specs.push({ icon: "seat", label: "Год выпуска", value: String(car["year"]) });
  if (car["complectation"]) specs.push({ icon: "gearbox", label: "Комплектация", value: String(car["complectation"]) });
  return specs.slice(0, 7);
}

async function getManagerBrands(managerId: number): Promise<string[]> {
  const rows = await db.select({ brands: managersTable.brands })
    .from(managersTable)
    .where(eq(managersTable.id, managerId))
    .limit(1);
  const brands = rows[0]?.brands;
  return Array.isArray(brands) && brands.length > 0 ? brands : [];
}

const USED_BRAND = "С пробегом";

function brandInList(col: typeof carsTable.brand, brands: string[]) {
  const { ilike, or } = require("drizzle-orm");
  if (brands.length === 0) return null;
  if (brands.length === 1) return ilike(col, brands[0]!);
  return or(...brands.map(b => ilike(col, b)))!;
}

function buildManagerCarFilter(mBrands: string[], requestedType?: string) {
  const { or: drOr } = require("drizzle-orm");
  const hasUsed = mBrands.includes(USED_BRAND);
  const regularBrands = mBrands.filter(b => b !== USED_BRAND);
  const brandOr = brandInList(carsTable.brand, regularBrands);

  if (requestedType === "used") {
    return hasUsed ? [] : [eq(carsTable.type, "__none__")];
  }
  if (requestedType === "new") {
    return brandOr ? [brandOr] : [eq(carsTable.type, "__none__")];
  }

  if (regularBrands.length > 0 && hasUsed) {
    return [drOr(eq(carsTable.type, "used"), brandOr!)!];
  } else if (regularBrands.length > 0) {
    return brandOr ? [brandOr] : [eq(carsTable.type, "__none__")];
  } else if (hasUsed) {
    return [eq(carsTable.type, "used")];
  }
  return [eq(carsTable.type, "__none__")];
}

function salesHeadBrandLookup(carType: string | null, carBrand: string | null) {
  const lookupBrand = carType === "used" ? USED_BRAND : (carBrand ?? "");
  return sql`${salesHeadManagersTable.brands} @> ${JSON.stringify([lookupBrand])}::jsonb`;
}

router.get("/cars/brands", async (req, res) => {
  try {
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdmin = rawPayload["isAdmin"] === true;
    const managerId = rawPayload["managerId"] as number | undefined;

    const type = String(req.query["type"] || "").trim() || undefined;
    const { and } = await import("drizzle-orm");
    const conditions = [];
    if (type) conditions.push(eq(carsTable.type, type));

    if (!isAdmin && managerId) {
      const mBrands = await getManagerBrands(managerId);
      const accessFilter = buildManagerCarFilter(mBrands, type);
      conditions.push(...accessFilter);
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    logger.info({ managerId, isAdmin, type, conditions: JSON.stringify(conditions.map(c => typeof c === "object" ? Object.keys(c) : c)), whereClause: String(whereClause) }, "[DEBUG] /cars/brands query");

    const rows = await db.selectDistinct({ brand: carsTable.brand })
      .from(carsTable)
      .where(whereClause)
      .orderBy(carsTable.brand);
    const brands = rows.map(r => r.brand).filter(Boolean).sort();
    logger.info({ managerId, isAdmin, brandCount: brands.length, brands }, "[DEBUG] /cars/brands result");
    return res.json({ ok: true, data: brands });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/cars/models", async (req, res) => {
  try {
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdmin = rawPayload["isAdmin"] === true;
    const managerId = rawPayload["managerId"] as number | undefined;

    const brand = String(req.query["brand"] || "").trim();
    const type = String(req.query["type"] || "").trim() || undefined;
    const { and } = await import("drizzle-orm");
    const conditions = [];
    if (brand) conditions.push(ilike(carsTable.brand, brand));
    if (type) conditions.push(eq(carsTable.type, type));

    if (!isAdmin && managerId) {
      const mBrands = await getManagerBrands(managerId);
      const accessFilter = buildManagerCarFilter(mBrands, type);
      conditions.push(...accessFilter);
    }

    const rows = await db.selectDistinct({ model: carsTable.model })
      .from(carsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(carsTable.model);
    const models = rows.map(r => r.model).filter(Boolean).sort();
    return res.json({ ok: true, data: models });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/cars/search", async (req, res) => {
  try {
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdmin = rawPayload["isAdmin"] === true;
    const managerId = rawPayload["managerId"] as number | undefined;

    const q = String(req.query["q"] || "").trim();
    const type = String(req.query["type"] || "").trim() || undefined;
    const brand = String(req.query["brand"] || "").trim() || undefined;
    const model = String(req.query["model"] || "").trim() || undefined;

    const carSelect = db.select({
      id: carsTable.id,
      externalId: carsTable.externalId,
      type: carsTable.type,
      brand: carsTable.brand,
      model: carsTable.model,
      year: carsTable.year,
      modification: carsTable.modification,
      complectation: carsTable.complectation,
      color: carsTable.color,
      price: carsTable.price,
      imageUrl: carsTable.imageUrl,
      vin: carsTable.vin,
      dealer: carsTable.dealer,
      bodyType: carsTable.bodyType,
      driveType: carsTable.driveType,
      extras: carsTable.extras,
    }).from(carsTable);

    const { and } = await import("drizzle-orm");
    const conditions = [];
    if (type) conditions.push(eq(carsTable.type, type));
    if (brand) conditions.push(ilike(carsTable.brand, brand));
    if (model) conditions.push(ilike(carsTable.model, model));
    if (q) {
      conditions.push(
        or(
          ilike(carsTable.brand, `%${q}%`),
          ilike(carsTable.model, `%${q}%`),
          ilike(carsTable.modification, `%${q}%`),
          ilike(carsTable.vin, `%${q}%`)
        )!
      );
    }

    if (!isAdmin && managerId) {
      const mBrands = await getManagerBrands(managerId);
      const accessFilter = buildManagerCarFilter(mBrands, type);
      conditions.push(...accessFilter);
    }

    const rows = await (conditions.length > 0
      ? carSelect.where(and(...conditions)).orderBy(carsTable.price).limit(50)
      : carSelect.orderBy(carsTable.price).limit(50));

    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

async function getOrCreateAdminManager(): Promise<number> {
  const existing = await db.select({ id: managersTable.id })
    .from(managersTable)
    .where(eq(managersTable.login, "__admin__"))
    .limit(1);
  if (existing.length) return existing[0]!.id;
  const inserted = await db.insert(managersTable).values({
    name: "Администратор",
    login: "__admin__",
    passwordHash: "disabled",
    isActive: true,
  }).returning({ id: managersTable.id });
  return inserted[0]!.id;
}

async function regenerateStoredQuotePdf(quote: typeof quotesTable.$inferSelect): Promise<string> {
  const carRows = await db.select().from(carsTable).where(eq(carsTable.externalId, quote.carId)).limit(1);
  const car = carRows[0] ?? null;
  const snap = quote.carSnapshot as Record<string, unknown>;

  const managerRows = await db.select().from(managersTable).where(eq(managersTable.id, quote.managerId)).limit(1);
  const manager = managerRows[0] ?? { id: quote.managerId, name: "Менеджер", phone: null, email: null, photoUrl: null };
  const managerInitials = (manager.name ?? "")
    .split(" ").map((word: string) => word[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const carBrand = car?.brand ?? String(snap["brand"] ?? "");
  const carType = quote.carType;
  let loc: { title: string; address: string; phone: string | null; hours: string | null } | null = null;
  if (carType === "used") {
    const rows = await db.select({
      title: locationsTable.title, address: locationsTable.address,
      phone: locationsTable.phone, hours: locationsTable.hours,
    }).from(locationsTable).where(eq(locationsTable.title, "Супонево")).limit(1);
    loc = rows[0] ?? null;
  } else if (carBrand) {
    const rows = await db.select({
      title: locationsTable.title, address: locationsTable.address,
      phone: locationsTable.phone, hours: locationsTable.hours,
    })
      .from(locationsTable)
      .innerJoin(locationBrandsTable, eq(locationBrandsTable.locationId, locationsTable.id))
      .innerJoin(brandsTable, eq(brandsTable.id, locationBrandsTable.brandId))
      .where(ilike(brandsTable.carMark, carBrand))
      .limit(1);
    loc = rows[0] ?? null;
  }
  if (!loc) {
    const rows = await db.select({
      title: locationsTable.title, address: locationsTable.address,
      phone: locationsTable.phone, hours: locationsTable.hours,
    }).from(locationsTable).orderBy(locationsTable.sortOrder).limit(1);
    loc = rows[0] ?? null;
  }

  const brandDisplayName = carBrand ? await resolveBrandName(carBrand) : (carBrand || null);
  const carSlug = car?.externalId ?? String(snap["externalId"] ?? quote.carId);
  const carUrl = `https://debryansk-auto.ru/${carType === "new" ? "new-cars" : "cars"}/${carSlug}`;
  const qrCode = await QRCode.toDataURL(carUrl, {
    width: 200, margin: 1, color: { dark: "#0d0f14", light: "#f4f6f9" },
  });
  const imageUrl = car?.imageUrl ?? String(snap["imageUrl"] ?? "");
  const [brandLogo, carImage, salesHeadRows, managerPhotoBase64] = await Promise.all([
    fetchBrandLogoHtml(carBrand),
    fetchImageBase64(imageUrl),
    db.select().from(salesHeadManagersTable)
      .where(salesHeadBrandLookup(carType, brandDisplayName))
      .orderBy(salesHeadManagersTable.sortOrder).limit(1),
    manager.photoUrl ? fetchManagerPhotoBase64(manager.photoUrl) : Promise.resolve(""),
  ]);
  const salesHead = salesHeadRows[0] ?? null;
  const salutation = quote.clientGender === "male" ? "Уважаемый" : quote.clientGender === "female" ? "Уважаемая" : "Уважаемый(-ая)";
  const validUntil = new Date(quote.validUntil).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const storedCreditOffer = quote.creditOffer as { term?: string; rate?: string; monthlyPayment?: number } | null;
  const kpData: KpData = {
    kpNumber: String(quote.id).padStart(10, "0"),
    kpDate: new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
    validUntil,
    clientSalutation: `${salutation} ${quote.clientName}`,
    brand: carBrand,
    contactsTitle: carType === "used"
      ? "Дебрянск Авто - автомобили с пробегом."
      : `Дебрянск Авто - официальный дилер ${carBrand} в Брянске`,
    brandLogo,
    carTitle: `${carBrand} ${String(snap["model"] ?? "")}`.trim(),
    carTrim: String(car?.modification ?? snap["modification"] ?? car?.complectation ?? snap["complectation"] ?? ""),
    carImage,
    specs: buildSpecsFromCar(snap),
    priceBase: quote.priceOriginal,
    discounts: (quote.discounts as Array<{ label: string; value: number }>) ?? [],
    options: parseExtrasToOptions(car?.extras ?? null),
    extraEquipment: (quote.extraEquipment as { text: string; price?: number } | null) ?? undefined,
    creditOffer: (storedCreditOffer?.term || storedCreditOffer?.rate || storedCreditOffer?.monthlyPayment)
      ? {
          term: storedCreditOffer.term ? `${storedCreditOffer.term} мес.` : "",
          rate: storedCreditOffer.rate ? `${storedCreditOffer.rate}%` : "",
          monthlyPayment: storedCreditOffer.monthlyPayment ?? 0,
        }
      : undefined,
    tradeIn: (quote.tradeIn as { priceFrom?: number; priceTo?: number } | null) ?? undefined,
    salesHead: salesHead ? {
      name: salesHead.name, position: salesHead.position,
      phone: salesHead.phone ?? undefined, email: salesHead.email ?? undefined,
    } : undefined,
    qrCode,
    carUrl,
    dealer: {
      name: loc?.title ?? carBrand ?? "Дебрянск Авто",
      address: loc?.address ?? "г. Брянск",
      addressFull: loc?.address ?? "г. Брянск",
      hours: loc?.hours ?? "Ежедневно 9:00–21:00",
      phone: loc?.phone ?? "+7 (4832) 63-10-00",
      site: "debryansk-auto.ru",
    },
    manager: {
      name: manager.name ?? "",
      initials: managerInitials,
      position: "Менеджер отдела продаж",
      phone: manager.phone ?? "",
      email: manager.email ?? "",
      photoBase64: managerPhotoBase64 || undefined,
    },
    legal: "",
  };

  const objectName = await savePdfToLocal(quote.managerId, quote.id, await generatePdf(renderKp(kpData)));
  await db.update(quotesTable).set({ pdfUrl: objectName }).where(eq(quotesTable.id, quote.id));
  logger.info(`[quotes] Regenerated PDF for quote ${quote.id}: ${objectName}`);
  return objectName;
}

router.get("/quotes", async (req, res) => {
  try {
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdmin = rawPayload["isAdmin"] === true;
    const managerId = payload.managerId;

    const selectFields = {
      id: quotesTable.id,
      carId: quotesTable.carId,
      carType: quotesTable.carType,
      carSnapshot: quotesTable.carSnapshot,
      clientName: quotesTable.clientName,
      clientPhone: quotesTable.clientPhone,
      clientGender: quotesTable.clientGender,
      extraAddToRrp: quotesTable.extraAddToRrp,
      discounts: quotesTable.discounts,
      priceOriginal: quotesTable.priceOriginal,
      priceFinal: quotesTable.priceFinal,
      validUntil: quotesTable.validUntil,
      extraEquipment: quotesTable.extraEquipment,
      creditOffer: quotesTable.creditOffer,
      tradeIn: quotesTable.tradeIn,
      pdfUrl: quotesTable.pdfUrl,
      createdAt: quotesTable.createdAt,
      updatedAt: quotesTable.updatedAt,
    };

    const rows = isAdmin
      ? await db.select(selectFields).from(quotesTable).orderBy(desc(quotesTable.createdAt)).limit(100)
      : await db.select(selectFields).from(quotesTable).where(eq(quotesTable.managerId, managerId)).orderBy(desc(quotesTable.createdAt)).limit(100);

    const uploadsDir = getUploadsDir();
    const data = rows.map(r => ({
      ...r,
      pdfUrl: r.pdfUrl && existsSync(path.join(uploadsDir, r.pdfUrl)) ? r.pdfUrl : null,
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/quotes/:id/pdf", async (req, res) => {
  try {
    const quoteId = Number(req.params["id"]);
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdminPayload = rawPayload["isAdmin"] === true;
    const rows = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId)).limit(1);
    if (!rows.length) return res.status(404).json({ ok: false, error: "Quote not found" });

    const quote = rows[0]!;
    if (quote.managerId !== payload.managerId && !isAdminPayload) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    await regenerateStoredQuotePdf(quote);
    return res.json({ ok: true, quoteId, pdfUrl: `/api/manager/quotes/${quoteId}/pdf` });
  } catch (err) {
    logger.error({ err }, "[quotes] PDF recovery failed");
    return res.status(500).json({ ok: false, error: "Не удалось сформировать PDF. Попробуйте ещё раз." });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdminToken = rawPayload["isAdmin"] === true;

    const {
      carId,
      carType,
      clientName,
      clientPhone,
      clientGender,
      discounts,
      validUntil,
      priceOverride,
      extraEquipment,
      extraAddToRrp,
      creditOffer,
      tradeIn,
    } = req.body as {
      carId: string;
      carType: string;
      clientName: string;
      clientPhone: string;
      clientGender?: "male" | "female";
      discounts: Array<{ label: string; value: number }>;
      validUntil: string;
      priceOverride?: number;
      extraEquipment?: { text: string; price?: number };
      extraAddToRrp?: boolean;
      creditOffer?: { term: string; rate: string; monthlyPayment: number };
      tradeIn?: { priceFrom?: number; priceTo?: number };
    };

    if (!carId || !clientName || !clientPhone || !validUntil) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const carRows = await db.select().from(carsTable).where(eq(carsTable.externalId, carId)).limit(1);
    if (!carRows.length) {
      return res.status(404).json({ ok: false, error: "Car not found" });
    }
    const car = carRows[0]!;

    let managerId: number;
    let manager: { id: number; name: string | null; phone?: string | null; email?: string | null; photoUrl?: string | null };
    if (isAdminToken) {
      managerId = await getOrCreateAdminManager();
      manager = { id: managerId, name: "Администратор", phone: null, email: null, photoUrl: null };
    } else {
      const managerRows = await db.select({
        id: managersTable.id,
        name: managersTable.name,
        phone: managersTable.phone,
        email: managersTable.email,
        photoUrl: managersTable.photoUrl,
      }).from(managersTable).where(eq(managersTable.id, payload.managerId)).limit(1);
      if (!managerRows.length) {
        return res.status(404).json({ ok: false, error: "Manager not found" });
      }
      manager = managerRows[0]!;
      managerId = manager.id;
    }

    // priceOverride — only for KP document, never writes to cars table
    const rawPrice = (priceOverride != null && priceOverride > 0) ? priceOverride : (car.price ?? 0);
    const extraPrice = extraEquipment?.price ? Number(extraEquipment.price) : 0;
    const addExtraToRrp = extraAddToRrp === true;
    const priceBase = addExtraToRrp ? rawPrice + extraPrice : rawPrice;
    const totalDiscount = (discounts ?? []).reduce((s, d) => s + (d.value ?? 0), 0);
    const priceFinal = priceBase - totalDiscount;

    const carSnapshot = {
      id: car.id,
      externalId: car.externalId,
      brand: car.brand,
      model: car.model,
      year: car.year,
      color: car.color,
      price: car.price,
      modification: car.modification,
      complectation: car.complectation,
      bodyType: car.bodyType,
      vin: car.vin,
      dealer: car.dealer,
      imageUrl: car.imageUrl,
    };

    const inserted = await db.insert(quotesTable).values({
      managerId,
      carId,
      carType: carType || car.type,
      carSnapshot,
      clientName,
      clientPhone,
      clientGender: clientGender ?? null,
      discounts: discounts ?? [],
      priceOriginal: priceBase,
      priceFinal,
      validUntil,
      extraEquipment: extraEquipment?.text?.trim() ? extraEquipment : null,
      extraAddToRrp: addExtraToRrp,
      creditOffer: (creditOffer?.term || creditOffer?.rate || creditOffer?.monthlyPayment) ? creditOffer : null,
      tradeIn: (tradeIn?.priceFrom || tradeIn?.priceTo) ? tradeIn : null,
      pdfUrl: null,
    }).returning({ id: quotesTable.id });

    const quoteId = inserted[0]!.id;
    const kpNumber = String(quoteId).padStart(10, "0");

    const now = new Date();
    const kpDate = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

    const managerInitials = (manager.name ?? "")
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

    // Find location: used cars → Супонево; new cars → by brand, fallback to first
    let loc: { title: string; address: string; phone: string | null; hours: string | null } | null = null;
    if (car.type === "used") {
      const usedLocRows = await db.select({
        title: locationsTable.title,
        address: locationsTable.address,
        phone: locationsTable.phone,
        hours: locationsTable.hours,
      }).from(locationsTable).where(eq(locationsTable.title, "Супонево")).limit(1);
      loc = usedLocRows[0] ?? null;
    } else if (car.brand) {
      const brandLocRows = await db.select({
        title: locationsTable.title,
        address: locationsTable.address,
        phone: locationsTable.phone,
        hours: locationsTable.hours,
      })
        .from(locationsTable)
        .innerJoin(locationBrandsTable, eq(locationBrandsTable.locationId, locationsTable.id))
        .innerJoin(brandsTable, eq(brandsTable.id, locationBrandsTable.brandId))
        .where(ilike(brandsTable.carMark, car.brand))
        .limit(1);
      loc = brandLocRows[0] ?? null;
    }
    if (!loc) {
      const fallback = await db.select({
        title: locationsTable.title,
        address: locationsTable.address,
        phone: locationsTable.phone,
        hours: locationsTable.hours,
      }).from(locationsTable).orderBy(locationsTable.sortOrder).limit(1);
      loc = fallback[0] ?? null;
    }

    const brandDisplayName = car.brand ? await resolveBrandName(car.brand) : (car.brand ?? null);

    const carSlug = car.externalId ?? String(car.id);
    const carUrl = `https://debryansk-auto.ru/${car.type === "new" ? "new-cars" : "cars"}/${carSlug}`;
    const qrCode = await QRCode.toDataURL(carUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#0d0f14", light: "#f4f6f9" },
    });

    const [brandLogo, carImage, salesHeadRows, managerPhotoBase64] = await Promise.all([
      fetchBrandLogoHtml(car.brand ?? ""),
      fetchImageBase64(car.imageUrl ?? ""),
      db.select().from(salesHeadManagersTable)
        .where(salesHeadBrandLookup(car.type ?? null, brandDisplayName))
        .orderBy(salesHeadManagersTable.sortOrder)
        .limit(1),
      manager.photoUrl ? fetchManagerPhotoBase64(manager.photoUrl) : Promise.resolve(""),
    ]);
    const salesHead = salesHeadRows[0] ?? null;

    const salutation = clientGender === "male" ? "Уважаемый" : clientGender === "female" ? "Уважаемая" : "Уважаемый(-ая)";
    const ruDate = new Date(validUntil).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

    const kpData: KpData = {
      kpNumber,
      kpDate,
      validUntil: ruDate,
      clientSalutation: `${salutation} ${clientName}`,
      brand: car.brand ?? "",
      contactsTitle: car.type === "used"
        ? "Дебрянск Авто - автомобили с пробегом."
        : `Дебрянск Авто - официальный дилер ${car.brand ?? ""} в Брянске`,
      brandLogo,
      carTitle: `${car.brand ?? ""} ${car.model ?? ""}`.trim(),
      carTrim: car.modification ?? car.complectation ?? "",
      carImage,
      specs: buildSpecsFromCar(carSnapshot as Record<string, unknown>),
      priceBase,
      discounts: discounts ?? [],
      options: parseExtrasToOptions(car.extras),
      extraEquipment: extraEquipment?.text?.trim() ? extraEquipment : undefined,
      creditOffer: (creditOffer?.term || creditOffer?.rate || creditOffer?.monthlyPayment)
        ? {
            term: creditOffer.term ? `${creditOffer.term} мес.` : "",
            rate: creditOffer.rate ? `${creditOffer.rate}%` : "",
            monthlyPayment: creditOffer.monthlyPayment,
          } : undefined,
      tradeIn: (tradeIn?.priceFrom || tradeIn?.priceTo) ? tradeIn : undefined,
      salesHead: salesHead ? {
        name: salesHead.name,
        position: salesHead.position,
        phone: salesHead.phone ?? undefined,
        email: salesHead.email ?? undefined,
      } : undefined,
      qrCode,
      carUrl,
      dealer: {
        name: loc?.title ?? car.dealer ?? "Дебрянск Авто",
        address: loc?.address ?? "г. Брянск",
        addressFull: loc?.address ?? "г. Брянск",
        hours: loc?.hours ?? "Ежедневно 9:00–21:00",
        phone: loc?.phone ?? "+7 (4832) 63-10-00",
        site: "debryansk-auto.ru",
      },
      manager: {
        name: manager.name ?? "",
        initials: managerInitials,
        position: "Менеджер отдела продаж",
        phone: manager.phone ?? "",
        email: manager.email ?? "",
        photoBase64: managerPhotoBase64 || undefined,
      },
      legal: "",
    };

    const html = renderKp(kpData);

    let pdfUrl: string | null = null;
    try {
      const pdfBuffer = await generatePdf(html);
      const objectName = await savePdfToLocal(managerId, quoteId, pdfBuffer);
      pdfUrl = `/api/manager/quotes/${quoteId}/pdf`;

      await db.update(quotesTable)
        .set({ pdfUrl: objectName })
        .where(eq(quotesTable.id, quoteId));

      logger.info(`[quotes] Generated PDF for quote ${quoteId}: ${objectName}`);
    } catch (pdfErr) {
      logger.error({ err: pdfErr }, `[quotes] PDF generation failed for quote ${quoteId}`);
    }

    return res.json({ ok: true, quoteId, pdfUrl });
  } catch (err) {
    logger.error({ err }, "[quotes] create error");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/quotes/:id", async (req, res) => {
  try {
    const quoteId = Number(req.params["id"]);
    const payload = getManagerPayload(req);
    const rawPayload = payload as unknown as Record<string, unknown>;
    const isAdminToken = rawPayload["isAdmin"] === true;

    const quoteRows = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId)).limit(1);
    if (!quoteRows.length) return res.status(404).json({ ok: false, error: "Quote not found" });
    const quote = quoteRows[0]!;

    if (quote.managerId !== payload.managerId && !isAdminToken) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const {
      clientName,
      clientPhone,
      clientGender,
      discounts,
      validUntil,
      priceOverride,
      extraEquipment,
      extraAddToRrp,
      creditOffer,
      tradeIn,
    } = req.body as {
      clientName: string;
      clientPhone: string;
      clientGender?: "male" | "female";
      discounts: Array<{ label: string; value: number }>;
      validUntil: string;
      priceOverride?: number;
      extraEquipment?: { text: string; price?: number };
      extraAddToRrp?: boolean;
      creditOffer?: { term: string; rate: string; monthlyPayment: number };
      tradeIn?: { priceFrom?: number; priceTo?: number };
    };

    if (!clientName || !clientPhone || !validUntil) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const carRows = await db.select().from(carsTable).where(eq(carsTable.externalId, quote.carId)).limit(1);
    const car = carRows[0] ?? null;
    const snap = quote.carSnapshot as Record<string, unknown>;

    // priceOverride — only for KP document, never writes to cars table
    const rawPrice = (priceOverride != null && priceOverride > 0)
      ? priceOverride
      : (car?.price ?? (snap["price"] as number | null) ?? 0);
    const extraPrice = extraEquipment?.price ? Number(extraEquipment.price) : 0;
    const addExtraToRrp = extraAddToRrp === true;
    const priceBase = addExtraToRrp ? rawPrice + extraPrice : rawPrice;
    const totalDiscount = (discounts ?? []).reduce((s, d) => s + (d.value ?? 0), 0);
    const priceFinal = priceBase - totalDiscount;

    const managerRows = await db.select().from(managersTable).where(eq(managersTable.id, quote.managerId)).limit(1);
    const manager = managerRows[0] ?? { id: quote.managerId, name: "Менеджер", phone: null, email: null };

    const kpNumber = String(quoteId).padStart(10, "0");
    const now = new Date();
    const kpDate = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const managerInitials = (manager.name ?? "")
      .split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

    const carBrand = car?.brand ?? String(snap["brand"] ?? "");
    const carType = quote.carType;
    let loc: { title: string; address: string; phone: string | null; hours: string | null } | null = null;
    if (carType === "used") {
      const usedLocRows = await db.select({
        title: locationsTable.title, address: locationsTable.address,
        phone: locationsTable.phone, hours: locationsTable.hours,
      }).from(locationsTable).where(eq(locationsTable.title, "Супонево")).limit(1);
      loc = usedLocRows[0] ?? null;
    } else if (carBrand) {
      const brandLocRows = await db.select({
        title: locationsTable.title, address: locationsTable.address,
        phone: locationsTable.phone, hours: locationsTable.hours,
      })
        .from(locationsTable)
        .innerJoin(locationBrandsTable, eq(locationBrandsTable.locationId, locationsTable.id))
        .innerJoin(brandsTable, eq(brandsTable.id, locationBrandsTable.brandId))
        .where(ilike(brandsTable.carMark, carBrand)).limit(1);
      loc = brandLocRows[0] ?? null;
    }
    if (!loc) {
      const fallback = await db.select({
        title: locationsTable.title, address: locationsTable.address,
        phone: locationsTable.phone, hours: locationsTable.hours,
      }).from(locationsTable).orderBy(locationsTable.sortOrder).limit(1);
      loc = fallback[0] ?? null;
    }

    const brandDisplayName = carBrand ? await resolveBrandName(carBrand) : (carBrand || null);

    const carSlug = car?.externalId ?? String(snap["externalId"] ?? quote.carId);
    const carUrl = `https://debryansk-auto.ru/${carType === "new" ? "new-cars" : "cars"}/${carSlug}`;
    const qrCode = await QRCode.toDataURL(carUrl, {
      width: 200, margin: 1,
      color: { dark: "#0d0f14", light: "#f4f6f9" },
    });

    const imageUrl = car?.imageUrl ?? String(snap["imageUrl"] ?? "");
    const [brandLogo, carImage, salesHeadRows] = await Promise.all([
      fetchBrandLogoHtml(carBrand),
      fetchImageBase64(imageUrl),
      db.select().from(salesHeadManagersTable)
        .where(salesHeadBrandLookup(carType, brandDisplayName))
        .orderBy(salesHeadManagersTable.sortOrder).limit(1),
    ]);
    const salesHead = salesHeadRows[0] ?? null;

    const salutation = clientGender === "male" ? "Уважаемый" : clientGender === "female" ? "Уважаемая" : "Уважаемый(-ая)";
    const ruDate = new Date(validUntil).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

    const kpData: KpData = {
      kpNumber,
      kpDate,
      validUntil: ruDate,
      clientSalutation: `${salutation} ${clientName}`,
      brand: carBrand,
      contactsTitle: carType === "used"
        ? "Дебрянск Авто - автомобили с пробегом."
        : `Дебрянск Авто - официальный дилер ${carBrand} в Брянске`,
      brandLogo,
      carTitle: `${carBrand} ${String(snap["model"] ?? "")}`.trim(),
      carTrim: String(car?.modification ?? snap["modification"] ?? car?.complectation ?? snap["complectation"] ?? ""),
      carImage,
      specs: buildSpecsFromCar(snap),
      priceBase,
      discounts: discounts ?? [],
      options: parseExtrasToOptions(car?.extras ?? null),
      extraEquipment: extraEquipment?.text?.trim() ? extraEquipment : undefined,
      creditOffer: (creditOffer?.term || creditOffer?.rate || creditOffer?.monthlyPayment)
        ? {
            term: creditOffer.term ? `${creditOffer.term} мес.` : "",
            rate: creditOffer.rate ? `${creditOffer.rate}%` : "",
            monthlyPayment: creditOffer.monthlyPayment,
          } : undefined,
      tradeIn: (tradeIn?.priceFrom || tradeIn?.priceTo) ? tradeIn : undefined,
      salesHead: salesHead ? {
        name: salesHead.name, position: salesHead.position,
        phone: salesHead.phone ?? undefined, email: salesHead.email ?? undefined,
      } : undefined,
      qrCode,
      carUrl,
      dealer: {
        name: loc?.title ?? carBrand ?? "Дебрянск Авто",
        address: loc?.address ?? "г. Брянск",
        addressFull: loc?.address ?? "г. Брянск",
        hours: loc?.hours ?? "Ежедневно 9:00–21:00",
        phone: loc?.phone ?? "+7 (4832) 63-10-00",
        site: "debryansk-auto.ru",
      },
      manager: {
        name: manager.name ?? "",
        initials: managerInitials,
        position: "Менеджер отдела продаж",
        phone: manager.phone ?? "",
        email: manager.email ?? "",
      },
      legal: "",
    };

    const html = renderKp(kpData);
    let pdfUrl: string | null = quote.pdfUrl ?? null;
    try {
      const pdfBuffer = await generatePdf(html);
      const objectName = await savePdfToLocal(quote.managerId, quoteId, pdfBuffer);
      pdfUrl = `/api/manager/quotes/${quoteId}/pdf`;
      logger.info(`[quotes] Regenerated PDF for quote ${quoteId}: ${objectName}`);
    } catch (pdfErr) {
      logger.error({ err: pdfErr }, `[quotes] PDF regeneration failed for quote ${quoteId}`);
    }

    await db.update(quotesTable).set({
      clientName,
      clientPhone,
      clientGender: clientGender ?? null,
      discounts: discounts ?? [],
      priceOriginal: priceBase,
      priceFinal,
      validUntil,
      extraEquipment: extraEquipment?.text?.trim() ? extraEquipment : null,
      extraAddToRrp: addExtraToRrp,
      creditOffer: (creditOffer?.term || creditOffer?.rate || creditOffer?.monthlyPayment) ? creditOffer : null,
      tradeIn: (tradeIn?.priceFrom || tradeIn?.priceTo) ? tradeIn : null,
      pdfUrl: pdfUrl ? pdfUrl.replace(/^\/api\/manager\/quotes\/\d+\/pdf$/, `quotes/${quote.managerId}/${quoteId}.pdf`) : null,
      updatedAt: now,
    }).where(eq(quotesTable.id, quoteId));

    return res.json({ ok: true, quoteId, pdfUrl });
  } catch (err) {
    logger.error({ err }, "[quotes] update error");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/quotes/:id/pdf", async (req, res) => {
  try {
    const quoteId = Number(req.params["id"]);
    const payload = getManagerPayload(req);

    const rows = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId)).limit(1);
    if (!rows.length) return res.status(404).json({ ok: false, error: "Not found" });

    const quote = rows[0]!;
    const isAdminPayload = (payload as unknown as Record<string, unknown>)["isAdmin"] === true;
    if (quote.managerId !== payload.managerId && !isAdminPayload) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    if (!quote.pdfUrl) {
      return res.status(404).json({ ok: false, error: "PDF not available" });
    }

    const uploadsDir = getUploadsDir();
    const pdfPath = path.join(uploadsDir, quote.pdfUrl);
    if (!existsSync(pdfPath)) {
      return res.status(404).json({ ok: false, error: "PDF not found in storage" });
    }

    const pdfBuffer = await readFile(pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="kp-${quoteId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
