import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import type { InvoiceStatus, InvoiceType } from "../../domain/enums/index.js";

export interface GetAllInvoicesInput {
  schoolUnitId?: number | undefined;
  className?: string | undefined;
  status?: InvoiceStatus | undefined;
  month?: number | undefined;
  year?: number | undefined;
  search?: string | undefined;
  invoiceType?: InvoiceType | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface GetAllInvoicesResult {
  invoices: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class GetAllInvoicesUseCase {
  constructor(private invoiceRepository: IInvoiceRepository) {}

  async execute(input: GetAllInvoicesInput): Promise<GetAllInvoicesResult> {
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? input.limit : 50;
    const skip = (page - 1) * limit;

    const { invoices, total } = await this.invoiceRepository.findAll({
      schoolUnitId: input.schoolUnitId,
      className: input.className,
      status: input.status,
      month: input.month,
      year: input.year,
      search: input.search,
      invoiceType: input.invoiceType,
      skip,
      take: limit,
    });

    return {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
