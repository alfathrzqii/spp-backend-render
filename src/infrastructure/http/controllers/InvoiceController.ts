import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";
import type { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import type { GetAllInvoicesUseCase } from "../../../application/use-cases/GetAllInvoicesUseCase.js";
import type { UpdateInvoiceStatusUseCase } from "../../../application/use-cases/UpdateInvoiceStatusUseCase.js";
import type { DeleteInvoiceUseCase } from "../../../application/use-cases/DeleteInvoiceUseCase.js";
import type { GetUnpaidInvoicesUseCase } from "../../../application/use-cases/GetUnpaidInvoicesUseCase.js";
import type { GetClassRecapUseCase } from "../../../application/use-cases/GetClassRecapUseCase.js";
import type { GetStudentInvoicesUseCase } from "../../../application/use-cases/GetStudentInvoicesUseCase.js";
import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";

export class InvoiceController {
  constructor(
    private processOfflinePaymentUseCase: ProcessOfflinePaymentUseCase,
    private studentRepository: IStudentRepository,
    private getAllInvoicesUseCase: GetAllInvoicesUseCase,
    private updateInvoiceStatusUseCase: UpdateInvoiceStatusUseCase,
    private deleteInvoiceUseCase: DeleteInvoiceUseCase,
    private getUnpaidInvoicesUseCase: GetUnpaidInvoicesUseCase,
    private getClassRecapUseCase: GetClassRecapUseCase,
    private getStudentInvoicesUseCase: GetStudentInvoicesUseCase
  ) {}

  async payOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber, month, year, invoiceType, paymentAmount, paymentMethod } = req.body;

      const student = await this.studentRepository.findByStudentNumber(studentNumber);
      if (!student) {
        throw new NotFoundError("Siswa tidak ditemukan");
      }

      if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini");
        }
      }

      const yearNum = Number(year);
      const monthNum = Number(month);

      if (
        yearNum < student.enrollmentYear ||
        (yearNum === student.enrollmentYear && monthNum < 7) ||
        (yearNum === 2026 && monthNum < 7)
      ) {
        res.status(400).json({
          success: false,
          message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)",
        });
        return;
      }

      let method: "CASH" | "TRANSFER" = "CASH";
      if (paymentMethod && (paymentMethod.toUpperCase() === "TRANSFER" || paymentMethod.toLowerCase() === "tf_manual")) {
        method = "TRANSFER";
      }

      const result = await this.processOfflinePaymentUseCase.execute({
        studentId: student.id,
        month: Number(month),
        year: Number(year),
        recordedById: user.id,
        invoiceType: invoiceType as any,
        paymentAmount: paymentAmount !== undefined ? Number(paymentAmount) : undefined,
        paymentMethod: method as any,
      });

      res.status(200).json({
        success: true,
        message: method === "TRANSFER"
          ? "Pembayaran SPP via transfer bank manual berhasil diproses"
          : "Pembayaran tunai SPP offline berhasil diproses",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getUnpaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const year = req.query.year ? Number(req.query.year) : undefined;
      const upToMonth = req.query.upToMonth ? Number(req.query.upToMonth) : undefined;
      const className = req.query.className ? String(req.query.className) : undefined;
      const schoolUnitId = req.query.schoolUnitId ? Number(req.query.schoolUnitId) : undefined;
      const invoiceType = req.query.invoiceType ? String(req.query.invoiceType) : undefined;

      const result = await this.getUnpaidInvoicesUseCase.execute({
        user: {
          id: user.id,
          role: user.role,
          schoolUnitId: user.schoolUnitId,
        },
        year,
        upToMonth,
        className,
        schoolUnitId,
        invoiceType,
      });

      res.status(200).json({
        success: true,
        message: `Laporan tunggakan ${result.invoiceType} berhasil diambil`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClassRecap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const year = req.query.year ? Number(req.query.year) : undefined;
      const upToMonth = req.query.upToMonth ? Number(req.query.upToMonth) : undefined;
      const schoolUnitId = req.query.schoolUnitId ? Number(req.query.schoolUnitId) : undefined;
      const className = req.query.className ? String(req.query.className) : undefined;

      const recap = await this.getClassRecapUseCase.execute({
        user: {
          id: user.id,
          role: user.role,
          schoolUnitId: user.schoolUnitId,
        },
        year,
        upToMonth,
        schoolUnitId,
        className,
      });

      res.status(200).json({
        success: true,
        message: "Rekap tunggakan SPP per kelas berhasil diambil",
        data: recap,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudentInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      const studentNumber = req.params["studentNumber"] as string;
      const year = req.query.year ? Number(req.query.year) : undefined;

      const result = await this.getStudentInvoicesUseCase.execute({
        user: user
          ? {
              id: user.id,
              role: user.role,
              schoolUnitId: user.schoolUnitId,
            }
          : undefined,
        studentNumber,
        year,
      });

      res.status(200).json({
        success: true,
        message: result.isPpdb
          ? "Daftar invoice PPDB siswa berhasil diambil"
          : "Daftar invoice SPP siswa berhasil diambil",
        data: result.invoices,
        allInvoices: result.allInvoices,
        student: result.student,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { status, paymentMethod } = req.body;

      let method: any = "CASH";
      if (paymentMethod && (paymentMethod.toUpperCase() === "TRANSFER" || paymentMethod.toLowerCase() === "tf_manual")) {
        method = "TRANSFER";
      }

      const updatedInvoice = await this.updateInvoiceStatusUseCase.execute({
        invoiceId: parseInt(id),
        status,
        paymentMethod: method,
        recordedById: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: "Status tagihan berhasil diperbarui",
        data: updatedInvoice,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      await this.deleteInvoiceUseCase.execute(parseInt(id));
      res.status(200).json({
        success: true,
        message: "Tagihan dan seluruh riwayat pembayarannya berhasil dihapus",
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getAllInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { schoolUnitId, className, status, month, year, search, invoiceType, page = "1", limit = "50" } = req.query;

      let parsedSchoolUnitId: number | undefined;
      if (req.user?.role === "UNIT_ADMIN") {
        parsedSchoolUnitId = req.user.schoolUnitId ?? undefined;
      } else if (schoolUnitId) {
        parsedSchoolUnitId = parseInt(schoolUnitId as string);
      }

      const result = await this.getAllInvoicesUseCase.execute({
        schoolUnitId: parsedSchoolUnitId,
        className: className as string | undefined,
        status: status as any,
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        search: search as string | undefined,
        invoiceType: invoiceType as any,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      res.status(200).json({
        success: true,
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
