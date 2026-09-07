import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { sdExtracurricularSchema, updateSdExtracurricularSchema } from "../schemas/sdExtracurricularSchema.js";
import { SdExtracurricularController } from "../controllers/SdExtracurricularController.js";
import { PrismaSdExtracurricularRepository } from "../../database/PrismaSdExtracurricularRepository.js";
import { CreateSdExtracurricularUseCase } from "../../../application/use-cases/CreateSdExtracurricularUseCase.js";
import { GetSdExtracurricularsUseCase } from "../../../application/use-cases/GetSdExtracurricularsUseCase.js";
import { UpdateSdExtracurricularUseCase } from "../../../application/use-cases/UpdateSdExtracurricularUseCase.js";
import { DeleteSdExtracurricularUseCase } from "../../../application/use-cases/DeleteSdExtracurricularUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";

const router = Router();

// Repositories
const repo = new PrismaSdExtracurricularRepository();

// Use Cases
const createUseCase = new CreateSdExtracurricularUseCase(repo);
const getUseCase = new GetSdExtracurricularsUseCase(repo);
const updateUseCase = new UpdateSdExtracurricularUseCase(repo);
const deleteUseCase = new DeleteSdExtracurricularUseCase(repo);

// Controller
const controller = new SdExtracurricularController(
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
