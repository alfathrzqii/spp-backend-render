import type { InvoiceStatus, InvoiceType, PaymentMethod, CategoryType } from "../enums/index.js";
import type { Invoice } from "../entities/Invoice.js";

export interface IInvoiceRepository {
  findByUniqueComposite(
    studentId: number,
    month: number,
    year: number,
    invoiceType: InvoiceType
  ): Promise<Invoice | null>;

  createOfflinePayment(
    invoiceData: {
      studentId: number;
      invoiceType: InvoiceType;
      month: number;
      year: number;
      baseAmount: number;
      discountApplied: number;
      amount: number;
      status: InvoiceStatus;
    },
    transactionData: {
      type: CategoryType;
      categoryId?: number;
      paymentMethod: PaymentMethod;
      amount: number;
      description: string;
      schoolUnitId: number;
      recordedById: number;
    },
    existingInvoiceId?: number
  ): Promise<{ invoice: Invoice; transaction: any }>;
  findById(id: number): Promise<Invoice | null>;
  findAll(filter?: {
    schoolUnitId?: number | undefined;
    className?: string | undefined;
    status?: InvoiceStatus | undefined;
    month?: number | undefined;
    year?: number | undefined;
    search?: string | undefined;
    invoiceType?: InvoiceType | undefined;
    skip?: number | undefined;
    take?: number | undefined;
  }): Promise<{ invoices: any[]; total: number }>;
  getPaidAmount(invoiceId: number): Promise<number>;
  updateStatus(
    id: number,
    status: InvoiceStatus,
    paymentDetails?: {
      paymentMethod: PaymentMethod;
      amount?: number | undefined;
      recordedById?: number | null | undefined;
      categoryName: string;
      description: string;
      schoolUnitId: number;
    }
  ): Promise<Invoice>;
  delete(id: number): Promise<void>;
}
