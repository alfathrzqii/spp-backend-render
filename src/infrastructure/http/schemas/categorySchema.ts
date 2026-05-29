import { z } from "zod";

export const categorySchema = z.object({
  body: z.object({
    name: z.string({ required_error: "Nama kategori wajib diisi" }).min(1, "Nama kategori tidak boleh kosong"),
    type: z.enum(["INCOME", "EXPENSE"], {
      required_error: "Tipe kategori wajib diisi (INCOME/EXPENSE)",
      invalid_type_error: "Tipe kategori harus INCOME atau EXPENSE",
    }),
    schoolUnitId: z.number().int().nullable().optional(),
  }),
});
