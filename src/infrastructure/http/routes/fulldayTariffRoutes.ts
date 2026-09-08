import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { createFulldayTariffSchema, updateFulldayTariffSchema } from "../schemas/fulldayTariffSchema.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { container } from "../../../main/container.js";

const router = Router();
const controller = container.fulldayTariffController;

router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  validateRequest(createFulldayTariffSchema),
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
  validateRequest(updateFulldayTariffSchema),
  controller.update.bind(controller)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  controller.delete.bind(controller)
);

export default router;
