import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateCategoryUseCase } from './CreateCategoryUseCase.js';
import { prismaMock } from '../../infrastructure/database/__mocks__/prisma.js';
import { Category } from '../../domain/entities/Category.js';
import { mockDeep } from 'vitest-mock-extended';
import type { ICategoryRepository } from '../../domain/repositories/ICategoryRepository.js';

describe('CreateCategoryUseCase', () => {
  let createCategoryUseCase: CreateCategoryUseCase;
  const mockCategoryRepository = mockDeep<ICategoryRepository>();

  beforeEach(() => {
    createCategoryUseCase = new CreateCategoryUseCase(mockCategoryRepository);
    vi.clearAllMocks();
  });

  it('should create a category successfully', async () => {
    const categoryData = {
      name: 'Monthly Tuition',
      type: 'MONTHLY' as const,
      schoolUnitId: 1,
    };

    const expectedCategory = new Category(
      1,
      categoryData.name,
      categoryData.type,
      categoryData.schoolUnitId,
    );

    mockCategoryRepository.create.mockResolvedValue(expectedCategory);

    const result = await createCategoryUseCase.execute(categoryData);

    expect(result).toBeInstanceOf(Category);
    expect(result.name).toBe(categoryData.name);
    expect(mockCategoryRepository.create).toHaveBeenCalledWith(categoryData);
  });

  it('should throw an error if repository fails', async () => {
    const categoryData = {
      name: 'Monthly Tuition',
      type: 'MONTHLY' as const,
      schoolUnitId: 1,
    };

    mockCategoryRepository.create.mockRejectedValue(new Error('Database error'));

    await expect(createCategoryUseCase.execute(categoryData)).rejects.toThrow('Database error');
  });
});
