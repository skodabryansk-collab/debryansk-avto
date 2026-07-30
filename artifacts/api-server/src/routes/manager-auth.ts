import { Router, type IRouter } from "express";
import { db, managersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

router.post("/", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    return res.status(400).json({ ok: false, error: "Login and password required" });
  }

  try {
    const rows = await db.select().from(managersTable)
      .where(eq(managersTable.login, login))
      .limit(1);

    if (!rows.length || !rows[0]!.isActive) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const manager = rows[0]!;
    const ok = await bcrypt.compare(password, manager.passwordHash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const secret = process.env["ADMIN_JWT_SECRET"] || process.env["JWT_SECRET"] || "dev-only-secret-key";
    const token = jwt.sign(
      { managerId: manager.id, name: manager.name, role: "manager" },
      secret,
      { expiresIn: "30d" }
    );

    return res.json({ ok: true, token, name: manager.name });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
