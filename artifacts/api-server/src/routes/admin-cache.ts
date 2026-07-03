import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { requireAdmin } from "../middlewares/requireAdmin";

let isRebuilding = false;
let isPrerenderRunning = false;

const router: IRouter = Router();
router.use(requireAdmin);

function getAssetsDir() {
  return join(process.cwd(), "artifacts/debryansk-avto/dist/public/assets");
}

function hasValidAssets(): boolean {
  const assetsDir = getAssetsDir();
  if (!existsSync(assetsDir)) return false;
  const files = readdirSync(assetsDir);
  return files.some((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
}

router.post("/rebuild", (_req, res) => {
  if (isRebuilding) {
    return res.status(409).json({ status: "running", message: "Пересборка уже выполняется" });
  }

  if (!hasValidAssets()) {
    return res.status(503).json({
      status: "error",
      message:
        "JS-бандл отсутствует в dist/public/assets — сначала выполните повторный деплой, чтобы пересобрать фронтенд.",
    });
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

router.post("/prerender", (_req, res) => {
  if (isPrerenderRunning) {
    return res.status(409).json({ status: "running", message: "Пририндер уже выполняется" });
  }
  const prerenderPath = join(process.cwd(), "artifacts/api-server/scripts/prerender.mjs");
  if (!existsSync(prerenderPath)) {
    return res.status(503).json({ status: "error", message: "prerender.mjs не найден" });
  }
  isPrerenderRunning = true;
  const child = spawn("node", [prerenderPath], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    env: process.env,
  });
  child.on("close", () => { isPrerenderRunning = false; });
  child.on("error", () => { isPrerenderRunning = false; });
  child.unref();
  return res.json({ status: "started", message: "Пририндер запущен в фоне (~10 мин)" });
});

router.get("/prerender/status", (_req, res) => {
  return res.json({ status: isPrerenderRunning ? "running" : "idle" });
});

export default router;
