import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { createFulldayTariffSchema, updateFulldayTariffSchema } from "../schemas/fulldayTariffSchema.js";
import { FulldayTariffController } from "../controllers/FulldayTariffController.js";
import { PrismaFulldayTariffRepository } from "../../database/PrismaFulldayTariffRepository.js";
import { CreateFulldayTariffUseCase } from "../../../application/use-cases/CreateFulldayTariffUseCase.js";
import { GetFulldayTariffsUseCase } from "../../../application/use-cases/GetFulldayTariffsUseCase.js";
import { UpdateFulldayTariffUseCase } from "../../../application/use-cases/UpdateFulldayTariffUseCase.js";
import { DeleteFulldayTariffUseCase } from "../../../application/use-cases/DeleteFulldayTariffUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import prisma from "../../database/prisma.js";

const router = Router();

const repo = new PrismaFulldayTariffRepository(prisma);

const createUseCase = new CreateFulldayTariffUseCase(repo);
const getUseCase = new GetFulldayTariffsUseCase(repo);
const updateUseCase = new UpdateFulldayTariffUseCase(repo);
const deleteUseCase = new DeleteFulldayTariffUseCase(repo);

const controller = new FulldayTariffController(
  createUseCase,
  updateUseCase,
  deleteUseCase,
  getUseCase
);

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
