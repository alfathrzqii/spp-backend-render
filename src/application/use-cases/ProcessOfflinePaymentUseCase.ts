import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import { InvoiceType, InvoiceStatus, CategoryType, PaymentMethod } from "@prisma/client";

export class ProcessOfflinePaymentUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private sppTariffRepository: ISppTariffRepository
  ) {}

  async execute(input: {
    studentId: number;
    month: number;
    year: number;
    recordedById: number;
  }) {
    const { studentId, month, year, recordedById } = input;

    // 1. Validasi Eksistensi Invoice
    const existingInvoice = await this.invoiceRepository.findByUniqueComposite(
      studentId,
      month,
      year,
      InvoiceType.SPP
    );

    if (existingInvoice && existingInvoice.status === InvoiceStatus.PAID) {
      throw new Error("Gagal: Tagihan SPP siswa untuk bulan dan tahun tersebut sudah lunas");
    }

    // 2. Kalkulasi & Snapshot Tarif Dasar SPP (Jika Invoice Belum Ada)
    let invoiceData: any;
    let amountToPay: number;
    let student: any;

    if (!existingInvoice) {
      student = await this.studentRepository.findById(studentId);
      if (!student) {
        throw new Error("Gagal: Siswa tidak ditemukan");
      }

      const tariff = await this.sppTariffRepository.findByUnitAndYear(
        student.schoolUnitId,
        student.enrollmentYear
      );

      if (!tariff) {
        throw new Error("Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi");
      }

      const baseAmount = tariff.amount;
      const discountApplied = Math.floor((baseAmount * student.discountPercentage) / 100);
      amountToPay = baseAmount - discountApplied;

      invoiceData = {
        studentId,
        invoiceType: InvoiceType.SPP,
        month,
        year,
        baseAmount,
        discountApplied,
        amount: amountToPay,
        status: InvoiceStatus.PAID,
      };
    } else {
      amountToPay = existingInvoice.amount;
      // We still need student info for transaction description and schoolUnitId
      student = await this.studentRepository.findById(studentId);
      invoiceData = {
        ...existingInvoice,
        status: InvoiceStatus.PAID,
      };
    }

    // 3. Eksekusi Atomik Database Transaction
    // Sesuai spesifikasi: categoryId untuk SPP (Gunakan ID kategori SPP dari master seeder yaitu 1)
    const transactionData = {
      type: CategoryType.INCOME,
      categoryId: 1, // ID Kategori SPP
      paymentMethod: PaymentMethod.CASH,
      amount: amountToPay,
      description: `Pembayaran SPP offline tunai bulan ${month} tahun ${year} untuk siswa ${student.name}`,
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
