import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IReRegistrationTariffRepository } from "../../domain/repositories/IReRegistrationTariffRepository.js";
import type { IExtraEquipmentTariffRepository } from "../../domain/repositories/IExtraEquipmentTariffRepository.js";
import { InvoiceType, InvoiceStatus, PaymentMethod } from "../../domain/enums/index.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../domain/errors/AppError.js";

export interface PayOnlineSimulatedInput {
  studentNumber: string;
  invoices?: Array<{ month: number; year: number; invoiceType: string }> | undefined;
  month?: number | undefined;
  year?: number | undefined;
  invoiceType?: string | undefined;
  user?: {
    id: number;
    role: string;
    schoolUnitId: number | null;
  } | undefined;
}

export class PayOnlineSimulatedUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private sppTariffRepository: ISppTariffRepository,
    private reRegistrationTariffRepository?: IReRegistrationTariffRepository,
    private extraEquipmentTariffRepository?: IExtraEquipmentTariffRepository
  ) {}

  async execute(input: PayOnlineSimulatedInput) {
    const { studentNumber, user } = input;

    const student = await this.studentRepository.findByStudentNumber(studentNumber);
    if (!student) {
      throw new NotFoundError("Siswa tidak ditemukan");
    }

    if (user) {
      if ((user.role as any) === "PARENT") {
        if (student.parentId !== user.id) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan membayar tagihan anak Anda sendiri");
        }
      } else if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          throw new ForbiddenError("Akses ditolak: Anda hanya diizinkan memproses tagihan siswa unit sekolah Anda");
        }
      }
    }

    let invoiceItems: Array<{ month: number; year: number; invoiceType: string }> = [];
    if (Array.isArray(input.invoices) && input.invoices.length > 0) {
      invoiceItems = input.invoices;
    } else {
      if (!input.month || !input.year) {
        throw new BadRequestError("Parameter tidak lengkap");
      }
      invoiceItems = [{
        month: Number(input.month),
        year: Number(input.year),
        invoiceType: input.invoiceType || "SPP",
      }];
    }

    const tariff = await this.sppTariffRepository.findByUnitAndYear(
      student.schoolUnitId,
      student.enrollmentYear
    );

    let totalAmountToPay = 0;
    const verifiedInvoices: any[] = [];

    for (const item of invoiceItems) {
      const { month: itemMonth, year: itemYear, invoiceType: itemType } = item;

      const existingInvoice = await this.invoiceRepository.findByUniqueComposite(
        student.id,
        Number(itemMonth),
        Number(itemYear),
        itemType as InvoiceType
      );

      if (existingInvoice && existingInvoice.status === InvoiceStatus.PAID) {
        throw new BadRequestError(`Gagal: Tagihan ${itemType} siswa untuk periode tersebut sudah lunas`);
      }

      let baseAmount = 0;
      let discountApplied = 0;
      let amountToPay = 0;

      if (existingInvoice) {
        amountToPay = existingInvoice.amount;
        baseAmount = existingInvoice.baseAmount;
        discountApplied = existingInvoice.discountApplied;
      } else {
        let discountVal = 0;
        if (itemType === "SPP") {
          baseAmount = tariff ? Number(tariff.amount) : 185000;
          discountVal = student ? Number(student.discountAmount) : 0;
        } else if (itemType === "UANG_PENGEMBANGAN") {
          baseAmount = tariff ? Number(tariff.developmentFee) : 0;
        } else if (itemType === "DAFTAR_ULANG") {
          if (this.reRegistrationTariffRepository) {
            const rereg = await this.reRegistrationTariffRepository.findByUnitAndYear(
              student.schoolUnitId,
              student.enrollmentYear
            );
            if (rereg) {
              baseAmount = student.registrationStatus === "BARU"
                ? rereg.newStudentFee
                : student.registrationStatus === "NAIK_KELAS"
                ? rereg.promotionFee
                : rereg.repeatFee;
            } else {
              baseAmount = tariff ? Number(tariff.reRegistrationFee) : 0;
            }
          } else {
            baseAmount = tariff ? Number(tariff.reRegistrationFee) : 0;
          }
        } else if (itemType === "UANG_PERALATAN") {
          let equipFee = 0;
          if ((student.schoolUnitId === 1 || student.schoolUnitId === 2) && this.extraEquipmentTariffRepository) {
            const level = student.schoolUnitId === 1
              ? "KB"
              : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
            const extra = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
              student.schoolUnitId,
              student.enrollmentYear,
              level
            );
            equipFee = extra?.equipmentFee ?? 0;
          }
          baseAmount = equipFee;
          discountVal = student ? Number(student.discountEquipment || 0) : 0;
        } else if (itemType === "EKSTRAKURIKULER") {
          let extraFee = 0;
          if ((student.schoolUnitId === 1 || student.schoolUnitId === 2) && this.extraEquipmentTariffRepository) {
            const level = student.schoolUnitId === 1
              ? "KB"
              : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
            const extra = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
              student.schoolUnitId,
              student.enrollmentYear,
              level
            );
            extraFee = extra?.extracurricularFee ?? 0;
          }
          baseAmount = extraFee;
          discountVal = student ? Number(student.discountExtracurricular || 0) : 0;
        } else if (itemType === "SERAGAM") {
          baseAmount = tariff ? Number(tariff.uniformFee) : 0;
        }

        discountApplied = Math.min(baseAmount, discountVal);
        const calculated = baseAmount - discountApplied;
        amountToPay = isNaN(calculated) || calculated <= 0 ? 1000 : Math.round(calculated);
      }

      totalAmountToPay += amountToPay;
      verifiedInvoices.push({
        month: Number(itemMonth),
        year: Number(itemYear),
        invoiceType: itemType as InvoiceType,
        baseAmount,
        discountApplied,
        amountToPay,
        existingInvoiceId: existingInvoice?.id,
      });
    }

    const mockOrderId = `SIMULATED-${Date.now()}`;
    await this.invoiceRepository.upsertPendingBatchInvoices(
      student.id,
      mockOrderId,
      verifiedInvoices
    );

    // Langsung lunaskan dengan batch processor online
    const createdInvoices = await this.invoiceRepository.findByOrderIdPrefix(mockOrderId);
    await this.invoiceRepository.processPaidInvoicesOnline(
      createdInvoices,
      "Simulasi Midtrans",
      PaymentMethod.MIDTRANS
    );

    return {
      invoiceId: createdInvoices[0]?.id || null,
      studentId: student.id,
      amountPaid: totalAmountToPay,
      midtransOrderId: mockOrderId,
    };
  }
}
