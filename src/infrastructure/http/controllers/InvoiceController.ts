import type { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma.js";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";
import type { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import type { GetAllInvoicesUseCase } from "../../../application/use-cases/GetAllInvoicesUseCase.js";
import type { UpdateInvoiceStatusUseCase } from "../../../application/use-cases/UpdateInvoiceStatusUseCase.js";
import type { DeleteInvoiceUseCase } from "../../../application/use-cases/DeleteInvoiceUseCase.js";
import type { PakasirController } from "./PakasirController.js";
import type { IInvoiceRepository } from "../../../domain/repositories/IInvoiceRepository.js";
import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";
import { logger } from "../../services/WinstonLogger.js";


export class InvoiceController {
  constructor(
    private processOfflinePaymentUseCase: ProcessOfflinePaymentUseCase,
    private studentRepository: IStudentRepository,
    private getAllInvoicesUseCase?: GetAllInvoicesUseCase,
    private updateInvoiceStatusUseCase?: UpdateInvoiceStatusUseCase,
    private deleteInvoiceUseCase?: DeleteInvoiceUseCase,
    private pakasirController?: PakasirController,
    private invoiceRepository?: IInvoiceRepository
  ) {}

  async payOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber, month, year, invoiceType, paymentAmount, paymentMethod } = req.body;

      const student = await this.studentRepository.findByStudentNumber(studentNumber);
      if (!student) {
        throw new NotFoundError("Siswa tidak ditemukan");
      }

      if ((user.role as any) === "UNIT_ADMIN") {
        if (student.schoolUnitId !== user.schoolUnitId) {
          throw new ForbiddenError("Akses ditolak: Anda tidak memiliki otoritas untuk mengelola unit sekolah ini");
        }
      }

      const yearNum = Number(year);
      const monthNum = Number(month);

      if (
        yearNum < student.enrollmentYear ||
        (yearNum === student.enrollmentYear && monthNum < 7) ||
        (yearNum === 2026 && monthNum < 7)
      ) {
        res.status(400).json({
          success: false,
          message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)",
        });
        return;
      }

      let method: "CASH" | "TRANSFER" = "CASH";
      if (paymentMethod && (paymentMethod.toUpperCase() === "TRANSFER" || paymentMethod.toLowerCase() === "tf_manual")) {
        method = "TRANSFER";
      }

      const result = await this.processOfflinePaymentUseCase.execute({
        studentId: student.id,
        month: Number(month),
        year: Number(year),
        recordedById: user.id,
        invoiceType: invoiceType as any,
        paymentAmount: paymentAmount !== undefined ? Number(paymentAmount) : undefined,
        paymentMethod: method as any,
      });

      res.status(200).json({
        success: true,
        message: method === "TRANSFER"
          ? "Pembayaran SPP via transfer bank manual berhasil diproses"
          : "Pembayaran tunai SPP offline berhasil diproses",
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
        if (req.query.className) {
          where.className = (req.query.className as string).trim();
        }
      } else if ((user.role as any) === "WALI_KELAS") {
        where.schoolUnitId = user.schoolUnitId;
        where.className = userClassName;
      } else if ((user.role as any) === "PARENT") {
        where.parentId = user.id;
      } else {
        if (req.query.schoolUnitId && !isNaN(Number(req.query.schoolUnitId))) {
          where.schoolUnitId = Number(req.query.schoolUnitId);
        }
        if (req.query.className) {
          where.className = (req.query.className as string).trim();
        }
      }

      where.status = "ACTIVE";
      if (!req.query.className) {
        where.className = { not: "PPDB" };
      }

      const invoiceType = ((req.query.invoiceType as string) || "SPP").toUpperCase();

      const students = await prisma.student.findMany({
        where,
        include: {
          schoolUnit: { select: { name: true } },
          parent: { select: { name: true, phoneNumber: true, email: true } },
          sdExtracurriculars: true,
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

        // 1. SPP Bulanan
        if (invoiceType === "SPP") {
          const baseAmount = tariff.amount;
          const discountApplied = Math.min(baseAmount, student.discountAmount);
          const netAmount = baseAmount - discountApplied;

          if (year < student.enrollmentYear) {
            continue;
          }

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
          const unpaidMonthsList = [];

          let startMonth = 1;
          if (year === student.enrollmentYear) {
            startMonth = 7;
          } else if (year === 2026) {
            startMonth = 7;
          }
          for (let m = startMonth; m <= upToMonth; m++) {
            const inv = dbInvoices.find((i) => i.month === m);
            if (!inv) {
              if (netAmount > 0) {
                totalUnpaidMonths++;
                totalUnpaidAmount += netAmount;
                unpaidMonthsList.push({
                  month: m,
                  status: "PENDING",
                  totalAmount: netAmount,
                  unpaidAmount: netAmount,
                });
              }
            } else if ((inv.status as any) === "PENDING") {
              if (netAmount > 0) {
                totalUnpaidMonths++;
                totalUnpaidAmount += netAmount;
                unpaidMonthsList.push({
                  month: m,
                  status: "PENDING",
                  totalAmount: netAmount,
                  unpaidAmount: netAmount,
                });
              }
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
                unpaidMonthsList.push({
                  month: m,
                  status: "PARTIALLY_PAID",
                  totalAmount: inv.amount,
                  unpaidAmount: unpaidPart,
                });
              }
            }
          }

          if (totalUnpaidMonths > 0) {
            unpaidList.push({
              id: student.id,
              studentNumber: student.studentNumber,
              name: student.name,
              className: student.className,
              schoolUnitId: student.schoolUnitId,
              schoolUnitName: student.schoolUnit.name,
              parentName: student.parent?.name || "-",
              parentPhoneNumber: student.parent?.phoneNumber || "-",
              parentEmail: student.parent?.email || null,
              invoiceType: "SPP",
              totalAmount: netAmount * totalUnpaidMonths,
              paidAmount: 0,
              unpaidAmount: totalUnpaidAmount,
              status: unpaidMonthsList.some(m => m.status === "PARTIALLY_PAID") ? "PARTIALLY_PAID" : "PENDING",
              unpaidMonths: unpaidMonthsList,
              totalUnpaidAmount,
              totalUnpaidCount: totalUnpaidMonths,
            });
          }
        } else if (invoiceType === "FULLDAY") {
          // 2. FULLDAY Bulanan
          if (!student.isFullday) continue;
          if (year < student.enrollmentYear) continue;

          let fulldayFee = 0;
          if (student.schoolUnitId === 1 || student.schoolUnitId === 2) {
            const ft = await (prisma as any).fulldayTariff.findUnique({
              where: {
                uq_fullday_school_unit_enrollment_year: {
                  schoolUnitId: student.schoolUnitId,
                  enrollmentYear: student.enrollmentYear,
                },
              },
            });
            if (ft) {
              fulldayFee = ft.monthlyFee;
            }
          }

          if (fulldayFee <= 0) continue;

          const dbInvoices = await prisma.invoice.findMany({
            where: {
              studentId: student.id,
              invoiceType: "FULLDAY" as any,
              year,
              month: { lte: upToMonth },
            },
          });

          let totalUnpaidMonths = 0;
          let totalUnpaidAmount = 0;
          const unpaidMonthsList = [];

          let startMonth = 1;
          if (year === student.enrollmentYear) {
            startMonth = 7;
          } else if (year === 2026) {
            startMonth = 7;
          }

          for (let m = startMonth; m <= upToMonth; m++) {
            const inv = dbInvoices.find((i) => i.month === m);
            if (!inv) {
              totalUnpaidMonths++;
              totalUnpaidAmount += fulldayFee;
              unpaidMonthsList.push({
                month: m,
                status: "PENDING",
                totalAmount: fulldayFee,
                unpaidAmount: fulldayFee,
              });
            } else if ((inv.status as any) === "PENDING") {
              totalUnpaidMonths++;
              totalUnpaidAmount += fulldayFee;
              unpaidMonthsList.push({
                month: m,
                status: "PENDING",
                totalAmount: fulldayFee,
                unpaidAmount: fulldayFee,
              });
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
                unpaidMonthsList.push({
                  month: m,
                  status: "PARTIALLY_PAID",
                  totalAmount: inv.amount,
                  unpaidAmount: unpaidPart,
                });
              }
            }
          }

          if (totalUnpaidMonths > 0) {
            unpaidList.push({
              id: student.id,
              studentNumber: student.studentNumber,
              name: student.name,
              className: student.className,
              schoolUnitId: student.schoolUnitId,
              schoolUnitName: student.schoolUnit.name,
              parentName: student.parent?.name || "-",
              parentPhoneNumber: student.parent?.phoneNumber || "-",
              parentEmail: student.parent?.email || null,
              invoiceType: "FULLDAY",
              totalAmount: fulldayFee * totalUnpaidMonths,
              paidAmount: 0,
              unpaidAmount: totalUnpaidAmount,
              status: unpaidMonthsList.some(m => m.status === "PARTIALLY_PAID") ? "PARTIALLY_PAID" : "PENDING",
              unpaidMonths: unpaidMonthsList,
              totalUnpaidAmount,
              totalUnpaidCount: totalUnpaidMonths,
            });
          }
        } else {
          // 3. Non-Monthly (UANG_PENGEMBANGAN, EKSTRAKURIKULER, DAFTAR_ULANG, UANG_PERALATAN, SERAGAM)
          let baseAmount = 0;
          let discountApplied = 0;

          if (invoiceType === "UANG_PENGEMBANGAN") {
            if (year < student.enrollmentYear) continue;
            baseAmount = tariff.developmentFee || 0;
            discountApplied = 0;
          } else if (invoiceType === "DAFTAR_ULANG") {
            if (year < student.enrollmentYear) continue;
            baseAmount = tariff.reRegistrationFee || 0;
            discountApplied = 0;
          } else if (invoiceType === "SERAGAM") {
            if (year < student.enrollmentYear) continue;
            baseAmount = tariff.uniformFee || 0;
            discountApplied = 0;
          } else if (invoiceType === "UANG_PERALATAN") {
            if (year < student.enrollmentYear) continue;
            let equipFee = 0;
            if (student.schoolUnitId === 1 || student.schoolUnitId === 2) {
              const level = student.schoolUnitId === 1 
                ? "KB" 
                : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
              const extraTariff = await prisma.extraEquipmentTariff.findUnique({
                where: {
                  uq_school_unit_enrollment_year_level: {
                    schoolUnitId: student.schoolUnitId,
                    enrollmentYear: student.enrollmentYear,
                    level,
                  },
                },
              });
              if (extraTariff) {
                if (student.registrationStatus === "BARU") {
                  equipFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
                } else if (student.registrationStatus === "NAIK_KELAS") {
                  equipFee = extraTariff.equipmentFeePromotion || extraTariff.equipmentFee;
                } else if (student.registrationStatus === "TINGGAL_KELAS") {
                  equipFee = extraTariff.equipmentFeeRepeat || extraTariff.equipmentFee;
                } else {
                  equipFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
                }
              }
            }
            baseAmount = equipFee;
            discountApplied = Math.min(baseAmount, student.discountEquipment || 0);
          } else if (invoiceType === "EKSTRAKURIKULER") {
            if (year < student.enrollmentYear) continue;
            let extraFee = 0;
            if (student.schoolUnitId === 1 || student.schoolUnitId === 2) {
              const level = student.schoolUnitId === 1 
                ? "KB" 
                : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
              const extraTariff = await prisma.extraEquipmentTariff.findUnique({
                where: {
                  uq_school_unit_enrollment_year_level: {
                    schoolUnitId: student.schoolUnitId,
                    enrollmentYear: student.enrollmentYear,
                    level,
                  },
                },
              });
              if (extraTariff) {
                if (student.registrationStatus === "BARU") {
                  extraFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
                } else if (student.registrationStatus === "NAIK_KELAS") {
                  extraFee = extraTariff.extracurricularFeePromotion || extraTariff.extracurricularFee;
                } else if (student.registrationStatus === "TINGGAL_KELAS") {
                  extraFee = extraTariff.extracurricularFeeRepeat || extraTariff.extracurricularFee;
                } else {
                  extraFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
                }
              }
            } else if (student.schoolUnitId === 3) {
              if (student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
                extraFee = student.sdExtracurriculars.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
              }
            }
            baseAmount = extraFee;
            discountApplied = Math.min(baseAmount, student.discountExtracurricular || 0);
          }

          const netAmount = Math.max(0, baseAmount - discountApplied);
          if (netAmount <= 0) continue;

          // Target billing year: enrollmentYear for UANG_PENGEMBANGAN & SERAGAM, or selected year for annual fees
          const targetYear = (invoiceType === "UANG_PENGEMBANGAN" || invoiceType === "SERAGAM")
            ? student.enrollmentYear
            : year;

          const dbInvoice = await prisma.invoice.findFirst({
            where: {
              studentId: student.id,
              invoiceType: invoiceType as any,
              year: targetYear,
            },
            include: {
              transactions: {
                where: { type: "INCOME" as any },
              },
            },
          });

          let paidAmount = 0;
          if (dbInvoice) {
            paidAmount = dbInvoice.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
          }

          const unpaidAmount = Math.max(0, netAmount - paidAmount);
          if (unpaidAmount > 0) {
            const status = paidAmount > 0 ? "PARTIALLY_PAID" : "PENDING";
            unpaidList.push({
              id: student.id,
              studentNumber: student.studentNumber,
              name: student.name,
              className: student.className,
              schoolUnitId: student.schoolUnitId,
              schoolUnitName: student.schoolUnit.name,
              parentName: student.parent?.name || "-",
              parentPhoneNumber: student.parent?.phoneNumber || "-",
              parentEmail: student.parent?.email || null,
              invoiceType,
              baseAmount,
              discountApplied,
              totalAmount: netAmount,
              paidAmount,
              unpaidAmount,
              status,
              unpaidMonths: [],
              totalUnpaidAmount: unpaidAmount,
              totalUnpaidCount: 1,
            });
          }
        }
      }

      let grandTotalUnpaidAmount = 0;
      let grandTotalUnpaidMonthsCount = 0;
      let totalStudentsUnpaidCount = 0;

      for (const item of unpaidList) {
        grandTotalUnpaidAmount += item.totalUnpaidAmount;
        grandTotalUnpaidMonthsCount += item.unpaidMonths.length;
        totalStudentsUnpaidCount++;
      }

      const summary = {
        grandTotalUnpaidAmount,
        grandTotalUnpaidMonthsCount,
        totalStudentsCount: students.length,
        totalStudentsUnpaidCount,
      };

      res.status(200).json({
        success: true,
        message: `Laporan tunggakan ${invoiceType} berhasil diambil`,
        data: {
          invoiceType,
          unpaidList,
          summary,
        },
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
        if (req.query.className) {
          where.className = String(req.query.className);
        }
      } else if ((user.role as any) === "WALI_KELAS") {
        where.schoolUnitId = user.schoolUnitId;
        if (userClassName) {
          where.className = userClassName;
        }
      } else {
        if (req.query.schoolUnitId && !isNaN(Number(req.query.schoolUnitId))) {
          where.schoolUnitId = Number(req.query.schoolUnitId);
        }
        if (req.query.className) {
          where.className = String(req.query.className);
        }
      }

      const students = await prisma.student.findMany({
        where,
      });

      if (students.length === 0) {
        res.status(200).json({
          success: true,
          message: "Rekap tunggakan SPP per kelas berhasil diambil",
          data: [],
        });
        return;
      }

      const studentIds = students.map((s) => s.id);
      const schoolUnitIds = Array.from(new Set(students.map((s) => s.schoolUnitId)));

      // Batch query related data in parallel: SchoolUnits, SppTariffs, and Invoices
      const [schoolUnits, tariffs, dbInvoices] = await Promise.all([
        prisma.schoolUnit.findMany({
          where: { id: { in: schoolUnitIds } },
          select: { id: true, name: true },
        }),
        prisma.sppTariff.findMany({
          where: { schoolUnitId: { in: schoolUnitIds } },
        }),
        prisma.invoice.findMany({
          where: {
            studentId: { in: studentIds },
            invoiceType: "SPP" as any,
            year,
            month: { lte: upToMonth },
          },
          include: {
            transactions: {
              where: { type: "INCOME" as any },
              select: { amount: true },
            },
          },
        }),
      ]);

      // Create lookup maps for instant in-memory lookups
      const unitMap = new Map<number, string>();
      schoolUnits.forEach((u) => unitMap.set(u.id, u.name));

      const tariffMap = new Map<string, number>();
      tariffs.forEach((t) => tariffMap.set(`${t.schoolUnitId}-${t.enrollmentYear}`, t.amount));

      const invoiceMap = new Map<string, typeof dbInvoices[0]>();
      dbInvoices.forEach((inv) => invoiceMap.set(`${inv.studentId}-${inv.month}`, inv));

      // Group students by class
      const classMap: Record<string, { unitId: number; className: string; students: typeof students }> = {};
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
        const totalStudentsInClass = group.students.length;
        let studentsWithUnpaid = 0;
        let totalUnpaidMonthsClass = 0;
        let totalUnpaidNominalClass = 0;

        const schoolUnitName = unitMap.get(group.unitId) || "-";

        for (const student of group.students) {
          const tariffAmount = tariffMap.get(`${student.schoolUnitId}-${student.enrollmentYear}`);
          if (tariffAmount === undefined) continue;

          const baseAmount = tariffAmount;
          const discountApplied = Math.min(baseAmount, student.discountAmount);
          const netAmount = baseAmount - discountApplied;

          if (year < student.enrollmentYear) {
            continue;
          }

          let studentUnpaidMonths = 0;
          let studentUnpaidAmount = 0;

          let startMonth = 1;
          if (year === student.enrollmentYear) {
            startMonth = 7;
          } else if (year === 2026) {
            startMonth = 7;
          }

          for (let m = startMonth; m <= upToMonth; m++) {
            const inv = invoiceMap.get(`${student.id}-${m}`);
            if (!inv) {
              if (netAmount > 0) {
                studentUnpaidMonths++;
                studentUnpaidAmount += netAmount;
              }
            } else if ((inv.status as any) === "PENDING") {
              if (netAmount > 0) {
                studentUnpaidMonths++;
                studentUnpaidAmount += netAmount;
              }
            } else if ((inv.status as any) === "PARTIALLY_PAID") {
              const paid = inv.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
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
          schoolUnit: schoolUnitName,
          schoolUnitName: schoolUnitName,
          className: group.className,
          totalStudents: totalStudentsInClass,
          unpaidStudentsCount: studentsWithUnpaid,
          totalUnpaidMonths: totalUnpaidMonthsClass,
          totalUnpaidNominal: totalUnpaidNominalClass,
          totalUnpaidAmount: totalUnpaidNominalClass,
        });
      }

      // Sort recap by unit and class name
      recap.sort((a, b) => {
        if (a.schoolUnitId !== b.schoolUnitId) {
          return a.schoolUnitId - b.schoolUnitId;
        }
        return a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' });
      });

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
      const user = req.user;
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
          sdExtracurriculars: true,
        },
      });

      if (!student) {
        res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
        return;
      }

      if (user) {
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

      // Auto-reconcile any pending Pakasir invoices for this student
      try {
        const pendingPakasir = await prisma.invoice.findMany({
          where: {
            studentId: student.id,
            status: "PENDING" as any,
            midtransOrderId: {
              not: null,
              startsWith: "BATCH-",
            },
          },
          include: {
            student: { select: { name: true, schoolUnitId: true } },
          },
        });

        if (pendingPakasir.length > 0) {
          const projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
          const apiKey = process.env.PAKASIR_API_KEY || "xxx123";

          const studentBatchMap = new Map<string, typeof pendingPakasir>();
          for (const inv of pendingPakasir) {
            const rawId = inv.midtransOrderId || "";
            const baseId = rawId.replace(/-\d+$/, "");
            if (!studentBatchMap.has(baseId)) studentBatchMap.set(baseId, []);
            studentBatchMap.get(baseId)!.push(inv);
          }

          for (const [baseOrderId, invs] of studentBatchMap.entries()) {
            const totalAmount = invs.reduce((sum, inv) => sum + inv.amount, 0);
            const detailUrl = `https://app.pakasir.com/api/transactiondetail?project=${projectSlug}&amount=${totalAmount}&order_id=${baseOrderId}&api_key=${apiKey}`;
            const checkResp = await fetch(detailUrl, { signal: AbortSignal.timeout(3000) });
            if (checkResp.ok) {
              const checkData = (await checkResp.json()) as any;
              if (checkData?.transaction?.status === "completed") {
                if (this.invoiceRepository) {
                  await this.invoiceRepository.processPaidInvoicesOnline(invs, "Auto-Sync");
                }
              }
            }
          }
        }
      } catch (autoSyncErr) {
        logger.warn(`Auto-sync Pakasir for student ${studentNumber} skipped: ${autoSyncErr instanceof Error ? autoSyncErr.message : String(autoSyncErr)}`);
      }

      // === LOGIKA PPDB (SISWA BARU / DAFTAR ULANG) ===
      if (student.className.toUpperCase() === "PPDB") {
        const dbInvoices = await prisma.invoice.findMany({
          where: {
            studentId: student.id,
            invoiceType: {
              in: ["UANG_PENGEMBANGAN", "DAFTAR_ULANG", "UANG_PERALATAN", "SPP", "EKSTRAKURIKULER", "SERAGAM"] as any
            }
          },
          include: {
            transactions: {
              where: { type: "INCOME" as any }
            }
          }
        });

        const baseSppAmount = tariff.amount;
        const sppDiscountApplied = Math.min(baseSppAmount, student.discountAmount);
        const sppNetAmount = baseSppAmount - sppDiscountApplied;

        const isSd = student.schoolUnit.name.toUpperCase() === "SD" || student.schoolUnitId === 3;

        let reRegistrationFee = tariff.reRegistrationFee;

        // Fetch equipment and extracurricular fees from extra_equipment_tariffs if KB or RA
        let equipmentFee = 0;
        let extracurricularFee = 0;
        if (!isSd && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
          const level = student.schoolUnitId === 1 ? "KB" : "A"; // default to A for entry level RA in PPDB
          const extraTariff = await prisma.extraEquipmentTariff.findUnique({
            where: {
              uq_school_unit_enrollment_year_level: {
                schoolUnitId: student.schoolUnitId,
                enrollmentYear: student.enrollmentYear,
                level,
              },
            },
          });
          if (extraTariff) {
            if (student.registrationStatus === "BARU") {
              equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
              extracurricularFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
            } else if (student.registrationStatus === "NAIK_KELAS") {
              equipmentFee = extraTariff.equipmentFeePromotion || extraTariff.equipmentFee;
              extracurricularFee = extraTariff.extracurricularFeePromotion || extraTariff.extracurricularFee;
            } else if (student.registrationStatus === "TINGGAL_KELAS") {
              equipmentFee = extraTariff.equipmentFeeRepeat || extraTariff.equipmentFee;
              extracurricularFee = extraTariff.extracurricularFeeRepeat || extraTariff.extracurricularFee;
            } else {
              equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
              extracurricularFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
            }
          }
        }

        let fulldayFee = 0;
        if (student.isFullday && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
          const ft = await (prisma as any).fulldayTariff.findUnique({
            where: {
              uq_fullday_school_unit_enrollment_year: {
                schoolUnitId: student.schoolUnitId,
                enrollmentYear: student.enrollmentYear,
              },
            },
          });
          if (ft) {
            fulldayFee = ft.monthlyFee;
          }
        }

        // Apply student-specific equipment and extracurricular discounts
        const equipDiscountApplied = Math.min(equipmentFee, student.discountEquipment || 0);
        const equipNetAmount = equipmentFee - equipDiscountApplied;

        let sdExtraFee = 0;
        if (isSd && student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
          sdExtraFee = student.sdExtracurriculars.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
        }
        const sdExtraDiscount = Math.min(sdExtraFee, student.discountExtracurricular || 0);
        const sdExtraNet = sdExtraFee - sdExtraDiscount;

        const extraDiscountApplied = isSd ? sdExtraDiscount : Math.min(extracurricularFee, student.discountExtracurricular || 0);
        const extraNetAmount = isSd ? sdExtraNet : (extracurricularFee - extraDiscountApplied);

        const feeTypes = isSd
          ? [
              { type: "DAFTAR_ULANG", base: reRegistrationFee, net: reRegistrationFee, month: 7 },
              { type: "UANG_PENGEMBANGAN", base: tariff.developmentFee, net: tariff.developmentFee, month: 7 },
              { type: "SPP", base: baseSppAmount, net: sppNetAmount, month: 7 },
              ...(sdExtraFee > 0 ? [{ type: "EKSTRAKURIKULER", base: sdExtraFee, net: sdExtraNet, month: 7 }] : [])
            ]
          : [
              { type: "DAFTAR_ULANG", base: reRegistrationFee, net: reRegistrationFee, month: 7 },
              { type: "UANG_PENGEMBANGAN", base: tariff.developmentFee, net: tariff.developmentFee, month: 7 },
              { type: "SPP", base: baseSppAmount, net: sppNetAmount, month: 7 },
              { type: "UANG_PERALATAN", base: equipmentFee, net: equipNetAmount, month: 7 },
              { type: "EKSTRAKURIKULER", base: extracurricularFee, net: extraNetAmount, month: 7 },
              { type: "SERAGAM", base: tariff.uniformFee, net: tariff.uniformFee, month: 7 },
              ...(fulldayFee > 0 ? [{ type: "FULLDAY", base: fulldayFee, net: fulldayFee, month: 7 }] : [])
            ];

        const invoices = feeTypes.map((fee) => {
          const existing = dbInvoices.find((inv) => inv.invoiceType === fee.type && inv.month === fee.month);
          if (existing) {
            if (existing.status === "PENDING") {
              existing.baseAmount = fee.base;
              existing.discountApplied = fee.base - fee.net;
              existing.amount = fee.net;
            }
            return existing;
          }
          return {
            id: null,
            studentId: student.id,
            invoiceType: fee.type,
            month: fee.month,
            year: student.enrollmentYear,
            baseAmount: fee.base,
            discountApplied: fee.base - fee.net,
            amount: fee.net,
            status: "PENDING",
            midtransOrderId: null,
          };
        });

        res.status(200).json({
          success: true,
          message: "Daftar invoice PPDB siswa berhasil diambil",
          data: invoices,
          allInvoices: dbInvoices,
          student,
        });
        return;
      }

      // === LOGIKA SPP BULANAN (SISWA AKTIF) ===
      const baseAmount = tariff.amount;
      const discountApplied = Math.min(baseAmount, student.discountAmount);
      const netAmount = baseAmount - discountApplied;

      if (year < student.enrollmentYear) {
        res.status(200).json({
          success: true,
          message: "Daftar invoice SPP siswa berhasil diambil",
          data: [],
          allInvoices: [],
          student,
        });
        return;
      }

      const dbInvoices = await prisma.invoice.findMany({
        where: { studentId: student.id, year },
        include: {
          transactions: {
            where: { type: "INCOME" as any },
          },
        },
        orderBy: { month: "asc" },
      });

      let startMonth = 1;
      if (year === student.enrollmentYear) {
        startMonth = 7;
      } else if (year === 2026) {
        startMonth = 7;
      }
      const invoices = Array.from({ length: 12 - startMonth + 1 }, (_, i) => {
        const month = startMonth + i;
        const existing = dbInvoices.find(
          (inv) => inv.month === month && inv.invoiceType === ("SPP" as any)
        );
        if (existing) {
          if (existing.status === "PENDING" || !existing.amount || existing.amount <= 0) {
            existing.baseAmount = baseAmount;
            existing.discountApplied = discountApplied;
            existing.amount = netAmount;
          }
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

      // Append other annual/one-time fees for month 7 (active students)
      if (startMonth === 7) {
        const isSd = student.schoolUnitId === 3;
        
        // 1. DAFTAR_ULANG
        const existingRereg = dbInvoices.find((inv) => inv.invoiceType === "DAFTAR_ULANG" && inv.month === 7);
        let reRegistrationFee = tariff.reRegistrationFee;
        if (existingRereg) {
          if (existingRereg.status === "PENDING") {
            existingRereg.baseAmount = reRegistrationFee;
            existingRereg.discountApplied = 0;
            existingRereg.amount = reRegistrationFee;
          }
          invoices.push(existingRereg);
        } else {
          invoices.push({
            id: null,
            studentId: student.id,
            invoiceType: "DAFTAR_ULANG" as any,
            month: 7,
            year,
            baseAmount: reRegistrationFee,
            discountApplied: 0,
            amount: reRegistrationFee,
            status: "PENDING" as any,
            midtransOrderId: null,
          });
        }

        // 2. UANG_PENGEMBANGAN (Only for new enrollment year)
        if (year === student.enrollmentYear) {
          const existingDev = dbInvoices.find((inv) => inv.invoiceType === "UANG_PENGEMBANGAN" && inv.month === 7);
          if (existingDev) {
            if (existingDev.status === "PENDING") {
              existingDev.baseAmount = tariff.developmentFee;
              existingDev.discountApplied = 0;
              existingDev.amount = tariff.developmentFee;
            }
            invoices.push(existingDev);
          } else {
            invoices.push({
              id: null,
              studentId: student.id,
              invoiceType: "UANG_PENGEMBANGAN" as any,
              month: 7,
              year,
              baseAmount: tariff.developmentFee,
              discountApplied: 0,
              amount: tariff.developmentFee,
              status: "PENDING" as any,
              midtransOrderId: null,
            });
          }
        }

        // 3. SERAGAM (Only for new enrollment year)
        if (year === student.enrollmentYear) {
          const existingUniform = dbInvoices.find((inv) => inv.invoiceType === "SERAGAM" && inv.month === 7);
          if (existingUniform) {
            if (existingUniform.status === "PENDING") {
              existingUniform.baseAmount = tariff.uniformFee;
              existingUniform.discountApplied = 0;
              existingUniform.amount = tariff.uniformFee;
            }
            invoices.push(existingUniform);
          } else {
            invoices.push({
              id: null,
              studentId: student.id,
              invoiceType: "SERAGAM" as any,
              month: 7,
              year,
              baseAmount: tariff.uniformFee,
              discountApplied: 0,
              amount: tariff.uniformFee,
              status: "PENDING" as any,
              midtransOrderId: null,
            });
          }
        }

        // 4. UANG_PERALATAN (Only for KB and RA, year >= enrollmentYear)
        if (!isSd && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
          const level = student.schoolUnitId === 1 
            ? "KB" 
            : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
          const extraTariff = await prisma.extraEquipmentTariff.findUnique({
            where: {
              uq_school_unit_enrollment_year_level: {
                schoolUnitId: student.schoolUnitId,
                enrollmentYear: student.enrollmentYear,
                level,
              },
            },
          });
          
          let equipmentFee = 0;
          if (extraTariff) {
            if (student.registrationStatus === "BARU") {
              equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
            } else if (student.registrationStatus === "NAIK_KELAS") {
              equipmentFee = extraTariff.equipmentFeePromotion || extraTariff.equipmentFee;
            } else if (student.registrationStatus === "TINGGAL_KELAS") {
              equipmentFee = extraTariff.equipmentFeeRepeat || extraTariff.equipmentFee;
            } else {
              equipmentFee = extraTariff.equipmentFeeNew || extraTariff.equipmentFee;
            }
          }

          const discountEquip = Math.min(equipmentFee, student.discountEquipment || 0);
          const existingEquip = dbInvoices.find((inv) => inv.invoiceType === "UANG_PERALATAN" && inv.month === 7);
          if (existingEquip) {
            if (existingEquip.status === "PENDING") {
              existingEquip.baseAmount = equipmentFee;
              existingEquip.discountApplied = discountEquip;
              existingEquip.amount = equipmentFee - discountEquip;
            }
            invoices.push(existingEquip);
          } else {
            invoices.push({
              id: null,
              studentId: student.id,
              invoiceType: "UANG_PERALATAN" as any,
              month: 7,
              year,
              baseAmount: equipmentFee,
              discountApplied: discountEquip,
              amount: equipmentFee - discountEquip,
              status: "PENDING" as any,
              midtransOrderId: null,
            });
          }
        }

        // 5. EKSTRAKURIKULER
        let extraFee = 0;
        let hasExtraBilling = false;

        if (!isSd && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
          hasExtraBilling = true;
          const level = student.schoolUnitId === 1 
            ? "KB" 
            : (student.className.trim().toUpperCase().charAt(0) === "B" ? "B" : "A");
          const extraTariff = await prisma.extraEquipmentTariff.findUnique({
            where: {
              uq_school_unit_enrollment_year_level: {
                schoolUnitId: student.schoolUnitId,
                enrollmentYear: student.enrollmentYear,
                level,
              },
            },
          });
          
          if (extraTariff) {
            if (student.registrationStatus === "BARU") {
              extraFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
            } else if (student.registrationStatus === "NAIK_KELAS") {
              extraFee = extraTariff.extracurricularFeePromotion || extraTariff.extracurricularFee;
            } else if (student.registrationStatus === "TINGGAL_KELAS") {
              extraFee = extraTariff.extracurricularFeeRepeat || extraTariff.extracurricularFee;
            } else {
              extraFee = extraTariff.extracurricularFeeNew || extraTariff.extracurricularFee;
            }
          }
        } else if (student.schoolUnitId === 3) {
          // SD extracurriculars
          if (student.sdExtracurriculars && student.sdExtracurriculars.length > 0) {
            hasExtraBilling = true;
            extraFee = student.sdExtracurriculars.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
          }
        }

        if (hasExtraBilling) {
          const discountExtra = Math.min(extraFee, student.discountExtracurricular || 0);
          const existingExtra = dbInvoices.find((inv) => inv.invoiceType === "EKSTRAKURIKULER" && inv.month === 7);
          if (existingExtra) {
            if (existingExtra.status === "PENDING") {
              existingExtra.baseAmount = extraFee;
              existingExtra.discountApplied = discountExtra;
              existingExtra.amount = extraFee - discountExtra;
            }
            invoices.push(existingExtra);
          } else {
            invoices.push({
              id: null,
              studentId: student.id,
              invoiceType: "EKSTRAKURIKULER" as any,
              month: 7,
              year,
              baseAmount: extraFee,
              discountApplied: discountExtra,
              amount: extraFee - discountExtra,
              status: "PENDING" as any,
              midtransOrderId: null,
            });
          }
        }
      }

      // 6. FULLDAY (Monthly for KB & RA if student.isFullday is enabled)
      if (student.isFullday && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
        const fulldayTariff = await (prisma as any).fulldayTariff.findUnique({
          where: {
            uq_fullday_school_unit_enrollment_year: {
              schoolUnitId: student.schoolUnitId,
              enrollmentYear: student.enrollmentYear,
            },
          },
        });
        if (fulldayTariff && fulldayTariff.monthlyFee > 0) {
          for (let m = startMonth; m <= 12; m++) {
            const existingFullday = dbInvoices.find(
              (inv) => inv.month === m && inv.invoiceType === ("FULLDAY" as any)
            );
            if (existingFullday) {
              if (existingFullday.status === "PENDING") {
                existingFullday.baseAmount = fulldayTariff.monthlyFee;
                existingFullday.discountApplied = 0;
                existingFullday.amount = fulldayTariff.monthlyFee;
              }
              invoices.push(existingFullday);
            } else {
              invoices.push({
                id: null,
                studentId: student.id,
                invoiceType: "FULLDAY" as any,
                month: m,
                year,
                baseAmount: fulldayTariff.monthlyFee,
                discountApplied: 0,
                amount: fulldayTariff.monthlyFee,
                status: "PENDING" as any,
                midtransOrderId: null,
              });
            }
          }
        }
      }

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



  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { status, paymentMethod } = req.body;

      if (!this.updateInvoiceStatusUseCase) {
        throw new Error("UpdateInvoiceStatusUseCase tidak tersedia");
      }

      let method: any = "CASH";
      if (paymentMethod && (paymentMethod.toUpperCase() === "TRANSFER" || paymentMethod.toLowerCase() === "tf_manual")) {
        method = "TRANSFER";
      }
      const updatedInvoice = await this.updateInvoiceStatusUseCase.execute({
        invoiceId: parseInt(id),
        status,
        paymentMethod: method,
        recordedById: req.user?.id,
      });
      res.status(200).json({
        success: true,
        message: "Status tagihan berhasil diperbarui",
        data: updatedInvoice,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!this.deleteInvoiceUseCase) {
        throw new Error("DeleteInvoiceUseCase tidak tersedia");
      }

      await this.deleteInvoiceUseCase.execute(parseInt(id));
      res.status(200).json({
        success: true,
        message: "Tagihan dan seluruh riwayat pembayarannya berhasil dihapus",
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getAllInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { schoolUnitId, className, status, month, year, search, invoiceType, page = "1", limit = "50" } = req.query;

      if (!this.getAllInvoicesUseCase) {
        throw new Error("GetAllInvoicesUseCase tidak tersedia");
      }

      let parsedSchoolUnitId: number | undefined;
      if (req.user?.role === "UNIT_ADMIN") {
        parsedSchoolUnitId = req.user.schoolUnitId ?? undefined;
      } else if (schoolUnitId) {
        parsedSchoolUnitId = parseInt(schoolUnitId as string);
      }

      const result = await this.getAllInvoicesUseCase.execute({
        schoolUnitId: parsedSchoolUnitId,
        className: className as string | undefined,
        status: status as any,
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        search: search as string | undefined,
        invoiceType: invoiceType as any,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      res.status(200).json({
        success: true,
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

