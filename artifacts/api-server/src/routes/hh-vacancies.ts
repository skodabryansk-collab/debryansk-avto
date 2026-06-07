import { Router, type IRouter } from "express";

const router: IRouter = Router();

const HH_EMPLOYER_ID = "2421744";
const RSS_URL = `https://hh.ru/search/vacancy/rss?employer_id=${HH_EMPLOYER_ID}&locale=RU&per_page=50`;
const HH_API = "https://api.hh.ru";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface HhVacancy {
  id: string;
  title: string;
  url: string;
  area: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryCurrency?: string;
  employmentType?: string;
  schedule?: string;
  experience?: string;
  description?: string;
  publishedAt?: string;
}

// Simple in-memory cache
let cache: { data: HhVacancy[]; ts: number } | null = null;

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`));
  return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function parseSalaryFromDesc(desc: string): Pick<HhVacancy, "salaryFrom" | "salaryTo" | "salaryCurrency"> {
  // hh.ru RSS format: "Предполагаемый уровень месячного дохода: от 55 000 ₽"
  // Extract only the salary line to avoid false-positives from dates in the description
  const salaryLine = desc.match(/(?:месячного дохода|зарплата|оклад)[^<]*?:\s*([^<]+)/i)?.[1]?.trim() ?? "";
  if (!salaryLine) return {};

  const toNum = (s: string) => parseInt(s.replace(/[\s\u00a0]/g, ""), 10);

  const fromTo = salaryLine.match(/от\s*([\d\s\u00a0]+?)\s*(?:до|–|-)\s*([\d\s\u00a0]+)/i);
  if (fromTo) return { salaryFrom: toNum(fromTo[1]), salaryTo: toNum(fromTo[2]), salaryCurrency: "RUR" };

  const fromOnly = salaryLine.match(/от\s*([\d][\d\s\u00a0]*\d)/i);
  if (fromOnly) return { salaryFrom: toNum(fromOnly[1]), salaryCurrency: "RUR" };

  const toOnly = salaryLine.match(/до\s*([\d][\d\s\u00a0]*\d)/i);
  if (toOnly) return { salaryTo: toNum(toOnly[1]), salaryCurrency: "RUR" };

  const fixed = salaryLine.match(/([\d][\d\s\u00a0]*\d)\s*(?:₽|руб)/i);
  if (fixed) return { salaryFrom: toNum(fixed[1]), salaryCurrency: "RUR" };

  return {};
}

async function fetchRss(): Promise<HhVacancy[]> {
  const res = await fetch(RSS_URL, {
    headers: {
      "User-Agent": "DebrynskAvtoSite/1.0 (info@debryansk-avto.ru)",
      "Accept": "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  // Split into <item>...</item> blocks
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

  const vacancies: HhVacancy[] = itemBlocks.map(block => {
    const title = stripHtml(extractTag(block, "title"));
    const url = extractTag(block, "link") || extractTag(block, "guid");
    const idMatch = url.match(/\/vacancy\/(\d+)/);
    const id = idMatch ? idMatch[1] : url;
    const desc = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");

    // Extract area from raw HTML before stripping: "Регион: Брянск</p>"
    const areaMatch = desc.match(/Регион:\s*([^<]+)/i);
    const area = areaMatch ? areaMatch[1].trim() : "Брянск";

    const salary = parseSalaryFromDesc(desc);

    return { id, title, url, area, publishedAt: pubDate, ...salary };
  });

  return vacancies.filter(v => v.id && v.title);
}

async function enrichWithApiDetails(vacancies: HhVacancy[]): Promise<HhVacancy[]> {
  // Try to enrich with details from api.hh.ru — may fail, gracefully ignored
  const enriched = await Promise.allSettled(
    vacancies.map(async v => {
      const res = await fetch(`${HH_API}/vacancies/${v.id}`, {
        headers: {
          "User-Agent": "DebrynskAvtoSite/1.0 (info@debryansk-avto.ru)",
          "Accept": "application/json",
          "HH-User-Agent": "DebrynskAvtoSite/1.0 (info@debryansk-avto.ru)",
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return v;
      const d = await res.json();
      return {
        ...v,
        employmentType: d.employment?.name,
        schedule: d.schedule?.name,
        experience: d.experience?.name,
        description: d.snippet?.responsibility || d.snippet?.requirement
          ? stripHtml((d.snippet?.responsibility ?? "") + " " + (d.snippet?.requirement ?? ""))
          : undefined,
        salaryFrom: d.salary?.from ?? v.salaryFrom,
        salaryTo: d.salary?.to ?? v.salaryTo,
        salaryCurrency: d.salary?.currency ?? v.salaryCurrency,
      } satisfies HhVacancy;
    })
  );

  return enriched.map((r, i) => r.status === "fulfilled" ? r.value : vacancies[i]);
}

router.get("/hh-vacancies", async (_req, res) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return res.json({ items: cache.data, source: "cache" });
    }

    const basic = await fetchRss();
    const enriched = await enrichWithApiDetails(basic);
    cache = { data: enriched, ts: Date.now() };
    return res.json({ items: enriched, source: "live" });
  } catch (err: any) {
    // Return cached data if available even if stale
    if (cache) return res.json({ items: cache.data, source: "stale-cache" });
    return res.status(502).json({ error: "hh.ru unavailable", message: err?.message });
  }
});

export default router;
