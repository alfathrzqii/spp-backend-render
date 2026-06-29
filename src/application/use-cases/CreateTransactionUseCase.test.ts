import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTransactionUseCase } from './CreateTransactionUseCase.js';
import { mockDeep } from 'vitest-mock-extended';
import type { ITransactionRepository } from '../../domain/repositories/ITransactionRepository.js';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository.js';
import { Transaction } from '../../domain/entities/Transaction.js';
import { CategoryType, PaymentMethod } from '@prisma/client';

describe('CreateTransactionUseCase', () => {
  let createTransactionUseCase: CreateTransactionUseCase;
  const mockTransactionRepository = mockDeep<ITransactionRepository>();
  const mockCategoryRepository = mockDeep<ICategoryRepository>();

  beforeEach(() => {
    createTransactionUseCase = new CreateTransactionUseCase(
      mockTransactionRepository,
      mockCategoryRepository
    );
    vi.clearAllMocks();
  });

  const transactionInput = {
    type: CategoryType.INCOME,
    categoryId: 1,
    paymentMethod: PaymentMethod.CASH,
    amount: 100000,
    description: 'Manual transaction',
    schoolUnitId: 1,
    recordedById: 1,
  };

  const mockCategory = {
    id: 1,
    name: 'SPP',
    type: CategoryType.INCOME,
    schoolUnitId: 1,
  };

  it('should create a transaction successfully', async () => {
    mockCategoryRepository.findById.mockResolvedValue(mockCategory);
    const expectedTransaction = new Transaction(
      1,
      new Date(),
      transactionInput.type,
      transactionInput.categoryId,
      transactionInput.paymentMethod,
      transactionInput.amount,
      transactionInput.schoolUnitId,
      null,
      transactionInput.description,
      transactionInput.recordedById
    );
    mockTransactionRepository.create.mockResolvedValue(expectedTransaction);

    const result = await createTransactionUseCase.execute(transactionInput);

    expect(result).toEqual(expectedTransaction);
    expect(mockTransactionRepository.create).toHaveBeenCalledWith({
      ...transactionInput,
      invoiceId: null,
    });
  });

  it('should throw error if category does not exist', async () => {
    mockCategoryRepository.findById.mockResolvedValue(null);

    await expect(createTransactionUseCase.execute(transactionInput)).rejects.toThrow(
      'Kategori transaksi tidak valid'
    );
  });

  it('should throw error if category type mismatch', async () => {
    mockCategoryRepository.findById.mockResolvedValue({
      ...mockCategory,
      type: CategoryType.EXPENSE,
    });

    await expect(createTransactionUseCase.execute(transactionInput)).rejects.toThrow(
      'Tipe kategori tidak cocok dengan konteks pencatatan'
    );
  });
});
