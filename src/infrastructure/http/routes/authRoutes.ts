import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { loginSchema } from "../schemas/authSchema.js";
import { container } from "../../../main/container.js";

const authRoutes = Router();
const authController = container.authController;

authRoutes.post("/login", validateRequest(loginSchema), (req, res, next) => authController.login(req, res, next));
authRoutes.post("/logout", (req, res, next) => authController.logout(req, res, next));
authRoutes.get("/me", authMiddleware, (req, res, next) => authController.getMe(req, res, next));

export default authRoutes;
