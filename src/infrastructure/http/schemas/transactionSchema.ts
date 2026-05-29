import { z } from "zod";

export const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(["INCOME", "EXPENSE"], {
      required_error: "Tipe transaksi wajib diisi (INCOME/EXPENSE)",
    }),
    categoryId: z.number({ required_error: "ID kategori wajib diisi" }).int(),
    paymentMethod: z.enum(["CASH", "TRANSFER"], {
      required_error: "Metode pembayaran wajib diisi (CASH/TRANSFER)",
    }),
    amount: z
      .number({ required_error: "Nominal transaksi wajib diisi" })
      .int()
      .positive({ message: "Nominal harus bilangan bulat positif" }),
    description: z.string().optional(),
    schoolUnitId: z.number().int().optional(),
  }),
});
