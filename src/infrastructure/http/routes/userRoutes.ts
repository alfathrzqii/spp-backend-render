import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { PrismaUserRepository } from "../../database/PrismaUserRepository.js";
import { PasswordHasher } from "../../services/PasswordHasher.js";
import { GetUsersUseCase } from "../../../application/use-cases/GetUsersUseCase.js";
import { CreateUserUseCase } from "../../../application/use-cases/CreateUserUseCase.js";
import { UpdateUserUseCase } from "../../../application/use-cases/UpdateUserUseCase.js";
import { DeleteUserUseCase } from "../../../application/use-cases/DeleteUserUseCase.js";
import { UserController } from "../controllers/UserController.js";

const router = Router();

// Inisialisasi Dependensi
const userRepository = new PrismaUserRepository();
const passwordHasher = new PasswordHasher();

const getUsersUseCase = new GetUsersUseCase(userRepository);
const createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher);
const updateUserUseCase = new UpdateUserUseCase(userRepository, passwordHasher);
const deleteUserUseCase = new DeleteUserUseCase(userRepository);

const userController = new UserController(
  getUsersUseCase,
  createUserUseCase,
  updateUserUseCase,
  deleteUserUseCase
);

// Rute Pengelolaan Pengguna (Hanya SUPER_ADMIN)
router.use(authMiddleware, roleMiddleware(["SUPER_ADMIN"]));

router.get("/", userController.getAll.bind(userController));
router.post("/", userController.create.bind(userController));
router.put("/:id", userController.update.bind(userController));
router.delete("/:id", userController.delete.bind(userController));

export default router;
