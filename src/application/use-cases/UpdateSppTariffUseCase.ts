import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import { SppTariff } from "../../domain/entities/SppTariff.js";

export class UpdateSppTariffUseCase {
  constructor(private sppTariffRepository: ISppTariffRepository) {}

  async execute(id: number, amount: number): Promise<SppTariff> {
    const existing = await this.sppTariffRepository.findById(id);

    if (!existing) {
      throw new Error("Tarif SPP tidak ditemukan");
    }

    return await this.sppTariffRepository.update(id, amount);
  }
}
