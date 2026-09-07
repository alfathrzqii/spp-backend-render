import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IReRegistrationTariffRepository } from "../../domain/repositories/IReRegistrationTariffRepository.js";
import type { IExtraEquipmentTariffRepository } from "../../domain/repositories/IExtraEquipmentTariffRepository.js";
import type { IFulldayTariffRepository } from "../../domain/repositories/IFulldayTariffRepository.js";
import type { IPakasirService } from "../ports/IPakasirService.js";
import { InvoiceType, InvoiceStatus } from "../../domain/enums/index.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export interface CreatePakasirTransactionInput {
  studentNumber: string;
  paymentMethod: string;
  invoices?: Array<{ month: number; year: number; invoiceType: string }> | undefined;
  month?: number | undefined;
  year?: number | undefined;
  invoiceType?: string | undefined;
}

export class CreatePakasirTransactionUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private sppTariffRepository: ISppTariffRepository,
    private pakasirService: IPakasirService,
    private reRegistrationTariffRepository?: IReRegistrationTariffRepository,
    private extraEquipmentTariffRepository?: IExtraEquipmentTariffRepository,
    private fulldayTariffRepository?: IFulldayTariffRepository
  ) {}

  async execute(input: CreatePakasirTransactionInput) {
    const { studentNumber, paymentMethod } = input;

    if (!studentNumber || !paymentMethod) {
      throw new BadRequestError("Parameter tidak lengkap");
    }

    const student = await this.studentRepository.findByStudentNumber(studentNumber);
    if (!student) {
      throw new NotFoundError("Siswa tidak ditemukan");
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

    // Cek batas periode pendaftaran siswa
    for (const item of invoiceItems) {
      if (item.invoiceType === "SPP") {
        const itemYear = Number(item.year);
        const itemMonth = Number(item.month);
        if (
          itemYear < student.enrollmentYear ||
          (itemYear === student.enrollmentYear && itemMonth < 7) ||
          (itemYear === 2026 && itemMonth < 7)
        ) {
          throw new BadRequestError("Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)");
        }
      }
    }

    const tariff = await this.sppTariffRepository.findByUnitAndYear(
      student.schoolUnitId,
      student.enrollmentYear
    );

    if (!tariff) {
      throw new BadRequestError("Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi");
    }

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
          const rawBaseAmount = tariff ? Number(tariff.amount) : 0;
          baseAmount = isNaN(rawBaseAmount) || rawBaseAmount <= 0 ? 185000 : rawBaseAmount;
          const rawDiscount = student ? Number(student.discountAmount) : 0;
          discountVal = isNaN(rawDiscount) ? 0 : rawDiscount;
        } else if (itemType === "UANG_PENGEMBANGAN") {
          baseAmount = tariff ? Number(tariff.developmentFee) : 0;
        } else if (itemType === "DAFTAR_ULANG") {
          if (this.reRegistrationTariffRepository) {
            const reregTariff = await this.reRegistrationTariffRepository.findByUnitAndYear(
              student.schoolUnitId,
              student.enrollmentYear
            );
            if (reregTariff) {
              if (student.registrationStatus === "BARU") {
                baseAmount = reregTariff.newStudentFee;
              } else if (student.registrationStatus === "NAIK_KELAS") {
                baseAmount = reregTariff.promotionFee;
              } else if (student.registrationStatus === "TINGGAL_KELAS") {
                baseAmount = reregTariff.repeatFee;
              } else {
                baseAmount = reregTariff.newStudentFee;
              }
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
            const extraTariff = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
              student.schoolUnitId,
              student.enrollmentYear,
              level
            );
            equipFee = extraTariff?.equipmentFee ?? 0;
          }
          baseAmount = equipFee;
          discountVal = student ? Number(student.discountEquipment || 0) : 0;
        } else if (itemType === "EKSTRAKURIKULER") {
          let extraFee = 0;
          if ((student.schoolUnitId === 1 || student.schoolUnitId === 2) && this.extraEquipmentTariffRepository) {
            const level = student.schoolUnitId === 1 
              ? "KB" 
              : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
            const extraTariff = await this.extraEquipmentTariffRepository.findByUnitYearAndLevel(
              student.schoolUnitId,
              student.enrollmentYear,
              level
            );
            extraFee = extraTariff?.extracurricularFee ?? 0;
          }
          baseAmount = extraFee;
          discountVal = student ? Number(student.discountExtracurricular || 0) : 0;
        } else if (itemType === "SERAGAM") {
          baseAmount = tariff ? Number(tariff.uniformFee) : 0;
        } else if (itemType === "FULLDAY") {
          let fulldayFee = 0;
          if ((student.schoolUnitId === 1 || student.schoolUnitId === 2) && this.fulldayTariffRepository) {
            const ft = await this.fulldayTariffRepository.findByUnitAndYear(
              student.schoolUnitId,
              student.enrollmentYear
            );
            fulldayFee = ft ? ft.monthlyFee : 0;
          }
          baseAmount = fulldayFee;
        }

        discountApplied = Math.min(baseAmount, discountVal);
        const calculatedAmount = baseAmount - discountApplied;
        amountToPay = isNaN(calculatedAmount) || calculatedAmount <= 0 
          ? 1000 
          : Math.round(calculatedAmount);
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

    const orderId = `BATCH-${student.studentNumber}-${Date.now()}`;
    const pakasirData = await this.pakasirService.createTransaction(
      paymentMethod,
      orderId,
      totalAmountToPay
    );

    await this.invoiceRepository.upsertPendingBatchInvoices(
      student.id,
      orderId,
      verifiedInvoices
    );

    return {
      orderId,
      amount: totalAmountToPay,
      payment: pakasirData.payment,
    };
  }
}
