import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import { join } from "path";
import { requireAdmin } from "../middlewares/requireAdmin";

let isRebuilding = false;

const router: IRouter = Router();
router.use(requireAdmin);

router.post("/rebuild", (_req, res) => {
  if (isRebuilding) {
    return res.status(409).json({ status: "running", message: "Пересборка уже выполняется" });
  }
  isRebuilding = true;
  const ssgPath = join(process.cwd(), "artifacts/debryansk-avto/scripts/ssg.mjs");
  const child = spawn("node", [ssgPath], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  child.on("close", () => { isRebuilding = false; });
  child.on("error", () => { isRebuilding = false; });
  child.unref();
  return res.json({ status: "started", message: "Пересборка запущена" });
});

router.get("/rebuild/status", (_req, res) => {
  return res.json({ status: isRebuilding ? "running" : "idle" });
});

export default router;
