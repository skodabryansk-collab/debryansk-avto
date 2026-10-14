export function getCatalogPageFromUrl(): number {
  const value = Number(new URLSearchParams(window.location.search).get("page"));
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

export function getCatalogPageHref(page: number): string {
  const url = new URL(window.location.href);
  if (page <= 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  return `${url.pathname}${url.search}${url.hash}`;
}
