export function normalizeManagerQuoteBrand(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function managerQuoteBrandMatches(actualBrand: string | null | undefined, requestedBrand: string): boolean {
  return normalizeManagerQuoteBrand(actualBrand ?? "") === normalizeManagerQuoteBrand(requestedBrand);
}

export function getManagerQuoteLocationOverride(
  carType: string | null | undefined,
  brand: string | null | undefined,
): string | null {
  if (carType === "used") return "Супонево";
  if (managerQuoteBrandMatches(brand, "Tenet Plus")) return "Советская";
  return null;
}

export function filterManagerQuoteCarsByBrand<T extends { brand: string | null | undefined }>(
  cars: readonly T[],
  requestedBrand: string,
): T[] {
  return cars.filter(car => managerQuoteBrandMatches(car.brand, requestedBrand));
}