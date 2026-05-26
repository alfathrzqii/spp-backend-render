import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { Student } from "../../domain/entities/Student.js";

export class UpdateStudentUseCase {
  constructor(private studentRepository: IStudentRepository) {}

  async execute(
    id: number,
    data: { name?: string; discountPercentage?: number },
    user: { role: string; schoolUnitId: number | null }
  ): Promise<Student> {
    const student = await this.studentRepository.findById(id);

    if (!student) {
      throw new Error("Data siswa tidak ditemukan");
    }

    if (user.role === "UNIT_ADMIN" && student.schoolUnitId !== user.schoolUnitId) {
      throw new Error("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini");
    }

    return this.studentRepository.update(id, data);
  }
}
