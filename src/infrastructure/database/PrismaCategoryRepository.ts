import prisma from "./prisma.js";
import type { ICategoryRepository } from "../../domain/repositories/ICategoryRepository.js";
import { Category } from "../../domain/entities/Category.js";

export class PrismaCategoryRepository implements ICategoryRepository {
  private prisma = prisma;

  async create(data: Omit<Category, "id">): Promise<Category> {
    const created = await this.prisma.category.create({
      data: {
        name: data.name,
        type: data.type,
        schoolUnitId: data.schoolUnitId,
      },
    });

    return new Category(
      created.id,
      created.name,
      created.type,
      created.schoolUnitId,
    );
  }

  async findAll(filter?: {
    schoolUnitIds: (number | null)[];
  }): Promise<Category[]> {
    const where: any = {};
    if (filter?.schoolUnitIds) {
      const nonNullIds = filter.schoolUnitIds.filter(
        (id) => id !== null,
      ) as number[];
      const hasNull = filter.schoolUnitIds.includes(null);

      if (hasNull && nonNullIds.length > 0) {
        // Skenario Admin Unit: butuh yang schoolUnitId === null OR schoolUnitId IN [3]
        where.OR = [
          { schoolUnitId: null },
          { schoolUnitId: { in: nonNullIds } },
        ];
      } else if (hasNull) {
        // Skenario cadangan jika hanya meminta yang global saja
        where.schoolUnitId = null;
      } else {
        // Skenario jika hanya meminta unit-unit tertentu tanpa global
        where.schoolUnitId = { in: nonNullIds };
      }
    }

    const categories = await this.prisma.category.findMany({
      where,
    });

    return categories.map(
      (c) => new Category(c.id, c.name, c.type, c.schoolUnitId),
    );
  }

  async findById(id: number): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) return null;

    return new Category(
      category.id,
      category.name,
      category.type,
      category.schoolUnitId,
    );
  }

  async update(
    id: number,
    data: Partial<Omit<Category, "id">>,
  ): Promise<Category> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.schoolUnitId !== undefined)
      updateData.schoolUnitId = data.schoolUnitId;

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    return new Category(
      updated.id,
      updated.name,
      updated.type,
      updated.schoolUnitId,
    );
  }

  async delete(id: number): Promise<void> {
    await this.prisma.category.delete({
      where: { id },
    });
  }
}
