import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IPasswordHasher } from "../ports/IPasswordHasher.js";
import type { Student } from "../../domain/entities/Student.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export interface CreateStudentRequest {
  studentNumber: string;
  name: string;
  className: string;
  schoolUnitId: number;
  enrollmentYear: number;
  discountAmount: number;
  discountEquipment?: number;
  discountExtracurricular?: number;
  registrationStatus?: string;
  isFullday?: boolean;
  parentName: string;
  parentEmail?: string;
  parentPhoneNumber: string;
  sdExtracurricularIds?: number[];
}

export class CreateStudentUseCase {
  constructor(
    private studentRepository: IStudentRepository,
    private userRepository: IUserRepository,
    private sppTariffRepository: ISppTariffRepository,
    private passwordHasher: IPasswordHasher
  ) {}

  async execute(data: CreateStudentRequest): Promise<Student> {
    // 1. Cek duplikasi studentNumber
    const existingStudent = await this.studentRepository.findByStudentNumber(
      data.studentNumber
    );
    if (existingStudent) {
      throw new BadRequestError("Gagal: Nomor induk siswa (NIS) sudah terdaftar");
    }

    // 2. Cek ketersediaan tarif dasar
    let tariff = await this.sppTariffRepository.findByUnitAndYear(
      data.schoolUnitId,
      data.enrollmentYear
    );
    if (!tariff) {
      tariff = await this.sppTariffRepository.create({
        schoolUnitId: data.schoolUnitId,
        enrollmentYear: data.enrollmentYear,
        amount: 150000,
        developmentFee: 0,
        reRegistrationFee: 0,
        equipmentFee: 0,
        extracurricularFee: 0,
        uniformFee: 0,
      });
    }

    // 3. Periksa akun parent (berdasarkan nomor HP)
    const existingParent = await this.userRepository.findByPhoneNumber(
      data.parentPhoneNumber
    );

    let parentId: number | undefined;
    let parentDataToCreate:
      | { name: string; email: string; phoneNumber: string; passwordHash: string }
      | undefined;

    if (existingParent) {
      parentId = existingParent.id;
    } else {
      const passwordHash = await this.passwordHasher.hash("parent123");
      parentDataToCreate = {
        name: data.parentName,
        email: data.parentEmail || `${data.parentPhoneNumber}@sekolah.id`, // Fallback email jika tidak ada
        phoneNumber: data.parentPhoneNumber,
        passwordHash,
      };
    }

    // 4. Simpan data siswa
    const studentPayload: any = {
      studentNumber: data.studentNumber,
      name: data.name,
      className: data.className,
      schoolUnitId: data.schoolUnitId,
      enrollmentYear: data.enrollmentYear,
      discountAmount: data.discountAmount,
      discountEquipment: data.discountEquipment || 0,
      discountExtracurricular: data.discountExtracurricular || 0,
      registrationStatus: data.registrationStatus || "BARU",
      isFullday: data.isFullday ?? false,
      parentId: parentId as any,
      status: "ACTIVE",
    };
    if (data.sdExtracurricularIds !== undefined) {
      studentPayload.sdExtracurricularIds = data.sdExtracurricularIds;
    }

    return this.studentRepository.create(
      studentPayload,
      parentDataToCreate
    );
  }
}
