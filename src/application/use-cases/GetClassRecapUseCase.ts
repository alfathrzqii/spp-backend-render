import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISchoolUnitRepository } from "../../domain/repositories/ISchoolUnitRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";

export interface GetClassRecapDTO {
  user: {
    id: number;
    role: string;
    schoolUnitId: number | null;
  };
  year?: number | undefined;
  upToMonth?: number | undefined;
  schoolUnitId?: number | undefined;
  className?: string | undefined;
}

export class GetClassRecapUseCase {
  constructor(
    private studentRepository: IStudentRepository,
    private schoolUnitRepository: ISchoolUnitRepository,
    private sppTariffRepository: ISppTariffRepository,
    private invoiceRepository: IInvoiceRepository,
    private userRepository: IUserRepository
  ) {}

  async execute(dto: GetClassRecapDTO) {
    const { user } = dto;
    const year = dto.year ?? new Date().getFullYear();
    const upToMonth = dto.upToMonth ?? new Date().getMonth() + 1;

    let targetSchoolUnitId: number | undefined;
    let targetClassName: string | undefined;

    if ((user.role as any) === "WALI_KELAS") {
      const dbUser = await this.userRepository.findById(user.id);
      targetSchoolUnitId = user.schoolUnitId ?? undefined;
      targetClassName = dbUser?.className || undefined;
    } else if ((user.role as any) === "UNIT_ADMIN") {
      targetSchoolUnitId = user.schoolUnitId ?? undefined;
      if (dto.className) {
        targetClassName = String(dto.className);
      }
    } else {
      if (dto.schoolUnitId && !isNaN(Number(dto.schoolUnitId))) {
        targetSchoolUnitId = Number(dto.schoolUnitId);
      }
      if (dto.className) {
        targetClassName = String(dto.className);
      }
    }

    const students = await this.studentRepository.findStudentsWithDetails({
      schoolUnitId: targetSchoolUnitId,
      className: targetClassName,
    });

    if (students.length === 0) {
      return [];
    }

    const studentIds = students.map((s) => s.id);
    const schoolUnitIds = Array.from(new Set(students.map((s) => s.schoolUnitId)));

    // Batch query related data in parallel: SchoolUnits, SppTariffs, and Invoices
    const [schoolUnits, tariffs, dbInvoices] = await Promise.all([
      this.schoolUnitRepository.findAll(),
      this.sppTariffRepository.findBySchoolUnitIds(schoolUnitIds),
      this.invoiceRepository.findInvoicesForRecap(studentIds, year, upToMonth),
    ]);

    // Create lookup maps for instant in-memory lookups
    const unitMap = new Map<number, string>();
    schoolUnits.forEach((u) => unitMap.set(u.id, u.name));

    const tariffMap = new Map<string, number>();
    tariffs.forEach((t) => tariffMap.set(`${t.schoolUnitId}-${t.enrollmentYear}`, t.amount));

    const invoiceMap = new Map<string, typeof dbInvoices[0]>();
    dbInvoices.forEach((inv) => invoiceMap.set(`${inv.studentId}-${inv.month}`, inv));

    // Group students by class
    const classMap: Record<string, { unitId: number; className: string; students: typeof students }> = {};
    students.forEach((s) => {
      const key = `${s.schoolUnitId}-${s.className}`;
      if (!classMap[key]) {
        classMap[key] = {
          unitId: s.schoolUnitId,
          className: s.className,
          students: [],
        };
      }
      classMap[key].students.push(s);
    });

    const recap = [];

    for (const group of Object.values(classMap)) {
      const totalStudentsInClass = group.students.length;
      let studentsWithUnpaid = 0;
      let totalUnpaidMonthsClass = 0;
      let totalUnpaidNominalClass = 0;

      const schoolUnitName = unitMap.get(group.unitId) || "-";

      for (const student of group.students) {
        const tariffAmount = tariffMap.get(`${student.schoolUnitId}-${student.enrollmentYear}`);
        if (tariffAmount === undefined) continue;

        const baseAmount = tariffAmount;
        const discountApplied = Math.min(baseAmount, student.discountAmount);
        const netAmount = baseAmount - discountApplied;

        if (year < student.enrollmentYear) {
          continue;
        }

        let studentUnpaidMonths = 0;
        let studentUnpaidAmount = 0;

        let startMonth = 1;
        if (year === student.enrollmentYear) {
          startMonth = 7;
        } else if (year === 2026) {
          startMonth = 7;
        }

        for (let m = startMonth; m <= upToMonth; m++) {
          const inv = invoiceMap.get(`${student.id}-${m}`);
          if (!inv) {
            if (netAmount > 0) {
              studentUnpaidMonths++;
              studentUnpaidAmount += netAmount;
            }
          } else if ((inv.status as any) === "PENDING") {
            if (netAmount > 0) {
              studentUnpaidMonths++;
              studentUnpaidAmount += netAmount;
            }
          } else if ((inv.status as any) === "PARTIALLY_PAID") {
            const paid = inv.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            const unpaidPart = Math.max(0, inv.amount - paid);
            if (unpaidPart > 0) {
              studentUnpaidMonths++;
              studentUnpaidAmount += unpaidPart;
            }
          }
        }

        if (studentUnpaidMonths > 0) {
          studentsWithUnpaid++;
          totalUnpaidMonthsClass += studentUnpaidMonths;
          totalUnpaidNominalClass += studentUnpaidAmount;
        }
      }

      recap.push({
        schoolUnitId: group.unitId,
        schoolUnit: schoolUnitName,
        schoolUnitName: schoolUnitName,
        className: group.className,
        totalStudents: totalStudentsInClass,
        unpaidStudentsCount: studentsWithUnpaid,
        totalUnpaidMonths: totalUnpaidMonthsClass,
        totalUnpaidNominal: totalUnpaidNominalClass,
        totalUnpaidAmount: totalUnpaidNominalClass,
      });
    }

    // Sort recap by unit and class name
    recap.sort((a, b) => {
      if (a.schoolUnitId !== b.schoolUnitId) {
        return a.schoolUnitId - b.schoolUnitId;
      }
      return a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" });
    });

    return recap;
  }
}
