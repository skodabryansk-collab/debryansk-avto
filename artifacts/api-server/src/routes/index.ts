import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carsRouter from "./cars";
import newCarsRouter from "./new-cars";
import featuredRouter from "./featured";
import hhVacanciesRouter from "./hh-vacancies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carsRouter);
router.use(newCarsRouter);
router.use(featuredRouter);
router.use(hhVacanciesRouter);

export default router;
