import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { IPakasirService } from "../ports/IPakasirService.js";
import type { ILogger } from "../../domain/services/ILogger.js";

export interface SyncPakasirTransactionsInput {
  studentNumber?: string | undefined;
  schoolUnitId?: number | undefined;
}

export class SyncPakasirTransactionsUseCase {
  constructor(
    private invoiceRepository: IInvoiceRepository,
    private pakasirService: IPakasirService,
    private logger?: ILogger
  ) {}

  async execute(input: SyncPakasirTransactionsInput) {
    const pendingInvoices = await this.invoiceRepository.findPendingBatchInvoices({
      studentNumber: input.studentNumber,
      schoolUnitId: input.schoolUnitId,
    });

    if (pendingInvoices.length === 0) {
      return {
        message: "Tidak ada tagihan tertunda (pending) yang perlu disinkronkan",
        checkedBatches: 0,
        syncedCount: 0,
      };
    }

    // Kelompokkan invoice berdasarkan base orderId
    const batchMap = new Map<string, typeof pendingInvoices>();
    for (const inv of pendingInvoices) {
      const rawId = inv.midtransOrderId || "";
      const baseId = rawId.replace(/-\d+$/, "");
      if (!batchMap.has(baseId)) {
        batchMap.set(baseId, []);
      }
      batchMap.get(baseId)!.push(inv);
    }

    let syncedCount = 0;
    const checkedBatches = Array.from(batchMap.keys());

    for (const [baseOrderId, invs] of batchMap.entries()) {
      const totalAmount = invs.reduce((sum, inv) => sum + inv.amount, 0);

      const detailData = await this.pakasirService.getTransactionDetail(baseOrderId, totalAmount);
      if (detailData?.transaction?.status === "completed") {
        await this.invoiceRepository.processPaidInvoicesOnline(invs, "Manual-Sync");
        syncedCount += invs.length;
        this.logger?.info(`SyncPakasirTransactionsUseCase: Berhasil menyinkronkan ${invs.length} invoice untuk order ${baseOrderId}`);
      }
    }

    return {
      message: syncedCount > 0
        ? `Sinkronisasi berhasil: ${syncedCount} tagihan diperbarui menjadi Lunas`
        : "Sinkronisasi selesai: Tidak ada transaksi baru yang lunas di Pakasir",
      checkedBatches: checkedBatches.length,
      syncedCount,
    };
  }
}
