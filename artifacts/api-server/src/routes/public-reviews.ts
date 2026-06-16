import { Router, type IRouter } from "express";

const router: IRouter = Router();

/* ── In-memory cache (30 min TTL) ──────────────────────────────────────────── */
interface CacheEntry { data: Review[]; avg: number; total: number; overallCount: number; fetchedAt: number; }
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface Review {
  id: string | number;
  author: string;
  rating: number;
  text: string;
  date: string;
  source: string;
  sourceUrl?: string;
}

/* ── Source name normalizer ─────────────────────────────────────────────────── */
function normalizeSource(raw: string | undefined): string {
  if (!raw) return "Отзыв";
  const s = raw.toLowerCase();
  if (s.includes("yandex") || s.includes("яндекс")) return "Яндекс";
  if (s.includes("google")) return "Google";
  if (s.includes("avito") || s.includes("авито")) return "Авито";
  if (s.includes("2gis") || s.includes("2gis") || s.includes("2гис")) return "2ГИС";
  return raw;
}

/* ── Fetch from GetLoyalty ─────────────────────────────────────────────────── */
async function fetchFromGetLoyalty(): Promise<CacheEntry> {
  const apiKey = process.env.GETLOYALTY_API_KEY;
  if (!apiKey) throw new Error("GETLOYALTY_API_KEY not set");

  const EXCLUDED_PLATFORMS = ["plasopro", "flamp", "yell", "zoon"];
  const cutoffTs = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
  const API_URL = "https://remake.getloyalty.io/api/v2/reviews";

  /* Fetch page helper */
  async function fetchPage(page: number): Promise<{ sourcesMap: Record<string, { platform?: string; link?: string; filials?: string[]; reviews?: number }> | null; items: Record<string, unknown>[] }> {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ page }),
    });
    if (!resp.ok) throw new Error(`GetLoyalty API error: ${resp.status}`);
    const json = await resp.json() as Record<string, unknown>;
    const items = Array.isArray(json.reviews) ? json.reviews as Record<string, unknown>[]
      : Array.isArray(json) ? json as Record<string, unknown>[]
      : Array.isArray((json as Record<string, unknown[]>).data) ? (json as Record<string, unknown[]>).data as Record<string, unknown>[]
      : [];
    const sm = page === 1 ? (json.sources ?? {}) as Record<string, { platform?: string; link?: string; filials?: string[]; reviews?: number }> : null;
    return { sourcesMap: sm, items };
  }

  /* Paginate — stop when page is empty or all items are older than cutoff */
  let sourcesMap: Record<string, { platform?: string; link?: string; filials?: string[]; reviews?: number }> = {};
  const rawList: Record<string, unknown>[] = [];
  const MAX_PAGES = 50;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { sourcesMap: sm, items } = await fetchPage(page);
    if (sm) sourcesMap = sm;
    if (items.length === 0) break;
    rawList.push(...items);
    /* Stop if the oldest item on this page is beyond the 90-day window */
    const oldestTs = Math.min(...items.map(r => (typeof r.date === "number" ? r.date as number : 0)));
    if (oldestTs > 0 && oldestTs < cutoffTs) break;
  }

  /* Overall count — sum of reviews across all non-excluded sources (all time) */
  const overallCount = Object.values(sourcesMap).reduce((sum, s) => {
    const p = (s.platform ?? "").toLowerCase();
    if (EXCLUDED_PLATFORMS.some(ex => p.includes(ex))) return sum;
    return sum + (s.reviews ?? 0);
  }, 0);

  /* Normalize each review */
  const all: Review[] = rawList.map((r, i) => {
    const sourceKey = r.source as string;
    const sourceInfo = sourcesMap[sourceKey];
    const platform = sourceInfo?.platform ?? sourceKey ?? "";
    const user = r.user as Record<string, unknown> | undefined;
    const authorName = (user?.name as string) || (r.author as string) || (r.name as string) || "Покупатель";
    const ratingRaw = (r.rate as number) ?? (r.rating as number) ?? (r.score as number) ?? 5;
    const dateRaw = r.date as number | string;
    const dateStr = typeof dateRaw === "number"
      ? new Date(dateRaw * 1000).toISOString().split("T")[0]
      : (dateRaw as string) || "";
    return {
      id: (r.id as string | number) ?? i,
      author: authorName,
      rating: Number(ratingRaw),
      text: (r.text as string) || (r.content as string) || (r.body as string) || "",
      date: dateStr,
      source: normalizeSource(platform),
      sourceUrl: sourceInfo?.link || (r.link as string) || undefined,
    };
  });

  /* Keep only: positive (4–5★), non-empty text, non-excluded platform, last 90 days */
  const positive = all.filter(r => {
    if (r.rating < 4 || !r.text.trim()) return false;
    if (EXCLUDED_PLATFORMS.some(p => (r.source ?? "").toLowerCase().includes(p))) return false;
    const ts = r.date ? Math.floor(new Date(r.date).getTime() / 1000) : 0;
    return ts >= cutoffTs;
  });

  const avg = positive.length > 0
    ? Math.round((positive.reduce((s, r) => s + r.rating, 0) / positive.length) * 10) / 10
    : 5.0;

  return { data: positive, avg, total: positive.length, overallCount, fetchedAt: Date.now() };
}

/* ── GET /api/reviews ──────────────────────────────────────────────────────── */
router.get("/", async (_req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ ok: true, data: cache.data, avg: cache.avg, total: cache.total, overallCount: cache.overallCount, cached: true });
    }

    const entry = await fetchFromGetLoyalty();
    cache = entry;
    return res.json({ ok: true, data: entry.data, avg: entry.avg, total: entry.total, overallCount: entry.overallCount, cached: false });
  } catch (err) {
    /* Graceful fallback — return empty array so frontend hides the block */
    console.error("[reviews]", String(err));
    return res.json({ ok: true, data: [], avg: 5, total: 0, overallCount: 0 });
  }
});

export default router;
