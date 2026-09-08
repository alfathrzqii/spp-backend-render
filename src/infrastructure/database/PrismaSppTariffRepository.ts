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
        developmentFee: data.developmentFee,
        reRegistrationFee: data.reRegistrationFee,
        equipmentFee: data.equipmentFee,
        extracurricularFee: data.extracurricularFee,
        uniformFee: data.uniformFee,
      },
    });

    return new SppTariff(
      created.id,
      created.schoolUnitId,
      created.enrollmentYear,
      created.amount,
      created.developmentFee,
      created.reRegistrationFee,
      created.equipmentFee,
      created.extracurricularFee,
      created.uniformFee
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
      (t) => new SppTariff(
        t.id,
        t.schoolUnitId,
        t.enrollmentYear,
        t.amount,
        t.developmentFee,
        t.reRegistrationFee,
        t.equipmentFee,
        t.extracurricularFee,
        t.uniformFee
      )
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
      tariff.amount,
      tariff.developmentFee,
      tariff.reRegistrationFee,
      tariff.equipmentFee,
      tariff.extracurricularFee,
      tariff.uniformFee
    );
  }

  async findBySchoolUnitIds(schoolUnitIds: number[]): Promise<SppTariff[]> {
    const tariffs = await this.prisma.sppTariff.findMany({
      where: {
        schoolUnitId: { in: schoolUnitIds },
      },
    });

    return tariffs.map(
      (t) =>
        new SppTariff(
          t.id,
          t.schoolUnitId,
          t.enrollmentYear,
          t.amount,
          t.developmentFee,
          t.reRegistrationFee,
          t.equipmentFee,
          t.extracurricularFee,
          t.uniformFee
        )
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
      tariff.amount,
      tariff.developmentFee,
      tariff.reRegistrationFee,
      tariff.equipmentFee,
      tariff.extracurricularFee,
      tariff.uniformFee
    );
  }

  async update(
    id: number,
    amount: number,
    developmentFee?: number,
    reRegistrationFee?: number,
    equipmentFee?: number,
    extracurricularFee?: number,
    uniformFee?: number
  ): Promise<SppTariff> {
    const dataToUpdate: any = { amount };
    if (developmentFee !== undefined) dataToUpdate.developmentFee = developmentFee;
    if (reRegistrationFee !== undefined) dataToUpdate.reRegistrationFee = reRegistrationFee;
    if (equipmentFee !== undefined) dataToUpdate.equipmentFee = equipmentFee;
    if (extracurricularFee !== undefined) dataToUpdate.extracurricularFee = extracurricularFee;
    if (uniformFee !== undefined) dataToUpdate.uniformFee = uniformFee;

    const updated = await this.prisma.sppTariff.update({
      where: { id },
      data: dataToUpdate,
    });

    return new SppTariff(
      updated.id,
      updated.schoolUnitId,
      updated.enrollmentYear,
      updated.amount,
      updated.developmentFee,
      updated.reRegistrationFee,
      updated.equipmentFee,
      updated.extracurricularFee,
      updated.uniformFee
    );
  }

  async delete(id: number): Promise<void> {
    await this.prisma.sppTariff.delete({
      where: { id },
    });
  }
}
