import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { PrismaStudentRepository } from "../../database/PrismaStudentRepository.js";
import { GetParentChildrenUseCase } from "../../../application/use-cases/GetParentChildrenUseCase.js";
import { ParentController } from "../controllers/ParentController.js";

const router = Router();

const studentRepository = new PrismaStudentRepository();
const getParentChildrenUseCase = new GetParentChildrenUseCase(studentRepository);
const parentController = new ParentController(getParentChildrenUseCase);

router.get(
  "/children",
  authMiddleware,
  roleMiddleware(["PARENT"]),
  parentController.getChildren.bind(parentController)
);

export default router;
