import { Router, type IRouter } from "express";

const router: IRouter = Router();

const SALES_FEED_URL = "https://xml.krona-auto.ru/WebsiteGC/sales.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SalesFeed {
  sales_new: number;
  sales_used: number;
}

let cachedSales: (SalesFeed & { total: number; updatedAt: string }) | null = null;
let cacheExpiresAt = 0;

function parseSalesFeed(value: unknown): SalesFeed | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  const salesNew = Number(data.sales_new);
  const salesUsed = Number(data.sales_used);

  if (
    !Number.isSafeInteger(salesNew) ||
    salesNew < 0 ||
    !Number.isSafeInteger(salesUsed) ||
    salesUsed < 0
  ) {
    return null;
  }

  return { sales_new: salesNew, sales_used: salesUsed };
}

router.get("/sales", async (req, res): Promise<void> => {
  if (cachedSales && Date.now() < cacheExpiresAt) {
    res.json({ ok: true, data: cachedSales });
    return;
  }

  try {
    const response = await fetch(SALES_FEED_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Sales feed responded with ${response.status}`);
    }

    const parsed = parseSalesFeed(await response.json());
    if (!parsed) {
      throw new Error("Sales feed has an invalid shape");
    }

    cachedSales = {
      ...parsed,
      total: parsed.sales_new + parsed.sales_used,
      updatedAt: new Date().toISOString(),
    };
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    res.json({ ok: true, data: cachedSales });
  } catch (error) {
    req.log.warn({ err: error }, "Unable to refresh sold cars statistics");

    if (cachedSales) {
      res.json({ ok: true, data: cachedSales, stale: true });
      return;
    }

    res.status(503).json({ ok: false, error: "Sales statistics are temporarily unavailable" });
  }
});

export default router;