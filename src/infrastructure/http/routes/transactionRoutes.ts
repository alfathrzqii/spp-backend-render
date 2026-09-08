import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { createTransactionSchema } from "../schemas/transactionSchema.js";
import { container } from "../../../main/container.js";

const router = Router();
const transactionController = container.transactionController;

// Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(createTransactionSchema),
  transactionController.create.bind(transactionController)
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  transactionController.getAll.bind(transactionController)
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  transactionController.update.bind(transactionController)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  transactionController.delete.bind(transactionController)
);

export default router;
