import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { fetchCmBusinessIntegrationSnapshot, mapCmBusinessDealerStockCar } from "./tenet-plus-stock";

export type CmStockMode = "catalog" | "options_only";
export interface CmStockIntegration {
  dealerId: string;
  dealerName: string;
  mode: CmStockMode;
  enabled: boolean;
  lastStatus: "never" | "running" | "success" | "error";
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  stockCount: number;
  matchedCount: number;
  carsWithOptions: number;
  optionsCount: number;
  pagesFetched: number;
  rowsScanned: number;
  durationMs: number;
}

const DEFAULT_INTERVAL_MINUTES = 30;
const ALLOWED_INTERVALS = new Set([30, 60, 120]);

let running = false;
let starting = false;
let optionsOnlyDealerNames = new Set(["haval pro", "haval city"]);

function normalizeVin(value: unknown): string {
  const vin = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return vin.length === 17 ? vin : "";
}

function safeError(error: unknown): string {
  const value = error instanceof Error ? error.message : "Неизвестная ошибка CM Expert";
  return value
    .replace(/https?:\/\/\S+/gi, "[CM API]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 300);
}

export async function getCmStockIntegrations(): Promise<CmStockIntegration[]> {
  const result = await db.execute(sql`
    SELECT dealer_id, dealer_name, mode, enabled, last_status, last_started_at,
           last_completed_at, last_success_at, last_error, stock_count,
           matched_count, cars_with_options, options_count, pages_fetched,
           rows_scanned, duration_ms
    FROM cm_stock_integrations
    ORDER BY CASE mode WHEN 'catalog' THEN 0 ELSE 1 END, dealer_name
  `);
  const integrations = (result.rows as Record<string, unknown>[]).map(row => ({
    dealerId: String(row.dealer_id),
    dealerName: String(row.dealer_name),
    mode: (row.mode === "catalog" ? "catalog" : "options_only") as CmStockMode,
    enabled: row.enabled === true,
    lastStatus: (row.last_status as CmStockIntegration["lastStatus"]) ?? "never",
    lastStartedAt: row.last_started_at ? new Date(String(row.last_started_at)).toISOString() : null,
    lastCompletedAt: row.last_completed_at ? new Date(String(row.last_completed_at)).toISOString() : null,
    lastSuccessAt: row.last_success_at ? new Date(String(row.last_success_at)).toISOString() : null,
    lastError: row.last_error ? String(row.last_error) : null,
    stockCount: Number(row.stock_count ?? 0),
    matchedCount: Number(row.matched_count ?? 0),
    carsWithOptions: Number(row.cars_with_options ?? 0),
    optionsCount: Number(row.options_count ?? 0),
    pagesFetched: Number(row.pages_fetched ?? 0),
    rowsScanned: Number(row.rows_scanned ?? 0),
    durationMs: Number(row.duration_ms ?? 0),
  }));
  optionsOnlyDealerNames = new Set(
    integrations.filter(row => row.mode === "options_only").map(row => row.dealerName.trim().toLowerCase()),
  );
  return integrations;
}

export function isCmOptionsOnlyDealer(dealerName: string | null | undefined): boolean {
  return optionsOnlyDealerNames.has(String(dealerName ?? "").trim().toLowerCase());
}

export async function getCmStockIntervalMinutes(): Promise<number> {
  const result = await db.execute(sql`SELECT interval_minutes FROM cm_stock_sync_settings WHERE id = 1`);
  const value = Number((result.rows[0] as { interval_minutes?: unknown } | undefined)?.interval_minutes);
  return ALLOWED_INTERVALS.has(value) ? value : DEFAULT_INTERVAL_MINUTES;
}

export async function saveCmStockIntervalMinutes(value: number): Promise<number> {
  if (!ALLOWED_INTERVALS.has(value)) throw new Error("Период должен быть 30, 60 или 120 минут");
  await db.execute(sql`
    INSERT INTO cm_stock_sync_settings (id, interval_minutes, updated_at)
    VALUES (1, ${value}, NOW())
    ON CONFLICT (id) DO UPDATE SET interval_minutes = EXCLUDED.interval_minutes, updated_at = NOW()
  `);
  return value;
}

export async function getCmOptionsOnlyDealerNames(): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT dealer_name FROM cm_stock_integrations WHERE mode = 'options_only'
  `);
  return (rows.rows as { dealer_name: string }[]).map(row => row.dealer_name);
}

export async function getCmCatalogDealers(): Promise<Array<{ dealerId: string; dealerName: string }>> {
  const rows = await db.execute(sql`
    SELECT dealer_id, dealer_name
    FROM cm_stock_integrations
    WHERE mode = 'catalog' AND enabled = TRUE
    ORDER BY dealer_name
  `);
  return (rows.rows as { dealer_id: string; dealer_name: string }[]).map(row => ({
    dealerId: row.dealer_id,
    dealerName: row.dealer_name,
  }));
}

export async function getCmStockAdminState() {
  const [integrations, intervalMinutes, history, credentials] = await Promise.all([
    getCmStockIntegrations(),
    getCmStockIntervalMinutes(),
    db.execute(sql`
      SELECT id, trigger, status, started_at, completed_at, duration_ms,
             pages_fetched, rows_scanned, error
      FROM cm_stock_sync_runs
      ORDER BY id DESC LIMIT 12
    `),
    Promise.resolve(Boolean(
      process.env.CM_EXPERT_CLIENT_ID?.trim() &&
      process.env.CM_EXPERT_CLIENT_SECRET?.trim(),
    )),
  ]);
  const runIds = (history.rows as { id: number }[]).map(row => row.id);
  const dealerHistory = runIds.length
    ? await db.execute(sql`
        SELECT run_id, dealer_id, dealer_name, status, stock_count,
               matched_count, cars_with_options, options_count, error
        FROM cm_stock_sync_run_dealers
        WHERE run_id IN (${sql.join(runIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY id
      `)
    : { rows: [] };
  const dealersByRun = new Map<number, Record<string, unknown>[]>();
  for (const dealerRun of dealerHistory.rows as Record<string, unknown>[]) {
    const runId = Number(dealerRun.run_id);
    const list = dealersByRun.get(runId) ?? [];
    list.push(dealerRun);
    dealersByRun.set(runId, list);
  }
  return {
    connection: credentials ? "credentials_configured" : "credentials_missing",
    running,
    intervalMinutes,
    integrations,
    recentRuns: (history.rows as Record<string, unknown>[]).map(run => ({
      ...run,
      dealers: dealersByRun.get(Number(run.id)) ?? [],
    })),
  };
}

interface DealerRunResult {
  dealerId: string;
  dealerName: string;
  status: "success" | "error";
  stockCount: number;
  matchedCount: number;
  carsWithOptions: number;
  optionsCount: number;
  error: string | null;
}

async function performCmStockSync(trigger: string): Promise<void> {
  const startedAt = Date.now();
  const enabled = (await getCmStockIntegrations()).filter(integration => integration.enabled);
  if (!enabled.length) return;

  const runResult = await db.execute(sql`
    INSERT INTO cm_stock_sync_runs (trigger, status, started_at)
    VALUES (${trigger}, 'running', NOW())
    RETURNING id
  `);
  const runId = Number((runResult.rows[0] as { id: number }).id);
  await db.execute(sql`
    UPDATE cm_stock_integrations
    SET last_status = 'running', last_started_at = NOW(), last_error = NULL, updated_at = NOW()
    WHERE enabled = TRUE
  `);

  try {
    const snapshot = await fetchCmBusinessIntegrationSnapshot(
      enabled.map(integration => integration.dealerId),
      { forceRefresh: trigger === "manual" },
    );
    if (trigger === "manual" && enabled.some(integration => integration.mode === "catalog")) {
      const { syncCars } = await import("./car-sync");
      await syncCars();
    }
    const localRows = await db.execute(sql`
      SELECT external_id, dealer, vin
      FROM cars WHERE type = 'new'
    `);
    const localCars = (localRows.rows as {
      external_id: string;
      dealer: string | null;
      vin: string | null;
    }[]).map(row => ({ ...row, dealerKey: String(row.dealer ?? "").trim().toLowerCase() }));
    const results: DealerRunResult[] = [];

    for (const integration of enabled) {
      try {
        if (!snapshot.presentDealerIds.has(integration.dealerId)) {
          throw new Error("Салон не найден в завершённой выгрузке CM");
        }
        const sourceRows = snapshot.rows.filter(row => String(row.dealerId ?? "") === integration.dealerId);
        const mapped = sourceRows.map(row => mapCmBusinessDealerStockCar(row, integration.dealerName))
          .filter((car): car is NonNullable<typeof car> => car !== null);
        if (mapped.length !== sourceRows.length) {
          throw new Error("В активном складе CM есть автомобили без стабильного ID");
        }
        let matchedCount = 0;
        let carsWithOptions = 0;
        let optionsCount = 0;
        const dealerKey = integration.dealerName.trim().toLowerCase();

        if (integration.mode === "options_only") {
          const localByVin = new Map(
            localCars.filter(car => car.dealerKey === dealerKey && normalizeVin(car.vin))
              .map(car => [normalizeVin(car.vin), car] as const),
          );

          const matched: Array<{ externalId: string; options: string[]; dmsCarId: string | null; stockId: string | null }> = [];
          for (const car of mapped) {
            const local = localByVin.get(normalizeVin(car.vin));
            if (!local) continue;
            const options = car.options ?? [];
            matched.push({ externalId: local.external_id, options, dmsCarId: car.cmDmsCarId, stockId: car.cmStockId });
            matchedCount++;
            if (options.length) carsWithOptions++;
            optionsCount += options.length;
          }
          // Replace only the CM-derived overlay as one transaction after a
          // complete scan. The source catalog's extras remain untouched.
          await db.transaction(async tx => {
            await tx.execute(sql`
              UPDATE cars
              SET cm_verified_extras = NULL, cm_dms_car_id = NULL, cm_stock_id = NULL
              WHERE type = 'new' AND LOWER(BTRIM(dealer)) = ${dealerKey}
            `);
            for (const car of matched) {
              await tx.execute(sql`
                UPDATE cars
                SET cm_verified_extras = ${car.options.length ? car.options.join(", ") : null},
                    cm_dms_car_id = ${car.dmsCarId},
                    cm_stock_id = ${car.stockId}
                WHERE external_id = ${car.externalId} AND type = 'new'
              `);
            }
          });
        } else {
          const localIds = new Set(localCars.filter(car => car.dealerKey === dealerKey).map(car => car.external_id));
          for (const car of mapped) {
            if (!localIds.has(car.id)) continue;
            matchedCount++;
            if (car.options?.length) carsWithOptions++;
            optionsCount += car.options?.length ?? 0;
          }
        }

        const stats = {
          stockCount: mapped.length,
          matchedCount,
          carsWithOptions,
          optionsCount,
        };
        await db.execute(sql`
          UPDATE cm_stock_integrations
          SET last_status = 'success', last_completed_at = NOW(), last_success_at = NOW(),
              last_error = NULL, stock_count = ${stats.stockCount}, matched_count = ${stats.matchedCount},
              cars_with_options = ${stats.carsWithOptions}, options_count = ${stats.optionsCount},
              pages_fetched = ${snapshot.pagesFetched}, rows_scanned = ${snapshot.rowsScanned},
              duration_ms = ${Date.now() - startedAt}, updated_at = NOW()
          WHERE dealer_id = ${integration.dealerId}
        `);
        results.push({ dealerId: integration.dealerId, dealerName: integration.dealerName, status: "success", ...stats, error: null });
      } catch (error) {
        const message = safeError(error);
        await db.execute(sql`
          UPDATE cm_stock_integrations
          SET last_status = 'error', last_completed_at = NOW(), last_error = ${message},
              pages_fetched = ${snapshot.pagesFetched}, rows_scanned = ${snapshot.rowsScanned},
              duration_ms = ${Date.now() - startedAt}, updated_at = NOW()
          WHERE dealer_id = ${integration.dealerId}
        `);
        results.push({
          dealerId: integration.dealerId,
          dealerName: integration.dealerName,
          status: "error",
          stockCount: 0,
          matchedCount: 0,
          carsWithOptions: 0,
          optionsCount: 0,
          error: message,
        });
      }
    }

    for (const integration of (await getCmStockIntegrations()).filter(row => !row.enabled)) {
      results.push({
        dealerId: integration.dealerId,
        dealerName: integration.dealerName,
        status: "error",
        stockCount: 0,
        matchedCount: 0,
        carsWithOptions: 0,
        optionsCount: 0,
        error: "Интеграция отключена",
      });
    }

    const hasErrors = results.some(result => result.status === "error" && result.error !== "Интеграция отключена");
    await db.execute(sql`
      INSERT INTO cm_stock_sync_run_dealers
        (run_id, dealer_id, dealer_name, status, stock_count, matched_count, cars_with_options, options_count, error)
      SELECT ${runId}, dealer_id, dealer_name, status, stock_count, matched_count,
             cars_with_options, options_count, error
      FROM jsonb_to_recordset(${JSON.stringify(results)}::jsonb) AS x(
        dealer_id text, dealer_name text, status text, stock_count integer,
        matched_count integer, cars_with_options integer, options_count integer, error text
      )
    `);
    await db.execute(sql`
      UPDATE cm_stock_sync_runs
      SET status = ${hasErrors ? "partial" : "success"}, completed_at = NOW(),
          duration_ms = ${Date.now() - startedAt}, pages_fetched = ${snapshot.pagesFetched},
          rows_scanned = ${snapshot.rowsScanned}
      WHERE id = ${runId}
    `);
    logger.info({ trigger, runId, pagesFetched: snapshot.pagesFetched, rowsScanned: snapshot.rowsScanned, results }, "CM stock integration sync complete");
  } catch (error) {
    const message = safeError(error);
    await db.execute(sql`
      UPDATE cm_stock_integrations
      SET last_status = 'error', last_completed_at = NOW(), last_error = ${message},
          duration_ms = ${Date.now() - startedAt}, updated_at = NOW()
      WHERE enabled = TRUE
    `);
    await db.execute(sql`
      INSERT INTO cm_stock_sync_run_dealers
        (run_id, dealer_id, dealer_name, status, error)
      SELECT ${runId}, dealer_id, dealer_name, 'error', ${message}
      FROM cm_stock_integrations WHERE enabled = TRUE
    `);
    await db.execute(sql`
      UPDATE cm_stock_sync_runs
      SET status = 'error', completed_at = NOW(), duration_ms = ${Date.now() - startedAt},
          error = ${message}
      WHERE id = ${runId}
    `);
    logger.warn({ trigger, runId, error: message }, "CM stock integration sync failed");
  }
}

export async function startCmStockIntegrationSync(
  trigger: "startup" | "scheduled" | "manual" = "manual",
  force = trigger === "manual",
): Promise<{ started: boolean; running: boolean; nextRunAt: string | null }> {
  if (running || starting) return { started: false, running: true, nextRunAt: null };
  starting = true;
  try {
    const enabled = (await getCmStockIntegrations()).some(integration => integration.enabled);
    if (!enabled) return { started: false, running: false, nextRunAt: null };
    if (!force && trigger !== "startup") {
      const [interval, lastRun] = await Promise.all([
        getCmStockIntervalMinutes(),
        db.execute(sql`SELECT MAX(completed_at) AS last_completed FROM cm_stock_sync_runs`),
      ]);
      const completed = (lastRun.rows[0] as { last_completed: Date | null } | undefined)?.last_completed;
      const nextTime = completed ? new Date(completed).getTime() + interval * 60_000 : 0;
      if (nextTime > Date.now()) return { started: false, running: false, nextRunAt: new Date(nextTime).toISOString() };
    }
    running = true;
    void performCmStockSync(trigger)
      .catch(error => logger.error({ trigger, error: safeError(error) }, "CM stock integration worker crashed"))
      .finally(() => { running = false; });
    return { started: true, running: true, nextRunAt: null };
  } finally {
    starting = false;
  }
}