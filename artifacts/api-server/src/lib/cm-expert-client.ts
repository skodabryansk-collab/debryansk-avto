const TOKEN_URL = process.env["CM_EXPERT_TOKEN_URL"] || "https://lk.cm.expert/oauth/token";
const API_BASE = process.env["CM_EXPERT_API_URL"] || "https://appraisal.api.cm.expert/v1";

const CLIENT_ID = process.env["CM_EXPERT_CLIENT_ID"];
const CLIENT_SECRET = process.env["CM_EXPERT_CLIENT_SECRET"];

let tokenCache: { access_token: string; expires_at: number } | null = null;

export async function getToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  if (tokenCache && Date.now() < tokenCache.expires_at - 60000) return tokenCache.access_token;
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!r.ok) return tokenCache?.access_token ?? null;
    const data = await r.json() as { access_token: string; expires_in: number };
    tokenCache = { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  } catch {
    return tokenCache?.access_token ?? null;
  }
}

export async function cmGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const token = await getToken();
  if (!token) throw new Error("CM Expert credentials not configured");
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const r = await fetch(`${API_BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`CM Expert ${path}: ${r.status} ${text}`);
  }
  return r.json();
}
