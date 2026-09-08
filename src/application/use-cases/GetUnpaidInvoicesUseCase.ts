import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IExtraEquipmentTariffRepository } from "../../domain/repositories/IExtraEquipmentTariffRepository.js";
import type { IFulldayTariffRepository } from "../../domain/repositories/IFulldayTariffRepository.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { InvoiceType } from "../../domain/enums/index.js";
import type { SppTariff } from "../../domain/entities/SppTariff.js";

export interface GetUnpaidInvoicesDTO {
  user: {
    id: number;
    role: string;
    schoolUnitId: number | null;
  };
  year?: number | undefined;
  upToMonth?: number | undefined;
  className?: string | undefined;
  schoolUnitId?: number | undefined;
  invoiceType?: string | undefined;
}

export class GetUnpaidInvoicesUseCase {
  constructor(
    private studentRepository: IStudentRepository,
    private invoiceRepository: IInvoiceRepository,
    private sppTariffRepository: ISppTariffRepository,
    private extraEquipmentTariffRepository: IExtraEquipmentTariffRepository,
    private fulldayTariffRepository: IFulldayTariffRepository,
    private userRepository: IUserRepository
  ) {}

  async execute(dto: GetUnpaidInvoicesDTO) {
    const { user } = dto;
    const year = dto.year ?? new Date().getFullYear();
    const upToMonth = dto.upToMonth ?? new Date().getMonth() + 1;

    let filterSchoolUnitId: number | undefined;
    let filterClassName: string | undefined;
    let filterParentId: number | undefined;
    let notClassName: string | undefined;

    if ((user.role as any) === "WALI_KELAS") {
      const dbUser = await this.userRepository.findById(user.id);
      filterSchoolUnitId = user.schoolUnitId ?? undefined;
      filterClassName = dbUser?.className || undefined;
    } else if ((user.role as any) === "UNIT_ADMIN") {
      filterSchoolUnitId = user.schoolUnitId ?? undefined;
      if (dto.className) {
        filterClassName = dto.className.trim();
      }
    } else if ((user.role as any) === "PARENT") {
      filterParentId = user.id;
    } else {
      if (dto.schoolUnitId && !isNaN(Number(dto.schoolUnitId))) {
        filterSchoolUnitId = Number(dto.schoolUnitId);
      }
      if (dto.className) {
        filterClassName = dto.className.trim();
      }
    }

    if (!dto.className) {
      notClassName = "PPDB";
    }

    const students = await this.studentRepository.findStudentsWithDetails({
      schoolUnitId: filterSchoolUnitId,
      className: filterClassName,
      parentId: filterParentId,
      notClassName,
      status: "ACTIVE",
    });

    if (students.length === 0) {
      return {
        invoiceType: ((dto.invoiceType as string) || "SPP").toUpperCase(),
        unpaidList: [],
        summary: {
          grandTotalUnpaidAmount: 0,
          grandTotalUnpaidMonthsCount: 0,
          totalStudentsCount: 0,
          totalStudentsUnpaidCount: 0,
        },
      };
    }

    const invoiceType = ((dto.invoiceType as string) || "SPP").toUpperCase() as InvoiceType;
    const studentIds = students.map((s) => s.id);
    const schoolUnitIds = Array.from(new Set(students.map((s) => s.schoolUnitId)));

    // Batch load SPP Tariffs
    const sppTariffs = await this.sppTariffRepository.findBySchoolUnitIds(schoolUnitIds);
    const tariffMap = new Map<string, SppTariff>();
    sppTariffs.forEach((t) => tariffMap.set(`${t.schoolUnitId}-${t.enrollmentYear}`, t));

    const unpaidList = [];

    if (invoiceType === "SPP") {
      // 1. SPP Bulanan - Batch query invoices
      const dbInvoices = await this.invoiceRepository.findInvoicesForUnpaidCalculation(
        studentIds,
        "SPP" as any,
        year,
        upToMonth
      );
      const studentInvoiceMap = new Map<string, typeof dbInvoices[0]>();
      dbInvoices.forEach((inv) => studentInvoiceMap.set(`${inv.studentId}-${inv.month}`, inv));

      for (const student of students) {
        const tariff = tariffMap.get(`${student.schoolUnitId}-${student.enrollmentYear}`);
        if (!tariff) continue;
        if (year < student.enrollmentYear) continue;

        const baseAmount = tariff.amount;
        const discountApplied = Math.min(baseAmount, student.discountAmount);
        const netAmount = baseAmount - discountApplied;

        let totalUnpaidMonths = 0;
        let totalUnpaidAmount = 0;
        const unpaidMonthsList = [];

        let startMonth = 1;
        if (year === student.enrollmentYear) {
          startMonth = 7;
        } else if (year === 2026) {
          startMonth = 7;
        }

        for (let m = startMonth; m <= upToMonth; m++) {
          const inv = studentInvoiceMap.get(`${student.id}-${m}`);
          if (!inv) {
            if (netAmount > 0) {
              totalUnpaidMonths++;
              totalUnpaidAmount += netAmount;
              unpaidMonthsList.push({
                month: m,
                status: "PENDING",
                totalAmount: netAmount,
                unpaidAmount: netAmount,
              });
            }
          } else if ((inv.status as any) === "PENDING") {
            if (netAmount > 0) {
              totalUnpaidMonths++;
              totalUnpaidAmount += netAmount;
              unpaidMonthsList.push({
                month: m,
                status: "PENDING",
                totalAmount: netAmount,
                unpaidAmount: netAmount,
              });
            }
          } else if ((inv.status as any) === "PARTIALLY_PAID") {
            const paid = inv.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            const unpaidPart = Math.max(0, inv.amount - paid);
            if (unpaidPart > 0) {
              totalUnpaidMonths++;
              totalUnpaidAmount += unpaidPart;
              unpaidMonthsList.push({
                month: m,
                status: "PARTIALLY_PAID",
                totalAmount: inv.amount,
                unpaidAmount: unpaidPart,
              });
            }
          }
        }

        if (totalUnpaidMonths > 0) {
          unpaidList.push({
            id: student.id,
            studentNumber: student.studentNumber,
            name: student.name,
            className: student.className,
            schoolUnitId: student.schoolUnitId,
            schoolUnitName: student.schoolUnit.name,
            parentName: student.parent?.name || "-",
            parentPhoneNumber: student.parent?.phoneNumber || "-",
            parentEmail: student.parent?.email || null,
            invoiceType: "SPP",
            totalAmount: netAmount * totalUnpaidMonths,
            paidAmount: 0,
            unpaidAmount: totalUnpaidAmount,
            status: unpaidMonthsList.some((m) => m.status === "PARTIALLY_PAID") ? "PARTIALLY_PAID" : "PENDING",
            unpaidMonths: unpaidMonthsList,
            totalUnpaidAmount,
            totalUnpaidCount: totalUnpaidMonths,
          });
        }
      }
    } else if (invoiceType === "FULLDAY") {
      // 2. FULLDAY Bulanan - Batch query tariffs & invoices
      const fulldayTariffs = await this.fulldayTariffRepository.findAll();
      const fulldayMap = new Map<string, number>();
      fulldayTariffs.forEach((ft) => fulldayMap.set(`${ft.schoolUnitId}-${ft.enrollmentYear}`, ft.monthlyFee));

      const dbInvoices = await this.invoiceRepository.findInvoicesForUnpaidCalculation(
        studentIds,
        "FULLDAY" as any,
        year,
        upToMonth
      );
      const studentInvoiceMap = new Map<string, typeof dbInvoices[0]>();
      dbInvoices.forEach((inv) => studentInvoiceMap.set(`${inv.studentId}-${inv.month}`, inv));

      for (const student of students) {
        if (!student.isFullday) continue;
        if (year < student.enrollmentYear) continue;

        let fulldayFee = 0;
        if (student.schoolUnitId === 1 || student.schoolUnitId === 2) {
          fulldayFee = fulldayMap.get(`${student.schoolUnitId}-${student.enrollmentYear}`) || 0;
        }

        if (fulldayFee <= 0) continue;

        let totalUnpaidMonths = 0;
        let totalUnpaidAmount = 0;
        const unpaidMonthsList = [];

        let startMonth = 1;
        if (year === student.enrollmentYear) {
          startMonth = 7;
        } else if (year === 2026) {
          startMonth = 7;
        }

        for (let m = startMonth; m <= upToMonth; m++) {
          const inv = studentInvoiceMap.get(`${student.id}-${m}`);
          if (!inv) {
            totalUnpaidMonths++;
            totalUnpaidAmount += fulldayFee;
            unpaidMonthsList.push({
              month: m,
              status: "PENDING",
              totalAmount: fulldayFee,
              unpaidAmount: fulldayFee,
            });
          } else if ((inv.status as any) === "PENDING") {
            totalUnpaidMonths++;
            totalUnpaidAmount += fulldayFee;
            unpaidMonthsList.push({
              month: m,
              status: "PENDING",
              totalAmount: fulldayFee,
              unpaidAmount: fulldayFee,
            });
          } else if ((inv.status as any) === "PARTIALLY_PAID") {
            const paid = inv.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            const unpaidPart = Math.max(0, inv.amount - paid);
            if (unpaidPart > 0) {
              totalUnpaidMonths++;
              totalUnpaidAmount += unpaidPart;
              unpaidMonthsList.push({
                month: m,
                status: "PARTIALLY_PAID",
                totalAmount: inv.amount,
                unpaidAmount: unpaidPart,
              });
            }
          }
        }

        if (totalUnpaidMonths > 0) {
          unpaidList.push({
            id: student.id,
            studentNumber: student.studentNumber,
            name: student.name,
            className: student.className,
            schoolUnitId: student.schoolUnitId,
            schoolUnitName: student.schoolUnit.name,
            parentName: student.parent?.name || "-",
            parentPhoneNumber: student.parent?.phoneNumber || "-",
            parentEmail: student.parent?.email || null,
            invoiceType: "FULLDAY",
            totalAmount: fulldayFee * totalUnpaidMonths,
            paidAmount: 0,
            unpaidAmount: totalUnpaidAmount,
            status: unpaidMonthsList.some((m) => m.status === "PARTIALLY_PAID") ? "PARTIALLY_PAID" : "PENDING",
            unpaidMonths: unpaidMonthsList,
            totalUnpaidAmount,
            totalUnpaidCount: totalUnpaidMonths,
          });
        }
      }
    } else {
      // 3. Non-Monthly (UANG_PENGEMBANGAN, EKSTRAKURIKULER, DAFTAR_ULANG, UANG_PERALATAN, SERAGAM)
      const extraTariffs =
        invoiceType === "UANG_PERALATAN" || invoiceType === "EKSTRAKURIKULER"
          ? await this.extraEquipmentTariffRepository.findAll()
          : [];
      const extraMap = new Map<string, typeof extraTariffs[0]>();
      extraTariffs.forEach((et) =>
        extraMap.set(`${et.schoolUnitId}-${et.enrollmentYear}-${et.level}`, et)
      );

      // Batch query non-monthly invoices for all student IDs
      const dbInvoices = await this.invoiceRepository.findInvoicesForUnpaidCalculation(
        studentIds,
        invoiceType
      );
      const studentInvoiceMap = new Map<string, typeof dbInvoices[0]>();
      dbInvoices.forEach((inv) => studentInvoiceMap.set(`${inv.studentId}-${inv.year}`, inv));

      for (const student of students) {
        const tariff = tariffMap.get(`${student.schoolUnitId}-${student.enrollmentYear}`);
        if (!tariff) continue;

        let baseAmount = 0;
        let discountApplied = 0;

        if (invoiceType === "UANG_PENGEMBANGAN") {
          if (year < student.enrollmentYear) continue;
          baseAmount = tariff.developmentFee || 0;
          discountApplied = 0;
        } else if (invoiceType === "DAFTAR_ULANG") {
          if (year < student.enrollmentYear) continue;
          baseAmount = tariff.reRegistrationFee || 0;
          discountApplied = 0;
        } else if (invoiceType === "SERAGAM") {
          if (year < student.enrollmentYear) continue;
          baseAmount = tariff.uniformFee || 0;
          discountApplied = 0;
        } else if (invoiceType === "UANG_PERALATAN") {
          if (year < student.enrollmentYear) continue;
          let equipFee = 0;
          if (student.schoolUnitId === 1 || student.schoolUnitId === 2) {
            const level =
              student.schoolUnitId === 1
                ? "KB"
                : student.className.trim().toUpperCase().charAt(0) === "B"
                ? "B"
                : "A";
            const extraTariff = extraMap.get(
              `${student.schoolUnitId}-${student.enrollmentYear}-${level}`
            );
            if (extraTariff) {
              if (student.registrationStatus === "BARU") {
                equipFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
              } else if (student.registrationStatus === "NAIK_KELAS") {
                equipFee = extraTariff.equipmentFeePromotion || extraTariff.equipmentFee;
              } else if (student.registrationStatus === "TINGGAL_KELAS") {
                equipFee = extraTariff.equipmentFeeRepeat || extraTariff.equipmentFee;
              } else {
                equipFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
              }
            }
          }
          baseAmount = equipFee;
          discountApplied = Math.min(baseAmount, student.discountEquipment || 0);
        } else if (invoiceType === "EKSTRAKURIKULER") {
          if (year < student.enrollmentYear) continue;
          let extraFee = 0;
          if (student.schoolUnitId === 1 || student.schoolUnitId === 2) {
            const level =
              student.schoolUnitId === 1
                ? "KB"
                : student.className.trim().toUpperCase().charAt(0) === "B"
                ? "B"
                : "A";
            const extraTariff = extraMap.get(
              `${student.schoolUnitId}-${student.enrollmentYear}-${level}`
            );
            if (extraTariff) {
              if (student.registrationStatus === "BARU") {
                extraFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
              } else if (student.registrationStatus === "NAIK_KELAS") {
                extraFee = extraTariff.extracurricularFeePromotion || extraTariff.extracurricularFee;
              } else if (student.registrationStatus === "TINGGAL_KELAS") {
                extraFee = extraTariff.extracurricularFeeRepeat || extraTariff.extracurricularFee;
              } else {
                extraFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
              }
            }
          } else if (student.schoolUnitId === 3) {
            if (student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
              extraFee = student.sdExtracurriculars.reduce(
                (sum: number, e: any) => sum + (e.fee || 0),
                0
              );
            }
          }
          baseAmount = extraFee;
          discountApplied = Math.min(baseAmount, student.discountExtracurricular || 0);
        }

        const netAmount = Math.max(0, baseAmount - discountApplied);
        if (netAmount <= 0) continue;

        const targetYear =
          invoiceType === "UANG_PENGEMBANGAN" || invoiceType === "SERAGAM"
            ? student.enrollmentYear
            : year;

        const dbInvoice = studentInvoiceMap.get(`${student.id}-${targetYear}`);

        let paidAmount = 0;
        if (dbInvoice) {
          paidAmount = dbInvoice.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        }

        const unpaidAmount = Math.max(0, netAmount - paidAmount);
        if (unpaidAmount > 0) {
          const status = paidAmount > 0 ? "PARTIALLY_PAID" : "PENDING";
          unpaidList.push({
            id: student.id,
            studentNumber: student.studentNumber,
            name: student.name,
            className: student.className,
            schoolUnitId: student.schoolUnitId,
            schoolUnitName: student.schoolUnit.name,
            parentName: student.parent?.name || "-",
            parentPhoneNumber: student.parent?.phoneNumber || "-",
            parentEmail: student.parent?.email || null,
            invoiceType,
            baseAmount,
            discountApplied,
            totalAmount: netAmount,
            paidAmount,
            unpaidAmount,
            status,
            unpaidMonths: [],
            totalUnpaidAmount: unpaidAmount,
            totalUnpaidCount: 1,
          });
        }
      }
    }

    let grandTotalUnpaidAmount = 0;
    let grandTotalUnpaidMonthsCount = 0;
    let totalStudentsUnpaidCount = 0;

    for (const item of unpaidList) {
      grandTotalUnpaidAmount += item.totalUnpaidAmount;
      grandTotalUnpaidMonthsCount += item.unpaidMonths.length;
      totalStudentsUnpaidCount++;
    }

    const summary = {
      grandTotalUnpaidAmount,
      grandTotalUnpaidMonthsCount,
      totalStudentsCount: students.length,
      totalStudentsUnpaidCount,
    };

    return {
      invoiceType,
      unpaidList,
      summary,
    };
  }
}
