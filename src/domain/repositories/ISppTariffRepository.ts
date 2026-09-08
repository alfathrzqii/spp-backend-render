import { SppTariff } from "../entities/SppTariff.js";

export interface ISppTariffRepository {
  create(data: Omit<SppTariff, "id">): Promise<SppTariff>;
  findAll(filter?: { schoolUnitId?: number }): Promise<SppTariff[]>;
  findById(id: number): Promise<SppTariff | null>;
  findBySchoolUnitIds(schoolUnitIds: number[]): Promise<SppTariff[]>;
  findByUnitAndYear(
    schoolUnitId: number,
    enrollmentYear: number
  ): Promise<SppTariff | null>;
  update(
    id: number,
    amount: number,
    developmentFee?: number,
    reRegistrationFee?: number,
    equipmentFee?: number,
    extracurricularFee?: number,
    uniformFee?: number
  ): Promise<SppTariff>;
  delete(id: number): Promise<void>;
}
