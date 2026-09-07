import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { ActivityLogController } from "../controllers/ActivityLogController.js";
import { PrismaActivityLogRepository } from "../../database/PrismaActivityLogRepository.js";
import { GetActivityLogsUseCase } from "../../../application/use-cases/GetActivityLogsUseCase.js";

const router = Router();
const activityLogRepository = new PrismaActivityLogRepository();
const getActivityLogsUseCase = new GetActivityLogsUseCase(activityLogRepository);
const controller = new ActivityLogController(getActivityLogsUseCase);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  controller.getAll.bind(controller)
);

export default router;
