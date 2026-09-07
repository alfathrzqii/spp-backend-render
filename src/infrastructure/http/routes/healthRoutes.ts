import { Router } from "express";
import { HealthCheckController } from "../controllers/HealthCheckController.js";
import { PrismaHealthIndicator } from "../../services/PrismaHealthIndicator.js";

const router = Router();
const prismaHealthIndicator = new PrismaHealthIndicator();
const healthCheckController = new HealthCheckController(prismaHealthIndicator);

router.get("/", (req, res, next) => healthCheckController.check(req, res, next));

export default router;
