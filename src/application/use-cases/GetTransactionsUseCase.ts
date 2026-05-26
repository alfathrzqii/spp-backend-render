import type { ITransactionRepository } from "../../domain/repositories/ITransactionRepository.js";

export class GetTransactionsUseCase {
  constructor(private transactionRepository: ITransactionRepository) {}

  async execute(filter?: {
    schoolUnitId?: number;
    type?: string;
    categoryId?: number;
  }): Promise<any[]> {
    return await this.transactionRepository.findAll(filter);
  }
}
