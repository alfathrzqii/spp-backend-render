import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { TransactionController } from "../controllers/TransactionController.js";
import { PrismaTransactionRepository } from "../../database/PrismaTransactionRepository.js";
import { PrismaCategoryRepository } from "../../database/PrismaCategoryRepository.js";
import { CreateTransactionUseCase } from "../../../application/use-cases/CreateTransactionUseCase.js";
import { GetTransactionsUseCase } from "../../../application/use-cases/GetTransactionsUseCase.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createTransactionSchema } from "../schemas/transactionSchema.js";

const router = Router();

// Repositories
const transactionRepo = new PrismaTransactionRepository();
const categoryRepo = new PrismaCategoryRepository();

// Use Cases
const createTransactionUseCase = new CreateTransactionUseCase(transactionRepo, categoryRepo);
const getTransactionsUseCase = new GetTransactionsUseCase(transactionRepo);

// Controller
const transactionController = new TransactionController(
  createTransactionUseCase,
  getTransactionsUseCase
);

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

export default router;
