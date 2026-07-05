import { Router, type IRouter } from "express";
import { db, calltouchCalls } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function checkSecret(req: import("express").Request, res: import("express").Response): boolean {
  const secret = process.env["CALLTOUCH_WEBHOOK_SECRET"];
  if (!secret) {
    logger.warn("CALLTOUCH_WEBHOOK_SECRET not set — rejecting webhook");
    res.status(403).json({ ok: false, error: "Webhook secret not configured" });
    return false;
  }
  const provided = (req.query["secret"] as string) || "";
  if (provided !== secret) {
    res.status(403).json({ ok: false, error: "Invalid secret" });
    return false;
  }
  return true;
}

function parseTimestamp(val: unknown): Date | null {
  if (!val) return null;
  const n = Number(val);
  if (!isNaN(n) && n > 1_000_000_000) return new Date(n * 1000);
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

async function downloadAndStoreRecording(callId: string, url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const { Storage } = await import("@google-cloud/storage");
    const REPLIT_SIDECAR = "http://127.0.0.1:1106";
    const gcs = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token" as const,
        token_url: `${REPLIT_SIDECAR}/token`,
        type: "external_account" as const,
        credential_source: {
          url: `${REPLIT_SIDECAR}/credential`,
          format: { type: "json" as const, subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
    const bucketId = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
    if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");

    const objectName = `call-recordings/${callId}.mp3`;
    await gcs.bucket(bucketId).file(objectName).save(buffer, {
      contentType: "audio/mpeg",
      resumable: false,
    });

    await db
      .update(calltouchCalls)
      .set({ recordingStoredPath: objectName })
      .where(eq(calltouchCalls.callId, callId));

    logger.info({ callId, objectName }, "calltouch: recording stored");
  } catch (err) {
    logger.warn({ callId, err }, "calltouch: recording download/store failed");
  }
}

router.post("/call-start", async (req, res) => {
  if (!checkSecret(req, res)) return;
  res.json({ ok: true });

  const body = req.body as Record<string, unknown>;
  const callId = String(body["callId"] || body["call_id"] || "").trim();
  if (!callId) { logger.warn({ body }, "calltouch call-start: missing call_id"); return; }

  try {
    await db.execute(sql`
      INSERT INTO calltouch_calls
        (call_id, phone_number, tracking_number, source, campaign, landing_page, status, started_at)
      VALUES (
        ${callId},
        ${String(body["phoneNumber"] || body["phone_number"] || body["callerNumber"] || "")},
        ${String(body["trackingNumber"] || body["tracking_number"] || "")},
        ${String(body["source"] || body["utmSource"] || body["utm_source"] || "")},
        ${String(body["campaign"] || body["utmCampaign"] || body["utm_campaign"] || "")},
        ${String(body["landingPage"] || body["landing_page"] || body["sessionUrl"] || "")},
        'started',
        ${parseTimestamp(body["startedAt"] || body["started_at"] || body["dateCall"]) ?? sql`NOW()`}
      )
      ON CONFLICT (call_id) DO NOTHING
    `);
    logger.info({ callId }, "calltouch: call-start recorded");
  } catch (err) {
    logger.warn({ callId, err }, "calltouch: call-start DB error");
  }
});

router.post("/call-complete", async (req, res) => {
  if (!checkSecret(req, res)) return;
  res.json({ ok: true });

  const body = req.body as Record<string, unknown>;
  const callId = String(body["callId"] || body["call_id"] || "").trim();
  if (!callId) { logger.warn({ body }, "calltouch call-complete: missing call_id"); return; }

  const rawStatus = String(body["status"] || body["callStatus"] || "").toLowerCase();
  const status = rawStatus.includes("miss") || rawStatus === "0" ? "missed" : "completed";
  const duration = Number(body["duration"] || body["durationSeconds"] || body["duration_seconds"] || 0) || null;
  const recordingUrl = String(body["recordingUrl"] || body["call_recording_url"] || body["callRecordingUrl"] || "").trim() || null;
  const completedAt = parseTimestamp(body["completedAt"] || body["completed_at"] || body["dateCall"]);

  try {
    await db.execute(sql`
      INSERT INTO calltouch_calls
        (call_id, phone_number, tracking_number, source, campaign, landing_page,
         status, duration_seconds, call_recording_url, completed_at)
      VALUES (
        ${callId},
        ${String(body["phoneNumber"] || body["phone_number"] || body["callerNumber"] || "")},
        ${String(body["trackingNumber"] || body["tracking_number"] || "")},
        ${String(body["source"] || body["utmSource"] || body["utm_source"] || "")},
        ${String(body["campaign"] || body["utmCampaign"] || body["utm_campaign"] || "")},
        ${String(body["landingPage"] || body["landing_page"] || body["sessionUrl"] || "")},
        ${status},
        ${duration},
        ${recordingUrl},
        ${completedAt ?? sql`NOW()`}
      )
      ON CONFLICT (call_id) DO UPDATE SET
        status             = EXCLUDED.status,
        duration_seconds   = EXCLUDED.duration_seconds,
        call_recording_url = EXCLUDED.call_recording_url,
        completed_at       = EXCLUDED.completed_at
    `);
    logger.info({ callId, status, duration, hasRecording: !!recordingUrl }, "calltouch: call-complete recorded");
  } catch (err) {
    logger.warn({ callId, err }, "calltouch: call-complete DB error");
    return;
  }

  if (recordingUrl) {
    downloadAndStoreRecording(callId, recordingUrl).catch(() => {});
  }
});

export default router;
