import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerSitemapRoute } from "./routes/sitemap";
import { prerenderMiddleware } from "./middleware/prerender";
import { seoMetaMiddleware } from "./middleware/seoMeta";

const app: Express = express();

// Redirect www to canonical non-www domain, preserving path and query string.
// Runs first so every subsequent middleware and the SPA fallback see the
// canonical hostname.
app.use((req, res, next) => {
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "") as string;
  if (host && host.startsWith("www.")) {
    const canonical = host.slice(4);
    const protocol = (req.headers["x-forwarded-proto"] || req.protocol) as string;
    return res.redirect(301, `${protocol}://${canonical}${req.url}`);
  }
  next();
});

// 301 redirects for old/external brand slugs that got indexed with wrong titles
const BRAND_SLUG_REDIRECTS: Record<string, string> = {
  "mb-bryansk": "mercedes-benz",
  "mb": "mercedes-benz",
  "haval": "haval-city",
};
app.use((req, res, next) => {
  const m = req.path.match(/^\/brands\/([^/]+)\/?$/);
  if (m) {
    const target = BRAND_SLUG_REDIRECTS[m[1]];
    if (target) return res.redirect(301, `/brands/${target}`);
  }
  next();
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; connect-src 'self' https: wss://mc.yandex.ru wss://*.yandex.ru; img-src 'self' data: https: http:; frame-ancestors 'self';"
  );
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(compression());

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
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// /sitemaps.xml → canonical /sitemap.xml (301 redirect)
// Without this, React Router catches /sitemaps.xml and returns an HTML shell,
// which causes crawlers to report "Unknown sitemap format".
app.get("/sitemaps.xml", (_req, res) => {
  res.redirect(301, "/sitemap.xml");
});

registerSitemapRoute(app);

app.use("/api", router);
// Uploaded files — serve from local disk with correct MIME types.
// Extensionless UUID files (legacy uploads from GCS migration) are WebP images;
// content type must be set inside express.static's setHeaders callback — doing it
// in a preceding middleware has no effect because send() overwrites Content-Type
// when it resolves the file extension (or falls back to application/octet-stream).
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads"), {
  setHeaders(res, filePath) {
    if (!path.extname(filePath)) {
      // Extensionless file → legacy WebP upload without .webp suffix
      res.setHeader("Content-Type", "image/webp");
    }
    res.setHeader("Cache-Control", "public, max-age=2592000"); // 30 days
  },
}));

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

  app.use(
    express.static(frontendDist, {
      index: false,
      setHeaders(res, filePath) {
        if (/\.html?$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else if (/-[A-Za-z0-9_]{8,}\.(js|css|mjs|woff2?|png|webp|jpe?g|svg|ico|gif|avif)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      },
    }),
  );

  // Return 404 for missing static assets — never serve index.html as CSS/JS
  app.use((req, res, next) => {
    if (/^\/(assets|uploads|storage)\//.test(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  });

  // SPA fallback — only for HTML navigation requests
  app.use((req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  logger.info(
    { frontendDist },
    "Frontend dist not found — skipping static serving (dev mode)",
  );
}

export default app;
