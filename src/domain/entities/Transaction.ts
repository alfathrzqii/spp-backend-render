import type { CategoryType, PaymentMethod } from "@prisma/client";

export class Transaction {
  constructor(
    public readonly id: number,
    public readonly date: Date,
    public readonly type: CategoryType,
    public readonly categoryId: number,
    public readonly paymentMethod: PaymentMethod,
    public readonly amount: number,
    public readonly schoolUnitId: number,
    public readonly invoiceId: number | null = null,
    public readonly description: string | null = null,
    public readonly recordedById: number | null = null
  ) {}
}
