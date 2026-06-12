import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// Store in /tmp — outside the repo, survives process restarts, never committed
const CACHE_PATH = join("/tmp", ".hh-token-cache.json");

let memCache: TokenCache | null = null;

function loadFromDisk(): TokenCache | null {
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as TokenCache;
    if (parsed.accessToken && parsed.expiresAt > Date.now()) {
      return parsed;
    }
  } catch {
    // file doesn't exist or is corrupt — ignore
  }
  return null;
}

function saveToDisk(cache: TokenCache): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch (e) {
    console.warn("[hh-token] Could not persist token to disk:", e);
  }
}

export async function getHhToken(): Promise<string | null> {
  const clientId = process.env.HH_CLIENT_ID?.trim();
  const clientSecret = process.env.HH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  // Check memory cache first (60s buffer before expiry)
  if (memCache && Date.now() < memCache.expiresAt - 60_000) {
    return memCache.accessToken;
  }

  // Fall back to disk cache on fresh start
  if (!memCache) {
    const disk = loadFromDisk();
    if (disk) {
      memCache = disk;
      return memCache.accessToken;
    }
  }

  // Request a new token from hh.ru
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://hh.ru/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "DebrynskAvtoSite/1.0 (info@debryansk-avto.ru)",
      "HH-User-Agent": "DebrynskAvtoSite/1.0 (info@debryansk-avto.ru)",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[hh-token] OAuth token request failed: ${res.status} ${text}`);
    // Return stale cached token if available (better than nothing)
    if (memCache) {
      console.warn("[hh-token] Using stale cached token as fallback");
      return memCache.accessToken;
    }
    return null;
  }

  const data = await res.json() as { access_token: string; expires_in?: number };
  // hh.ru client_credentials tokens don't always include expires_in — default to 23h
  const expiresIn = data.expires_in ?? 82800;
  memCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  saveToDisk(memCache);
  console.log("[hh-token] New token obtained and cached (expires in", expiresIn, "s)");

  return memCache.accessToken;
}
