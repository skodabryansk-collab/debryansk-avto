import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"];
  if (!secret) {
    return res.status(500).json({ ok: false, error: "JWT_SECRET is not configured" });
  }

  // Accept token from Authorization header OR ?token= query param (for CSV export links)
  let token: string | undefined;
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof req.query["token"] === "string") {
    token = req.query["token"];
  }

  if (!token) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, secret);
    (req as unknown as Record<string, unknown>)["adminPayload"] = payload;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
