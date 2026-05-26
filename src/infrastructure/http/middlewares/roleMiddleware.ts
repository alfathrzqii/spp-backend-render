import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";

export const roleMiddleware = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Autentikasi gagal: Sesi tidak valid atau telah berakhir",
      });
      return;
    }

    // 1. Pengecekan Role (RBAC)
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "Akses ditolak: Anda tidak memiliki hak akses untuk menu ini",
      });
      return;
    }

    // 2. Logika Proteksi Cross-Unit Sekolah
    if (user.role === "UNIT_ADMIN") {
      const requestedUnitId =
        req.params.schoolUnitId ||
        req.query.schoolUnitId ||
        req.body.schoolUnitId ||
        req.params.unitId ||
        req.query.unitId ||
        req.body.unitId;

      if (requestedUnitId !== undefined && requestedUnitId !== null) {
        // Pastikan perbandingannya benar (konversi ke number jika perlu)
        if (Number(requestedUnitId) !== user.schoolUnitId) {
          res.status(403).json({
            success: false,
            message: "Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini",
          });
          return;
        }
      }
    }

    next();
  };
};
