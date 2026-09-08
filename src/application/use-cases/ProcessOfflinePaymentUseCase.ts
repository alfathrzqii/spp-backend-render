import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import type { IExtraEquipmentTariffRepository } from "../../domain/repositories/IExtraEquipmentTariffRepository.js";
import type { IFulldayTariffRepository } from "../../domain/repositories/IFulldayTariffRepository.js";
import { InvoiceType, InvoiceStatus, CategoryType, PaymentMethod } from "../../domain/enums/index.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../domain/errors/AppError.js";

export interface ProcessOfflinePaymentInput {
  studentId?: number | undefined;
  studentNumber?: string | undefined;
  month: number;
  year: number;
  recordedById: number;
  user?: {
    id: number;
    role: string;
    schoolUnitId: number | null;
  } | undefined;
  invoiceType?: InvoiceType | undefined;
  paymentAmount?: number | undefined;
  paymentMethod?: PaymentMethod | undefined;
}

export class ProcessOfflinePaymentUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private sppTariffRepository: ISppTariffRepository,
    private extraEquipmentTariffRepository?: IExtraEquipmentTariffRepository,
    private fulldayTariffRepository?: IFulldayTariffRepository
  ) {}

  async execute(input: ProcessOfflinePaymentInput) {
    const {
      studentId,
      studentNumber,
      month,
      year,
      recordedById,
      user,
      invoiceType = InvoiceType.SPP,
      paymentAmount,
      paymentMethod = PaymentMethod.CASH,
    } = input;

    let student: any;
    if (studentId) {
      student = await this.studentRepository.findById(studentId);
    } else if (studentNumber) {
      student = await this.studentRepository.findByStudentNumber(studentNumber);
    }

    if (!student) {
      throw new NotFoundError("Gagal: Siswa tidak ditemukan");
    }

    const finalStudentId = student.id;

    if (user && (user.role as any) === "UNIT_ADMIN") {
      if (student.schoolUnitId !== user.schoolUnitId) {
        throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini");
      }
    }

    const yearNum = Number(year);
    const monthNum = Number(month);

    if (
      yearNum < student.enrollmentYear ||
      (yearNum === student.enrollmentYear && monthNum < 7) ||
      (yearNum === 2026 && monthNum < 7)
    ) {
      throw new BadRequestError(
        "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)"
      );
    }

    // 1. Validasi Eksistensi Invoice
    const existingInvoice = await this.invoiceRepository.findByUniqueComposite(
      finalStudentId,
      monthNum,
      yearNum,
      invoiceType
    );

    if (existingInvoice && existingInvoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError(`Gagal: Tagihan ${invoiceType} siswa untuk bulan dan tahun tersebut sudah lunas`);
    }

    // 2. Kalkulasi & Snapshot Tarif Dasar (Jika Invoice Belum Ada)
    let invoiceData: any;

    const tariff = await this.sppTariffRepository.findByUnitAndYear(
      student.schoolUnitId,
      student.enrollmentYear
    );

    if (!tariff) {
      throw new NotFoundError("Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi");
    }

    let baseAmount = 0;
    let discountApplied = 0;

    if (invoiceType === InvoiceType.SPP) {
      baseAmount = tariff.amount;
      discountApplied = Math.min(baseAmount, student.discountAmount);
    } else if (invoiceType === InvoiceType.UANG_PENGEMBANGAN) {
      baseAmount = tariff.developmentFee;
    } else if (invoiceType === InvoiceType.DAFTAR_ULANG) {
      baseAmount = tariff.reRegistrationFee;
    } else if (invoiceType === InvoiceType.UANG_PERALATAN) {
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
    } else if (invoiceType === InvoiceType.EKSTRAKURIKULER) {
      let extraFee = 0;
      if (student.schoolUnitId === 3) {
        if (student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
          extraFee = student.sdExtracurriculars.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
        }
      } else if ((student.schoolUnitId === 1 || student.schoolUnitId === 2) && this.extraEquipmentTariffRepository) {
        const level = student.schoolUnitId === 1 
          ? "KB" 
          : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
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
      }
      baseAmount = extraFee;
      discountApplied = Math.min(baseAmount, student.discountExtracurricular || 0);
    } else if (invoiceType === InvoiceType.SERAGAM) {
      baseAmount = tariff.uniformFee;
    } else if (invoiceType === InvoiceType.FULLDAY) {
      let fulldayFee = 0;
      if (student.isFullday && (student.schoolUnitId === 1 || student.schoolUnitId === 2) && this.fulldayTariffRepository) {
        const ft = await this.fulldayTariffRepository.findByUnitAndYear(
          student.schoolUnitId,
          student.enrollmentYear
        );
        if (ft) {
          fulldayFee = ft.monthlyFee;
        }
      }
      baseAmount = fulldayFee;
    }

    const totalInvoiceAmount = baseAmount - discountApplied;

    // Hitung berapa yang sudah dibayar
    let currentPaid = 0;
    if (existingInvoice) {
      currentPaid = await this.invoiceRepository.getPaidAmount(existingInvoice.id);
    }

    const targetInvoiceAmount = (existingInvoice && existingInvoice.status !== InvoiceStatus.PENDING)
      ? existingInvoice.amount
      : totalInvoiceAmount;
    const remainingAmount = Math.max(0, targetInvoiceAmount - currentPaid);

    // Tentukan nominal transaksi pembayaran tunai ini
    let paymentTxAmount = paymentAmount !== undefined ? paymentAmount : remainingAmount;
    if (paymentTxAmount > remainingAmount) {
      paymentTxAmount = remainingAmount;
    }

    if (paymentTxAmount <= 0) {
      throw new BadRequestError("Gagal: Nominal pembayaran tidak boleh nol atau negatif, atau tagihan sudah lunas");
    }

    // Tentukan status akhir invoice setelah pembayaran ini
    const totalPaidAfterTx = currentPaid + paymentTxAmount;
    const finalInvoiceAmount = targetInvoiceAmount;
    const finalStatus = totalPaidAfterTx >= finalInvoiceAmount ? InvoiceStatus.PAID : InvoiceStatus.PENDING;

    if (!existingInvoice) {
      invoiceData = {
        studentId: finalStudentId,
        invoiceType,
        month: monthNum,
        year: yearNum,
        baseAmount,
        discountApplied,
        amount: totalInvoiceAmount,
        status: finalStatus,
      };
    } else {
      invoiceData = {
        ...existingInvoice,
        status: finalStatus,
      };
      if (existingInvoice.status === InvoiceStatus.PENDING) {
        invoiceData.baseAmount = baseAmount;
        invoiceData.discountApplied = discountApplied;
        invoiceData.amount = totalInvoiceAmount;
      }
    }

    let categoryName = "SPP";
    if (invoiceType === InvoiceType.UANG_PENGEMBANGAN) categoryName = "Uang Pengembangan";
    else if (invoiceType === InvoiceType.DAFTAR_ULANG) categoryName = "Daftar Ulang";
    else if (invoiceType === InvoiceType.UANG_PERALATAN) categoryName = "Uang Peralatan";
    else if (invoiceType === InvoiceType.EKSTRAKURIKULER) categoryName = "Uang Ekstrakurikuler";
    else if (invoiceType === InvoiceType.SERAGAM) categoryName = "Uang Seragam";
    else if (invoiceType === InvoiceType.FULLDAY) categoryName = "Uang Fullday";

    const isTransfer = paymentMethod === PaymentMethod.TRANSFER;
    const transactionData = {
      type: CategoryType.INCOME,
      paymentMethod,
      amount: paymentTxAmount,
      description: `Pembayaran ${categoryName} offline ${isTransfer ? "transfer bank" : "tunai"} bulan ${monthNum} tahun ${yearNum} untuk siswa ${student.name}`,
      schoolUnitId: student.schoolUnitId,
      recordedById,
    };

    const result = await this.invoiceRepository.createOfflinePayment(
      invoiceData,
      transactionData,
      existingInvoice?.id
    );

    return {
      invoiceId: result.invoice.id,
      studentId: result.invoice.studentId,
      month: result.invoice.month,
      year: result.invoice.year,
      amountPaid: result.transaction.amount,
      transactionId: result.transaction.id,
    };
  }
}
