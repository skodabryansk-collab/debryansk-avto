import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUsedCars, getAvitoMeta } from "../routes/cars";
import { getNewCars } from "../routes/new-cars";
import {
  enrichCars,
  parseXmlEngineData,
  type ExistingEngineData,
  type FeedCarForEnrichment,
} from "./car-engine-enrichment";

export interface RemovedCar {
  externalId: string;
  type: "new" | "used";
}

export interface SyncStats {
  added: number;
  updated: number;
  removed: number;
  total: number;
  durationMs: number;
  addedOrUpdatedExternalIds: string[];
  addedNewCarIds: string[];
  addedUsedCarIds: string[];
  removedCars: RemovedCar[];
}

let engineEnrichmentInFlight: Promise<void> | null = null;

function scheduleEngineEnrichment(
  cars: FeedCarForEnrichment[],
  existingCars: Map<string, ExistingEngineData>,
) {
  if (engineEnrichmentInFlight) {
    logger.info("car-sync: engine enrichment already running — skipping duplicate start");
    return;
  }
  engineEnrichmentInFlight = enrichCars(cars, existingCars, async (externalId, engine) => {
    await db.execute(sql`
      UPDATE cars SET
        fuel_type = COALESCE(${engine.fuelType}, fuel_type),
        engine_volume = COALESCE(${engine.engineVolume}, engine_volume),
        engine_power = COALESCE(${engine.enginePower}, engine_power),
        engine_source = ${engine.source},
        engine_enriched_at = NOW()
      WHERE external_id = ${externalId}
    `);
  })
    .then(result => logger.info({ enriched: result.size }, "car-sync: engine enrichment complete"))
    .catch(err => logger.warn({ err }, "car-sync: engine enrichment failed"))
    .finally(() => { engineEnrichmentInFlight = null; });
}

export async function syncCars(): Promise<SyncStats> {
  const startedAt = Date.now();

  const [usedCars, newCars, avitoMap] = await Promise.all([
    getUsedCars().catch(err => { logger.warn({ err }, "car-sync: used cars fetch failed"); return []; }),
    getNewCars().catch(err => { logger.warn({ err }, "car-sync: new cars fetch failed"); return []; }),
    getAvitoMeta().catch(err => { logger.warn({ err }, "car-sync: avito fetch failed"); return new Map(); }),
  ]);

  if (!usedCars.length && !newCars.length) {
    return { added: 0, updated: 0, removed: 0, total: 0, durationMs: Date.now() - startedAt, addedOrUpdatedExternalIds: [], addedNewCarIds: [], addedUsedCarIds: [], removedCars: [] };
  }

  // Snapshot models per brand BEFORE sync — used to detect catalog changes for AI cache invalidation
  const beforeSnapshot = await db.execute(sql`
    SELECT LOWER(dealer) AS brand,
           ARRAY_AGG(DISTINCT TRIM(SPLIT_PART(model, ',', 1)) ORDER BY TRIM(SPLIT_PART(model, ',', 1))) AS models,
           MIN(price)::int AS min_price
    FROM cars WHERE type = 'new' AND dealer IS NOT NULL
    GROUP BY LOWER(dealer)
  `).catch(() => ({ rows: [] }));
  const beforeMap = new Map(
    (beforeSnapshot.rows as { brand: string; models: string[]; min_price: number | null }[])
      .map(r => [r.brand, { models: r.models ?? [], minPrice: r.min_price }]),
  );

  const [countBeforeResult, existingIdsResult] = await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cars`).catch(() => ({ rows: [{ cnt: 0 }] })),
    db.execute(sql`
      SELECT external_id, vin, modification, fuel_type, engine_volume, engine_power,
             engine_source, engine_enriched_at
      FROM cars
    `).catch(() => ({ rows: [] })),
  ]);
  const countBefore = Number((countBeforeResult.rows[0] as any)?.cnt ?? 0);
  const existingCars = new Map(
    (existingIdsResult.rows as {
      external_id: string;
      vin: string | null;
      modification: string | null;
      fuel_type: string | null;
      engine_volume: number | null;
      engine_power: number | null;
      engine_source: string | null;
      engine_enriched_at: Date | string | null;
    }[]).map(row => [row.external_id, {
      vin: row.vin,
      modification: row.modification,
      fuelType: row.fuel_type,
      engineVolume: row.engine_volume,
      enginePower: row.engine_power,
      engineSource: row.engine_source,
      engineEnrichedAt: row.engine_enriched_at,
    }]),
  );
  const existingIds = new Set<string>(existingCars.keys());

  const allExternalIds: string[] = [];
  const addedNewCarIds: string[] = [];
  const addedUsedCarIds: string[] = [];

  const parseOwners = (val: string | undefined | null): number | null => {
    if (!val) return null;
    const v = val.trim().toLowerCase();
    if (v === "один владелец" || v === "1") return 1;
    if (v === "два владельца" || v === "2") return 2;
    if (v === "три владельца" || v === "3") return 3;
    if (v === "четыре владельца" || v === "4") return 4;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  };

  for (const c of usedCars) {
    allExternalIds.push(c.id);
    if (!existingIds.has(c.id)) addedUsedCarIds.push(c.id);
    const avito = avitoMap.get(c.id);
    const ownersNum = avito?.owners ? parseInt(avito.owners, 10) || null : parseOwners(c.ownersNumber);
    const driveType = avito?.driveType || null;
    const engine = parseXmlEngineData(c.modification);
    await db.execute(sql`
      INSERT INTO cars (external_id, type, brand, model, year, color, price, mileage,
                        body_type, modification, complectation, extras, description,
                        image_url, vin, dealer, owners_number, drive_type,
                        fuel_type, engine_volume, engine_power, engine_source, engine_enriched_at,
                        max_discount, credit_discount, tradein_discount, synced_at)
      VALUES (
        ${c.id}, 'used', ${c.mark}, ${c.model}, ${c.year}, ${c.color}, ${c.price},
        ${c.run}, ${c.bodyType}, ${c.modification}, ${c.complectation},
        ${c.extras || null}, ${c.description || null}, ${c.images[0] ?? null},
        ${c.vin || null}, null, ${ownersNum}, ${driveType},
        ${engine?.fuelType ?? null}, ${engine?.engineVolume ?? null},
        ${engine?.enginePower ?? null}, ${engine ? "xml_pending" : null}, NULL,
        ${c.maxDiscount}, ${c.creditDiscount}, ${c.tradeinDiscount}, NOW()
      )
      ON CONFLICT (external_id) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        year = EXCLUDED.year,
        color = EXCLUDED.color,
        price = EXCLUDED.price,
        mileage = EXCLUDED.mileage,
        modification = EXCLUDED.modification,
        complectation = EXCLUDED.complectation,
        extras = EXCLUDED.extras,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        vin = EXCLUDED.vin,
        owners_number = EXCLUDED.owners_number,
        drive_type = EXCLUDED.drive_type,
        fuel_type = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.fuel_type
          WHEN cars.engine_source = 'cm_vin' THEN cars.fuel_type
          ELSE COALESCE(EXCLUDED.fuel_type, cars.fuel_type)
        END,
        engine_volume = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_volume
          WHEN cars.engine_source = 'cm_vin' THEN cars.engine_volume
          ELSE COALESCE(EXCLUDED.engine_volume, cars.engine_volume)
        END,
        engine_power = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_power
          WHEN cars.engine_source = 'cm_vin' THEN cars.engine_power
          ELSE COALESCE(EXCLUDED.engine_power, cars.engine_power)
        END,
        engine_source = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_source
          ELSE COALESCE(cars.engine_source, EXCLUDED.engine_source)
        END,
        engine_enriched_at = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_enriched_at
          ELSE cars.engine_enriched_at
        END,
        max_discount = EXCLUDED.max_discount,
        credit_discount = EXCLUDED.credit_discount,
        tradein_discount = EXCLUDED.tradein_discount,
        synced_at = NOW()
    `).catch(err => logger.warn({ err, id: c.id }, "car-sync: upsert used car failed"));
  }

  for (const c of newCars) {
    allExternalIds.push(c.id);
    if (!existingIds.has(c.id)) addedNewCarIds.push(c.id);
    // image_url policy: use first image from feed when available; on conflict keep
    // the existing non-NULL image_url rather than overwriting it with NULL — this
    // prevents transient feed gaps (supplier forgot to upload a photo) from
    // permanently erasing a photo we already have.
    const imageUrl = c.images[0] ?? null;
    const effectiveBrand = (c.mark === 'Haval' && (c.dealer === 'Haval City' || c.dealer === 'Haval Pro'))
      ? c.dealer : c.mark;
    const modUpper = (c.modification ?? "").toUpperCase();
    const driveType = /\b(4WD|AWD)\b/.test(modUpper) ? "Полный" : (c.modification ? "Передний" : null);
    const engine = parseXmlEngineData(c.modification);
    await db.execute(sql`
      INSERT INTO cars (external_id, type, brand, model, year, color, price, mileage,
                        body_type, modification, complectation, extras, description,
                        image_url, vin, dealer, drive_type,
                        fuel_type, engine_volume, engine_power, engine_source, engine_enriched_at,
                        max_discount, credit_discount, tradein_discount, synced_at)
      VALUES (
        ${c.id}, 'new', ${effectiveBrand}, ${c.model}, ${c.year}, ${c.color}, ${c.price},
        0, ${c.bodyType}, ${c.modification}, ${c.complectation},
        ${c.extras || null}, ${c.description || null}, ${imageUrl},
        ${c.vin || null}, ${c.dealer}, ${driveType},
        ${engine?.fuelType ?? null}, ${engine?.engineVolume ?? null},
        ${engine?.enginePower ?? null}, ${engine ? "xml_pending" : null}, NULL,
        ${c.maxDiscount}, ${c.creditDiscount}, ${c.tradeinDiscount}, NOW()
      )
      ON CONFLICT (external_id) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        year = EXCLUDED.year,
        color = EXCLUDED.color,
        price = EXCLUDED.price,
        modification = EXCLUDED.modification,
        complectation = EXCLUDED.complectation,
        extras = EXCLUDED.extras,
        description = EXCLUDED.description,
        image_url = COALESCE(EXCLUDED.image_url, cars.image_url),
        vin = EXCLUDED.vin,
        dealer = EXCLUDED.dealer,
        drive_type = EXCLUDED.drive_type,
        fuel_type = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.fuel_type
          WHEN cars.engine_source = 'cm_vin' THEN cars.fuel_type
          ELSE COALESCE(EXCLUDED.fuel_type, cars.fuel_type)
        END,
        engine_volume = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_volume
          WHEN cars.engine_source = 'cm_vin' THEN cars.engine_volume
          ELSE COALESCE(EXCLUDED.engine_volume, cars.engine_volume)
        END,
        engine_power = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_power
          WHEN cars.engine_source = 'cm_vin' THEN cars.engine_power
          ELSE COALESCE(EXCLUDED.engine_power, cars.engine_power)
        END,
        engine_source = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_source
          ELSE COALESCE(cars.engine_source, EXCLUDED.engine_source)
        END,
        engine_enriched_at = CASE
          WHEN cars.vin IS DISTINCT FROM EXCLUDED.vin OR cars.modification IS DISTINCT FROM EXCLUDED.modification
            THEN EXCLUDED.engine_enriched_at
          ELSE cars.engine_enriched_at
        END,
        max_discount = EXCLUDED.max_discount,
        credit_discount = EXCLUDED.credit_discount,
        tradein_discount = EXCLUDED.tradein_discount,
        synced_at = NOW()
    `).catch(err => logger.warn({ err, id: c.id }, "car-sync: upsert new car failed"));
  }

  let removed = 0;
  const removedCars: RemovedCar[] = [];

  /* Delete stale cars PER TYPE so that a feed outage (0 cars returned) for one
     type never wipes out cars of that type from the database.
     Only delete within a type when we actually received at least 1 car from that feed. */
  const deleteByType = async (type: "new" | "used", ids: string[]) => {
    if (ids.length === 0) {
      logger.warn({ type }, "car-sync: skipping delete — feed returned 0 cars, likely a transient outage");
      return;
    }
    const idList = ids.map(id => `'${id.replace(/'/g, "''")}'`).join(",");
    const result = await db.execute(
      sql.raw(`DELETE FROM cars WHERE type = '${type}' AND external_id NOT IN (${idList}) RETURNING external_id, type`)
    ).catch(() => ({ rows: [] }));
    removed += result.rows.length;
    for (const row of result.rows as { external_id: string; type: "new" | "used" }[]) {
      if (row.external_id) removedCars.push({ externalId: row.external_id, type: row.type ?? type });
    }
  };

  const usedIds = usedCars.map(c => c.id);
  const newIds  = newCars.map(c => c.id);
  await deleteByType("used", usedIds);
  await deleteByType("new",  newIds);

  scheduleEngineEnrichment(
    [...usedCars, ...newCars].map(car => ({
      id: car.id,
      vin: car.vin,
      modification: car.modification,
    })),
    existingCars,
  );

  const countAfter = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cars`)
    .then(r => Number((r.rows[0] as any)?.cnt ?? 0))
    .catch(() => 0);

  const added = Math.max(0, countAfter - countBefore);
  const updated = Math.max(0, allExternalIds.length - added);

  const stats: SyncStats = {
    added,
    updated,
    removed,
    total: countAfter,
    durationMs: Date.now() - startedAt,
    addedOrUpdatedExternalIds: allExternalIds,
    addedNewCarIds,
    addedUsedCarIds,
    removedCars,
  };

  logger.info(stats, "car-sync: completed");

  // ── AI cache invalidation ─────────────────────────────────────────────
  // Compare post-sync model/price snapshot to the pre-sync snapshot.
  // Clear seo_ai_cache for any brand whose model list or minimum price changed,
  // so the next GAP run generates fresh content that reflects current inventory.
  try {
    const afterSnapshot = await db.execute(sql`
      SELECT LOWER(dealer) AS brand,
             ARRAY_AGG(DISTINCT TRIM(SPLIT_PART(model, ',', 1)) ORDER BY TRIM(SPLIT_PART(model, ',', 1))) AS models,
             MIN(price)::int AS min_price
      FROM cars WHERE type = 'new' AND dealer IS NOT NULL
      GROUP BY LOWER(dealer)
    `);
    const afterRows = afterSnapshot.rows as { brand: string; models: string[]; min_price: number | null }[];

    const changedBrands: string[] = [];
    for (const r of afterRows) {
      const before = beforeMap.get(r.brand);
      const modelsChanged = !before || JSON.stringify(before.models) !== JSON.stringify(r.models ?? []);
      const priceChanged = before && before.minPrice !== r.min_price;
      if (modelsChanged || priceChanged) changedBrands.push(r.brand);
    }
    // Brands that completely disappeared from the feed
    for (const brand of beforeMap.keys()) {
      if (!afterRows.find(r => r.brand === brand)) changedBrands.push(brand);
    }

    if (changedBrands.length > 0) {
      const slugRows = await db.execute(sql`
        SELECT slug FROM brands
        WHERE LOWER(name) = ANY(${changedBrands}::text[]) AND slug IS NOT NULL
      `);
      let invalidated = 0;
      for (const row of slugRows.rows as { slug: string }[]) {
        const pageSlug = `brands/${row.slug}`;
        const deleted = await db.execute(sql`
          DELETE FROM seo_ai_cache WHERE page_slug = ${pageSlug} RETURNING id
        `);
        invalidated += deleted.rows.length;
        if (deleted.rows.length > 0) {
          logger.info({ pageSlug, deleted: deleted.rows.length }, "car-sync: seo_ai_cache invalidated (catalog change)");
        }
      }
      if (invalidated > 0) {
        logger.info({ changedBrands, invalidated }, "car-sync: AI cache cleared for changed brands");
      }
    }
  } catch (err) {
    // Cache invalidation is non-fatal — sync result is not affected
    logger.warn({ err }, "car-sync: seo_ai_cache invalidation failed (non-fatal)");
  }

  return stats;
}
