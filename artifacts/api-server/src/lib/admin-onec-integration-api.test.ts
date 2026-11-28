import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  db,
  locationsTable,
  onecExchangeLogsTable,
} from "@workspace/db";
import oneCFeedRouter from "../routes/onec-integration";
import adminOneCRouter from "../routes/admin-onec-integration";

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.use("/api/integrations/1c/v1", oneCFeedRouter);
  app.use("/api/admin/onec", adminOneCRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

test("1C admin journal and settings are admin-only and do not expose the token", async () => {
  const oldEnv = {
    nodeEnv: process.env["NODE_ENV"],
    adminJwtSecret: process.env["ADMIN_JWT_SECRET"],
    jwtSecret: process.env["JWT_SECRET"],
    oneCToken: process.env["ONEC_CLIENT_CARDS_TOKEN"],
  };
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const adminSecret = `test-admin-secret-${suffix}`;
  const oneCToken = `test-onec-token-${suffix}`;
  let server: Server | undefined;
  let locationId: number | undefined;
  let oldOrganizationCode: string | null | undefined;
  let oldOrganizationCodeConfirmed: boolean | undefined;

  try {
    process.env["NODE_ENV"] = "production";
    process.env["ADMIN_JWT_SECRET"] = adminSecret;
    process.env["ONEC_CLIENT_CARDS_TOKEN"] = oneCToken;
    const started = await startServer();
    server = started.server;
    const adminToken = jwt.sign({ login: "test-admin", isAdmin: true }, adminSecret, { expiresIn: "5m" });

    const unauthorized = await fetch(`${started.baseUrl}/api/admin/onec/status`);
    assert.equal(unauthorized.status, 401);

    const statusResponse = await fetch(`${started.baseUrl}/api/admin/onec/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as Record<string, unknown>;
    assert.equal(status["token_configured"], true);
    assert.equal(status["token_active"], true);
    assert.equal(status["secret_name"], "ONEC_CLIENT_CARDS_TOKEN");
    assert.equal(status["feed_path"], "/api/integrations/1c/v2/client-cards");
    assert.equal(
      status["changes_initial_cursor_path"],
      "/api/integrations/1c/v2/client-cards/changes/initial-cursor",
    );
    assert.equal("token" in status, false);
    assert.equal("token_value" in status, false);

    const mappingsResponse = await fetch(`${started.baseUrl}/api/admin/onec/mappings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(mappingsResponse.status, 200);
    const mappings = await mappingsResponse.json() as {
      organizations: Array<{ id: number; organization_code: string | null; confirmed: boolean }>;
    };
    assert.ok(mappings.organizations.length > 0);
    const location = mappings.organizations[0]!;
    locationId = location.id;
    const [originalLocation] = await db.select({
      code: locationsTable.onecOrganizationCode,
      confirmed: locationsTable.onecOrganizationCodeConfirmed,
    }).from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
    oldOrganizationCode = originalLocation?.code;
    oldOrganizationCodeConfirmed = originalLocation?.confirmed;

    const invalidTemporaryCode = await fetch(
      `${started.baseUrl}/api/admin/onec/mappings/organizations/${locationId}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: `TMP1C-TEST-${suffix}`, confirmed: true }),
      },
    );
    assert.equal(invalidTemporaryCode.status, 400);

    const updateResponse = await fetch(
      `${started.baseUrl}/api/admin/onec/mappings/organizations/${locationId}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: `TEST-ORG-${suffix}`, confirmed: true }),
      },
    );
    assert.equal(updateResponse.status, 200);
    const update = await updateResponse.json() as { ok: boolean; code: string; confirmed: boolean };
    assert.equal(update.ok, true);
    assert.equal(update.code, `TEST-ORG-${suffix}`);
    assert.equal(update.confirmed, true);

    const requestStartedAt = new Date();
    const feedResponse = await fetch(`${started.baseUrl}/api/integrations/1c/v1/client-cards/initial-cursor`, {
      headers: { Authorization: `Bearer ${oneCToken}` },
    });
    assert.equal(feedResponse.status, 200);
    await feedResponse.body?.cancel();

    let requestLog: typeof onecExchangeLogsTable.$inferSelect | undefined;
    for (let attempt = 0; attempt < 20 && !requestLog; attempt += 1) {
      const [candidate] = await db.select()
        .from(onecExchangeLogsTable)
        .where(and(
          eq(onecExchangeLogsTable.eventType, "api_request"),
          eq(onecExchangeLogsTable.endpoint, "/client-cards/initial-cursor"),
          gte(onecExchangeLogsTable.createdAt, requestStartedAt),
        ))
        .orderBy(desc(onecExchangeLogsTable.id))
        .limit(1);
      if (candidate) requestLog = candidate;
      else await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(requestLog);
    assert.equal(requestLog.httpStatus, 200);
    assert.equal(requestLog.outcome, "success");
    assert.equal(requestLog.itemCount, 0);
    assert.equal(requestLog.errorCode, null);

    const auditResponse = await fetch(`${started.baseUrl}/api/admin/onec/logs?event_type=settings_change`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(auditResponse.status, 200);
    const audit = await auditResponse.json() as {
      items: Array<{ entity_name: string | null; previous_code: string | null; new_code: string | null; actor_login: string | null }>;
    };
    const change = audit.items.find(item => item.new_code === `TEST-ORG-${suffix}`);
    assert.ok(change);
    assert.equal(change.actor_login, "test-admin");
    assert.equal("client_phone" in change, false);
  } finally {
    if (locationId !== undefined) {
      await db.update(locationsTable)
        .set({
          onecOrganizationCode: oldOrganizationCode ?? null,
          onecOrganizationCodeConfirmed: oldOrganizationCodeConfirmed ?? false,
        })
        .where(eq(locationsTable.id, locationId));
    }
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (oldEnv.nodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = oldEnv.nodeEnv;
    if (oldEnv.adminJwtSecret === undefined) delete process.env["ADMIN_JWT_SECRET"];
    else process.env["ADMIN_JWT_SECRET"] = oldEnv.adminJwtSecret;
    if (oldEnv.jwtSecret === undefined) delete process.env["JWT_SECRET"];
    else process.env["JWT_SECRET"] = oldEnv.jwtSecret;
    if (oldEnv.oneCToken === undefined) delete process.env["ONEC_CLIENT_CARDS_TOKEN"];
    else process.env["ONEC_CLIENT_CARDS_TOKEN"] = oldEnv.oneCToken;
  }
});
