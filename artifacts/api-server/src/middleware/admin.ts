import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const isProd = process.env["NODE_ENV"] === "production";

const SECRET = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"];
const ADMIN_LOGIN = process.env["ADMIN_LOGIN"];
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];

if (isProd && !SECRET) {
  console.error("[FATAL] ADMIN_JWT_SECRET or JWT_SECRET must be set in production");
  process.exit(1);
}

const JWT_SECRET = SECRET || "dev-only-secret-key";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { login: string; id?: number; isAdmin?: boolean };
    if (decoded.isAdmin !== true) {
      res.status(403).json({ error: "Forbidden: admin access required" });
      return;
    }
    (req as any).admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function generateToken(login: string, id?: number, isAdmin?: boolean): string {
  return jwt.sign({ login, id, isAdmin: isAdmin ?? true }, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyCredentials(login: string, password: string): boolean {
  if (isProd && (!ADMIN_LOGIN || !ADMIN_PASSWORD)) {
    return false;
  }
  const adminLogin = ADMIN_LOGIN || "admin";
  const adminPassword = ADMIN_PASSWORD || "admin123";
  return login === adminLogin && password === adminPassword;
}

export async function verifyUserCredentials(email: string, password: string): Promise<{ id: number; email: string; fullName: string; isAdmin: boolean } | null> {
  const rows = await db.select().from(usersTable).where(and(eq(usersTable.email, email), eq(usersTable.isActive, true))).limit(1);
  if (!rows.length) return null;
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  return { id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin ?? false };
}
