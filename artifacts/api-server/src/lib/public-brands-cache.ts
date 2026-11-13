export interface CachedBrandEntry {
  name: string;
  carCount: number;
  isServiceOnly?: boolean;
  [key: string]: unknown;
}

export interface PublicBrandsCacheSnapshot {
  data: CachedBrandEntry[];
  ts: number;
  tenetPlusComplete: boolean;
  tenetPlusIds: string;
  jelandComplete: boolean;
  jelandIds: string;
}

export interface BrandFeedState {
  tenetPlus: { complete: boolean; ids: Set<string> };
  jeland: { complete: boolean; ids: Set<string> };
}

export function brandIdsSignature(ids: Set<string>): string {
  return [...ids].sort().join("\u0000");
}

export function parsePublicBrandsCache(value: unknown): PublicBrandsCacheSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate["data"])
    || !Number.isFinite(candidate["ts"])
    || typeof candidate["tenetPlusComplete"] !== "boolean"
    || typeof candidate["tenetPlusIds"] !== "string"
    || typeof candidate["jelandComplete"] !== "boolean"
    || typeof candidate["jelandIds"] !== "string"
  ) return null;

  const data: CachedBrandEntry[] = [];
  for (const entry of candidate["data"]) {
    if (!entry || typeof entry !== "object") return null;
    const brand = entry as Record<string, unknown>;
    if (
      typeof brand["name"] !== "string"
      || typeof brand["carCount"] !== "number"
      || !Number.isFinite(brand["carCount"])
    ) return null;
    data.push(brand as CachedBrandEntry);
  }

  return {
    data,
    ts: candidate["ts"] as number,
    tenetPlusComplete: candidate["tenetPlusComplete"],
    tenetPlusIds: candidate["tenetPlusIds"],
    jelandComplete: candidate["jelandComplete"],
    jelandIds: candidate["jelandIds"],
  };
}

export function sanitizeCachedBrandData(
  snapshot: PublicBrandsCacheSnapshot,
  current: BrandFeedState,
): CachedBrandEntry[] {
  const tenetPlusStillVerified = snapshot.tenetPlusComplete
    && current.tenetPlus.complete
    && snapshot.tenetPlusIds === brandIdsSignature(current.tenetPlus.ids);
  const jelandStillVerified = snapshot.jelandComplete
    && current.jeland.complete
    && snapshot.jelandIds === brandIdsSignature(current.jeland.ids);

  return snapshot.data.map((brand) => {
    const name = brand.name.trim().toLowerCase();
    if (name === "tenet plus" && !tenetPlusStillVerified) {
      return { ...brand, carCount: 0 };
    }
    if (name === "jeland" && !jelandStillVerified) {
      return { ...brand, carCount: 0 };
    }
    return brand;
  });
}
