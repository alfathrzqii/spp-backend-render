import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { StudentController } from "../controllers/StudentController.js";
import { PrismaStudentRepository } from "../../database/PrismaStudentRepository.js";
import { PrismaUserRepository } from "../../database/PrismaUserRepository.js";
import { PrismaSppTariffRepository } from "../../database/PrismaSppTariffRepository.js";
import { PasswordHasher } from "../../services/PasswordHasher.js";
import { CreateStudentUseCase } from "../../../application/use-cases/CreateStudentUseCase.js";
import { GetStudentsUseCase } from "../../../application/use-cases/GetStudentsUseCase.js";
import { UpdateStudentUseCase } from "../../../application/use-cases/UpdateStudentUseCase.js";
import { DeleteStudentUseCase } from "../../../application/use-cases/DeleteStudentUseCase.js";

const router = Router();

// Repositories
const studentRepo = new PrismaStudentRepository();
const userRepo = new PrismaUserRepository();
const sppTariffRepo = new PrismaSppTariffRepository();

// Services
const passwordHasher = new PasswordHasher();

// Use Cases
const createStudentUseCase = new CreateStudentUseCase(
  studentRepo,
  userRepo,
  sppTariffRepo,
  passwordHasher
);
const getStudentsUseCase = new GetStudentsUseCase(studentRepo);
const updateStudentUseCase = new UpdateStudentUseCase(studentRepo);
const deleteStudentUseCase = new DeleteStudentUseCase(studentRepo);

// Controller
const studentController = new StudentController(
  createStudentUseCase,
  getStudentsUseCase,
  updateStudentUseCase,
  deleteStudentUseCase
);

// Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
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

export default router;
