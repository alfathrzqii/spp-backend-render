import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { TransactionController } from "../controllers/TransactionController.js";
import { PrismaTransactionRepository } from "../../database/PrismaTransactionRepository.js";
import { PrismaCategoryRepository } from "../../database/PrismaCategoryRepository.js";
import { CreateTransactionUseCase } from "../../../application/use-cases/CreateTransactionUseCase.js";
import { GetTransactionsUseCase } from "../../../application/use-cases/GetTransactionsUseCase.js";
import { UpdateTransactionUseCase } from "../../../application/use-cases/UpdateTransactionUseCase.js";
import { DeleteTransactionUseCase } from "../../../application/use-cases/DeleteTransactionUseCase.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { createTransactionSchema } from "../schemas/transactionSchema.js";

const router = Router();

// Repositories
const transactionRepo = new PrismaTransactionRepository();
const categoryRepo = new PrismaCategoryRepository();

// Use Cases
const createTransactionUseCase = new CreateTransactionUseCase(transactionRepo, categoryRepo);
const getTransactionsUseCase = new GetTransactionsUseCase(transactionRepo);
const updateTransactionUseCase = new UpdateTransactionUseCase(transactionRepo, categoryRepo);
const deleteTransactionUseCase = new DeleteTransactionUseCase(transactionRepo);

// Controller
const transactionController = new TransactionController(
  createTransactionUseCase,
  getTransactionsUseCase,
  updateTransactionUseCase,
  deleteTransactionUseCase
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
