import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";

export class DeleteSppTariffUseCase {
  constructor(private sppTariffRepository: ISppTariffRepository) {}

  async execute(id: number): Promise<void> {
    const existing = await this.sppTariffRepository.findById(id);

    if (!existing) {
      throw new Error("Tarif SPP tidak ditemukan");
    }

    await this.sppTariffRepository.delete(id);
  }
}
