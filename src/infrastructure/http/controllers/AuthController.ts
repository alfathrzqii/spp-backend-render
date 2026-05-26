import type { Request, Response, NextFunction } from "express";
import type { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import type { PasswordHasher } from "../../services/PasswordHasher.js";
import type { TokenService } from "../../services/TokenService.js";

export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private passwordHasher: PasswordHasher,
    private tokenService: TokenService
  ) {}

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const user = await this.loginUseCase.execute(email);

      const isPasswordValid = await this.passwordHasher.compare(
        password,
        user.password
      );

      if (!isPasswordValid) {
        throw new Error("Email atau password salah");
      }

      const token = this.tokenService.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        schoolUnitId: user.schoolUnitId,
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false, // development
        sameSite: "strict",
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
}
