import { Transaction } from "../entities/Transaction.js";

export interface ITransactionRepository {
  create(data: Omit<Transaction, "id" | "date">): Promise<Transaction>;
  findAll(filter?: {
    schoolUnitId?: number;
    type?: string;
    categoryId?: number;
  }): Promise<any[]>;
}
