import { z } from "zod";

export const offlinePaymentSchema = z.object({
  body: z.object({
    studentNumber: z.string({ required_error: "Nomor induk siswa wajib diisi" }),
    month: z
      .number({ required_error: "Bulan wajib diisi" })
      .int()
      .min(1, { message: "Bulan harus antara 1-12" })
      .max(12, { message: "Bulan harus antara 1-12" }),
    year: z
      .number({ required_error: "Tahun wajib diisi" })
      .int()
      .min(2000, { message: "Tahun tidak valid" }),
    invoiceType: z.literal("SPP", {
      required_error: "Tipe invoice wajib diisi ('SPP')",
    }),
  }),
});
