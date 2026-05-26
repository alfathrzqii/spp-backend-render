import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";
import { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import { PrismaUserRepository } from "../../database/PrismaUserRepository.js";
import { PasswordHasher } from "../../services/PasswordHasher.js";
import { TokenService } from "../../services/TokenService.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const authRoutes = Router();

const userRepo = new PrismaUserRepository();
const loginUseCase = new LoginUseCase(userRepo);
const passwordHasher = new PasswordHasher();
const tokenService = new TokenService();
const authController = new AuthController(loginUseCase, passwordHasher, tokenService, userRepo);

authRoutes.post("/login", (req, res, next) => authController.login(req, res, next));
authRoutes.get("/me", authMiddleware, (req, res, next) => authController.getMe(req, res, next));

export default authRoutes;
