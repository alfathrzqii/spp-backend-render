import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";
import { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import { GetMeUseCase } from "../../../application/use-cases/GetMeUseCase.js";
import { PrismaUserRepository } from "../../database/PrismaUserRepository.js";
import { PasswordHasher } from "../../services/PasswordHasher.js";
import { TokenService } from "../../services/TokenService.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { loginSchema } from "../schemas/authSchema.js";

const authRoutes = Router();

const userRepo = new PrismaUserRepository();
const passwordHasher = new PasswordHasher();
const loginUseCase = new LoginUseCase(userRepo, passwordHasher);
const getMeUseCase = new GetMeUseCase(userRepo);
const tokenService = new TokenService();
const authController = new AuthController(loginUseCase, getMeUseCase, tokenService);

authRoutes.post("/login", validateRequest(loginSchema), (req, res, next) => authController.login(req, res, next));
authRoutes.post("/logout", (req, res, next) => authController.logout(req, res, next));
authRoutes.get("/me", authMiddleware, (req, res, next) => authController.getMe(req, res, next));

export default authRoutes;
