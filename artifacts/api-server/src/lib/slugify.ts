export function slugifyCarId(dealer: string, uniqueId: string): string {
  const dealerSlug = dealer.toLowerCase().replace(/\s+/g, "-");
  const idSlug = uniqueId.toLowerCase().replace(/_/g, "-");
  return `${dealerSlug}-${idSlug}`;
}
