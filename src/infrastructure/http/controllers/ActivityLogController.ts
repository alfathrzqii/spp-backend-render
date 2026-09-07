import type { Request, Response, NextFunction } from "express";
import type { GetActivityLogsUseCase } from "../../../application/use-cases/GetActivityLogsUseCase.js";

export class ActivityLogController {
  constructor(private getActivityLogsUseCase: GetActivityLogsUseCase) {}

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const action = typeof req.query.action === "string" ? req.query.action : undefined;
      const limitVal = typeof req.query.limit === "string" ? parseInt(req.query.limit) : undefined;
      const pageVal = typeof req.query.page === "string" ? parseInt(req.query.page) : undefined;

      const result = await this.getActivityLogsUseCase.execute({
        search,
        action,
        limit: limitVal,
        page: pageVal,
      });

      res.status(200).json({
        success: true,
        message: "Data log aktivitas berhasil diambil",
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}
