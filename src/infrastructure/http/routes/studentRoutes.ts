import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import { StudentController } from "../controllers/StudentController.js";
import { PrismaStudentRepository } from "../../database/PrismaStudentRepository.js";
import { PrismaUserRepository } from "../../database/PrismaUserRepository.js";
import { PrismaSppTariffRepository } from "../../database/PrismaSppTariffRepository.js";
import { PasswordHasher } from "../../services/PasswordHasher.js";
import { CreateStudentUseCase } from "../../../application/use-cases/CreateStudentUseCase.js";
import { GetStudentsUseCase } from "../../../application/use-cases/GetStudentsUseCase.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createStudentSchema } from "../schemas/studentSchema.js";
import { UpdateStudentUseCase } from "../../../application/use-cases/UpdateStudentUseCase.js";
import { DeleteStudentUseCase } from "../../../application/use-cases/DeleteStudentUseCase.js";
import prisma from "../../database/prisma.js";
import bcrypt from "bcrypt";

const router = Router();

// Repositories
const studentRepo = new PrismaStudentRepository();
const userRepo = new PrismaUserRepository();
const sppTariffRepo = new PrismaSppTariffRepository();

// Services
const passwordHasher = new PasswordHasher();

// Use Cases
const createStudentUseCase = new CreateStudentUseCase(
  studentRepo,
  userRepo,
  sppTariffRepo,
  passwordHasher
);
const getStudentsUseCase = new GetStudentsUseCase(studentRepo);
const updateStudentUseCase = new UpdateStudentUseCase(studentRepo);
const deleteStudentUseCase = new DeleteStudentUseCase(studentRepo);

// Controller
const studentController = new StudentController(
  createStudentUseCase,
  getStudentsUseCase,
  updateStudentUseCase,
  deleteStudentUseCase
);

// Helper functions for CSV import
function formatBirthDateToPassword(birthDate: string): string {
  if (!birthDate) return "parent123";
  const clean = birthDate.trim();
  
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts[0] && parts[0].length === 4) {
      return `${parts[2]}${parts[1]}${parts[0]}`; // YYYY-MM-DD -> DDMMYYYY
    }
    return parts.join(""); // DD-MM-YYYY -> DDMMYYYY
  }
  
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts[2] && parts[2].length === 4) {
      return `${parts[0]}${parts[1]}${parts[2]}`;
    } else if (parts[0] && parts[0].length === 4) {
      return `${parts[2]}${parts[1]}${parts[0]}`;
    }
  }
  
  return clean.replace(/[^0-9]/g, "") || "parent123";
}

function getUnitIdByName(name: string): number {
  const clean = name.trim().toUpperCase();
  if (clean.includes("KB")) return 1;
  if (clean.includes("RA")) return 2;
  if (clean.includes("SD")) return 3;
  if (clean.includes("TPA")) return 4;
  return 3;
}

// Routes
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  validateRequest(createStudentSchema),
  studentController.create.bind(studentController)
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.getAll.bind(studentController)
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.update.bind(studentController)
);

router.delete(
  "/wipe-all-dummy-data",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const delTx = await prisma.transaction.deleteMany({});
      const delInv = await prisma.invoice.deleteMany({});
      const delSt = await prisma.student.deleteMany({});
      const delUsers = await prisma.user.deleteMany({
        where: {
          role: {
            notIn: ["SUPER_ADMIN", "UNIT_ADMIN"],
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Seluruh data berhasil dibersihkan (${delSt.count} siswa, ${delInv.count} tagihan, ${delTx.count} transaksi, ${delUsers.count} akun ortu)`,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  studentController.delete.bind(studentController)
);

router.post(
  "/import",
  authMiddleware,
  roleMiddleware(["SUPER_ADMIN", "UNIT_ADMIN"]),
  async (req, res, next) => {
    try {
      const authResult = req.user as any;
      const { rows } = req.body;

      if (!rows || !Array.isArray(rows)) {
        res.status(400).json({
          success: false,
          message: "Format data tidak valid. Wajib menyertakan array data siswa.",
        });
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        try {
          let studentNumber = (row.nis || row.studentNumber || "").toString().trim();
          let name = (row.nama || row.name || row.nama_ortu || row.parentName || "").toString().trim();
          const className = (row.kelas || row.className || "N/A").toString().trim();
          const unitName = (row.unit || row.schoolUnitName || "SD").toString().trim();
          const enrollmentYearStr = (row.angkatan || row.enrollmentYear || new Date().getFullYear()).toString().trim();
          const discountStr = (row.diskon || row.discountPercentage || "0").toString().trim();
          const birthDate = (row.tanggal_lahir || row.birthDate || "").toString().trim();
          const parentName = (row.nama_ortu || row.parentName || `Wali dari ${name}`).toString().trim();
          let parentPhoneNumber = (row.hp_ortu || row.parentPhoneNumber || "").toString().trim();
          const parentEmail = (row.email_ortu || row.parentEmail || "").toString().trim();

          if (!name) {
            name = `Siswa ${index + 1}`;
          }

          if (!studentNumber) {
            const cleanClass = className.toUpperCase().replace(/[^A-Z]/g, "") || "KB";
            studentNumber = `${cleanClass}-${new Date().getFullYear()}-${String(index + 1).padStart(3, "0")}`;
          }

          if (!parentPhoneNumber) {
            parentPhoneNumber = `089999999${String(index + 1).padStart(3, "0")}`;
          }

          const schoolUnitId = getUnitIdByName(unitName);
          const enrollmentYear = Number(enrollmentYearStr) || new Date().getFullYear();
          const discountPercentage = Number(discountStr) || 0;

          if (authResult.role === "UNIT_ADMIN" && schoolUnitId !== authResult.schoolUnitId) {
            throw new Error(`Akses ditolak: Baris ${index + 1} berada pada unit yang berbeda dari kewenangan Anda`);
          }

          await prisma.$transaction(async (tx) => {
            // Ensure school unit exists in master data to avoid FK constraint errors
            const existingUnit = await tx.schoolUnit.findUnique({
              where: { id: schoolUnitId },
            });
            if (!existingUnit) {
              await tx.schoolUnit.create({
                data: {
                  id: schoolUnitId,
                  name: unitName.toUpperCase() || "UNIT",
                },
              });
            }

            let parentUser = await tx.user.findUnique({
              where: { phoneNumber: parentPhoneNumber },
            });

            if (!parentUser) {
              const defaultPassword = formatBirthDateToPassword(birthDate);
              const passwordHash = await bcrypt.hash(defaultPassword, 10);

              parentUser = await tx.user.create({
                data: {
                  name: parentName,
                  email: parentEmail || null,
                  phoneNumber: parentPhoneNumber,
                  password: passwordHash,
                  role: "PARENT",
                  schoolUnitId: null,
                },
              });
            }

            const existingStudent = await tx.student.findUnique({
              where: { studentNumber },
            });

            if (existingStudent) {
              await tx.student.update({
                where: { studentNumber },
                data: {
                  name,
                  className,
                  schoolUnitId,
                  enrollmentYear,
                  discountPercentage,
                  parentId: parentUser.id,
                },
              });
            } else {
              await tx.student.create({
                data: {
                  studentNumber,
                  name,
                  className,
                  schoolUnitId,
                  enrollmentYear,
                  discountPercentage,
                  parentId: parentUser.id,
                },
              });
            }
          });

          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push(`Baris ${index + 1}: ${err.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: `Import selesai. Sukses: ${successCount}, Gagal: ${failedCount}`,
        data: {
          successCount,
          failedCount,
          errors,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
