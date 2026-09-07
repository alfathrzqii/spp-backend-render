import type { ITransactionRepository } from "../../domain/repositories/ITransactionRepository.js";
import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import type { Transaction } from "../../domain/entities/Transaction.js";
import type { CategoryType, PaymentMethod } from "../../domain/enums/index.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export class UpdateTransactionUseCase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private categoryRepository: ICategoryRepository
  ) {}

  async execute(
    id: number,
    data: {
      type?: CategoryType;
      categoryId?: number;
      paymentMethod?: PaymentMethod;
      amount?: number;
      description?: string;
      schoolUnitId?: number;
    }
  ): Promise<Transaction> {
    const existingTransaction = await this.transactionRepository.findById(id);
    if (!existingTransaction) {
      throw new NotFoundError("Transaksi tidak ditemukan");
    }

    const type = data.type || existingTransaction.type;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existingTransaction.categoryId;

    if (data.categoryId !== undefined) {
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) {
        throw new BadRequestError("Kategori transaksi tidak valid");
      }
      if (category.type !== type) {
        throw new BadRequestError("Tipe kategori tidak cocok dengan konteks pencatatan");
      }
    }

    return await this.transactionRepository.update(id, {
      type,
      categoryId,
      paymentMethod: data.paymentMethod || existingTransaction.paymentMethod,
      amount: data.amount !== undefined ? data.amount : existingTransaction.amount,
      description: data.description !== undefined ? data.description : existingTransaction.description,
      schoolUnitId: data.schoolUnitId !== undefined ? data.schoolUnitId : existingTransaction.schoolUnitId,
    });
  }
}
