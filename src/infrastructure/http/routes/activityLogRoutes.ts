import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { container } from "../../../main/container.js";

const router = Router();
const controller = container.activityLogController;

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  controller.getAll.bind(controller)
);

export default router;
