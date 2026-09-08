import { BadRequestError, ForbiddenError, NotFoundError } from "../../domain/errors/AppError.js";
import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IExtraEquipmentTariffRepository } from "../../domain/repositories/IExtraEquipmentTariffRepository.js";
import type { IFulldayTariffRepository } from "../../domain/repositories/IFulldayTariffRepository.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { IPakasirService } from "../ports/IPakasirService.js";
import type { ILogger } from "../../domain/services/ILogger.js";

export interface GetStudentInvoicesDTO {
  user?: {
    id: number;
    role: string;
    schoolUnitId: number | null;
  } | undefined;
  studentNumber: string;
  year?: number | undefined;
}

export class GetStudentInvoicesUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private sppTariffRepository: ISppTariffRepository,
    private extraEquipmentTariffRepository: IExtraEquipmentTariffRepository,
    private fulldayTariffRepository: IFulldayTariffRepository,
    private userRepository: IUserRepository,
    private pakasirService: IPakasirService,
    private logger: ILogger
  ) {}

  async execute(dto: GetStudentInvoicesDTO) {
    const { user, studentNumber } = dto;
    const year = dto.year ?? new Date().getFullYear();

    if (!studentNumber) {
      throw new BadRequestError("NIS siswa harus disertakan");
    }

    const student = await this.studentRepository.findByStudentNumberWithDetails(studentNumber);

    if (!student) {
      throw new NotFoundError("Siswa tidak ditemukan");
    }

    if (user) {
      if ((user.role as any) === "PARENT") {
        if (student.parentId !== user.id) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan melihat tagihan anak Anda sendiri");
        }
      } else if ((user.role as any) === "WALI_KELAS") {
        const dbUser = await this.userRepository.findById(user.id);
        const userClassName = dbUser?.className || null;

        if (
          student.schoolUnitId !== user.schoolUnitId ||
          student.className !== userClassName
        ) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan melihat tagihan siswa kelas bimbingan Anda");
        }
      } else if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan melihat tagihan siswa unit sekolah Anda");
        }
      }
    }

    const tariff = await this.sppTariffRepository.findByUnitAndYear(
      student.schoolUnitId,
      student.enrollmentYear
    );

    if (!tariff) {
      throw new BadRequestError("Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi");
    }

    // Auto-reconcile any pending Pakasir invoices for this student
    try {
      const pendingPakasir = await this.invoiceRepository.findPendingBatchByStudentId(student.id);

      if (pendingPakasir.length > 0) {
        const studentBatchMap = new Map<string, typeof pendingPakasir>();
        for (const inv of pendingPakasir) {
          const rawId = inv.midtransOrderId || "";
          const baseId = rawId.replace(/-\d+$/, "");
          if (!studentBatchMap.has(baseId)) studentBatchMap.set(baseId, []);
          studentBatchMap.get(baseId)!.push(inv);
        }

        for (const [baseOrderId, invs] of studentBatchMap.entries()) {
          const totalAmount = invs.reduce((sum, inv) => sum + inv.amount, 0);
          const checkData = await this.pakasirService.getTransactionDetail(baseOrderId, totalAmount);
          if (checkData?.transaction?.status === "completed") {
            await this.invoiceRepository.processPaidInvoicesOnline(invs, "Auto-Sync");
          }
        }
      }
    } catch (autoSyncErr) {
      this.logger.warn(
        `Auto-sync Pakasir for student ${studentNumber} skipped: ${
          autoSyncErr instanceof Error ? autoSyncErr.message : String(autoSyncErr)
        }`
      );
    }

    // === LOGIKA PPDB (SISWA BARU / DAFTAR ULANG) ===
    if (student.className.toUpperCase() === "PPDB") {
      const dbInvoices = await this.invoiceRepository.findByStudentAndYearWithTransactions(
        student.id,
        undefined,
        [
          "UANG_PENGEMBANGAN",
          "DAFTAR_ULANG",
          "UANG_PERALATAN",
          "SPP",
          "EKSTRAKURIKULER",
          "SERAGAM",
        ] as any
      );

      const baseSppAmount = tariff.amount;
      const sppDiscountApplied = Math.min(baseSppAmount, student.discountAmount);
      const sppNetAmount = baseSppAmount - sppDiscountApplied;

      const isSd = student.schoolUnit.name.toUpperCase() === "SD" || student.schoolUnitId === 3;

      let reRegistrationFee = tariff.reRegistrationFee;

      // Fetch equipment and extracurricular fees from extra_equipment_tariffs if KB or RA
      let equipmentFee = 0;
      let extracurricularFee = 0;
      if (!isSd && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
        const level = student.schoolUnitId === 1 ? "KB" : "A"; // default to A for entry level RA in PPDB
        const extraTariff = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
          student.schoolUnitId,
          student.enrollmentYear,
          level
        );
        if (extraTariff) {
          if (student.registrationStatus === "BARU") {
            equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
            extracurricularFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
          } else if (student.registrationStatus === "NAIK_KELAS") {
            equipmentFee = extraTariff.equipmentFeePromotion || extraTariff.equipmentFee;
            extracurricularFee = extraTariff.extracurricularFeePromotion || extraTariff.extracurricularFee;
          } else if (student.registrationStatus === "TINGGAL_KELAS") {
            equipmentFee = extraTariff.equipmentFeeRepeat || extraTariff.equipmentFee;
            extracurricularFee = extraTariff.extracurricularFeeRepeat || extraTariff.extracurricularFee;
          } else {
            equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
            extracurricularFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
          }
        }
      }

      let fulldayFee = 0;
      if (student.isFullday && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
        const ft = await this.fulldayTariffRepository.findByUnitAndYear(
          student.schoolUnitId,
          student.enrollmentYear
        );
        if (ft) {
          fulldayFee = ft.monthlyFee;
        }
      }

      // Apply student-specific equipment and extracurricular discounts
      const equipDiscountApplied = Math.min(equipmentFee, student.discountEquipment || 0);
      const equipNetAmount = equipmentFee - equipDiscountApplied;

      let sdExtraFee = 0;
      if (isSd && student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
        sdExtraFee = student.sdExtracurriculars.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
      }
      const sdExtraDiscount = Math.min(sdExtraFee, student.discountExtracurricular || 0);
      const sdExtraNet = sdExtraFee - sdExtraDiscount;

      const extraDiscountApplied = isSd
        ? sdExtraDiscount
        : Math.min(extracurricularFee, student.discountExtracurricular || 0);
      const extraNetAmount = isSd ? sdExtraNet : extracurricularFee - extraDiscountApplied;

      const feeTypes = isSd
        ? [
            { type: "DAFTAR_ULANG", base: reRegistrationFee, net: reRegistrationFee, month: 7 },
            { type: "UANG_PENGEMBANGAN", base: tariff.developmentFee, net: tariff.developmentFee, month: 7 },
            { type: "SPP", base: baseSppAmount, net: sppNetAmount, month: 7 },
            ...(sdExtraFee > 0 ? [{ type: "EKSTRAKURIKULER", base: sdExtraFee, net: sdExtraNet, month: 7 }] : []),
          ]
        : [
            { type: "DAFTAR_ULANG", base: reRegistrationFee, net: reRegistrationFee, month: 7 },
            { type: "UANG_PENGEMBANGAN", base: tariff.developmentFee, net: tariff.developmentFee, month: 7 },
            { type: "SPP", base: baseSppAmount, net: sppNetAmount, month: 7 },
            { type: "UANG_PERALATAN", base: equipmentFee, net: equipNetAmount, month: 7 },
            { type: "EKSTRAKURIKULER", base: extracurricularFee, net: extraNetAmount, month: 7 },
            { type: "SERAGAM", base: tariff.uniformFee, net: tariff.uniformFee, month: 7 },
            ...(fulldayFee > 0 ? [{ type: "FULLDAY", base: fulldayFee, net: fulldayFee, month: 7 }] : []),
          ];

      const invoices: any[] = feeTypes.map((fee) => {
        const existing = dbInvoices.find((inv) => inv.invoiceType === fee.type && inv.month === fee.month);
        if (existing) {
          if (existing.status === "PENDING") {
            existing.baseAmount = fee.base;
            existing.discountApplied = fee.base - fee.net;
            existing.amount = fee.net;
          }
          return existing;
        }
        return {
          id: null,
          studentId: student.id,
          invoiceType: fee.type,
          month: fee.month,
          year: student.enrollmentYear,
          baseAmount: fee.base,
          discountApplied: fee.base - fee.net,
          amount: fee.net,
          status: "PENDING",
          midtransOrderId: null,
        };
      });

      return {
        invoices,
        allInvoices: dbInvoices,
        student,
        isPpdb: true,
      };
    }

    // === LOGIKA SPP BULANAN (SISWA AKTIF) ===
    const baseAmount = tariff.amount;
    const discountApplied = Math.min(baseAmount, student.discountAmount);
    const netAmount = baseAmount - discountApplied;

    if (year < student.enrollmentYear) {
      return {
        invoices: [],
        allInvoices: [],
        student,
        isPpdb: false,
      };
    }

    const dbInvoices = await this.invoiceRepository.findByStudentAndYearWithTransactions(
      student.id,
      year
    );

    let startMonth = 1;
    if (year === student.enrollmentYear) {
      startMonth = 7;
    } else if (year === 2026) {
      startMonth = 7;
    }

    const invoices: any[] = Array.from({ length: 12 - startMonth + 1 }, (_, i) => {
      const month = startMonth + i;
      const existing = dbInvoices.find(
        (inv) => inv.month === month && inv.invoiceType === ("SPP" as any)
      );
      if (existing) {
        if (existing.status === "PENDING" || !existing.amount || existing.amount <= 0) {
          existing.baseAmount = baseAmount;
          existing.discountApplied = discountApplied;
          existing.amount = netAmount;
        }
        return existing;
      }
      return {
        id: null,
        studentId: student.id,
        invoiceType: "SPP",
        month,
        year,
        baseAmount,
        discountApplied,
        amount: netAmount,
        status: "PENDING",
        midtransOrderId: null,
      };
    });

    // Append other annual/one-time fees for month 7 (active students)
    if (startMonth === 7) {
      const isSd = student.schoolUnitId === 3;

      // 1. DAFTAR_ULANG
      const existingRereg = dbInvoices.find((inv) => inv.invoiceType === "DAFTAR_ULANG" && inv.month === 7);
      let reRegistrationFee = tariff.reRegistrationFee;
      if (existingRereg) {
        if (existingRereg.status === "PENDING") {
          existingRereg.baseAmount = reRegistrationFee;
          existingRereg.discountApplied = 0;
          existingRereg.amount = reRegistrationFee;
        }
        invoices.push(existingRereg);
      } else {
        invoices.push({
          id: null,
          studentId: student.id,
          invoiceType: "DAFTAR_ULANG" as any,
          month: 7,
          year,
          baseAmount: reRegistrationFee,
          discountApplied: 0,
          amount: reRegistrationFee,
          status: "PENDING" as any,
          midtransOrderId: null,
        });
      }

      // 2. UANG_PENGEMBANGAN (Only for new enrollment year)
      if (year === student.enrollmentYear) {
        const existingDev = dbInvoices.find((inv) => inv.invoiceType === "UANG_PENGEMBANGAN" && inv.month === 7);
        if (existingDev) {
          if (existingDev.status === "PENDING") {
            existingDev.baseAmount = tariff.developmentFee;
            existingDev.discountApplied = 0;
            existingDev.amount = tariff.developmentFee;
          }
          invoices.push(existingDev);
        } else {
          invoices.push({
            id: null,
            studentId: student.id,
            invoiceType: "UANG_PENGEMBANGAN" as any,
            month: 7,
            year,
            baseAmount: tariff.developmentFee,
            discountApplied: 0,
            amount: tariff.developmentFee,
            status: "PENDING" as any,
            midtransOrderId: null,
          });
        }
      }

      // 3. SERAGAM (Only for new enrollment year)
      if (year === student.enrollmentYear) {
        const existingUniform = dbInvoices.find((inv) => inv.invoiceType === "SERAGAM" && inv.month === 7);
        if (existingUniform) {
          if (existingUniform.status === "PENDING") {
            existingUniform.baseAmount = tariff.uniformFee;
            existingUniform.discountApplied = 0;
            existingUniform.amount = tariff.uniformFee;
          }
          invoices.push(existingUniform);
        } else {
          invoices.push({
            id: null,
            studentId: student.id,
            invoiceType: "SERAGAM" as any,
            month: 7,
            year,
            baseAmount: tariff.uniformFee,
            discountApplied: 0,
            amount: tariff.uniformFee,
            status: "PENDING" as any,
            midtransOrderId: null,
          });
        }
      }

      // 4. UANG_PERALATAN (Only for KB and RA, year >= enrollmentYear)
      if (!isSd && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
        const level =
          student.schoolUnitId === 1
            ? "KB"
            : student.className.trim().toUpperCase().charAt(0) === "B"
            ? "B"
            : "A";
        const extraTariff = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
          student.schoolUnitId,
          student.enrollmentYear,
          level
        );

        let equipmentFee = 0;
        if (extraTariff) {
          if (student.registrationStatus === "BARU") {
            equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
          } else if (student.registrationStatus === "NAIK_KELAS") {
            equipmentFee = extraTariff.equipmentFeePromotion || extraTariff.equipmentFee;
          } else if (student.registrationStatus === "TINGGAL_KELAS") {
            equipmentFee = extraTariff.equipmentFeeRepeat || extraTariff.equipmentFee;
          } else {
            equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
          }
        }

        const discountEquip = Math.min(equipmentFee, student.discountEquipment || 0);
        const existingEquip = dbInvoices.find((inv) => inv.invoiceType === "UANG_PERALATAN" && inv.month === 7);
        if (existingEquip) {
          if (existingEquip.status === "PENDING") {
            existingEquip.baseAmount = equipmentFee;
            existingEquip.discountApplied = discountEquip;
            existingEquip.amount = equipmentFee - discountEquip;
          }
          invoices.push(existingEquip);
        } else {
          invoices.push({
            id: null,
            studentId: student.id,
            invoiceType: "UANG_PERALATAN" as any,
            month: 7,
            year,
            baseAmount: equipmentFee,
            discountApplied: discountEquip,
            amount: equipmentFee - discountEquip,
            status: "PENDING" as any,
            midtransOrderId: null,
          });
        }
      }

      // 5. EKSTRAKURIKULER
      let extraFee = 0;
      let hasExtraBilling = false;

      if (!isSd && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
        hasExtraBilling = true;
        const level =
          student.schoolUnitId === 1
            ? "KB"
            : student.className.trim().toUpperCase().charAt(0) === "B"
            ? "B"
            : "A";
        const extraTariff = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
          student.schoolUnitId,
          student.enrollmentYear,
          level
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
        // SD extracurriculars
        if (student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
          hasExtraBilling = true;
          extraFee = student.sdExtracurriculars.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
        }
      }

      if (hasExtraBilling) {
        const discountExtra = Math.min(extraFee, student.discountExtracurricular || 0);
        const existingExtra = dbInvoices.find((inv) => inv.invoiceType === "EKSTRAKURIKULER" && inv.month === 7);
        if (existingExtra) {
          if (existingExtra.status === "PENDING") {
            existingExtra.baseAmount = extraFee;
            existingExtra.discountApplied = discountExtra;
            existingExtra.amount = extraFee - discountExtra;
          }
          invoices.push(existingExtra);
        } else {
          invoices.push({
            id: null,
            studentId: student.id,
            invoiceType: "EKSTRAKURIKULER" as any,
            month: 7,
            year,
            baseAmount: extraFee,
            discountApplied: discountExtra,
            amount: extraFee - discountExtra,
            status: "PENDING" as any,
            midtransOrderId: null,
          });
        }
      }
    }

    // 6. FULLDAY (Monthly for KB & RA if student.isFullday is enabled)
    if (student.isFullday && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
      const fulldayTariff = await this.fulldayTariffRepository.findByUnitAndYear(
        student.schoolUnitId,
        student.enrollmentYear
      );
      if (fulldayTariff && fulldayTariff.monthlyFee > 0) {
        for (let m = startMonth; m <= 12; m++) {
          const existingFullday = dbInvoices.find(
            (inv) => inv.month === m && inv.invoiceType === ("FULLDAY" as any)
          );
          if (existingFullday) {
            if (existingFullday.status === "PENDING") {
              existingFullday.baseAmount = fulldayTariff.monthlyFee;
              existingFullday.discountApplied = 0;
              existingFullday.amount = fulldayTariff.monthlyFee;
            }
            invoices.push(existingFullday);
          } else {
            invoices.push({
              id: null,
              studentId: student.id,
              invoiceType: "FULLDAY" as any,
              month: m,
              year,
              baseAmount: fulldayTariff.monthlyFee,
              discountApplied: 0,
              amount: fulldayTariff.monthlyFee,
              status: "PENDING" as any,
              midtransOrderId: null,
            });
          }
        }
      }
    }

    return {
      invoices,
      allInvoices: dbInvoices,
      student,
      isPpdb: false,
    };
  }
}
