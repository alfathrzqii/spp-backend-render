import type { ISppTariffRepository } from "../../domain/repositories/ISppTariffRepository.js";
import { SppTariff } from "../../domain/entities/SppTariff.js";

export class CreateSppTariffUseCase {
  constructor(private sppTariffRepository: ISppTariffRepository) {}

  async execute(data: {
    schoolUnitId: number;
    enrollmentYear: number;
    amount: number;
  }): Promise<SppTariff> {
    const existing = await this.sppTariffRepository.findByUnitAndYear(
      data.schoolUnitId,
      data.enrollmentYear
    );

    if (existing) {
      throw new Error(
        "Gagal: Tarif SPP untuk unit dan angkatan tersebut sudah terdaftar"
      );
    }

    return await this.sppTariffRepository.create(data);
  }
}
