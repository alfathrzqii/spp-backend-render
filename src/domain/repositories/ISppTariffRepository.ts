import { SppTariff } from "../entities/SppTariff.js";

export interface ISppTariffRepository {
  create(data: Omit<SppTariff, "id">): Promise<SppTariff>;
  findAll(filter?: { schoolUnitId?: number }): Promise<SppTariff[]>;
  findById(id: number): Promise<SppTariff | null>;
  findByUnitAndYear(
    schoolUnitId: number,
    enrollmentYear: number
  ): Promise<SppTariff | null>;
  update(id: number, amount: number): Promise<SppTariff>;
  delete(id: number): Promise<void>;
}
