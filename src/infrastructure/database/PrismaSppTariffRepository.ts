import prisma from "./prisma.js";
import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import { SppTariff } from "../../domain/entities/SppTariff.js";

export class PrismaSppTariffRepository implements ISppTariffRepository {
  private prisma = prisma;

  async create(data: Omit<SppTariff, "id">): Promise<SppTariff> {
    const created = await this.prisma.sppTariff.create({
      data: {
        schoolUnitId: data.schoolUnitId,
        enrollmentYear: data.enrollmentYear,
        amount: data.amount,
      },
    });

    return new SppTariff(
      created.id,
      created.schoolUnitId,
      created.enrollmentYear,
      created.amount
    );
  }

  async findAll(filter?: { schoolUnitId?: number }): Promise<SppTariff[]> {
    const where: any = {};
    if (filter?.schoolUnitId !== undefined) {
      where.schoolUnitId = filter.schoolUnitId;
    }

    const tariffs = await this.prisma.sppTariff.findMany({
      where,
    });

    return tariffs.map(
      (t) => new SppTariff(t.id, t.schoolUnitId, t.enrollmentYear, t.amount)
    );
  }

  async findById(id: number): Promise<SppTariff | null> {
    const tariff = await this.prisma.sppTariff.findUnique({
      where: { id },
    });

    if (!tariff) return null;

    return new SppTariff(
      tariff.id,
      tariff.schoolUnitId,
      tariff.enrollmentYear,
      tariff.amount
    );
  }

  async findByUnitAndYear(
    schoolUnitId: number,
    enrollmentYear: number
  ): Promise<SppTariff | null> {
    const tariff = await this.prisma.sppTariff.findUnique({
      where: {
        uq_school_unit_enrollment_year: {
          schoolUnitId,
          enrollmentYear,
        },
      },
    });

    if (!tariff) return null;

    return new SppTariff(
      tariff.id,
      tariff.schoolUnitId,
      tariff.enrollmentYear,
      tariff.amount
    );
  }

  async update(id: number, amount: number): Promise<SppTariff> {
    const updated = await this.prisma.sppTariff.update({
      where: { id },
      data: { amount },
    });

    return new SppTariff(
      updated.id,
      updated.schoolUnitId,
      updated.enrollmentYear,
      updated.amount
    );
  }

  async delete(id: number): Promise<void> {
    await this.prisma.sppTariff.delete({
      where: { id },
    });
  }
}
