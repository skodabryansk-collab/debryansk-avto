import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import test from "node:test";
import {
  createSessionToken,
  renewSessionToken,
  SESSION_MAX_AGE_SECONDS,
  SESSION_RENEW_WINDOW_SECONDS,
  SESSION_TOKEN_TTL_SECONDS,
  shouldRenewSessionToken,
} from "./session-token";

const now = 1_800_000_000;

test("session tokens renew only inside the final seven days", () => {
  assert.equal(shouldRenewSessionToken({
    iat: now - 10_000,
    exp: now + SESSION_RENEW_WINDOW_SECONDS + 1,
  }, now), false);
  assert.equal(shouldRenewSessionToken({
    iat: now - 10_000,
    exp: now + SESSION_RENEW_WINDOW_SECONDS,
  }, now), true);
});

test("expired tokens and sessions past the 90-day maximum are not renewed", () => {
  assert.equal(shouldRenewSessionToken({ iat: now - 1, exp: now }, now), false);
  assert.equal(shouldRenewSessionToken({
    iat: now - SESSION_MAX_AGE_SECONDS,
    exp: now + 10,
  }, now), false);
});

test("new sessions have a 30-day lifetime and a bounded absolute age", () => {
  assert.equal(SESSION_TOKEN_TTL_SECONDS, 30 * 24 * 60 * 60);
  assert.equal(SESSION_MAX_AGE_SECONDS, 90 * 24 * 60 * 60);
});

test("admin and manager claims survive renewal without extending beyond 30 days", () => {
  const secret = "unit-test-secret";
  const currentNow = Math.floor(Date.now() / 1000);
  const sessionStartedAt = currentNow - 20 * 24 * 60 * 60;
  const expiredSoonToken = jwt.sign(
    { managerId: 42, name: "Test manager", role: "manager", sessionStartedAt },
    secret,
    { expiresIn: 2 * 24 * 60 * 60 },
  );
  const payload = jwt.verify(expiredSoonToken, secret) as Record<string, unknown>;
  const renewed = renewSessionToken(
    payload,
    { managerId: 42, name: "Test manager", role: "manager" },
    secret,
    currentNow,
  );

  assert.ok(renewed);
  const renewedPayload = jwt.verify(renewed, secret) as Record<string, unknown>;
  assert.equal(renewedPayload["role"], "manager");
  assert.equal(renewedPayload["managerId"], 42);
  assert.equal(renewedPayload["sessionStartedAt"], sessionStartedAt);
  assert.ok((renewedPayload["exp"] as number) - (renewedPayload["iat"] as number) <= SESSION_TOKEN_TTL_SECONDS);
});

test("newly issued tokens preserve their original session start", () => {
  const token = createSessionToken({ login: "admin", isAdmin: true }, "unit-test-secret");
  const payload = jwt.verify(token, "unit-test-secret") as Record<string, unknown>;
  assert.equal(payload["isAdmin"], true);
  assert.equal(payload["exp"] as number - (payload["iat"] as number), SESSION_TOKEN_TTL_SECONDS);
  assert.equal(payload["sessionStartedAt"], payload["iat"]);
});
