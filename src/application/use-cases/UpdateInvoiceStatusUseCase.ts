import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import { InvoiceStatus, PaymentMethod } from "../../domain/enums/index.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export interface UpdateInvoiceStatusInput {
  invoiceId: number;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod | undefined;
  recordedById?: number | null | undefined;
}

export class UpdateInvoiceStatusUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private sppTariffRepository?: ISppTariffRepository
  ) {}

  async execute(input: UpdateInvoiceStatusInput) {
    const { invoiceId, status, paymentMethod, recordedById } = input;

    if (!status || (status !== InvoiceStatus.PAID && status !== InvoiceStatus.PENDING)) {
      throw new BadRequestError("Status tidak valid. Gunakan PAID atau PENDING.");
    }

    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError("Tagihan tidak ditemukan");
    }

    const chosenMethod = paymentMethod === PaymentMethod.TRANSFER ? PaymentMethod.TRANSFER : PaymentMethod.CASH;

    let categoryName = "SPP";
    if (invoice.invoiceType === "UANG_PENGEMBANGAN") categoryName = "Uang Pengembangan";
    else if (invoice.invoiceType === "DAFTAR_ULANG") categoryName = "Daftar Ulang";
    else if (invoice.invoiceType === "UANG_PERALATAN") categoryName = "Uang Peralatan";
    else if (invoice.invoiceType === "EKSTRAKURIKULER") categoryName = "Uang Ekstrakurikuler";
    else if (invoice.invoiceType === "SERAGAM") categoryName = "Uang Seragam";
    else if (invoice.invoiceType === "FULLDAY") categoryName = "Uang Fullday";

    const student = await this.studentRepository.findById(invoice.studentId);
    const schoolUnitId = student ? student.schoolUnitId : 1;
    const studentName = student ? student.name : "Siswa";

    let txAmount = invoice.amount;
    if ((!txAmount || txAmount <= 0) && student && this.sppTariffRepository) {
      const tariff = await this.sppTariffRepository.findByUnitAndYear(
        student.schoolUnitId,
        student.enrollmentYear
      );
      if (tariff) {
        const disc = student.discountAmount || 0;
        txAmount = Math.max(0, tariff.amount - disc);
      }
    }

    const updatedInvoice = await this.invoiceRepository.updateStatus(invoiceId, status, {
      paymentMethod: chosenMethod,
      amount: txAmount,
      recordedById: recordedById ?? null,
      categoryName,
      description: `Pembaruan status lunas manual (${chosenMethod === PaymentMethod.TRANSFER ? "Transfer Bank" : "Tunai"}) oleh Admin SPP bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${studentName}`,
      schoolUnitId,
    });

    return updatedInvoice;
  }
}
