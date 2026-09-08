import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import { ForbiddenError, NotFoundError } from "../../domain/errors/AppError.js";

export class DeleteCategoryUseCase {
  constructor(private categoryRepository: ICategoryRepository) {}

  async execute(id: number, user?: { role: string; schoolUnitId: number | null }): Promise<void> {
    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new NotFoundError("Kategori tidak ditemukan");
    }

    if (user && user.role === "UNIT_ADMIN") {
      if (category.schoolUnitId !== user.schoolUnitId) {
        throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola kategori ini");
      }
    }

    await this.categoryRepository.delete(id);
  }
}
