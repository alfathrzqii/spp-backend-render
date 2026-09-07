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
      else if (invoiceData.invoiceType === "FULLDAY") categoryName = "Uang Fullday";

      let categoryId = transactionData.categoryId;
      if (!categoryId) {
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
        categoryId = category.id;
      }

      const transaction = await tx.transaction.create({
        data: {
          ...transactionData,
          categoryId,
          invoiceId: rawInvoice.id,
        },
      });

      return { invoice: this.mapToDomain(rawInvoice), transaction };
    });
  }

  async findById(id: number): Promise<Invoice | null> {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!inv) return null;
    const domainInvoice = this.mapToDomain(inv);
    if ((inv as any).student) {
      (domainInvoice as any).student = (inv as any).student;
    }
    return domainInvoice;
  }

  async findAll(filter?: {
    schoolUnitId?: number | undefined;
    className?: string | undefined;
    status?: InvoiceStatus | undefined;
    month?: number | undefined;
    year?: number | undefined;
    search?: string | undefined;
    invoiceType?: InvoiceType | undefined;
    skip?: number | undefined;
    take?: number | undefined;
  }): Promise<{ invoices: any[]; total: number }> {
    const where: any = {};

    if (filter?.schoolUnitId) {
      where.student = { ...where.student, schoolUnitId: filter.schoolUnitId };
    }

    if (filter?.className) {
      where.student = { ...where.student, className: filter.className };
    }

    if (filter?.search) {
      where.student = {
        ...where.student,
        OR: [
          { name: { contains: filter.search, mode: "insensitive" } },
          { studentNumber: { contains: filter.search } },
        ],
      };
    }

    if (filter?.invoiceType) {
      where.invoiceType = filter.invoiceType as any;
    }

    if (filter?.status) {
      where.status = filter.status as any;
    }

    if (filter?.month) {
      where.month = filter.month;
    }

    if (filter?.year) {
      where.year = filter.year;
    }

    const skip = filter?.skip ?? 0;
    const take = filter?.take ?? 50;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          student: {
            include: {
              parent: true,
            },
          },
          transactions: true,
        },
        orderBy: [
          { year: "desc" },
          { month: "desc" },
          { id: "desc" },
        ],
        skip,
        take,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  async getPaidAmount(invoiceId: number): Promise<number> {
    const txSum = await this.prisma.transaction.aggregate({
      where: { invoiceId, type: "INCOME" as any },
      _sum: { amount: true },
    });
    return txSum._sum.amount || 0;
  }

  async updateStatus(
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
  ): Promise<Invoice> {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: status as any },
      });

      if (status === "PAID" && paymentDetails) {
        const existingTx = await tx.transaction.findFirst({
          where: { invoiceId: id, type: "INCOME" as any },
        });

        if (!existingTx) {
          let category = await tx.category.findFirst({
            where: {
              name: { equals: paymentDetails.categoryName, mode: "insensitive" },
              type: "INCOME",
            },
          });

          if (!category) {
            category = await tx.category.create({
              data: {
                name: paymentDetails.categoryName,
                type: "INCOME",
                schoolUnitId: null,
              },
            });
          }

          let txAmount = paymentDetails.amount ?? updated.amount;

          await tx.transaction.create({
            data: {
              type: "INCOME" as any,
              categoryId: category.id,
              paymentMethod: paymentDetails.paymentMethod as any,
              amount: txAmount,
              description: paymentDetails.description,
              schoolUnitId: paymentDetails.schoolUnitId,
              recordedById: paymentDetails.recordedById ?? null,
              invoiceId: id,
            },
          });
        }
      } else if (status !== "PAID") {
        await tx.transaction.deleteMany({
          where: { invoiceId: id },
        });
      }

      return this.mapToDomain(updated);
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { invoiceId: id },
      });
      await tx.invoice.delete({
        where: { id },
      });
    });
  }
}
