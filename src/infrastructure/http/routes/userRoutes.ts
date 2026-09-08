import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { container } from "../../../main/container.js";

const router = Router();
const userController = container.userController;

// Rute Pengelolaan Pengguna (Hanya SUPER_ADMIN)
router.use(authMiddleware, roleMiddleware(["SUPER_ADMIN"]));

router.get("/", userController.getAll.bind(userController));
router.post("/", userController.create.bind(userController));
router.put("/:id", userController.update.bind(userController));
router.delete("/:id", userController.delete.bind(userController));

export default router;
