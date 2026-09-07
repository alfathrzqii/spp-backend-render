import { Router } from "express";
import { HealthCheckController } from "../controllers/HealthCheckController.js";

const router = Router();
const healthCheckController = new HealthCheckController();

router.get("/", (req, res, next) => healthCheckController.check(req, res, next));

export default router;
