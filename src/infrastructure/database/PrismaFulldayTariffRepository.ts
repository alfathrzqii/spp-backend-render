import type { PrismaClient } from "@prisma/client";
import defaultPrisma from "./prisma.js";
import { FulldayTariff } from "../../domain/entities/FulldayTariff.js";
import type {
  IFulldayTariffRepository,
  CreateFulldayTariffDTO,
  UpdateFulldayTariffDTO,
} from "../../domain/repositories/IFulldayTariffRepository.js";

export class PrismaFulldayTariffRepository implements IFulldayTariffRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  private mapToDomain(raw: any): FulldayTariff {
    return new FulldayTariff(
      raw.id,
      raw.schoolUnitId,
      raw.enrollmentYear,
      raw.monthlyFee
    );
  }

  async create(data: CreateFulldayTariffDTO): Promise<FulldayTariff> {
    const created = await (this.prisma as any).fulldayTariff.create({
      data: {
        schoolUnitId: data.schoolUnitId,
        enrollmentYear: data.enrollmentYear,
        monthlyFee: data.monthlyFee,
      },
    });
    return this.mapToDomain(created);
  }

  async findById(id: number): Promise<FulldayTariff | null> {
    const raw = await (this.prisma as any).fulldayTariff.findUnique({
      where: { id },
    });
    return raw ? this.mapToDomain(raw) : null;
  }

  async findByUnitAndYear(schoolUnitId: number, enrollmentYear: number): Promise<FulldayTariff | null> {
    const raw = await (this.prisma as any).fulldayTariff.findUnique({
      where: {
        uq_fullday_school_unit_enrollment_year: {
          schoolUnitId,
          enrollmentYear,
        },
      },
    });
    return raw ? this.mapToDomain(raw) : null;
  }

  async findAll(): Promise<FulldayTariff[]> {
    const list = await (this.prisma as any).fulldayTariff.findMany({
      orderBy: [{ schoolUnitId: "asc" }, { enrollmentYear: "desc" }],
    });
    return list.map((item: any) => this.mapToDomain(item));
  }

  async update(id: number, data: UpdateFulldayTariffDTO): Promise<FulldayTariff> {
    const updated = await (this.prisma as any).fulldayTariff.update({
      where: { id },
      data,
    });
    return this.mapToDomain(updated);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await (this.prisma as any).fulldayTariff.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
