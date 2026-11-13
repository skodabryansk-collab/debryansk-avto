import jwt from "jsonwebtoken";

export const SESSION_TOKEN_HEADER = "X-Session-Token";
export const SESSION_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_RENEW_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

type TokenClaims = Record<string, unknown>;

export function createSessionToken(claims: TokenClaims, secret: string): string {
  const sessionStartedAt = typeof claims["sessionStartedAt"] === "number"
    ? claims["sessionStartedAt"]
    : Math.floor(Date.now() / 1000);

  return jwt.sign(
    { ...claims, sessionStartedAt },
    secret,
    { expiresIn: SESSION_TOKEN_TTL_SECONDS },
  );
}

export function shouldRenewSessionToken(
  payload: TokenClaims,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const expiresAt = payload["exp"];
  if (typeof expiresAt !== "number" || expiresAt <= nowSeconds) return false;

  const sessionStartedAt = typeof payload["sessionStartedAt"] === "number"
    ? payload["sessionStartedAt"]
    : typeof payload["iat"] === "number"
      ? payload["iat"]
      : nowSeconds;
  const sessionAge = nowSeconds - sessionStartedAt;

  return expiresAt - nowSeconds <= SESSION_RENEW_WINDOW_SECONDS
    && sessionAge >= 0
    && sessionAge < SESSION_MAX_AGE_SECONDS;
}

export function renewSessionToken(
  payload: TokenClaims,
  claims: TokenClaims,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string | null {
  if (!shouldRenewSessionToken(payload, nowSeconds)) return null;

  const sessionStartedAt = typeof payload["sessionStartedAt"] === "number"
    ? payload["sessionStartedAt"]
    : typeof payload["iat"] === "number"
      ? payload["iat"]
      : nowSeconds;
  const absoluteLifetimeLeft = SESSION_MAX_AGE_SECONDS - (nowSeconds - sessionStartedAt);
  const tokenLifetime = Math.min(SESSION_TOKEN_TTL_SECONDS, absoluteLifetimeLeft);
  if (tokenLifetime <= 0) return null;

  return jwt.sign(
    { ...claims, sessionStartedAt },
    secret,
    { expiresIn: tokenLifetime },
  );
}
