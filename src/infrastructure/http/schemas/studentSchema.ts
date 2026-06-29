import { z } from "zod";

export const createStudentSchema = z.object({
  body: z.object({
    studentNumber: z.string({ required_error: "Nomor induk siswa wajib diisi" }),
    name: z.string({ required_error: "Nama siswa wajib diisi" }),
    className: z.string({ required_error: "Kelas wajib diisi" }),
    schoolUnitId: z.number({ required_error: "ID unit sekolah wajib diisi" }).int(),
    enrollmentYear: z.number({ required_error: "Tahun angkatan wajib diisi" }).int(),
    discountPercentage: z.number().min(0).max(100).optional(),
    parentName: z.string({ required_error: "Nama orang tua wajib diisi" }),
    parentEmail: z
      .string()
      .email({ message: "Format email tidak valid" })
      .optional(),
    parentPhoneNumber: z.string({ required_error: "Nomor HP orang tua wajib diisi" }),
  }),
});
