import { lt } from "drizzle-orm";
import { db, onecExchangeLogsTable, type InsertOneCExchangeLog } from "@workspace/db";

const LOG_RETENTION_DAYS = 90;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastPrunedAt = 0;

export async function pruneOneCExchangeLogsIfDue(): Promise<void> {
  const now = Date.now();
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  lastPrunedAt = now;

  try {
    const cutoff = new Date(now - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await db.delete(onecExchangeLogsTable).where(lt(onecExchangeLogsTable.createdAt, cutoff));
  } catch (error) {
    lastPrunedAt = 0;
    throw error;
  }
}

export async function recordOneCExchangeLog(
  event: Omit<InsertOneCExchangeLog, "id" | "createdAt">,
): Promise<void> {
  await db.insert(onecExchangeLogsTable).values(event);
  await pruneOneCExchangeLogsIfDue();
}
