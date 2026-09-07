import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { IPakasirService } from "../ports/IPakasirService.js";
import type { ILogger } from "../../domain/services/ILogger.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export interface SimulatePakasirPaymentInput {
  orderId: string;
  amount?: number | undefined;
}

export class SimulatePakasirPaymentUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private pakasirService: IPakasirService,
    private logger?: ILogger
  ) {}

  async execute(input: SimulatePakasirPaymentInput) {
    const { orderId, amount } = input;

    if (!orderId) {
      throw new BadRequestError("orderId wajib diisi");
    }

    let invoices = await this.invoiceRepository.findByOrderIdPrefix(orderId);

    if (invoices.length === 0) {
      const match = String(orderId).match(/^BATCH-([^-]+)-(\d+)/);
      if (match && match[1]) {
        const studentNumber = match[1];
        const student = await this.studentRepository.findByStudentNumber(studentNumber);
        if (student) {
          const pendingInvoices = await this.invoiceRepository.findPendingBatchInvoices({
            studentNumber,
          });
          if (pendingInvoices.length > 0) {
            invoices = pendingInvoices;
          }
        }
      }
    }

    if (invoices.length === 0) {
      throw new NotFoundError("Tagihan tidak ditemukan untuk Order ID ini");
    }

    const totalAmount = amount
      ? Number(amount)
      : invoices.reduce((sum, inv) => sum + inv.amount, 0);

    await this.pakasirService.simulatePayment(orderId, totalAmount);

    // Selalu perbarui status invoice dan catat transaksi kasir secara lokal
    await this.invoiceRepository.processPaidInvoicesOnline(invoices, "Simulasi");

    this.logger?.info(`Simulasi pembayaran Pakasir berhasil untuk order: ${orderId} (${invoices.length} tagihan)`);

    return {
      orderId,
      paidCount: invoices.length,
    };
  }
}
