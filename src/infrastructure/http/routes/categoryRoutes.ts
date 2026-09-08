import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { categorySchema } from "../schemas/categorySchema.js";
import { container } from "../../../main/container.js";

const router = Router();
const categoryController = container.categoryController;

// Registrasi Route API
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(categorySchema),
  categoryController.create.bind(categoryController)
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  categoryController.getAll.bind(categoryController)
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(categorySchema),
  categoryController.update.bind(categoryController)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  categoryController.delete.bind(categoryController)
);

export default router;
