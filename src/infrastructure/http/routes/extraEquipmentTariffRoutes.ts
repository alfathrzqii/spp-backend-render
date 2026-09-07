import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { extraEquipmentTariffSchema, updateExtraEquipmentTariffSchema } from "../schemas/extraEquipmentTariffSchema.js";
import { ExtraEquipmentTariffController } from "../controllers/ExtraEquipmentTariffController.js";
import { PrismaExtraEquipmentTariffRepository } from "../../database/PrismaExtraEquipmentTariffRepository.js";
import { CreateExtraEquipmentTariffUseCase } from "../../../application/use-cases/CreateExtraEquipmentTariffUseCase.js";
import { GetExtraEquipmentTariffsUseCase } from "../../../application/use-cases/GetExtraEquipmentTariffsUseCase.js";
import { UpdateExtraEquipmentTariffUseCase } from "../../../application/use-cases/UpdateExtraEquipmentTariffUseCase.js";
import { DeleteExtraEquipmentTariffUseCase } from "../../../application/use-cases/DeleteExtraEquipmentTariffUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";

const router = Router();

// Repositories
const repo = new PrismaExtraEquipmentTariffRepository();

// Use Cases
const createUseCase = new CreateExtraEquipmentTariffUseCase(repo);
const getUseCase = new GetExtraEquipmentTariffsUseCase(repo);
const updateUseCase = new UpdateExtraEquipmentTariffUseCase(repo);
const deleteUseCase = new DeleteExtraEquipmentTariffUseCase(repo);

// Controller
const controller = new ExtraEquipmentTariffController(
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
  validateRequest(extraEquipmentTariffSchema),
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
  validateRequest(updateExtraEquipmentTariffSchema),
  controller.update.bind(controller)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  controller.delete.bind(controller)
);

export default router;
