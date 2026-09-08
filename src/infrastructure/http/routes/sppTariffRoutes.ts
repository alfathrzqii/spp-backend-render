import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { sppTariffSchema, updateSppTariffSchema } from "../schemas/sppTariffSchema.js";
import { container } from "../../../main/container.js";

const router = Router();
const sppTariffController = container.sppTariffController;

// Define Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  validateRequest(sppTariffSchema),
  sppTariffController.create.bind(sppTariffController)
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  sppTariffController.getAll.bind(sppTariffController)
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  validateRequest(updateSppTariffSchema),
  sppTariffController.update.bind(sppTariffController)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  sppTariffController.delete.bind(sppTariffController)
);

export default router;
