import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../../../domain/errors/AppError.js";
import type { CreateStudentUseCase } from "../../../application/use-cases/CreateStudentUseCase.js";
import type { GetStudentsUseCase } from "../../../application/use-cases/GetStudentsUseCase.js";
import type { UpdateStudentUseCase } from "../../../application/use-cases/UpdateStudentUseCase.js";
import type { DeleteStudentUseCase } from "../../../application/use-cases/DeleteStudentUseCase.js";

export class StudentController {
  constructor(
    private createStudentUseCase: CreateStudentUseCase,
    private getStudentsUseCase: GetStudentsUseCase,
    private updateStudentUseCase: UpdateStudentUseCase,
    private deleteStudentUseCase: DeleteStudentUseCase
  ) {}

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        studentNumber,
        name,
        className,
        schoolUnitId,
        enrollmentYear,
        discountPercentage,
        parentName,
        parentEmail,
        parentPhoneNumber,
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
        discountPercentage,
        parentName,
        parentEmail,
        parentPhoneNumber,
      });

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
      let { schoolUnitId, search, className } = req.query;

      // Jika UNIT_ADMIN, paksa schoolUnitId miliknya
      if (req.user?.role === "UNIT_ADMIN") {
        schoolUnitId = req.user.schoolUnitId?.toString();
      }

      const filter: { schoolUnitId?: number; search?: string; className?: string } = {};
      if (schoolUnitId) {
        filter.schoolUnitId = parseInt(schoolUnitId as string);
      }
      if (search) {
        filter.search = search as string;
      }
      if (className) {
        filter.className = className as string;
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
        discountPercentage,
        birthDate,
        parentName,
        parentEmail,
        parentPhoneNumber,
      } = req.body;

      const student = await this.updateStudentUseCase.execute(
        parseInt(id),
        {
          name,
          className,
          schoolUnitId,
          enrollmentYear,
          discountPercentage,
          birthDate,
          parentName,
          parentEmail,
          parentPhoneNumber,
        },
        req.user!
      );

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

      return res.status(200).json({
        success: true,
        message: "Data siswa berhasil dihapus",
      });
    } catch (error: any) {
      next(error);
    }
  }
}
