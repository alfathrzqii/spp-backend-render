import type { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma.js";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";
import type { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";

export class InvoiceController {
  constructor(
    private processOfflinePaymentUseCase: ProcessOfflinePaymentUseCase,
    private studentRepository: IStudentRepository
  ) {}

  async payOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber, month, year } = req.body;

      const student = await this.studentRepository.findByStudentNumber(studentNumber);
      if (!student) {
        throw new NotFoundError("Siswa tidak ditemukan");
      }

      if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini");
        }
      }

      const result = await this.processOfflinePaymentUseCase.execute({
        studentId: student.id,
        month: Number(month),
        year: Number(year),
        recordedById: user.id,
      });

      res.status(200).json({
        success: true,
        message: "Pembayaran tunai SPP offline berhasil diproses",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getUnpaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const upToMonth = req.query.upToMonth ? Number(req.query.upToMonth) : new Date().getMonth() + 1;

      const where: any = {};
      
      let userClassName: string | null = null;
      if ((user.role as any) === "WALI_KELAS") {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { className: true } as any,
        });
        userClassName = (dbUser as any)?.className || null;
      }

      if ((user.role as any) === "UNIT_ADMIN") {
        where.schoolUnitId = user.schoolUnitId;
      } else if ((user.role as any) === "WALI_KELAS") {
        where.schoolUnitId = user.schoolUnitId;
        where.className = userClassName;
      } else if ((user.role as any) === "PARENT") {
        where.parentId = user.id;
      }

      const students = await prisma.student.findMany({
        where,
        include: {
          schoolUnit: { select: { name: true } },
          parent: { select: { name: true, phoneNumber: true } },
        },
        orderBy: { name: "asc" },
      });

      const unpaidList = [];

      for (const student of students) {
        const tariff = await prisma.sppTariff.findUnique({
          where: {
            uq_school_unit_enrollment_year: {
              schoolUnitId: student.schoolUnitId,
              enrollmentYear: student.enrollmentYear,
            },
          },
        });

        if (!tariff) continue;

        const baseAmount = tariff.amount;
        const discountApplied = Math.floor((baseAmount * student.discountPercentage) / 100);
        const netAmount = baseAmount - discountApplied;

        const dbInvoices = await prisma.invoice.findMany({
          where: {
            studentId: student.id,
            invoiceType: "SPP" as any,
            year,
            month: { lte: upToMonth },
          },
        });

        let totalUnpaidMonths = 0;
        let totalUnpaidAmount = 0;

        for (let m = 1; m <= upToMonth; m++) {
          const inv = dbInvoices.find((i) => i.month === m);
          if (!inv) {
            totalUnpaidMonths++;
            totalUnpaidAmount += netAmount;
          } else if ((inv.status as any) === "PENDING") {
            totalUnpaidMonths++;
            totalUnpaidAmount += inv.amount;
          } else if ((inv.status as any) === "PARTIALLY_PAID") {
            const txSum = await prisma.transaction.aggregate({
              where: { invoiceId: inv.id, type: "INCOME" as any },
              _sum: { amount: true },
            });
            const paid = txSum._sum.amount || 0;
            const unpaidPart = Math.max(0, inv.amount - paid);
            if (unpaidPart > 0) {
              totalUnpaidMonths++;
              totalUnpaidAmount += unpaidPart;
            }
          }
        }

        if (totalUnpaidMonths > 0) {
          unpaidList.push({
            studentId: student.id,
            studentNumber: student.studentNumber,
            name: student.name,
            className: student.className,
            schoolUnit: student.schoolUnit.name,
            parentName: student.parent?.name || "-",
            parentPhone: student.parent?.phoneNumber || "-",
            unpaidMonthsCount: totalUnpaidMonths,
            totalUnpaidAmount,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: "Laporan tunggakan SPP berhasil diambil",
        data: unpaidList,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClassRecap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const upToMonth = req.query.upToMonth ? Number(req.query.upToMonth) : new Date().getMonth() + 1;

      const where: any = {};
      
      let userClassName: string | null = null;
      if ((user.role as any) === "WALI_KELAS") {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { className: true } as any,
        });
        userClassName = (dbUser as any)?.className || null;
      }

      if ((user.role as any) === "UNIT_ADMIN") {
        where.schoolUnitId = user.schoolUnitId;
      } else if ((user.role as any) === "WALI_KELAS") {
        where.schoolUnitId = user.schoolUnitId;
        where.className = userClassName;
      }

      const students = await prisma.student.findMany({
        where,
      });

      const classMap: Record<string, { unitId: number; className: string; students: any[] }> = {};
      students.forEach((s) => {
        const key = `${s.schoolUnitId}-${s.className}`;
        if (!classMap[key]) {
          classMap[key] = {
            unitId: s.schoolUnitId,
            className: s.className,
            students: [],
          };
        }
        classMap[key].students.push(s);
      });

      const recap = [];

      for (const group of Object.values(classMap)) {
        let totalStudentsInClass = group.students.length;
        let studentsWithUnpaid = 0;
        let totalUnpaidMonthsClass = 0;
        let totalUnpaidNominalClass = 0;

        const schoolUnit = await prisma.schoolUnit.findUnique({
          where: { id: group.unitId },
          select: { name: true },
        });

        for (const student of group.students) {
          const tariff = await prisma.sppTariff.findUnique({
            where: {
              uq_school_unit_enrollment_year: {
                schoolUnitId: student.schoolUnitId,
                enrollmentYear: student.enrollmentYear,
              },
            },
          });

          if (!tariff) continue;

          const baseAmount = tariff.amount;
          const discountApplied = Math.floor((baseAmount * student.discountPercentage) / 100);
          const netAmount = baseAmount - discountApplied;

          const dbInvoices = await prisma.invoice.findMany({
            where: {
              studentId: student.id,
              invoiceType: "SPP" as any,
              year,
              month: { lte: upToMonth },
            },
          });

          let studentUnpaidMonths = 0;
          let studentUnpaidAmount = 0;

          for (let m = 1; m <= upToMonth; m++) {
            const inv = dbInvoices.find((i) => i.month === m);
            if (!inv) {
              studentUnpaidMonths++;
              studentUnpaidAmount += netAmount;
            } else if ((inv.status as any) === "PENDING") {
              studentUnpaidMonths++;
              studentUnpaidAmount += inv.amount;
            } else if ((inv.status as any) === "PARTIALLY_PAID") {
              const txSum = await prisma.transaction.aggregate({
                where: { invoiceId: inv.id, type: "INCOME" as any },
                _sum: { amount: true },
              });
              const paid = txSum._sum.amount || 0;
              const unpaidPart = Math.max(0, inv.amount - paid);
              if (unpaidPart > 0) {
                studentUnpaidMonths++;
                studentUnpaidAmount += unpaidPart;
              }
            }
          }

          if (studentUnpaidMonths > 0) {
            studentsWithUnpaid++;
            totalUnpaidMonthsClass += studentUnpaidMonths;
            totalUnpaidNominalClass += studentUnpaidAmount;
          }
        }

        recap.push({
          schoolUnitId: group.unitId,
          schoolUnit: schoolUnit?.name || "-",
          className: group.className,
          totalStudents: totalStudentsInClass,
          unpaidStudentsCount: studentsWithUnpaid,
          totalUnpaidMonths: totalUnpaidMonthsClass,
          totalUnpaidNominal: totalUnpaidNominalClass,
        });
      }

      res.status(200).json({
        success: true,
        message: "Rekap tunggakan SPP per kelas berhasil diambil",
        data: recap,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudentInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const studentNumber = req.params["studentNumber"] as string;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

      if (!studentNumber) {
        res.status(400).json({ success: false, message: "NIS siswa harus disertakan" });
        return;
      }

      const student = await prisma.student.findUnique({
        where: { studentNumber },
        include: {
          schoolUnit: { select: { name: true } },
          parent: { select: { id: true, name: true, email: true } },
        },
      });

      if (!student) {
        res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
        return;
      }

      if ((user.role as any) === "PARENT") {
        if (student.parentId !== user.id) {
          res.status(403).json({ success: false, message: "Akses ditolak: Anda hanya diizinkan melihat tagihan anak Anda sendiri" });
          return;
        }
      } else if ((user.role as any) === "WALI_KELAS") {
        let userClassName: string | null = null;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { className: true } as any,
        });
        userClassName = (dbUser as any)?.className || null;

        if (
          student.schoolUnitId !== user.schoolUnitId ||
          student.className !== userClassName
        ) {
          res.status(403).json({ success: false, message: "Akses ditolak: Anda hanya diizinkan melihat tagihan siswa kelas bimbingan Anda" });
          return;
        }
      } else if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          res.status(403).json({ success: false, message: "Akses ditolak: Anda hanya diizinkan melihat tagihan siswa unit sekolah Anda" });
          return;
        }
      }

      const tariff = await prisma.sppTariff.findUnique({
        where: {
          uq_school_unit_enrollment_year: {
            schoolUnitId: student.schoolUnitId,
            enrollmentYear: student.enrollmentYear,
          },
        },
      });

      if (!tariff) {
        res.status(400).json({
          success: false,
          message: "Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi",
        });
        return;
      }

      const baseAmount = tariff.amount;
      const discountApplied = Math.floor((baseAmount * student.discountPercentage) / 100);
      const netAmount = baseAmount - discountApplied;

      const dbInvoices = await prisma.invoice.findMany({
        where: { studentId: student.id, year },
        include: {
          transactions: {
            where: { type: "INCOME" as any },
          },
        },
        orderBy: { month: "asc" },
      });

      const invoices = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const existing = dbInvoices.find(
          (inv) => inv.month === month && inv.invoiceType === ("SPP" as any)
        );
        if (existing) {
          return existing;
        }
        return {
          id: null,
          studentId: student.id,
          invoiceType: "SPP",
          month,
          year,
          baseAmount,
          discountApplied,
          amount: netAmount,
          status: "PENDING",
          midtransOrderId: null,
        };
      });

      res.status(200).json({
        success: true,
        message: "Daftar invoice SPP siswa berhasil diambil",
        data: invoices,
        allInvoices: dbInvoices,
        student,
      });
    } catch (error) {
      next(error);
    }
  }

  async payOnlineSimulated(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber, month, year } = req.body;

      const student = await prisma.student.findUnique({
        where: { studentNumber },
      });

      if (!student) {
        res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
        return;
      }

      if ((user.role as any) === "PARENT") {
        if (student.parentId !== user.id) {
          res.status(403).json({ success: false, message: "Akses ditolak: Anda hanya diizinkan membayar tagihan anak Anda sendiri" });
          return;
        }
      } else if ((user.role as any) === "WALI_KELAS") {
        let userClassName: string | null = null;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { className: true } as any,
        });
        userClassName = (dbUser as any)?.className || null;

        if (
          student.schoolUnitId !== user.schoolUnitId ||
          student.className !== userClassName
        ) {
          res.status(403).json({ success: false, message: "Akses ditolak: Anda hanya diizinkan memproses tagihan siswa kelas bimbingan Anda" });
          return;
        }
      } else if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          res.status(403).json({ success: false, message: "Akses ditolak: Anda hanya diizinkan memproses tagihan siswa unit sekolah Anda" });
          return;
        }
      }

      const existingInvoice = await prisma.invoice.findUnique({
        where: {
          uq_student_billing_period: {
            studentId: student.id,
            month: Number(month),
            year: Number(year),
            invoiceType: "SPP" as any,
          },
        },
      });

      if (existingInvoice && (existingInvoice.status as any) === "PAID") {
        res.status(400).json({
          success: false,
          message: "Gagal: Tagihan SPP siswa untuk bulan dan tahun tersebut sudah lunas",
        });
        return;
      }

      const tariff = await prisma.sppTariff.findUnique({
        where: {
          uq_school_unit_enrollment_year: {
            schoolUnitId: student.schoolUnitId,
            enrollmentYear: student.enrollmentYear,
          },
        },
      });

      if (!tariff) {
        res.status(400).json({
          success: false,
          message: "Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi",
        });
        return;
      }

      const baseAmount = tariff.amount;
      const discountApplied = Math.floor((baseAmount * student.discountPercentage) / 100);
      const amountToPay = baseAmount - discountApplied;

      const mockOrderId = `MOCK-MIDTRANS-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        let invoice;
        if (existingInvoice) {
          invoice = await tx.invoice.update({
            where: { id: existingInvoice.id },
            data: {
              status: "PAID" as any,
              midtransOrderId: existingInvoice.midtransOrderId || mockOrderId,
            },
          });
        } else {
          invoice = await tx.invoice.create({
            data: {
              studentId: student.id,
              invoiceType: "SPP" as any,
              month: Number(month),
              year: Number(year),
              baseAmount,
              discountApplied,
              amount: amountToPay,
              status: "PAID" as any,
              midtransOrderId: mockOrderId,
            },
          });
        }

        const transaction = await tx.transaction.create({
          data: {
            type: "INCOME" as any,
            categoryId: 1,
            paymentMethod: "MIDTRANS" as any,
            amount: amountToPay,
            description: `Pembayaran SPP online (simulasi Midtrans) bulan ${month} tahun ${year} untuk siswa ${student.name}`,
            schoolUnitId: student.schoolUnitId,
            recordedById: null,
            invoiceId: invoice.id,
          },
        });

        return { invoice, transaction };
      });

      res.status(200).json({
        success: true,
        message: "Simulasi pembayaran online SPP (Midtrans) berhasil diproses",
        data: {
          invoiceId: result.invoice.id,
          studentId: result.invoice.studentId,
          month: result.invoice.month,
          year: result.invoice.year,
          amountPaid: result.transaction.amount,
          transactionId: result.transaction.id,
          midtransOrderId: result.invoice.midtransOrderId,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
}
