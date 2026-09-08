import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { container } from "../../../main/container.js";

const router = Router();
const parentController = container.parentController;

router.get(
  "/children",
  authMiddleware,
  roleMiddleware(["PARENT"]),
  parentController.getChildren.bind(parentController)
);

export default router;
