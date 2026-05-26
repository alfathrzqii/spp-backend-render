import { PrismaClient } from "@prisma/client";
import type { ITransactionRepository } from "../../domain/repositories/ITransactionRepository.js";
import { Transaction } from "../../domain/entities/Transaction.js";

export class PrismaTransactionRepository implements ITransactionRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

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
}
