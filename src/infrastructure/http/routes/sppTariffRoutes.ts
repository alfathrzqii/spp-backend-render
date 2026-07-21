import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { sppTariffSchema, updateSppTariffSchema } from "../schemas/sppTariffSchema.js";
import { SppTariffController } from "../controllers/SppTariffController.js";
import { PrismaSppTariffRepository } from "../../database/PrismaSppTariffRepository.js";
import { CreateSppTariffUseCase } from "../../../application/use-cases/CreateSppTariffUseCase.js";
import { GetSppTariffsUseCase } from "../../../application/use-cases/GetSppTariffsUseCase.js";
import { UpdateSppTariffUseCase } from "../../../application/use-cases/UpdateSppTariffUseCase.js";
import { DeleteSppTariffUseCase } from "../../../application/use-cases/DeleteSppTariffUseCase.js";

const router = Router();

// Inisialisasi Repository
const sppTariffRepo = new PrismaSppTariffRepository();

// Inisialisasi Use Cases
const createSppTariffUseCase = new CreateSppTariffUseCase(sppTariffRepo);
const getSppTariffsUseCase = new GetSppTariffsUseCase(sppTariffRepo);
const updateSppTariffUseCase = new UpdateSppTariffUseCase(sppTariffRepo);
const deleteSppTariffUseCase = new DeleteSppTariffUseCase(sppTariffRepo);

// Inisialisasi Controller
const sppTariffController = new SppTariffController(
  createSppTariffUseCase,
  getSppTariffsUseCase,
  updateSppTariffUseCase,
  deleteSppTariffUseCase
);

// Define Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
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
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(updateSppTariffSchema),
  sppTariffController.update.bind(sppTariffController)
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  sppTariffController.delete.bind(sppTariffController)
);

export default router;


