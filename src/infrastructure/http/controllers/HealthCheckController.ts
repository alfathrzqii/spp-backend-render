import type { Request, Response, NextFunction } from "express";
import type { IDatabaseHealthIndicator } from "../../../application/ports/IDatabaseHealthIndicator.js";

export class HealthCheckController {
  constructor(private dbHealthIndicator: IDatabaseHealthIndicator) {}

  async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isDbHealthy = await this.dbHealthIndicator.isHealthy();

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
