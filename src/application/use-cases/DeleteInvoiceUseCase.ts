import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import { NotFoundError } from "../../domain/errors/AppError.js";

export class DeleteInvoiceUseCase {
  constructor(private invoiceRepository: IInvoiceRepository) {}

  async execute(invoiceId: number): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError("Tagihan tidak ditemukan");
    }

    await this.invoiceRepository.delete(invoiceId);
  }
}
