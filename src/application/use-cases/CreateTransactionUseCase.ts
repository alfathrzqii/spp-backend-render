import type { ITransactionRepository } from "../../domain/repositories/ITransactionRepository.js";
import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import type { Transaction } from "../../domain/entities/Transaction.js";
import type { CategoryType, PaymentMethod } from "../../domain/enums/index.js";
import { BadRequestError } from "../../domain/errors/AppError.js";

export class CreateTransactionUseCase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private categoryRepository: ICategoryRepository
  ) {}

  async execute(data: {
    type: CategoryType;
    categoryId: number;
    paymentMethod: PaymentMethod;
    amount: number;
    description?: string;
    schoolUnitId: number;
    recordedById: number;
  }): Promise<Transaction> {
    const category = await this.categoryRepository.findById(data.categoryId);

    if (!category) {
      throw new BadRequestError("Kategori transaksi tidak valid");
    }

    if (category.type !== data.type) {
        throw new BadRequestError("Tipe kategori tidak cocok dengan konteks pencatatan");
    }

    return await this.transactionRepository.create({
      type: data.type,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      amount: data.amount,
      description: data.description || null,
      schoolUnitId: data.schoolUnitId,
      recordedById: data.recordedById,
      invoiceId: null,
    });
  }
}
