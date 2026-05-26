import type { Request, Response } from "express";
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

  async create(req: Request, res: Response) {
    try {
      const {
        studentNumber,
        name,
        schoolUnitId,
        enrollmentYear,
        discountPercentage,
        parentName,
        parentEmail,
      } = req.body;

      // Isolasi unit sekolah untuk UNIT_ADMIN
      if (req.user?.role === "UNIT_ADMIN" && schoolUnitId !== req.user.schoolUnitId) {
        return res.status(403).json({
          success: false,
          message: "Akses ditolak: Anda tidak memiliki otoritas untuk mendaftarkan siswa di unit sekolah ini",
        });
      }

      const student = await this.createStudentUseCase.execute({
        studentNumber,
        name,
        schoolUnitId,
        enrollmentYear,
        discountPercentage,
        parentName,
        parentEmail,
      });

      return res.status(201).json({
        success: true,
        message: "Data siswa dan akun orang tua berhasil didaftarkan",
        data: student,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      let { schoolUnitId, search } = req.query;

      // Jika UNIT_ADMIN, paksa schoolUnitId miliknya
      if (req.user?.role === "UNIT_ADMIN") {
        schoolUnitId = req.user.schoolUnitId?.toString();
      }

      const filter: { schoolUnitId?: number; search?: string } = {};
      if (schoolUnitId) {
        filter.schoolUnitId = parseInt(schoolUnitId as string);
      }
      if (search) {
        filter.search = search as string;
      }

      const students = await this.getStudentsUseCase.execute(filter);

      return res.status(200).json({
        success: true,
        message: "Daftar data siswa berhasil diambil",
        data: students,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { name, discountPercentage } = req.body;

      const student = await this.updateStudentUseCase.execute(
        parseInt(id),
        { name, discountPercentage },
        req.user!
      );

      return res.status(200).json({
        success: true,
        message: "Data siswa berhasil diperbarui",
        data: student,
      });
    } catch (error: any) {
      const status = error.message.includes("Akses ditolak") ? 403 : 400;
      return res.status(status).json({
        success: false,
        message: error.message,
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      await this.deleteStudentUseCase.execute(parseInt(id), req.user!);

      return res.status(200).json({
        success: true,
        message: "Data siswa berhasil dihapus",
      });
    } catch (error: any) {
      const status = error.message.includes("Akses ditolak") ? 403 : 400;
      return res.status(status).json({
        success: false,
        message: error.message,
      });
    }
  }
}
