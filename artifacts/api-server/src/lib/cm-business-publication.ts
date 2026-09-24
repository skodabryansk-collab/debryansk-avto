/** Durable SEO extras must not restore old XML or manager-only CM car URLs. */
export function isManagedCmDetailPath(loc: string): boolean {
  const normalized = loc === "/" ? "/" : `/${loc.replace(/^\/+|\/+$/g, "")}`;
  return /^\/new-cars\/(?:tenet-plus|jeland)-.+/i.test(normalized);
}

/** IndexNow must only receive Jeland cars confirmed in the public CM snapshot. */
export function filterIndexableNewCarIds(
  addedIds: string[],
  publicJelandIds: ReadonlySet<string>,
): string[] {
  return addedIds.filter(id =>
    !/^jeland-(?:cme|dms)-/i.test(id) || publicJelandIds.has(id),
  );
}