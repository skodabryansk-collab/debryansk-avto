import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUsedCars } from "../routes/cars";
import { getNewCars } from "../routes/new-cars";

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
  removedCars: RemovedCar[];
}

export async function syncCars(): Promise<SyncStats> {
  const startedAt = Date.now();

  const [usedCars, newCars] = await Promise.all([
    getUsedCars().catch(err => { logger.warn({ err }, "car-sync: used cars fetch failed"); return []; }),
    getNewCars().catch(err => { logger.warn({ err }, "car-sync: new cars fetch failed"); return []; }),
  ]);

  if (!usedCars.length && !newCars.length) {
    return { added: 0, updated: 0, removed: 0, total: 0, durationMs: Date.now() - startedAt, addedOrUpdatedExternalIds: [], removedCars: [] };
  }

  const countBefore = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cars`)
    .then(r => Number((r.rows[0] as any)?.cnt ?? 0))
    .catch(() => 0);

  const allExternalIds: string[] = [];

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
    const ownersNum = parseOwners(c.ownersNumber);
    await db.execute(sql`
      INSERT INTO cars (external_id, type, brand, model, year, color, price, mileage,
                        body_type, modification, complectation, extras, description,
                        image_url, vin, dealer, owners_number,
                        max_discount, credit_discount, tradein_discount, synced_at)
      VALUES (
        ${c.id}, 'used', ${c.mark}, ${c.model}, ${c.year}, ${c.color}, ${c.price},
        ${c.run}, ${c.bodyType}, ${c.modification}, ${c.complectation},
        ${c.extras || null}, ${c.description || null}, ${c.images[0] ?? null},
        ${c.vin || null}, null, ${ownersNum},
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
        max_discount = EXCLUDED.max_discount,
        credit_discount = EXCLUDED.credit_discount,
        tradein_discount = EXCLUDED.tradein_discount,
        synced_at = NOW()
    `).catch(err => logger.warn({ err, id: c.id }, "car-sync: upsert used car failed"));
  }

  for (const c of newCars) {
    allExternalIds.push(c.id);
    // image_url policy: use first image from feed when available; on conflict keep
    // the existing non-NULL image_url rather than overwriting it with NULL — this
    // prevents transient feed gaps (supplier forgot to upload a photo) from
    // permanently erasing a photo we already have.
    const imageUrl = c.images[0] ?? null;
    await db.execute(sql`
      INSERT INTO cars (external_id, type, brand, model, year, color, price, mileage,
                        body_type, modification, complectation, extras, description,
                        image_url, vin, dealer,
                        max_discount, credit_discount, tradein_discount, synced_at)
      VALUES (
        ${c.id}, 'new', ${c.mark}, ${c.model}, ${c.year}, ${c.color}, ${c.price},
        0, ${c.bodyType}, ${c.modification}, ${c.complectation},
        ${c.extras || null}, ${c.description || null}, ${imageUrl},
        ${c.vin || null}, ${c.dealer},
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
    removedCars,
  };

  logger.info(stats, "car-sync: completed");
  return stats;
}
