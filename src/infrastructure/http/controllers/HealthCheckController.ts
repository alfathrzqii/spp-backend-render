import type { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma.js";

export class HealthCheckController {
  async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let isDbHealthy = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        isDbHealthy = true;
      } catch {
        isDbHealthy = false;
      }

      const status = isDbHealthy ? "ok" : "error";
      const statusCode = isDbHealthy ? 200 : 503;

      res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: isDbHealthy ? "up" : "down",
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
