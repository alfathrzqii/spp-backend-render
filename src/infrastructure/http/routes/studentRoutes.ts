import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { createStudentSchema } from "../schemas/studentSchema.js";
import { container } from "../../../main/container.js";

const router = Router();
const studentController = container.studentController;

// Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(createStudentSchema),
  studentController.create.bind(studentController)
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.getAll.bind(studentController)
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.update.bind(studentController)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.delete.bind(studentController)
);

router.post(
  "/import",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.import.bind(studentController)
);

export default router;
