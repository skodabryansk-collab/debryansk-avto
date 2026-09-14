export interface ManagerQuoteCarDisplay {
  brand: string | null | undefined;
  model: string | null | undefined;
  year: number | null | undefined;
}

export function formatManagerQuoteCarTitle(car: ManagerQuoteCarDisplay): string {
  return [car.brand, car.model, car.year]
    .filter(value => value !== null && value !== undefined && String(value).trim() !== "")
    .map(value => String(value).trim())
    .join(" ");
}