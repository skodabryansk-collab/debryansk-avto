import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carsRouter from "./cars";
import newCarsRouter from "./new-cars";
import featuredRouter from "./featured";
import hhVacanciesRouter from "./hh-vacancies";
import cmExpertRouter from "./cm-expert";
import emailRouter from "./email";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carsRouter);
router.use(newCarsRouter);
router.use(featuredRouter);
router.use(hhVacanciesRouter);
router.use(cmExpertRouter);
router.use(emailRouter);

export default router;
