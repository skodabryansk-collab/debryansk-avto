import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { renewSessionToken, SESSION_TOKEN_HEADER } from "../lib/session-token";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"] || "dev-only-secret-key";

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
    const payload = jwt.verify(token, secret) as Record<string, unknown>;
    if (!payload["isAdmin"]) {
      return res.status(403).json({ ok: false, error: "Admin access required" });
    }
    const claims: Record<string, unknown> = {
      login: payload["login"],
      ...(typeof payload["id"] === "number" ? { id: payload["id"] } : {}),
      isAdmin: true,
    };
    const renewedToken = renewSessionToken(payload, claims, secret);
    if (renewedToken) res.setHeader(SESSION_TOKEN_HEADER, renewedToken);
    (req as unknown as Record<string, unknown>)["adminPayload"] = payload;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
