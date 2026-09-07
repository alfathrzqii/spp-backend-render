import type { IPasswordHasher } from "../ports/IPasswordHasher.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISchoolUnitRepository } from "../../domain/repositories/ISchoolUnitRepository.js";

export interface ImportStudentRow {
  nis?: string | number;
  studentNumber?: string | number;
  nama?: string;
  name?: string;
  nama_ortu?: string;
  parentName?: string;
  kelas?: string;
  className?: string;
  unit?: string;
  schoolUnitName?: string;
  angkatan?: string | number;
  enrollmentYear?: string | number;
  diskon?: string | number;
  discountAmount?: string | number;
  discountPercentage?: string | number;
  diskon_peralatan?: string | number;
  discountEquipment?: string | number;
  diskon_ekskul?: string | number;
  discountExtracurricular?: string | number;
  tanggal_lahir?: string;
  birthDate?: string;
  hp_ortu?: string;
  parentPhoneNumber?: string;
  email_ortu?: string;
  parentEmail?: string;
}

export interface ImportStudentsResult {
  successCount: number;
  failedCount: number;
  errors: string[];
}

export class ImportStudentsUseCase {
  constructor(
    private passwordHasher: IPasswordHasher,
    private studentRepository: IStudentRepository,
    private schoolUnitRepository: ISchoolUnitRepository
  ) {}

  private formatBirthDateToPassword(birthDate: string): string {
    if (!birthDate) return "parent123";
    const clean = birthDate.trim();

    if (clean.includes("-")) {
      const parts = clean.split("-");
      if (parts[0] && parts[0].length === 4) {
        return `${parts[2]}${parts[1]}${parts[0]}`; // YYYY-MM-DD -> DDMMYYYY
      }
      return parts.join(""); // DD-MM-YYYY -> DDMMYYYY
    }

    if (clean.includes("/")) {
      const parts = clean.split("/");
      if (parts[2] && parts[2].length === 4) {
        return `${parts[0]}${parts[1]}${parts[2]}`;
      } else if (parts[0] && parts[0].length === 4) {
        return `${parts[2]}${parts[1]}${parts[0]}`;
      }
    }

    return clean.replace(/[^0-9]/g, "") || "parent123";
  }

  private getUnitIdByName(name: string): number {
    const clean = name.trim().toUpperCase();
    if (clean.includes("KB")) return 1;
    if (clean.includes("RA")) return 2;
    if (clean.includes("SD")) return 3;
    if (clean.includes("TPA")) return 4;
    return 3;
  }

  async execute(
    rows: ImportStudentRow[],
    user: { role: string; schoolUnitId: number | null }
  ): Promise<ImportStudentsResult> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]!;
      try {
        let studentNumber = (row.nis || row.studentNumber || "").toString().trim();
        let name = (row.nama || row.name || row.nama_ortu || row.parentName || "").toString().trim();
        const className = (row.kelas || row.className || "N/A").toString().trim();
        const unitName = (row.unit || row.schoolUnitName || "SD").toString().trim();
        const enrollmentYearStr = (row.angkatan || row.enrollmentYear || new Date().getFullYear()).toString().trim();
        const discountStr = (row.diskon || row.discountAmount || row.discountPercentage || "0").toString().trim();
        const discountEquipmentStr = (row.diskon_peralatan || row.discountEquipment || "0").toString().trim();
        const discountExtracurricularStr = (row.diskon_ekskul || row.discountExtracurricular || "0").toString().trim();
        const birthDate = (row.tanggal_lahir || row.birthDate || "").toString().trim();
        const parentName = (row.nama_ortu || row.parentName || `Wali dari ${name}`).toString().trim();
        let parentPhoneNumber = (row.hp_ortu || row.parentPhoneNumber || "").toString().trim();
        const parentEmail = (row.email_ortu || row.parentEmail || "").toString().trim();

        if (!name) {
          name = `Siswa ${index + 1}`;
        }

        if (!studentNumber) {
          const cleanClass = className.toUpperCase().replace(/[^A-Z]/g, "") || "KB";
          studentNumber = `${cleanClass}-${new Date().getFullYear()}-${String(index + 1).padStart(3, "0")}`;
        }

        if (!parentPhoneNumber) {
          parentPhoneNumber = `089999999${String(index + 1).padStart(3, "0")}`;
        }

        const schoolUnitId = this.getUnitIdByName(unitName);
        const enrollmentYear = Number(enrollmentYearStr) || new Date().getFullYear();
        const discountAmount = Number(discountStr) || 0;
        const discountEquipment = Number(discountEquipmentStr) || 0;
        const discountExtracurricular = Number(discountExtracurricularStr) || 0;

        if (user.role === "UNIT_ADMIN" && schoolUnitId !== user.schoolUnitId) {
          throw new Error(`Akses ditolak: Baris ${index + 1} berada pada unit yang berbeda dari kewenangan Anda`);
        }

        // Ensure school unit exists in master data to avoid FK constraint errors
        await this.schoolUnitRepository.ensureExists(schoolUnitId, unitName);

        const defaultPassword = this.formatBirthDateToPassword(birthDate);
        const passwordHash = await this.passwordHasher.hash(defaultPassword);

        await this.studentRepository.importStudentWithParent({
          studentNumber,
          name,
          className,
          schoolUnitId,
          enrollmentYear,
          discountAmount,
          discountEquipment,
          discountExtracurricular,
          birthDate,
          parentName,
          parentPhoneNumber,
          parentEmail,
          parentPasswordHash: passwordHash,
        });

        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`Baris ${index + 1}: ${err.message}`);
      }
    }

    return {
      successCount,
      failedCount,
      errors,
    };
  }
}
