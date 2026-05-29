import { Router } from "express";
import { CategoryController } from "../controllers/CategoryController.js";
import { CreateCategoryUseCase } from "../../../application/use-cases/CreateCategoryUseCase.js";
import { GetCategoriesUseCase } from "../../../application/use-cases/GetCategoriesUseCase.js";
import { UpdateCategoryUseCase } from "../../../application/use-cases/UpdateCategoryUseCase.js";
import { DeleteCategoryUseCase } from "../../../application/use-cases/DeleteCategoryUseCase.js";
import { PrismaCategoryRepository } from "../../database/PrismaCategoryRepository.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { categorySchema } from "../schemas/categorySchema.js";

const router = Router();

// Inisialisasi Repository dan Use Cases
const categoryRepository = new PrismaCategoryRepository();
const createCategoryUseCase = new CreateCategoryUseCase(categoryRepository);
const getCategoriesUseCase = new GetCategoriesUseCase(categoryRepository);
const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepository);
const deleteCategoryUseCase = new DeleteCategoryUseCase(categoryRepository);

// Inisialisasi Controller
const categoryController = new CategoryController(
  createCategoryUseCase,
  getCategoriesUseCase,
  updateCategoryUseCase,
  deleteCategoryUseCase,
  categoryRepository
);

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
