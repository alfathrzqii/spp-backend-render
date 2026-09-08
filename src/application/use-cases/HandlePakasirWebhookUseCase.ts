import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { ILogger } from "../../domain/services/ILogger.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export interface HandlePakasirWebhookInput {
  order_id: string;
  status: string;
  amount?: number | undefined;
  rawPayload?: any;
}

export class HandlePakasirWebhookUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private studentRepository: IStudentRepository,
    private logger?: ILogger
  ) {}

  async execute(input: HandlePakasirWebhookInput) {
    const { order_id, status, amount, rawPayload } = input;

    this.logger?.info(`Menerima webhook Pakasir: ${JSON.stringify(rawPayload || input)}`);

    if (!order_id || !status) {
      this.logger?.warn(`Webhook Pakasir diabaikan: Payload tidak valid`);
      throw new BadRequestError("Payload webhook tidak valid");
    }

    if (status !== "completed") {
      this.logger?.info(`Webhook Pakasir untuk order_id: ${order_id} diabaikan karena status adalah "${status}"`);
      return { success: true, message: "Status transaksi bukan completed, abaikan" };
    }

    let invoices = await this.invoiceRepository.findByOrderIdPrefix(order_id);

    if (invoices.length === 0) {
      const match = String(order_id).match(/^BATCH-([^-]+)-(\d+)/);
      if (match && match[1]) {
        const studentNumber = match[1];
        const student = await this.studentRepository.findByStudentNumber(studentNumber);
        if (student) {
          const pendingInvoices = await this.invoiceRepository.findPendingBatchInvoices({
            studentNumber,
          });
          if (pendingInvoices.length > 0) {
            const pendingSum = pendingInvoices.reduce((acc, inv) => acc + inv.amount, 0);
            if (Number(amount) === pendingSum || pendingInvoices.some((inv) => inv.amount === Number(amount))) {
              invoices = Number(amount) === pendingSum
                ? pendingInvoices
                : pendingInvoices.filter((inv) => inv.amount === Number(amount));
            } else {
              invoices = pendingInvoices;
            }
          }
        }
      }
    }

    if (invoices.length === 0) {
      this.logger?.warn(`Webhook Pakasir - Tagihan tidak ditemukan untuk order_id: ${order_id}`);
      throw new NotFoundError("Tagihan tidak ditemukan");
    }

    const allPaid = invoices.every((inv) => (inv.status as any) === "PAID");
    if (allPaid) {
      this.logger?.info(`Webhook Pakasir untuk order_id: ${order_id} - Semua tagihan terkait sudah berstatus PAID`);
      return { success: true, message: "Tagihan sudah lunas" };
    }

    this.logger?.info(`Webhook Pakasir - Mulai memproses pembaruan status lunas untuk order_id: ${order_id}`);
    await this.invoiceRepository.processPaidInvoicesOnline(invoices, "Webhook");

    this.logger?.info(`Webhook Pakasir - Berhasil memproses pembayaran untuk order_id: ${order_id}`);
    return { success: true, message: "Webhook berhasil diproses" };
  }
}
