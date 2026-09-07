import { InvoiceStatus, InvoiceType } from "../enums/index.js";

export class Invoice {
  constructor(
    public readonly id: number,
    public readonly studentId: number,
    public readonly invoiceType: InvoiceType,
    public readonly month: number,
    public readonly year: number,
    public readonly baseAmount: number,
    public readonly discountApplied: number,
    public readonly amount: number,
    public readonly status: InvoiceStatus = InvoiceStatus.PENDING,
    public readonly midtransOrderId: string | null = null
  ) {}

  public isPaid(): boolean {
    return this.status === InvoiceStatus.PAID;
  }

  public isPending(): boolean {
    return this.status === InvoiceStatus.PENDING;
  }

  public isVoid(): boolean {
    return this.status === InvoiceStatus.VOID;
  }
}
