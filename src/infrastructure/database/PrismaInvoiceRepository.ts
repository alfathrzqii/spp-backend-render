import type { InvoiceStatus, InvoiceType, CategoryType, PaymentMethod } from "../../domain/enums/index.js";
import type { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository.js";
import { Invoice } from "../../domain/entities/Invoice.js";
import prisma from "./prisma.js";

export class PrismaInvoiceRepository implements IInvoiceRepository {
  private prisma = prisma;

  private mapToDomain(inv: any): Invoice {
    return new Invoice(
      inv.id,
      inv.studentId,
      inv.invoiceType as InvoiceType,
      inv.month,
      inv.year,
      inv.baseAmount,
      inv.discountApplied,
      inv.amount,
      inv.status as InvoiceStatus,
      inv.midtransOrderId
    );
  }

  async findByUniqueComposite(
    studentId: number,
    month: number,
    year: number,
    invoiceType: InvoiceType
  ): Promise<Invoice | null> {
    const inv = await this.prisma.invoice.findUnique({
      where: {
        uq_student_billing_period: {
          studentId,
          month,
          year,
          invoiceType: invoiceType as any,
        },
      },
    });

    if (!inv) return null;
    return this.mapToDomain(inv);
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
  ): Promise<{ invoice: Invoice; transaction: any }> {
    return await this.prisma.$transaction(async (tx) => {
      let rawInvoice: any;
      if (existingInvoiceId) {
        rawInvoice = await tx.invoice.update({
          where: { id: existingInvoiceId },
          data: { status: invoiceData.status as any },
        });
      } else {
        rawInvoice = await tx.invoice.create({
          data: invoiceData as any,
        });
      }

      // Ensure appropriate income category exists in database to prevent FK constraint violation
      let categoryName = "SPP";
      if (invoiceData.invoiceType === "UANG_PENGEMBANGAN") categoryName = "Uang Pengembangan";
      else if (invoiceData.invoiceType === "DAFTAR_ULANG") categoryName = "Daftar Ulang";
      else if (invoiceData.invoiceType === "UANG_PERALATAN") categoryName = "Uang Peralatan";
      else if (invoiceData.invoiceType === "EKSTRAKURIKULER") categoryName = "Uang Ekstrakurikuler";
      else if (invoiceData.invoiceType === "SERAGAM") categoryName = "Uang Seragam";

      let category = await tx.category.findFirst({
        where: {
          name: { equals: categoryName, mode: "insensitive" },
          type: "INCOME",
        },
      });

      if (!category) {
        category = await tx.category.create({
          data: {
            name: categoryName,
            type: "INCOME",
            schoolUnitId: null,
          },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          ...transactionData,
          categoryId: category.id,
          invoiceId: rawInvoice.id,
        },
      });

      return { invoice: this.mapToDomain(rawInvoice), transaction };
    });
  }
}
