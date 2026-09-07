import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { reRegistrationTariffSchema, updateReRegistrationTariffSchema } from "../schemas/reRegistrationTariffSchema.js";
import { ReRegistrationTariffController } from "../controllers/ReRegistrationTariffController.js";
import { PrismaReRegistrationTariffRepository } from "../../database/PrismaReRegistrationTariffRepository.js";
import { CreateReRegistrationTariffUseCase } from "../../../application/use-cases/CreateReRegistrationTariffUseCase.js";
import { GetReRegistrationTariffsUseCase } from "../../../application/use-cases/GetReRegistrationTariffsUseCase.js";
import { UpdateReRegistrationTariffUseCase } from "../../../application/use-cases/UpdateReRegistrationTariffUseCase.js";
import { DeleteReRegistrationTariffUseCase } from "../../../application/use-cases/DeleteReRegistrationTariffUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";

const router = Router();

// Repositories
const repo = new PrismaReRegistrationTariffRepository();

// Use Cases
const createUseCase = new CreateReRegistrationTariffUseCase(repo);
const getUseCase = new GetReRegistrationTariffsUseCase(repo);
const updateUseCase = new UpdateReRegistrationTariffUseCase(repo);
const deleteUseCase = new DeleteReRegistrationTariffUseCase(repo);

// Controller
const controller = new ReRegistrationTariffController(
  createUseCase,
  getUseCase,
  updateUseCase,
  deleteUseCase
);

// Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  validateRequest(reRegistrationTariffSchema),
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
  validateRequest(updateReRegistrationTariffSchema),
  controller.update.bind(controller)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  controller.delete.bind(controller)
);

export default router;
