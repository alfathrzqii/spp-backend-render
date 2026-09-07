import prisma from "./prisma.js";
import type { ISchoolUnitRepository } from "../../domain/repositories/ISchoolUnitRepository.js";
import { SchoolUnit } from "../../domain/entities/SchoolUnit.js";

export class PrismaSchoolUnitRepository implements ISchoolUnitRepository {
  private prisma = prisma;

  private mapToDomain(unit: any): SchoolUnit {
    return new SchoolUnit(unit.id, unit.name);
  }

  async findById(id: number): Promise<SchoolUnit | null> {
    const unit = await this.prisma.schoolUnit.findUnique({
      where: { id },
    });
    if (!unit) return null;
    return this.mapToDomain(unit);
  }

  async findAll(): Promise<SchoolUnit[]> {
    const units = await this.prisma.schoolUnit.findMany({
      orderBy: { id: "asc" },
    });
    return units.map((u) => this.mapToDomain(u));
  }

  async ensureExists(id: number, defaultName: string): Promise<SchoolUnit> {
    const existing = await this.prisma.schoolUnit.findUnique({
      where: { id },
    });
    if (existing) {
      return this.mapToDomain(existing);
    }
    const created = await this.prisma.schoolUnit.create({
      data: {
        id,
        name: defaultName.toUpperCase() || "UNIT",
      },
    });
    return this.mapToDomain(created);
  }
}

