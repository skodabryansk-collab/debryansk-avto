import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerSitemapRoute } from "./routes/sitemap";
import { prerenderMiddleware } from "./middleware/prerender";
import { seoMetaMiddleware } from "./middleware/seoMeta";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

registerSitemapRoute(app);

app.use("/api", router);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const frontendDist =
  process.env.FRONTEND_DIST_PATH ||
  path.resolve(__dirname, "../../debryansk-avto/dist/public");

if (existsSync(frontendDist)) {
  logger.info({ frontendDist }, "Serving frontend static files");

  app.use((req, res, next) => {
    const m = req.path.match(/^\/(new-cars)\/(.+)$/);
    if (!m) return next();
    const segment = m[2];
    const decoded = decodeURIComponent(segment);
    const normalized = decoded.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
    if (normalized !== segment) {
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return res.redirect(301, `/new-cars/${normalized}${qs}`);
    }
    next();
  });

  app.use(prerenderMiddleware);
  app.use(seoMetaMiddleware);

  app.use(express.static(frontendDist, { index: false }));

  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  logger.info(
    { frontendDist },
    "Frontend dist not found — skipping static serving (dev mode)",
  );
}

export default app;
