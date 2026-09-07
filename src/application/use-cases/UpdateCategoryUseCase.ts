import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import { Category } from "../../domain/entities/Category.js";
import type { CategoryType } from "../../domain/enums/CategoryType.js";
import { NotFoundError } from "../../domain/errors/AppError.js";

export class UpdateCategoryUseCase {
  constructor(private categoryRepository: ICategoryRepository) {}

  async execute(
    id: number,
    data: {
      name?: string;
      type?: CategoryType;
      schoolUnitId?: number | null;
    }
  ): Promise<Category> {
    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new NotFoundError("Kategori tidak ditemukan");
    }

    return await this.categoryRepository.update(id, data);
  }
}
