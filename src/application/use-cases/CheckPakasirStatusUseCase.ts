import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { IPakasirService } from "../ports/IPakasirService.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";
import { logger } from "../../infrastructure/services/WinstonLogger.js";

export interface CheckPakasirStatusInput {
  orderId: string;
  amount?: number | undefined;
}

export class CheckPakasirStatusUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private pakasirService: IPakasirService
  ) {}

  async execute(input: CheckPakasirStatusInput) {
    const { orderId, amount } = input;

    if (!orderId) {
      throw new BadRequestError("order_id wajib disertakan");
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
      logger.warn(`CheckPakasirStatusUseCase - Tagihan tidak ditemukan untuk order_id: ${orderId}`);
      throw new NotFoundError("Tagihan tidak ditemukan");
    }

    const allPaid = invoices.every((inv) => (inv.status as any) === "PAID");
    if (allPaid) {
      return {
        status: "completed",
        message: "Pembayaran terverifikasi (lunas)",
      };
    }

    const totalAmount = amount
      ? Number(amount)
      : invoices.reduce((sum, inv) => sum + inv.amount, 0);

    const detailData = await this.pakasirService.getTransactionDetail(orderId, totalAmount);
    let transactionStatus = "pending";

    if (detailData && detailData.transaction) {
      transactionStatus = detailData.transaction.status || "pending";
    }

    if (transactionStatus === "completed") {
      logger.info(`CheckPakasirStatusUseCase - Transaksi ${orderId} terverifikasi selesai di Pakasir, memproses pembaruan DB...`);
      await this.invoiceRepository.processPaidInvoicesOnline(invoices, "Polling");

      return {
        status: "completed",
        message: "Pembayaran terverifikasi (lunas)",
      };
    }

    return {
      status: "pending",
      message: "Pembayaran masih tertunda (pending)",
    };
  }
}
