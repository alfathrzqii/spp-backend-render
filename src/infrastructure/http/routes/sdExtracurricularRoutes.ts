import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { sdExtracurricularSchema, updateSdExtracurricularSchema } from "../schemas/sdExtracurricularSchema.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { container } from "../../../main/container.js";

const router = Router();
const controller = container.sdExtracurricularController;

// Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  validateRequest(sdExtracurricularSchema),
  controller.create.bind(controller)
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  controller.getAll.bind(controller)
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  validateRequest(updateSdExtracurricularSchema),
  controller.update.bind(controller)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  controller.delete.bind(controller)
);

export default router;
