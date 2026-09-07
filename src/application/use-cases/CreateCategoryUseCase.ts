import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import { Category } from "../../domain/entities/Category.js";
import type { CategoryType } from "../../domain/enums/CategoryType.js";

export class CreateCategoryUseCase {
  constructor(private categoryRepository: ICategoryRepository) {}

  async execute(data: {
    name: string;
    type: CategoryType;
    schoolUnitId: number | null;
  }): Promise<Category> {
    return await this.categoryRepository.create(data);
  }
}
