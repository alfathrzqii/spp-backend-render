import { PrismaClient, type InvoiceType, type InvoiceStatus, type CategoryType, type PaymentMethod } from "@prisma/client";
import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";

export class PrismaInvoiceRepository implements IInvoiceRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findByUniqueComposite(
    studentId: number,
    month: number,
    year: number,
    invoiceType: InvoiceType
  ): Promise<any | null> {
    return await this.prisma.invoice.findUnique({
      where: {
        uq_student_billing_period: {
          studentId,
          month,
          year,
          invoiceType,
        },
      },
    });
  }

  async createOfflinePayment(
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
      categoryId: number;
      paymentMethod: PaymentMethod;
      amount: number;
      description: string;
      schoolUnitId: number;
      recordedById: number;
    },
    existingInvoiceId?: number
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      let invoice;
      if (existingInvoiceId) {
        invoice = await tx.invoice.update({
          where: { id: existingInvoiceId },
          data: { status: invoiceData.status },
        });
      } else {
        invoice = await tx.invoice.create({
          data: invoiceData,
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          ...transactionData,
          invoiceId: invoice.id,
        },
      });

      return { invoice, transaction };
    });
  }
}
