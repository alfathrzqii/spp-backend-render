import type { Request, Response, NextFunction } from "express";
import { TokenService } from "../../services/TokenService.js";

const tokenService = new TokenService();

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies.token;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Autentikasi gagal: Sesi tidak valid atau telah berakhir",
    });
    return;
  }

  try {
    const decoded = tokenService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Autentikasi gagal: Sesi tidak valid atau telah berakhir",
    });
  }
};
