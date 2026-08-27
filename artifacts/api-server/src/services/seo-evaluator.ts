/**
 * SEO Evaluator — Петля Карпаты
 * Runs after each weekly seo-positions fetch.
 * For every applied suggestion past its evaluate_at window, computes
 * whether the applied change actually improved rankings/clicks.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  getGeoPageSignals,
  readGeoCitationReport,
  type GeoProviderObservation,
} from "../lib/geoCitationReport";
import { getSitemapLocs } from "../routes/sitemap";

const POSITION_IMPROVE_THRESHOLD = 1.5;  // positions drop (lower = better)
const CLICKS_IMPROVE_THRESHOLD   = 0.2;  // 20% more clicks → improved
const POSITION_FELL_THRESHOLD    = 2.0;  // positions rise by this → fell
const MIN_COVERAGE               = 2;    // min weekly snapshots in window
const WINDOW_DAYS                = 28;
const GEO_MIN_COMPARABLE_ROWS    = 4;
const GEO_CITATION_IMPROVE_PP    = 15;
const GEO_MENTION_IMPROVE_PP     = 10;
const GEO_CITATION_FELL_PP       = 15;
let isEvaluationRunning = false;

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

export interface GeoCitationSnapshot {
  pageUrl: string;
  reportWeek: string;
  reportUpdatedAt: string | null;
  responses: number;
  mentions: number;
  citations: number;
  mentionRatePct: number;
  citationRatePct: number;
  providers: string[];
  queryIds: string[];
  observations: GeoProviderObservation[];
}

async function captureGeoCitationSnapshotInternal(pageUrl: string): Promise<GeoCitationSnapshot | null> {
  const report = await readGeoCitationReport();
  const paths = await getSitemapLocs();
  const signals = getGeoPageSignals(report, paths, { minResponses: 1, minMentions: 0 });
  const signal = signals.signals.find(item => item.pageUrl === pageUrl);
  if (!signal || signal.responses === 0) return null;
  return {
    pageUrl: signal.pageUrl,
    reportWeek: signal.reportWeek,
    reportUpdatedAt: signal.reportUpdatedAt,
    responses: signal.responses,
    mentions: signal.mentions,
    citations: signal.citations,
    mentionRatePct: signal.mentionRatePct,
    citationRatePct: signal.citationRatePct,
    providers: signal.providers,
    queryIds: signal.queryIds,
    observations: signal.observations,
  };
}

export async function captureGeoCitationSnapshot(pageUrl: string): Promise<GeoCitationSnapshot | null> {
  try {
    return await captureGeoCitationSnapshotInternal(pageUrl);
  } catch (err) {
    logger.warn({ err, pageUrl }, "[seo-evaluator] captureGeoCitationSnapshot failed");
    return null;
  }
}

async function evaluateGeoSuggestion(
  id: number,
  pageUrl: string,
  snapshotBefore: GeoCitationSnapshot | null,
): Promise<{
  verdict: "improved" | "stable" | "fell" | "falsified" | "insufficient_data";
  note: string;
  delta: Record<string, number | string | null>;
}> {
  if (!snapshotBefore) {
    return {
      verdict: "insufficient_data",
      note: "Нет GEO-baseline до применения — оценка пропущена.",
      delta: { citationRatePp: null, mentionRatePp: null, comparableResponses: 0 },
    };
  }

  const current = await captureGeoCitationSnapshotInternal(pageUrl);
  if (!current || current.reportWeek === snapshotBefore.reportWeek) {
    return {
      verdict: "insufficient_data",
      note: "Нет нового сопоставимого GEO-отчёта после baseline.",
      delta: { citationRatePp: null, mentionRatePp: null, comparableResponses: 0 },
    };
  }

  const beforeByKey = new Map(
    snapshotBefore.observations.map(row => [`${row.provider}:${row.queryId}`, row]),
  );
  const comparable = current.observations.filter(row => beforeByKey.has(`${row.provider}:${row.queryId}`));
  if (comparable.length < GEO_MIN_COMPARABLE_ROWS) {
    return {
      verdict: "insufficient_data",
      note: `Недостаточно одинаковых наблюдений provider/query (${comparable.length} из мин. ${GEO_MIN_COMPARABLE_ROWS}).`,
      delta: { citationRatePp: null, mentionRatePp: null, comparableResponses: comparable.length },
    };
  }

  const beforeComparable = comparable.map(row => beforeByKey.get(`${row.provider}:${row.queryId}`)!);
  const beforeCitationRate = beforeComparable.filter(row => row.targetCited).length / comparable.length * 100;
  const currentCitationRate = comparable.filter(row => row.targetCited).length / comparable.length * 100;
  const beforeMentionRate = beforeComparable.filter(row => row.mentioned).length / comparable.length * 100;
  const currentMentionRate = comparable.filter(row => row.mentioned).length / comparable.length * 100;
  const citationRatePp = Math.round((currentCitationRate - beforeCitationRate) * 10) / 10;
  const mentionRatePp = Math.round((currentMentionRate - beforeMentionRate) * 10) / 10;

  let verdict: "improved" | "stable" | "fell" | "falsified";
  if (citationRatePp >= GEO_CITATION_IMPROVE_PP || mentionRatePp >= GEO_MENTION_IMPROVE_PP) {
    verdict = "improved";
  } else if (citationRatePp <= -GEO_CITATION_FELL_PP) {
    verdict = "fell";
  } else if (citationRatePp < -10 || mentionRatePp < -10) {
    verdict = "falsified";
  } else {
    verdict = "stable";
  }

  const note =
    `GEO: цитирование ${beforeCitationRate.toFixed(1)}% → ${currentCitationRate.toFixed(1)}% ` +
    `(Δ ${citationRatePp >= 0 ? "+" : ""}${citationRatePp.toFixed(1)} п.п.), ` +
    `упоминание ${beforeMentionRate.toFixed(1)}% → ${currentMentionRate.toFixed(1)}% ` +
    `(Δ ${mentionRatePp >= 0 ? "+" : ""}${mentionRatePp.toFixed(1)} п.п.).`;
  logger.info({ id, pageUrl, verdict, citationRatePp, mentionRatePp }, "[seo-evaluator] GEO verdict");
  return {
    verdict,
    note,
    delta: {
      citationRatePp,
      mentionRatePp,
      comparableResponses: comparable.length,
      beforeReportWeek: snapshotBefore.reportWeek,
      currentReportWeek: current.reportWeek,
    },
  };
}

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
  } else if (positionDelta < -1.0) {
    // Position slightly worsened (between -1.0 and -POSITION_FELL_THRESHOLD) — suggestion may have backfired
    verdict = "falsified";
    note = `Позиция незначительно ухудшилась: ${beforePos.toFixed(1)} → ${currentPos.toFixed(1)} (Δ ${positionDelta.toFixed(1)} поз.).`;
  } else {
    verdict = "stable";
    note = `Позиция стабильна (${beforePos.toFixed(1)} → ${currentPos.toFixed(1)}).`;
  }

  logger.info({ id, pageUrl, verdict, beforePos, currentPos, positionDelta }, "[seo-evaluator] Verdict");
  return { verdict, note, positionDelta };
}

/** Main entry point — called as onComplete callback by scheduleSeoPositions */
export async function runEvaluation(): Promise<void> {
  if (isEvaluationRunning) {
    logger.info("[seo-evaluator] Evaluation pass already running — skipping");
    return;
  }

  isEvaluationRunning = true;
  logger.info("[seo-evaluator] Starting evaluation pass");

  try {
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
    const geoDueRows = await db.execute(sql`
      SELECT id, page_url, geo_snapshot_before, geo_evaluate_at
      FROM seo_suggestions
      WHERE status = 'applied'
        AND type = 'geo'
        AND geo_evaluated_at IS NULL
        AND geo_evaluate_at IS NOT NULL
        AND geo_evaluate_at <= NOW()
        AND geo_snapshot_before IS NOT NULL
      ORDER BY geo_evaluate_at ASC
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
    type GeoDueRow = {
      id: number;
      page_url: string;
      geo_snapshot_before: GeoCitationSnapshot | null;
      geo_evaluate_at: string;
    };
    const geoSuggestions = geoDueRows.rows as GeoDueRow[];
    if (suggestions.length === 0 && geoSuggestions.length === 0) {
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

    let geoEvaluated = 0;
    for (const s of geoSuggestions) {
      try {
        const result = await evaluateGeoSuggestion(s.id, s.page_url, s.geo_snapshot_before);
        await db.execute(sql`
          UPDATE seo_suggestions
          SET geo_evaluated_at = NOW(),
              geo_evaluation_result = ${result.verdict},
              geo_evaluation_note = ${result.note},
              geo_result_delta = ${JSON.stringify(result.delta)}::jsonb,
              updated_at = NOW()
          WHERE id = ${s.id}
        `);
        if (result.verdict === "fell" || result.verdict === "falsified") {
          const msg = `[Петля Карпаты/GEO] На ${s.page_url}: вердикт «${result.verdict}». ${result.note}`;
          await db.execute(sql`
            INSERT INTO oauth_alerts (service, status, message)
            VALUES ('seo-evaluator-geo', 'warning', ${msg})
          `).catch(alertErr => logger.error({ alertErr }, "[seo-evaluator] Failed to write GEO alert"));
        }
        geoEvaluated++;
      } catch (err) {
        logger.error({ err, id: s.id }, "[seo-evaluator] GEO evaluation failed for suggestion");
      }
    }

    logger.info({
      evaluated,
      geoEvaluated,
      total: suggestions.length,
      geoTotal: geoSuggestions.length,
    }, "[seo-evaluator] Evaluation pass complete");
  } catch (err) {
    logger.error({ err }, "[seo-evaluator] Evaluation query failed");
  } finally {
    isEvaluationRunning = false;
  }
}

/**
 * Run a catch-up pass on startup and then once per day. The weekly positions
 * fetch remains another trigger, but it cannot be the only trigger: a
 * suggestion can become due the day after the weekly fetch.
 */
export function scheduleSeoEvaluation(): void {
  const run = () => {
    runEvaluation().catch(err => logger.error({ err }, "[seo-evaluator] Scheduled evaluation failed"));
  };

  run();
  setInterval(run, 24 * 60 * 60 * 1000);
  logger.info("[seo-evaluator] Daily evaluation scheduler started");
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

    const latestDate = await db.execute(sql`
      SELECT MAX(snapshot_date)::text AS latest FROM seo_query_snapshots
    `);
    const dateVal = (latestDate.rows[0] as { latest: string | null }).latest;
    if (!dateVal) return null;

    // Fetch all rows for this snapshot date and filter by keywords in JS.
    // Dataset is small (≤ 500 rows) so this is safe and avoids parameterized ILIKE issues.
    const kws = keywords.map(k => k.toLowerCase());
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
 * Returns negative evaluation results keyed by `${page_url}:${type}`.
 * This ensures a fell/falsified verdict for "meta" on /brands/haval-city
 * does NOT penalise the "cluster" suggestion for the same page.
 */
export async function getEvaluationFeedback(): Promise<Map<string, "fell" | "falsified">> {
  const rows = await db.execute(sql`
    SELECT page_url, type, evaluation_result
    FROM seo_suggestions
    WHERE evaluation_result IN ('fell', 'falsified')
      AND evaluated_at >= NOW() - INTERVAL '90 days'
    ORDER BY evaluated_at DESC
  `);
  const map = new Map<string, "fell" | "falsified">();
  for (const r of rows.rows as { page_url: string; type: string; evaluation_result: string }[]) {
    const key = `${r.page_url}:${r.type}`;
    if (!map.has(key)) {
      map.set(key, r.evaluation_result as "fell" | "falsified");
    }
  }
  return map;
}
