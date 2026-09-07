import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { Student } from "../../domain/entities/Student.js";
import { NotFoundError, ForbiddenError } from "../../domain/errors/AppError.js";

export class UpdateStudentUseCase {
  constructor(
    private studentRepository: IStudentRepository,
    private invoiceRepository?: IInvoiceRepository
  ) {}

  async execute(
    id: number,
    data: {
      name?: string;
      className?: string;
      schoolUnitId?: number;
      enrollmentYear?: number;
      discountAmount?: number;
      discountEquipment?: number;
      discountExtracurricular?: number;
      registrationStatus?: string;
      isFullday?: boolean;
      birthDate?: string | null;
      parentName?: string;
      parentEmail?: string | null;
      parentPhoneNumber?: string;
      status?: string;
      sdExtracurricularIds?: number[];
    },
    user: { role: string; schoolUnitId: number | null }
  ): Promise<Student> {
    const student = await this.studentRepository.findById(id);

    if (!student) {
      throw new NotFoundError("Data siswa tidak ditemukan");
    }

    if (user.role === "UNIT_ADMIN" && student.schoolUnitId !== user.schoolUnitId) {
      throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini");
    }

    if (data.status === "CANCELED" && this.invoiceRepository) {
      await this.invoiceRepository.deletePendingByStudentId(id);
    }

    return this.studentRepository.update(id, data);
  }
}

