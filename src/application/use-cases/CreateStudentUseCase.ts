import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { PasswordHasher } from "../../infrastructure/services/PasswordHasher.js";
import type { Student } from "../../domain/entities/Student.js";

export interface CreateStudentRequest {
  studentNumber: string;
  name: string;
  schoolUnitId: number;
  enrollmentYear: number;
  discountPercentage: number;
  parentName: string;
  parentEmail: string;
}

export class CreateStudentUseCase {
  constructor(
    private studentRepository: IStudentRepository,
    private userRepository: IUserRepository,
    private sppTariffRepository: ISppTariffRepository,
    private passwordHasher: PasswordHasher
  ) {}

  async execute(data: CreateStudentRequest): Promise<Student> {
    // 1. Cek duplikasi studentNumber
    const existingStudent = await this.studentRepository.findByStudentNumber(
      data.studentNumber
    );
    if (existingStudent) {
      throw new Error("Gagal: Nomor induk siswa (NIS) sudah terdaftar");
    }

    // 2. Cek ketersediaan tarif dasar
    const tariff = await this.sppTariffRepository.findByUnitAndYear(
      data.schoolUnitId,
      data.enrollmentYear
    );
    if (!tariff) {
      throw new Error(
        "Gagal: Tarif dasar SPP untuk unit dan angkatan ini belum dikonfigurasi"
      );
    }

    // 3. Periksa akun parent
    const existingParent = await this.userRepository.findByEmail(data.parentEmail);

    let parentId: number | undefined;
    let parentDataToCreate: { name: string; email: string; passwordHash: string } | undefined;

    if (existingParent) {
      parentId = existingParent.id;
    } else {
      const passwordHash = await this.passwordHasher.hash("parent123");
      parentDataToCreate = {
        name: data.parentName,
        email: data.parentEmail,
        passwordHash,
      };
    }

    // 4. Simpan data siswa
    return this.studentRepository.create(
      {
        studentNumber: data.studentNumber,
        name: data.name,
        schoolUnitId: data.schoolUnitId,
        enrollmentYear: data.enrollmentYear,
        discountPercentage: data.discountPercentage,
        parentId: parentId as any, // Will be set in repo if parentDataToCreate is provided
      },
      parentDataToCreate
    );
  }
}
