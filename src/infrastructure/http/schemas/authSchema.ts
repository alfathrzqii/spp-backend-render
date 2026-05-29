import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email wajib diisi" })
      .email({ message: "Format email tidak valid" }),
    password: z
      .string({ required_error: "Password wajib diisi" })
      .min(6, { message: "Password minimal 6 karakter" }),
  }),
});
