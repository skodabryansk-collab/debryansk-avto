import { Router, type IRouter } from "express";
import { db, calltouchCalls } from "@workspace/db";
import { desc, sql, eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query["page"] || 1));
    const limit = 50;
    const offset = (page - 1) * limit;
    const status = req.query["status"] as string | undefined;

    const rows = await (status && status !== "all"
      ? db.select().from(calltouchCalls).where(eq(calltouchCalls.status, status)).orderBy(desc(calltouchCalls.createdAt)).limit(limit).offset(offset)
      : db.select().from(calltouchCalls).orderBy(desc(calltouchCalls.createdAt)).limit(limit).offset(offset)
    );
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(calltouchCalls);
    return res.json({ ok: true, data: rows, total: Number(count ?? 0), page, limit });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:id/recording", async (req, res) => {
  try {
    const [row] = await db.select().from(calltouchCalls).where(eq(calltouchCalls.id, Number(req.params["id"]))).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "Not found" });

    if (row.recordingStoredPath) {
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
      const bucketId = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"] ?? "";
      const [signedUrl] = await gcs
        .bucket(bucketId)
        .file(row.recordingStoredPath)
        .getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
      return res.json({ ok: true, url: signedUrl });
    }

    if (row.callRecordingUrl) {
      return res.json({ ok: true, url: row.callRecordingUrl, external: true });
    }

    return res.status(404).json({ ok: false, error: "No recording available" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
