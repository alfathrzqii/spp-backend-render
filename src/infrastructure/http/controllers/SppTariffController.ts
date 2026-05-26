import type { Request, Response, NextFunction } from "express";
import { CreateSppTariffUseCase } from "../../../application/use-cases/CreateSppTariffUseCase.js";
import { GetSppTariffsUseCase } from "../../../application/use-cases/GetSppTariffsUseCase.js";
import { UpdateSppTariffUseCase } from "../../../application/use-cases/UpdateSppTariffUseCase.js";
import { DeleteSppTariffUseCase } from "../../../application/use-cases/DeleteSppTariffUseCase.js";

export class SppTariffController {
  constructor(
    private createSppTariffUseCase: CreateSppTariffUseCase,
    private getSppTariffsUseCase: GetSppTariffsUseCase,
    private updateSppTariffUseCase: UpdateSppTariffUseCase,
    private deleteSppTariffUseCase: DeleteSppTariffUseCase
  ) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { schoolUnitId, enrollmentYear, amount } = req.body;
      const result = await this.createSppTariffUseCase.execute({
        schoolUnitId,
        enrollmentYear,
        amount,
      });

      res.status(201).json({
        success: true,
        message: "Tarif SPP berhasil ditambahkan",
        data: result,
      });
    } catch (error: any) {
      if (
        error.message ===
        "Gagal: Tarif SPP untuk unit dan angkatan tersebut sudah terdaftar"
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { schoolUnitId } = req.query;
      const filter = schoolUnitId
        ? { schoolUnitId: Number(schoolUnitId) }
        : undefined;
      const result = await this.getSppTariffsUseCase.execute(filter);

      res.status(200).json({
        success: true,
        message: "Daftar tarif SPP berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const result = await this.updateSppTariffUseCase.execute(
        Number(id),
        amount
      );

      res.status(200).json({
        success: true,
        message: "Tarif SPP berhasil diperbarui",
        data: result,
      });
    } catch (error: any) {
      if (error.message === "Tarif SPP tidak ditemukan") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.deleteSppTariffUseCase.execute(Number(id));

      res.status(200).json({
        success: true,
        message: "Tarif SPP berhasil dihapus",
      });
    } catch (error: any) {
      if (error.message === "Tarif SPP tidak ditemukan") {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }
}
