import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import bcrypt from "bcryptjs";

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const rows = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    }).from(usersTable).orderBy(usersTable.createdAt);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const rows = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    }).from(usersTable).where(eq(usersTable.id, id));
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { email, password, fullName, isActive, isAdmin } = req.body as {
      email: string; password: string; fullName: string; isActive?: boolean; isAdmin?: boolean;
    };
    const hash = await bcrypt.hash(password, 10);
    const rows = await db.insert(usersTable).values({
      email, password: hash, fullName, isActive: isActive ?? true, isAdmin: isAdmin ?? false,
    }).returning({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { email, password, fullName, isActive, isAdmin } = req.body as {
      email?: string; password?: string; fullName?: string; isActive?: boolean; isAdmin?: boolean;
    };
    const update: Record<string, unknown> = {};
    if (email !== undefined) update.email = email;
    if (fullName !== undefined) update.fullName = fullName;
    if (isActive !== undefined) update.isActive = isActive;
    if (isAdmin !== undefined) update.isAdmin = isAdmin;
    if (password) update.password = await bcrypt.hash(password, 10);
    update.updatedAt = new Date();
    const rows = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    });
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
