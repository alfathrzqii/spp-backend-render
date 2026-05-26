import type { Request, Response, NextFunction } from "express";
import type { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";

export class InvoiceController {
  constructor(
    private processOfflinePaymentUseCase: ProcessOfflinePaymentUseCase,
    private studentRepository: IStudentRepository
  ) {}

  async payOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentId, month, year } = req.body;

      if (!studentId || !month || !year) {
        res.status(400).json({
          success: false,
          message: "studentId, month, dan year wajib diisi",
        });
        return;
      }

      // Multi-unit isolation check
      const student = await this.studentRepository.findById(Number(studentId));
      if (!student) {
        res.status(404).json({
          success: false,
          message: "Siswa tidak ditemukan",
        });
        return;
      }

      if (user.role === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          res.status(403).json({
            success: false,
            message: "Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini",
          });
          return;
        }
      }

      const result = await this.processOfflinePaymentUseCase.execute({
        studentId: Number(studentId),
        month: Number(month),
        year: Number(year),
        recordedById: user.id,
      });

      res.status(200).json({
        success: true,
        message: "Pembayaran tunai SPP offline berhasil diproses",
        data: result,
      });
    } catch (error: any) {
      if (
        error.message.startsWith("Gagal:") ||
        error.message === "Siswa tidak ditemukan"
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
}
