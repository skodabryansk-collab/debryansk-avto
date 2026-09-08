export function createBrowserId(): string {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (typeof webCrypto?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    webCrypto.getRandomValues(values);
    return Array.from(values, (value) => value.toString(36)).join("-");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}