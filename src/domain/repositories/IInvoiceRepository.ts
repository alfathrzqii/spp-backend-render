import type { InvoiceStatus, InvoiceType, PaymentMethod, CategoryType } from "../enums/index.js";
import type { Invoice } from "../entities/Invoice.js";
import type { Transaction } from "../entities/Transaction.js";

export interface InvoiceWithDetailsDTO {
  id: number;
  studentId: number;
  invoiceType: InvoiceType;
  month: number;
  year: number;
  baseAmount: number;
  discountApplied: number;
  amount: number;
  status: InvoiceStatus;
  midtransOrderId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  student?: {
    id: number;
    studentNumber: string;
    name: string;
    className: string;
    schoolUnitId: number;
    enrollmentYear: number;
    discountAmount: number;
    status: string;
    parent?: {
      id: number;
      name: string;
      email: string;
      phoneNumber: string | null;
    } | null;
  } | null;
  transactions?: Array<{
    id: number;
    date: Date;
    type: string;
    amount: number;
    paymentMethod: string;
    description: string | null;
  }>;
}

export interface BatchInvoiceItemDTO {
  id: number;
  studentId: number;
  invoiceType: InvoiceType;
  month: number;
  year: number;
  baseAmount: number;
  discountApplied: number;
  amount: number;
  status: InvoiceStatus;
  midtransOrderId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  student?: {
    id?: number;
    name: string;
    studentNumber?: string;
    schoolUnitId: number;
  } | null;
}

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
  ): Promise<{ invoice: Invoice; transaction: Transaction }>;
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
  }): Promise<{ invoices: InvoiceWithDetailsDTO[]; total: number }>;
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
  findByOrderIdPrefix(orderIdPrefix: string): Promise<BatchInvoiceItemDTO[]>;
  findPendingBatchInvoices(filter?: {
    studentNumber?: string | undefined;
    schoolUnitId?: number | undefined;
  }): Promise<BatchInvoiceItemDTO[]>;
  upsertPendingBatchInvoices(
    studentId: number,
    baseOrderId: string,
    items: Array<{
      month: number;
      year: number;
      invoiceType: InvoiceType;
      baseAmount: number;
      discountApplied: number;
      amountToPay: number;
      existingInvoiceId?: number | undefined;
    }>
  ): Promise<void>;
  processPaidInvoicesOnline(
    invoices: BatchInvoiceItemDTO[] | any[],
    source: string,
    paymentMethod?: PaymentMethod
  ): Promise<void>;
  deletePendingByStudentId(studentId: number): Promise<void>;
}
