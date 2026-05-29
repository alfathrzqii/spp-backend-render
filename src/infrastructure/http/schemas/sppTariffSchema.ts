import { z } from "zod";

export const sppTariffSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: "Nominal tarif SPP wajib diisi" })
      .int({ message: "Nominal harus berupa angka integer" })
      .positive({ message: "Nominal harus lebih besar dari 0" }),
    enrollmentYear: z
      .number({ required_error: "Tahun angkatan wajib diisi" })
      .int({ message: "Tahun angkatan harus berupa angka integer" })
      .min(2000, { message: "Tahun angkatan minimal tahun 2000" })
      .max(9999, { message: "Tahun angkatan maksimal tahun 9999" }),
    schoolUnitId: z
      .number({ required_error: "ID unit sekolah wajib diisi" })
      .int({ message: "ID unit sekolah harus berupa angka integer" })
      .positive({ message: "ID unit sekolah harus positif" }),
  }),
});
