import type { Request, Response, NextFunction } from "express";
import type { CreatePakasirTransactionUseCase } from "../../../application/use-cases/CreatePakasirTransactionUseCase.js";
import type { CheckPakasirStatusUseCase } from "../../../application/use-cases/CheckPakasirStatusUseCase.js";
import type { HandlePakasirWebhookUseCase } from "../../../application/use-cases/HandlePakasirWebhookUseCase.js";
import type { SyncPakasirTransactionsUseCase } from "../../../application/use-cases/SyncPakasirTransactionsUseCase.js";
import type { SimulatePakasirPaymentUseCase } from "../../../application/use-cases/SimulatePakasirPaymentUseCase.js";
import type { PayOnlineSimulatedUseCase } from "../../../application/use-cases/PayOnlineSimulatedUseCase.js";
import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";

export class PakasirController {
  constructor(
    private createPakasirTransactionUseCase: CreatePakasirTransactionUseCase,
    private checkPakasirStatusUseCase: CheckPakasirStatusUseCase,
    private handlePakasirWebhookUseCase: HandlePakasirWebhookUseCase,
    private syncPakasirTransactionsUseCase: SyncPakasirTransactionsUseCase,
    private simulatePakasirPaymentUseCase: SimulatePakasirPaymentUseCase,
    private payOnlineSimulatedUseCase: PayOnlineSimulatedUseCase,
    private studentRepository: IStudentRepository
  ) {}

  async createPakasirTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentNumber, paymentMethod, invoices, month, year, invoiceType } = req.body;
      const result = await this.createPakasirTransactionUseCase.execute({
        studentNumber,
        paymentMethod,
        invoices,
        month,
        year,
        invoiceType,
      });

      res.status(200).json({
        success: true,
        message: "Transaksi Pakasir berhasil dibuat",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async checkPakasirStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { order_id, amount } = req.query;
      const result = await this.checkPakasirStatusUseCase.execute({
        orderId: String(order_id || ""),
        amount: amount ? Number(amount) : undefined,
      });

      res.status(200).json({
        success: true,
        status: result.status,
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async handlePakasirWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { order_id, status, amount } = req.body;
      const result = await this.handlePakasirWebhookUseCase.execute({
        order_id,
        status,
        amount: amount ? Number(amount) : undefined,
        rawPayload: req.body,
      });

      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async syncPakasirTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      const { studentNumber } = req.body || req.query;

      let schoolUnitId: number | undefined;
      if (user && (user.role as any) === "UNIT_ADMIN") {
        schoolUnitId = user.schoolUnitId ?? undefined;
      }

      const result = await this.syncPakasirTransactionsUseCase.execute({
        studentNumber: studentNumber ? String(studentNumber) : undefined,
        schoolUnitId,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          checkedBatches: result.checkedBatches,
          syncedCount: result.syncedCount,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async simulatePakasirPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, order_id, amount } = req.body;
      const targetOrderId = String(orderId || order_id || "");

      const result = await this.simulatePakasirPaymentUseCase.execute({
        orderId: targetOrderId,
        amount: amount ? Number(amount) : undefined,
      });

      res.status(200).json({
        success: true,
        message: "Simulasi pembayaran QRIS/VA Pakasir berhasil! Status tagihan kini lunas.",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async payOnlineSimulated(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber, invoices, month, year, invoiceType } = req.body;

      const student = await this.studentRepository.findByStudentNumber(studentNumber);
      if (!student) {
        throw new NotFoundError("Siswa tidak ditemukan");
      }

      if ((user.role as any) === "PARENT") {
        if (student.parentId !== user.id) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan membayar tagihan anak Anda sendiri");
        }
      } else if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan memproses tagihan siswa unit sekolah Anda");
        }
      }

      const result = await this.payOnlineSimulatedUseCase.execute({
        studentNumber,
        invoices,
        month,
        year,
        invoiceType,
      });

      res.status(200).json({
        success: true,
        message: "Simulasi pembayaran online berhasil diproses",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
