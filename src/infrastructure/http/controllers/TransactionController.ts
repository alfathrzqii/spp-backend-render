import type { Request, Response, NextFunction } from "express";
import type { CreateTransactionUseCase } from "../../../application/use-cases/CreateTransactionUseCase.js";
import type { GetTransactionsUseCase } from "../../../application/use-cases/GetTransactionsUseCase.js";

export class TransactionController {
  constructor(
    private createTransactionUseCase: CreateTransactionUseCase,
    private getTransactionsUseCase: GetTransactionsUseCase
  ) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      let { type, categoryId, paymentMethod, amount, description, schoolUnitId } = req.body;

      // Logic Ekstraksi Hak Akses
      if (user.role === "UNIT_ADMIN") {
        schoolUnitId = user.schoolUnitId;
      }

      const result = await this.createTransactionUseCase.execute({
        type,
        categoryId: Number(categoryId),
        paymentMethod,
        amount: Number(amount),
        description,
        schoolUnitId: Number(schoolUnitId),
        recordedById: user.id,
      });

      res.status(201).json({
        success: true,
        message: "Transaksi buku kas berhasil dicatat",
        data: result,
      });
    } catch (error: any) {
      if (error.message === "Kategori transaksi tidak valid" || error.message === "Tipe kategori tidak cocok dengan konteks pencatatan") {
          res.status(400).json({
              success: false,
              message: error.message
          });
          return;
      }
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { type, categoryId } = req.query;
      let { schoolUnitId } = req.query;

      // Aturan Isolasi Output
      if (user.role === "UNIT_ADMIN") {
        schoolUnitId = user.schoolUnitId?.toString();
      }

      const filter: any = {};
      if (schoolUnitId) filter.schoolUnitId = Number(schoolUnitId);
      if (type) filter.type = type as string;
      if (categoryId) filter.categoryId = Number(categoryId);

      const result = await this.getTransactionsUseCase.execute(filter);

      res.status(200).json({
        success: true,
        message: "Riwayat transaksi kas berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
