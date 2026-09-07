import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../../../domain/errors/AppError.js";
import type { CreateStudentUseCase } from "../../../application/use-cases/CreateStudentUseCase.js";
import type { GetStudentsUseCase } from "../../../application/use-cases/GetStudentsUseCase.js";
import type { UpdateStudentUseCase } from "../../../application/use-cases/UpdateStudentUseCase.js";
import type { DeleteStudentUseCase } from "../../../application/use-cases/DeleteStudentUseCase.js";
import type { ImportStudentsUseCase } from "../../../application/use-cases/ImportStudentsUseCase.js";
import { logActivity } from "../../utils/activityLogger.js";

export class StudentController {
  constructor(
    private createStudentUseCase: CreateStudentUseCase,
    private getStudentsUseCase: GetStudentsUseCase,
    private updateStudentUseCase: UpdateStudentUseCase,
    private deleteStudentUseCase: DeleteStudentUseCase,
    private importStudentsUseCase?: ImportStudentsUseCase
  ) {}

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        studentNumber,
        name,
        className,
        schoolUnitId,
        enrollmentYear,
        discountAmount,
        discountEquipment,
        discountExtracurricular,
        registrationStatus,
        isFullday,
        parentName,
        parentEmail,
        parentPhoneNumber,
        sdExtracurricularIds,
      } = req.body;

      // Isolasi unit sekolah untuk UNIT_ADMIN
      if (req.user?.role === "UNIT_ADMIN" && schoolUnitId !== req.user.schoolUnitId) {
        throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mendaftarkan siswa di unit sekolah ini");
      }

      const student = await this.createStudentUseCase.execute({
        studentNumber,
        name,
        className,
        schoolUnitId,
        enrollmentYear,
        discountAmount: Number(discountAmount || 0),
        discountEquipment: Number(discountEquipment || 0),
        discountExtracurricular: Number(discountExtracurricular || 0),
        registrationStatus: registrationStatus || "BARU",
        isFullday: Boolean(isFullday),
        parentName,
        parentEmail,
        parentPhoneNumber,
        sdExtracurricularIds,
      });

      // Log Aktivitas
      if (req.user) {
        await logActivity(
          req.user.id,
          "CREATE_STUDENT",
          `Mendaftarkan siswa baru: ${name} (NIS: ${studentNumber}) di kelas ${className}`,
          req
        );
      }

      return res.status(201).json({
        success: true,
        message: "Data siswa dan akun orang tua berhasil didaftarkan",
        data: student,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      let { schoolUnitId, search, className, discount, status, excludePpdb } = req.query;

      // Jika UNIT_ADMIN, paksa schoolUnitId miliknya
      if (req.user?.role === "UNIT_ADMIN") {
        schoolUnitId = req.user.schoolUnitId?.toString();
      }

      const filter: {
        schoolUnitId?: number;
        search?: string;
        className?: string;
        discount?: string;
        status?: string;
        excludePpdb?: boolean;
      } = {};
      if (schoolUnitId) {
        filter.schoolUnitId = parseInt(schoolUnitId as string);
      }
      if (search) {
        filter.search = search as string;
      }
      if (className) {
        filter.className = className as string;
      }
      if (discount) {
        filter.discount = discount as string;
      }
      if (status) {
        filter.status = status as string;
      }
      if (excludePpdb === "true") {
        filter.excludePpdb = true;
      }

      const students = await this.getStudentsUseCase.execute(filter);

      return res.status(200).json({
        success: true,
        message: "Daftar data siswa berhasil diambil",
        data: students,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const {
        name,
        className,
        schoolUnitId,
        enrollmentYear,
        discountAmount,
        discountEquipment,
        discountExtracurricular,
        registrationStatus,
        isFullday,
        birthDate,
        parentName,
        parentEmail,
        parentPhoneNumber,
        status,
        sdExtracurricularIds,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (className !== undefined) updateData.className = className;
      if (schoolUnitId !== undefined) updateData.schoolUnitId = schoolUnitId;
      if (enrollmentYear !== undefined) updateData.enrollmentYear = enrollmentYear;
      if (discountAmount !== undefined) updateData.discountAmount = Number(discountAmount);
      if (discountEquipment !== undefined) updateData.discountEquipment = Number(discountEquipment);
      if (discountExtracurricular !== undefined) updateData.discountExtracurricular = Number(discountExtracurricular);
      if (registrationStatus !== undefined) updateData.registrationStatus = registrationStatus;
      if (isFullday !== undefined) updateData.isFullday = Boolean(isFullday);
      if (birthDate !== undefined) updateData.birthDate = birthDate;
      if (parentName !== undefined) updateData.parentName = parentName;
      if (parentEmail !== undefined) updateData.parentEmail = parentEmail;
      if (parentPhoneNumber !== undefined) updateData.parentPhoneNumber = parentPhoneNumber;
      if (status !== undefined) updateData.status = status;
      if (sdExtracurricularIds !== undefined) updateData.sdExtracurricularIds = sdExtracurricularIds;

      const student = await this.updateStudentUseCase.execute(
        parseInt(id),
        updateData,
        req.user!
      );

      // Log Aktivitas
      if (req.user) {
        await logActivity(
          req.user.id,
          "UPDATE_STUDENT",
          `Mengupdate data siswa: ${name || student.name} (ID: ${id}) kelas ${className || student.className}`,
          req
        );
      }

      return res.status(200).json({
        success: true,
        message: "Data siswa berhasil diperbarui",
        data: student,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };

      await this.deleteStudentUseCase.execute(parseInt(id), req.user!);

      // Log Aktivitas
      if (req.user) {
        await logActivity(
          req.user.id,
          "DELETE_STUDENT",
          `Menghapus data siswa dengan ID: ${id}`,
          req
        );
      }

      return res.status(200).json({
        success: true,
        message: "Data siswa berhasil dihapus",
      });
    } catch (error: any) {
      next(error);
    }
  }

  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const { rows } = req.body;

      if (!rows || !Array.isArray(rows)) {
        res.status(400).json({
          success: false,
          message: "Format data tidak valid. Wajib menyertakan array data siswa.",
        });
        return;
      }

      if (!this.importStudentsUseCase) {
        throw new Error("ImportStudentsUseCase belum terdaftar");
      }

      const result = await this.importStudentsUseCase.execute(rows, {
        role: user.role,
        schoolUnitId: user.schoolUnitId ?? null,
      });

      res.status(200).json({
        success: true,
        message: `Import selesai. Sukses: ${result.successCount}, Gagal: ${result.failedCount}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
