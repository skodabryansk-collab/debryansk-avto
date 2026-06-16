import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(carsRouter);
router.use(newCarsRouter);
router.use(featuredRouter);
router.use(hhVacanciesRouter);
router.use(cmExpertRouter);
router.use(emailRouter);

// Public content routes
router.use("/news", publicNewsRouter);
router.use("/brands", publicBrandsRouter);
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

// Public settings
router.use("/settings", publicSettingsRouter);

// GetLoyalty reviews proxy
router.use("/reviews", publicReviewsRouter);

export default router;
