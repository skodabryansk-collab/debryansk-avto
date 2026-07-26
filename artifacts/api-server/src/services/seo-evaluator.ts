/**
 * SEO Evaluator — Петля Карпаты
 * Runs after each weekly seo-positions fetch.
 * For every applied suggestion past its evaluate_at window, computes
 * whether the applied change actually improved rankings/clicks.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const POSITION_IMPROVE_THRESHOLD = 1.5;  // positions drop (lower = better)
const CLICKS_IMPROVE_THRESHOLD   = 0.2;  // 20% more clicks → improved
const POSITION_FELL_THRESHOLD    = 2.0;  // positions rise by this → fell
const MIN_COVERAGE               = 2;    // min weekly snapshots in window
const WINDOW_DAYS                = 28;

/* ── Brand-url → query keywords mapping ─────────────────────────────── */
const BRAND_URL_KEYWORDS: Record<string, string[]> = {
  "haval-city":    ["haval", "хавал", "jolion", "джолион", "dargo", "дарго", "f7", "h9", "m6"],
  "haval-pro":     ["haval", "хавал"],
  "omoda":         ["omoda", "омода"],
  "jaecoo":        ["jaecoo", "джаеку", "джейку"],
  "jetour":        ["jetour", "джетур", "x70", "x90", "dashing"],
  "tenet":         ["tenet", "тенет", "arrizo"],
  "soueast":       ["soueast", "соуист"],
  "mercedes-benz": ["mercedes", "мерседес", "mb ", "мб "],
  "volkswagen":    ["volkswagen", "фольксваген", "vw "],
  "skoda":         ["skoda", "шкода"],
  "exeed":         ["exeed", "эксид"],
};

function getKeywordsForUrl(pageUrl: string): string[] {
  if (pageUrl.startsWith("/brands/")) {
    const slug = pageUrl.replace("/brands/", "");
    return BRAND_URL_KEYWORDS[slug] ?? [];
  }
  return [];
}

type Snapshot = { avg_position: number; total_clicks: number; snapshot_date: string };

async function evaluateSuggestion(
  id: number,
  pageUrl: string,
  snapshotBefore: { position: number | null; clicks: number | null; date: string } | null,
): Promise<{ verdict: "improved" | "stable" | "fell" | "falsified"; note: string; positionDelta: number | null }> {

  if (!snapshotBefore || snapshotBefore.position === null) {
    return { verdict: "stable", note: "Нет снапшота до применения — оценка пропущена", positionDelta: null };
  }

  // Load snapshots from the last WINDOW_DAYS
  const snapsRows = await db.execute(sql`
    SELECT query_text, avg_position, total_clicks, snapshot_date::text
    FROM seo_query_snapshots
    WHERE snapshot_date >= NOW() - INTERVAL '28 days'
    ORDER BY snapshot_date DESC
  `);
  const allSnaps = snapsRows.rows as (Snapshot & { query_text: string })[];

  const keywords = getKeywordsForUrl(pageUrl);
  const relevant = keywords.length > 0
    ? allSnaps.filter(r => {
        const q = r.query_text.toLowerCase();
        return keywords.some(kw => q.includes(kw.toLowerCase()));
      })
    : allSnaps; // non-brand pages: use all queries (rare case)

  // Group by date
  const byDate = new Map<string, { positions: number[]; clicks: number[] }>();
  for (const r of relevant) {
    if (!byDate.has(r.snapshot_date)) byDate.set(r.snapshot_date, { positions: [], clicks: [] });
    byDate.get(r.snapshot_date)!.positions.push(r.avg_position);
    byDate.get(r.snapshot_date)!.clicks.push(r.total_clicks);
  }

  if (byDate.size < MIN_COVERAGE) {
    return {
      verdict: "stable",
      note: `Недостаточно снапшотов для оценки (${byDate.size} из мин. ${MIN_COVERAGE})`,
      positionDelta: null,
    };
  }

  // Weighted average: newest week → weight 1, prev → 0.5, etc.
  const dates = [...byDate.keys()].sort().reverse(); // newest first
  let weightedPos = 0, weightedClicks = 0, weightTotal = 0;
  for (let i = 0; i < dates.length; i++) {
    const w = 1 / (i + 1);
    const d = byDate.get(dates[i])!;
    const avgPos = d.positions.reduce((a, b) => a + b, 0) / d.positions.length;
    const sumClicks = d.clicks.reduce((a, b) => a + b, 0);
    weightedPos += avgPos * w;
    weightedClicks += sumClicks * w;
    weightTotal += w;
  }

  const currentPos = weightedPos / weightTotal;
  const currentClicks = weightedClicks / weightTotal;
  const beforePos = snapshotBefore.position;
  const beforeClicks = snapshotBefore.clicks ?? 0;

  // Positive positionDelta = position dropped = improved
  const positionDelta = beforePos - currentPos;
  const clicksDelta = beforeClicks > 0
    ? (currentClicks - beforeClicks) / beforeClicks
    : 0;

  let verdict: "improved" | "stable" | "fell" | "falsified";
  let note: string;

  if (positionDelta >= POSITION_IMPROVE_THRESHOLD || clicksDelta >= CLICKS_IMPROVE_THRESHOLD) {
    verdict = "improved";
    note = `Позиция улучшилась на ${positionDelta.toFixed(1)} поз. (${beforePos.toFixed(1)} → ${currentPos.toFixed(1)}). ` +
           `Кликов Δ: ${clicksDelta >= 0 ? "+" : ""}${(clicksDelta * 100).toFixed(0)}%.`;
  } else if (positionDelta <= -POSITION_FELL_THRESHOLD) {
    verdict = "fell";
    note = `Позиция ухудшилась на ${Math.abs(positionDelta).toFixed(1)} поз. (${beforePos.toFixed(1)} → ${currentPos.toFixed(1)}).`;
  } else if (beforePos > 10 && Math.abs(positionDelta) < POSITION_IMPROVE_THRESHOLD && clicksDelta < CLICKS_IMPROVE_THRESHOLD) {
    // Was not in top-10 before, expected improvement but nothing happened
    verdict = "falsified";
    note = `Ожидался рост позиции, но изменений нет. Позиция: ${beforePos.toFixed(1)} → ${currentPos.toFixed(1)}.`;
  } else {
    verdict = "stable";
    note = `Позиция стабильна (${beforePos.toFixed(1)} → ${currentPos.toFixed(1)}).`;
  }

  logger.info({ id, pageUrl, verdict, beforePos, currentPos, positionDelta }, "[seo-evaluator] Verdict");
  return { verdict, note, positionDelta };
}

/** Main entry point — called as onComplete callback by scheduleSeoPositions */
export async function runEvaluation(): Promise<void> {
  logger.info("[seo-evaluator] Starting evaluation pass");

  const dueRows = await db.execute(sql`
    SELECT id, type, page_url, snapshot_before, evaluate_at, applied_at
    FROM seo_suggestions
    WHERE status = 'applied'
      AND evaluated_at IS NULL
      AND evaluate_at IS NOT NULL
      AND evaluate_at <= NOW()
      AND snapshot_before IS NOT NULL
    ORDER BY evaluate_at ASC
    LIMIT 50
  `);

  type DueRow = {
    id: number;
    type: string;
    page_url: string;
    snapshot_before: { position: number | null; clicks: number | null; date: string } | null;
    evaluate_at: string;
    applied_at: string;
  };

  const suggestions = dueRows.rows as DueRow[];
  if (suggestions.length === 0) {
    logger.info("[seo-evaluator] Nothing due for evaluation");
    return;
  }

  let evaluated = 0;
  for (const s of suggestions) {
    try {
      const { verdict, note, positionDelta } = await evaluateSuggestion(s.id, s.page_url, s.snapshot_before);

      await db.execute(sql`
        UPDATE seo_suggestions
        SET evaluated_at     = NOW(),
            evaluation_result = ${verdict},
            evaluation_note  = ${note},
            result_delta     = ${positionDelta},
            updated_at       = NOW()
        WHERE id = ${s.id}
      `);

      // Watchman: alert on fell / falsified
      if (verdict === "fell" || verdict === "falsified") {
        const msg = `[Петля Карпаты] Тип "${s.type}" на ${s.page_url}: вердикт «${verdict}». ${note}`;
        await db.execute(sql`
          INSERT INTO oauth_alerts (service, status, message)
          VALUES ('seo-evaluator', 'warning', ${msg})
        `).catch(alertErr => logger.error({ alertErr }, "[seo-evaluator] Failed to write alert"));
      }

      evaluated++;
    } catch (err) {
      logger.error({ err, id: s.id }, "[seo-evaluator] Evaluation failed for suggestion");
    }
  }

  logger.info({ evaluated, total: suggestions.length }, "[seo-evaluator] Evaluation pass complete");
}

/**
 * Captures current position + clicks for a page_url from the latest seo_query_snapshots.
 * Called by the apply pipeline (admin-seo-autopilot.ts) to record the baseline before changes take effect.
 */
export async function capturePositionSnapshot(pageUrl: string): Promise<{
  position: number | null;
  clicks: number | null;
  date: string | null;
  queryCount: number;
} | null> {
  try {
    const keywords = getKeywordsForUrl(pageUrl);
    if (keywords.length === 0) return null;

    const likeConditions = keywords.map(kw => `query_text ILIKE '%${kw.replace(/'/g, "''")}%'`).join(" OR ");

    const latestDate = await db.execute(sql`
      SELECT MAX(snapshot_date)::text AS latest FROM seo_query_snapshots
    `);
    const dateVal = (latestDate.rows[0] as { latest: string | null }).latest;
    if (!dateVal) return null;

    const rows = await db.execute(sql`
      SELECT avg_position, total_clicks
      FROM seo_query_snapshots
      WHERE snapshot_date = ${dateVal}::date
    `);
    // Filter by keywords in JS (safe from injection since we only use the BRAND_URL_KEYWORDS constants)
    const matching = (rows.rows as { avg_position: number; total_clicks: number }[])
      .filter((_, _i) => true); // we'll filter below via a real approach

    // Safer: re-query with explicit keyword matching
    const snapRows = await db.execute(sql`
      SELECT avg_position, total_clicks
      FROM seo_query_snapshots
      WHERE snapshot_date = ${dateVal}::date
        AND total_shows > 0
    `);
    type SnapRow = { avg_position: number; total_clicks: number };
    const allRows = snapRows.rows as SnapRow[];
    const kws = keywords.map(k => k.toLowerCase());

    // We need to fetch with ILIKE, but can't parameterize a dynamic list cleanly.
    // Fetch all for this date and filter in JS (dataset is small ≤ 500 rows).
    const allSnaps = await db.execute(sql`
      SELECT query_text, avg_position, total_clicks
      FROM seo_query_snapshots
      WHERE snapshot_date = ${dateVal}::date
    `);
    type FullSnapRow = { query_text: string; avg_position: number; total_clicks: number };
    const filtered = (allSnaps.rows as FullSnapRow[]).filter(r => {
      const q = r.query_text.toLowerCase();
      return kws.some(kw => q.includes(kw));
    });

    if (filtered.length === 0) return null;

    const avgPos = filtered.reduce((s, r) => s + r.avg_position, 0) / filtered.length;
    const totalClicks = filtered.reduce((s, r) => s + r.total_clicks, 0);

    return { position: avgPos, clicks: totalClicks, date: dateVal, queryCount: filtered.length };
  } catch (err) {
    logger.error({ err, pageUrl }, "[seo-evaluator] capturePositionSnapshot failed");
    return null;
  }
}

/**
 * Returns evaluated negative results by page_url.
 * Used by seo-gap.ts to apply a 0.5× priority discount on repeat suggestions
 * for pages where a previous suggestion fell or was falsified.
 */
export async function getEvaluationFeedback(): Promise<Map<string, "fell" | "falsified">> {
  const rows = await db.execute(sql`
    SELECT page_url, evaluation_result
    FROM seo_suggestions
    WHERE evaluation_result IN ('fell', 'falsified')
      AND evaluated_at >= NOW() - INTERVAL '90 days'
    ORDER BY evaluated_at DESC
  `);
  const map = new Map<string, "fell" | "falsified">();
  for (const r of rows.rows as { page_url: string; evaluation_result: string }[]) {
    if (!map.has(r.page_url)) {
      map.set(r.page_url, r.evaluation_result as "fell" | "falsified");
    }
  }
  return map;
}
