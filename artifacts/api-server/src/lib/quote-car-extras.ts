interface QuoteOptionCar {
  dealer?: string | null;
  extras?: string | null;
  catalogSource?: string | null;
}

/** CM-dealer options may only come from a confirmed CM row, never an old XML snapshot. */
export function verifiedQuoteExtras(
  car: QuoteOptionCar | null,
  snapshot: Record<string, unknown> = {},
): string {
  const dealer = String(car?.dealer ?? snapshot["dealer"] ?? "").trim().toLowerCase();
  if (dealer === "jeland" || dealer === "tenet plus") {
    if (car) return car.catalogSource === "cm_business" ? car.extras ?? "" : "";
    return snapshot["catalogSource"] === "cm_business" && typeof snapshot["extras"] === "string"
      ? snapshot["extras"] : "";
  }
  const value = car?.extras ?? snapshot["extras"];
  return typeof value === "string" ? value : "";
}