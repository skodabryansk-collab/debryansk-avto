import { Router, type IRouter } from "express";
import { updatePrerenderCache, getPrerenderCache } from "../middleware/prerender";
import healthRouter from "./health";
import chatRouter from "./chat";
import carsRouter from "./cars";
import newCarsRouter from "./new-cars";
import featuredRouter from "./featured";
import hhVacanciesRouter from "./hh-vacancies";
import cmExpertRouter from "./cm-expert";
import emailRouter from "./email";
import publicNewsRouter from "./public-news";
import publicBrandsRouter from "./public-brands";
import publicLocationsRouter from "./public-locations";
import adminAuthRouter from "./admin-auth";
import adminNewsRouter from "./admin-news";
import adminLeadsRouter from "./admin-leads";
import adminDashboardRouter from "./admin-dashboard";
import adminBrandsRouter from "./admin-brands";
import adminUsersRouter from "./admin-users";
import adminUploadRouter from "./admin-upload";
import adminStatsRouter from "./admin-stats";
import adminLocationsRouter from "./admin-locations";
import adminSettingsRouter from "./admin-settings";
import publicSettingsRouter from "./public-settings";
import publicReviewsRouter from "./public-reviews";
import storageRouter from "./storage";
import carCatalogRouter from "./car-catalog";
import brandLocationsRouter from "./brand-locations";
import adminNavigatorRouter from "./admin-navigator";
import adminReviewsRouter from "./admin-reviews";
import adminBrandPagesRouter from "./admin-brand-pages";
import adminPromotionsRouter from "./admin-promotions";
import publicPromotionsRouter from "./public-promotions";
import adminCacheRouter from "./admin-cache";
import adminMetrikaRouter from "./admin-metrika";
import adminSeoPositionsRouter from "./admin-seo-positions";
import disclaimersRouter from "./disclaimers";
import feedYmlRouter from "./feed-yml";
import { publicFaqRouter, adminFaqRouter } from "./faq";
import { publicBonusProgramRouter, adminBonusProgramRouter } from "./bonus-program";
import toCatalogRouter from "./to-catalog";
import adminToCatalogRouter from "./admin-to-catalog";
import calltouchWebhookRouter from "./webhooks-calltouch";
import adminCalltouchRouter from "./admin-calltouch";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(carsRouter);
router.use(feedYmlRouter);
router.use(newCarsRouter);
router.use(featuredRouter);
router.use(hhVacanciesRouter);
router.use(cmExpertRouter);
router.use(emailRouter);

// Public content routes
router.use("/news", publicNewsRouter);
router.use("/brands", publicBrandsRouter);
router.use(publicPromotionsRouter);
router.use("/locations", publicLocationsRouter);
router.use(brandLocationsRouter);

// Storage routes
router.use(storageRouter);

// Auto.ru catalog proxy
router.use("/car-catalog", carCatalogRouter);

// Admin routes
router.use("/admin/login", adminAuthRouter);
router.use("/admin/news", adminNewsRouter);
router.use("/admin/leads", adminLeadsRouter);
router.use("/admin/dashboard", adminDashboardRouter);
router.use("/admin/stats", adminStatsRouter);
router.use("/admin/brands", adminBrandsRouter);
router.use("/admin/users", adminUsersRouter);
router.use("/admin/upload", adminUploadRouter);
router.use("/admin/locations", adminLocationsRouter);
router.use("/admin/settings", adminSettingsRouter);
router.use("/admin/navigator", adminNavigatorRouter);
router.use("/admin/reviews", adminReviewsRouter);
router.use("/admin/brand-pages", adminBrandPagesRouter);
router.use("/admin/promotions", adminPromotionsRouter);
router.use("/admin/cache", adminCacheRouter);
router.use("/admin/metrika", adminMetrikaRouter);
router.use("/admin/seo-positions", adminSeoPositionsRouter);
router.use("/faq", publicFaqRouter);
router.use("/admin/faq", adminFaqRouter);
router.use(disclaimersRouter);
router.use(publicBonusProgramRouter);
router.use("/admin/bonus-program", adminBonusProgramRouter);
router.use("/admin/to-catalog", adminToCatalogRouter);

// TO catalog (public)
router.use("/to-catalog", toCatalogRouter);

// Calltouch webhooks (public, protected by secret query param)
// Both /webhook/ and /webhooks/ are supported — CallTouch cabinet uses the singular form
router.use("/webhooks/calltouch", calltouchWebhookRouter);
router.use("/webhook/calltouch", calltouchWebhookRouter);

// Calltouch admin
router.use("/admin/calltouch-calls", adminCalltouchRouter);

// Public settings
router.use("/settings", publicSettingsRouter);

// GetLoyalty reviews proxy
router.use("/reviews", publicReviewsRouter);

// Internal: live prerender cache update (called by prerender.mjs after each page)
// "/buyout" is NOT real SSG content (dist/public/buyout/index.html is just the
// SPA shell) — it's fully Puppeteer-rendered like /cars, /new-cars etc. Keeping
// it protected here blocked every live crawl from refreshing its in-memory
// cache entry, so edits only ever became visible after the next server
// restart happened to reload a fresh GCS snapshot. Removed so crawls can
// update it live, same as other Puppeteer-rendered routes.
const SSG_PROTECTED_ROUTES = new Set(["/", "/service", "/vacancies", "/about", "/contacts", "/news", "/new-cars", "/cars", "/legal", "/privacy", "/service/bonus"]);
function isSsgProtected(route: string): boolean {
  if (SSG_PROTECTED_ROUTES.has(route)) return true;
  // /brands/* and /news/* are prerendered by Puppeteer — allow cache updates
  if (route.startsWith("/news/")) return true;
  if (route.startsWith("/promotions/")) return true;
  return false;
}

router.post("/internal/prerender-update", (req, res) => {
  const secret = req.headers["x-prerender-secret"];
  if (secret !== process.env.PRERENDER_INTERNAL_SECRET) {
    res.status(403).json({ ok: false });
    return;
  }
  const { route, html } = req.body as { route?: string; html?: string };
  if (!route || !html) {
    res.status(400).json({ ok: false, error: "missing route or html" });
    return;
  }
  // Never overwrite SSG routes — they have correct FAQPage schema
  if (isSsgProtected(route)) {
    res.json({ ok: true, route, skipped: true, reason: "SSG protected" });
    return;
  }
  updatePrerenderCache(route, html);
  res.json({ ok: true, route, size: html.length });
});

// Debug: prerender cache status (internal use only)
router.get("/debug/prerender-cache", (req, res) => {
  const secret = req.query["secret"];
  if (!secret || secret !== process.env.PRERENDER_INTERNAL_SECRET) {
    res.status(403).json({ ok: false });
    return;
  }
  const cache = getPrerenderCache();
  const routes = [...cache.pages.keys()].sort();
  res.json({
    ok: true,
    size: cache.pages.size,
    gone: cache.gone.size,
    hasRoot: cache.pages.has("/"),
    routes: routes.slice(0, 30),
    totalRoutes: routes.length,
  });
});

export default router;
