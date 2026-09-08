import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import { Category } from "../../domain/entities/Category.js";
import type { CategoryType } from "../../domain/enums/CategoryType.js";
import { ForbiddenError, NotFoundError } from "../../domain/errors/AppError.js";

export class UpdateCategoryUseCase {
  constructor(private categoryRepository: ICategoryRepository) {}

  async execute(
    id: number,
    data: {
      name?: string;
      type?: CategoryType;
      schoolUnitId?: number | null;
    },
    user?: { role: string; schoolUnitId: number | null }
  ): Promise<Category> {
    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new NotFoundError("Kategori tidak ditemukan");
    }

    if (user && user.role === "UNIT_ADMIN") {
      if (category.schoolUnitId !== user.schoolUnitId) {
        throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola kategori ini");
      }
    }

    return await this.categoryRepository.update(id, data);
  }
}
