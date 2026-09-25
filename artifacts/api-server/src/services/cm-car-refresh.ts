import {
  mapCmBusinessDealerStockCar,
  type CmBusinessStockCar,
} from "./tenet-plus-stock";
import type { CmStockIntegration } from "./cm-stock-integrations";
import { carsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type CmRefreshCandidateResult =
  | { status: "match"; car: CmBusinessStockCar; sourceRow: Record<string, unknown> }
  | { status: "no_match" | "mismatch" | "ambiguous" | "invalid_vin" };

export function enabledCmIntegrationForDealer(
  integrations: CmStockIntegration[],
  dealerName: string,
): CmStockIntegration | undefined {
  const key = dealerName.trim().toLowerCase();
  return integrations.find(integration =>
    integration.enabled && integration.dealerName.trim().toLowerCase() === key,
  );
}

export function normalizeValidatedVin(value: unknown): string {
  const vin = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return vin.length === 17 ? vin : "";
}

export function buildCmBusinessCarLookupPath(dealerId: string, dmsCarId: string): string {
  return `/dealers/${encodeURIComponent(dealerId)}/dms/cars/${encodeURIComponent(dmsCarId)}`;
}

export function cmBusinessHttpStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/:\s(\d{3})(?:\s|$)/);
  return match ? Number(match[1]) : null;
}

export function findCmRefreshCandidate(
  local: { vin: string | null; cmStockId: string | null; cmDmsCarId: string | null },
  value: unknown,
  dealerId: string,
  dealerName: string,
): CmRefreshCandidateResult {
  const vin = normalizeValidatedVin(local.vin);
  if (!vin) return { status: "invalid_vin" };

  if (!value || typeof value !== "object") return { status: "no_match" };
  if (Array.isArray(value)) return { status: value.length > 1 ? "ambiguous" : "mismatch" };

  const sourceRow = value as Record<string, unknown>;
  const localDmsCarId = local.cmDmsCarId?.trim();
  if (!localDmsCarId) return { status: "mismatch" };
  if (
    String(sourceRow.dealerId ?? "") !== dealerId
    || String(sourceRow.dmsCarId ?? "").trim() !== localDmsCarId
    || normalizeValidatedVin(sourceRow.vin) !== vin
  ) {
    return { status: "mismatch" };
  }

  const car = mapCmBusinessDealerStockCar(sourceRow, dealerName);
  if (!car || (!car.cmStockId && !car.cmDmsCarId) || normalizeValidatedVin(car.vin) !== vin) {
    return { status: "mismatch" };
  }
  if (local.cmStockId && local.cmStockId !== car.cmStockId) return { status: "mismatch" };
  if (car.cmDmsCarId !== localDmsCarId) return { status: "mismatch" };
  return { status: "match", car, sourceRow };
}

export function buildCmRefreshUpdate(
  mode: "catalog" | "options_only",
  car: CmBusinessStockCar,
  localBrand: string | null,
  stockState: unknown,
  fetchedAt: string,
) {
  const options = car.options?.join(", ") || null;
  if (mode === "options_only") {
    return {
      cmVerifiedExtras: options,
      cmDmsCarId: car.cmDmsCarId,
      cmStockId: car.cmStockId,
      cmRefreshedAt: new Date(fetchedAt),
    };
  }
  const parsedUpdatedAt = car.sourceUpdatedAt ? new Date(car.sourceUpdatedAt) : new Date(fetchedAt);
  return {
    brand: car.brand ?? localBrand,
    model: car.model || null,
    year: car.year || null,
    modification: car.modification || null,
    complectation: car.complectation || null,
    color: car.color || null,
    price: car.price || null,
    imageUrl: car.images[0] ?? null,
    vin: car.vin || null,
    bodyType: car.bodyType || null,
    extras: options,
    catalogSource: "cm_business",
    cmStockId: car.cmStockId,
    cmDmsCarId: car.cmDmsCarId,
    cmStockState: typeof stockState === "string" ? stockState : "in",
    sourceUpdatedAt: Number.isNaN(parsedUpdatedAt.getTime()) ? new Date(fetchedAt) : parsedUpdatedAt,
    cmVerifiedExtras: options,
    syncedAt: new Date(fetchedAt),
    cmRefreshedAt: new Date(fetchedAt),
  };
}

export function buildCmRefreshGuard(local: {
  id: number;
  vin: string | null;
  cmStockId: string | null;
  cmDmsCarId: string | null;
  brand: string | null;
  dealer: string | null;
}) {
  return [
    eq(carsTable.id, local.id),
    eq(carsTable.type, "new"),
    sql`${carsTable.vin} IS NOT DISTINCT FROM ${local.vin}`,
    sql`${carsTable.cmStockId} IS NOT DISTINCT FROM ${local.cmStockId}`,
    sql`${carsTable.cmDmsCarId} IS NOT DISTINCT FROM ${local.cmDmsCarId}`,
    sql`${carsTable.brand} IS NOT DISTINCT FROM ${local.brand}`,
    sql`${carsTable.dealer} IS NOT DISTINCT FROM ${local.dealer}`,
  ];
}

export function hasCmRefreshChanges(
  local: Record<string, unknown>,
  updates: Record<string, unknown>,
): boolean {
  return Object.entries(updates).some(([key, nextValue]) => {
    const currentValue = local[key];
    if (currentValue instanceof Date && nextValue instanceof Date) {
      return currentValue.getTime() !== nextValue.getTime();
    }
    if (currentValue == null || nextValue == null) {
      return currentValue != null || nextValue != null;
    }
    return currentValue !== nextValue;
  });
}