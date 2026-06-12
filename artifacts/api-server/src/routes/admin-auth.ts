import { Router, type IRouter } from "express";
import { verifyCredentials, verifyUserCredentials, generateToken } from "../middleware/admin";

const router: IRouter = Router();

router.post("/", async (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    return res.status(400).json({ ok: false, error: "Login and password required" });
  }

  // Try legacy env-based auth first
  if (verifyCredentials(login, password)) {
    const token = generateToken(login, undefined, true);
    return res.json({ ok: true, token });
  }

  // Try database user auth
  const user = await verifyUserCredentials(login, password);
  if (user && user.isAdmin) {
    const token = generateToken(user.email, user.id, true);
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, error: "Invalid credentials" });
});

export default router;
