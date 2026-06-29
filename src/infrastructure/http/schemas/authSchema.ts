import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string({ required_error: "Email atau Nomor HP wajib diisi" }),
    password: z
      .string({ required_error: "Password wajib diisi" })
      .min(6, { message: "Password minimal 6 karakter" }),
  }),
});
