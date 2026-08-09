/**
 * Normalizes any Russian phone format to a consistent display format.
 *
 * Examples:
 *   "+7 (4832) 63-10-00"  → "+7 (4832) 63-10-00"
 *   "+74832631000"         → "+7 (4832) 63-10-00"
 *   "84832631000"          → "+7 (4832) 63-10-00"
 *   "8-4832-63-10-00"      → "+7 (4832) 63-10-00"
 *   "+7 (910) 123-45-67"   → "+7 (910) 123-45-67"  (mobile, 3-digit code)
 *   "+74832777770"         → "+7 (4832) 77-77-70"
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");

  // Strip country code prefix (7 or 8) → always 10 local digits
  let local = d;
  if (local.length === 11 && (local[0] === "7" || local[0] === "8")) {
    local = local.slice(1);
  }

  if (local.length !== 10) return phone; // can't normalize — return as-is

  // Mobile numbers start with 9 → 3-digit area code
  const isMobile = local[0] === "9";
  if (isMobile) {
    const area  = local.slice(0, 3);
    const p1    = local.slice(3, 6);
    const p2    = local.slice(6, 8);
    const p3    = local.slice(8, 10);
    return `+7 (${area}) ${p1}-${p2}-${p3}`;
  }

  // Landline → 4-digit area code (e.g. 4832 for Bryansk)
  const area  = local.slice(0, 4);
  const p1    = local.slice(4, 6);
  const p2    = local.slice(6, 8);
  const p3    = local.slice(8, 10);
  return `+7 (${area}) ${p1}-${p2}-${p3}`;
}

/**
 * Returns a tel: href from any phone format.
 *   "+7 (4832) 63-10-00" → "tel:+74832631000"
 */
export function phoneHref(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11) {
    // Normalize leading 8 → 7 (Russia: 8-xxx-xxx-xx-xx == +7-xxx-xxx-xx-xx)
    const e164 = digits[0] === "8" ? "7" + digits.slice(1) : digits;
    return `tel:+${e164}`;
  }
  if (digits.length === 10) return `tel:+7${digits}`;
  return `tel:+${digits}`;
}
