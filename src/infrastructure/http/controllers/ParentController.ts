import type { Request, Response, NextFunction } from "express";
import type { GetParentChildrenUseCase } from "../../../application/use-cases/GetParentChildrenUseCase.js";

export class ParentController {
  constructor(private getParentChildrenUseCase: GetParentChildrenUseCase) {}

  async getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const children = await this.getParentChildrenUseCase.execute(user.id);

      res.status(200).json({
        success: true,
        message: "Data anak berhasil diambil",
        data: children,
      });
    } catch (error) {
      next(error);
    }
  }
}
