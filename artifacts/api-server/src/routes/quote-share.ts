import { Router } from "express";
import { createHash } from "crypto";
import { db, quotesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

const router = Router();

function getUploadsDir(): string {
  return process.env["LOCAL_UPLOADS_DIR"] || path.resolve(__dirname, "../uploads");
}

function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Public by design: the random token is the only credential. It is scoped to
// one quote, expires automatically, and never grants access to manager APIs.
router.get("/:token/pdf", async (req, res) => {
  try {
    const token = typeof req.params["token"] === "string" ? req.params["token"] : "";
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const rows = await db.select({
      id: quotesTable.id,
      pdfUrl: quotesTable.pdfUrl,
    })
      .from(quotesTable)
      .where(and(
        eq(quotesTable.shareTokenHash, hashShareToken(token)),
        gt(quotesTable.shareTokenExpiresAt, new Date()),
      ))
      .limit(1);

    const quote = rows[0];
    if (!quote?.pdfUrl) {
      return res.status(404).json({ ok: false, error: "Link expired or not found" });
    }

    const pdfPath = path.join(getUploadsDir(), quote.pdfUrl);
    if (!existsSync(pdfPath)) {
      return res.status(404).json({ ok: false, error: "PDF not found" });
    }

    const pdfBuffer = await readFile(pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="kp-${quote.id}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;