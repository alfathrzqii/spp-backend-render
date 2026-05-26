import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import { SppTariff } from "../../domain/entities/SppTariff.js";

export class GetSppTariffsUseCase {
  constructor(private sppTariffRepository: ISppTariffRepository) {}

  async execute(filter?: { schoolUnitId?: number }): Promise<SppTariff[]> {
    return await this.sppTariffRepository.findAll(filter);
  }
}
