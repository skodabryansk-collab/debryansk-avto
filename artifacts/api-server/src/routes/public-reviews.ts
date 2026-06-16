import { Router, type IRouter } from "express";

const router: IRouter = Router();

/* ── In-memory cache (30 min TTL) ──────────────────────────────────────────── */
interface CacheEntry { data: Review[]; avg: number; total: number; fetchedAt: number; }
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

  const url = "https://remake.getloyalty.io/platform/reviews?per_page=50&sort=date&order=desc";
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) throw new Error(`GetLoyalty API error: ${resp.status}`);
  const json = await resp.json() as Record<string, unknown>;

  /* Flatten response — try common shapes: {data:[...]}, {reviews:[...]}, [...] */
  let rawList: Record<string, unknown>[] = [];
  if (Array.isArray(json)) {
    rawList = json as Record<string, unknown>[];
  } else if (Array.isArray((json as Record<string, unknown[]>).data)) {
    rawList = (json as Record<string, unknown[]>).data as Record<string, unknown>[];
  } else if (Array.isArray((json as Record<string, unknown[]>).reviews)) {
    rawList = (json as Record<string, unknown[]>).reviews as Record<string, unknown>[];
  } else if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
    /* paginated: {data:{data:[...]}} */
    const inner = (json.data as Record<string, unknown>).data;
    if (Array.isArray(inner)) rawList = inner as Record<string, unknown>[];
  }

  /* Normalize each review */
  const all: Review[] = rawList.map((r, i) => ({
    id: (r.id as string | number) ?? i,
    author: (r.author as string) || (r.name as string) || (r.reviewer as string) || "Покупатель",
    rating: Number((r.rating as number) ?? (r.rate as number) ?? (r.score as number) ?? 5),
    text: (r.text as string) || (r.content as string) || (r.body as string) || (r.comment as string) || "",
    date: (r.date as string) || (r.created_at as string) || (r.published_at as string) || "",
    source: normalizeSource((r.source as string) || (r.platform as string) || (r.source_name as string)),
    sourceUrl: (r.url as string) || (r.link as string) || undefined,
  }));

  /* Keep only positive reviews (4–5 stars), non-empty text */
  const positive = all.filter(r => r.rating >= 4 && r.text.trim().length > 0);

  const avg = positive.length > 0
    ? Math.round((positive.reduce((s, r) => s + r.rating, 0) / positive.length) * 10) / 10
    : 5.0;

  return { data: positive, avg, total: positive.length, fetchedAt: Date.now() };
}

/* ── GET /api/reviews ──────────────────────────────────────────────────────── */
router.get("/", async (_req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ ok: true, data: cache.data, avg: cache.avg, total: cache.total, cached: true });
    }

    const entry = await fetchFromGetLoyalty();
    cache = entry;
    return res.json({ ok: true, data: entry.data, avg: entry.avg, total: entry.total, cached: false });
  } catch (err) {
    /* Graceful fallback — return empty array so frontend hides the block */
    console.error("[reviews]", String(err));
    return res.json({ ok: true, data: [], avg: 5, total: 0 });
  }
});

export default router;
