import type { Request, Response, NextFunction } from "express";
import { TokenService } from "../../services/TokenService.js";
import { getAuthCookieOptions } from "../utils/cookieConfig.js";

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

    // Sliding session: Auto-refresh token and cookie on active API requests
    const newToken = tokenService.generateToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      schoolUnitId: decoded.schoolUnitId,
    });

    res.cookie("token", newToken, getAuthCookieOptions(req));

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Autentikasi gagal: Sesi tidak valid atau telah berakhir",
    });
  }
};

export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.token;

  if (!token) {
    return next();
  }

  try {
    const decoded = tokenService.verifyToken(token);
    req.user = decoded;
  } catch {
    // Sesi tidak valid atau expired diabaikan, lanjutkan sebagai guest
  }

  next();
};
