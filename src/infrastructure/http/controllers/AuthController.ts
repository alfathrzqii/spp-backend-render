import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../../domain/errors/AppError.js";
import type { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import type { PasswordHasher } from "../../services/PasswordHasher.js";
import type { TokenService } from "../../services/TokenService.js";
import type { IUserRepository } from "../../../domain/repositories/IUserRepository.js";

export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private passwordHasher: PasswordHasher,
    private tokenService: TokenService,
    private userRepository: IUserRepository
  ) {}

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, password } = req.body;

      const user = await this.loginUseCase.execute(identifier, password);

      const token = this.tokenService.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        schoolUnitId: user.schoolUnitId,
      });

      const isProduction = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolUnitId: user.schoolUnitId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError("Autentikasi gagal: Sesi tidak valid atau telah berakhir");
      }

      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new UnauthorizedError("Autentikasi gagal: Sesi tidak valid atau telah berakhir");
      }

      res.status(200).json({
        success: true,
        message: "Sesi pengguna aktif",
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolUnitId: user.schoolUnitId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isProduction = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
      res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "strict",
      });
      res.status(200).json({
        success: true,
        message: "Logout berhasil",
      });
    } catch (error) {
      next(error);
    }
  }
}
