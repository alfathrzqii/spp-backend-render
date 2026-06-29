import prisma from "./prisma.js";
import type { ITransactionRepository } from "../../domain/repositories/ITransactionRepository.js";
import { Transaction } from "../../domain/entities/Transaction.js";

export class PrismaTransactionRepository implements ITransactionRepository {
  private prisma = prisma;

  async create(data: Omit<Transaction, "id" | "date">): Promise<Transaction> {
    const created = await this.prisma.transaction.create({
      data: {
        type: data.type,
        categoryId: data.categoryId,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        description: data.description,
        schoolUnitId: data.schoolUnitId,
        recordedById: data.recordedById,
        invoiceId: data.invoiceId,
      },
    });

    return new Transaction(
      created.id,
      created.date,
      created.type,
      created.categoryId,
      created.paymentMethod,
      created.amount,
      created.schoolUnitId,
      created.invoiceId,
      created.description,
      created.recordedById
    );
  }

  async findAll(filter?: {
    schoolUnitId?: number;
    type?: string;
    categoryId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const where: any = {};
    if (filter?.schoolUnitId !== undefined) {
      where.schoolUnitId = filter.schoolUnitId;
    }
    if (filter?.type) {
      where.type = filter.type;
    }
    if (filter?.categoryId !== undefined) {
      where.categoryId = filter.categoryId;
    }
    if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = filter.startDate;
      if (filter.endDate) where.date.lte = filter.endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        recordedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc'
      }
    });

    return transactions;
  }

  async getSummary(filter?: {
    schoolUnitId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ totalIncome: number; totalExpense: number }> {
    const where: any = {};
    if (filter?.schoolUnitId !== undefined) {
      where.schoolUnitId = filter.schoolUnitId;
    }
    if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = filter.startDate;
      if (filter.endDate) where.date.lte = filter.endDate;
    }

    const incomeSum = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        ...where,
        type: "INCOME",
      },
    });

    const expenseSum = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        ...where,
        type: "EXPENSE",
      },
    });

    return {
      totalIncome: incomeSum._sum.amount || 0,
      totalExpense: expenseSum._sum.amount || 0,
    };
  }
}
