import type { Request, Response, NextFunction } from "express";
import prisma from "../../database/prisma.js";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";
import type { ProcessOfflinePaymentUseCase } from "../../../application/use-cases/ProcessOfflinePaymentUseCase.js";
import type { IStudentRepository } from "../../../domain/repositories/IStudentRepository.js";
import { logger } from "../../services/WinstonLogger.js";


export class InvoiceController {
  constructor(
    private processOfflinePaymentUseCase: ProcessOfflinePaymentUseCase,
    private studentRepository: IStudentRepository
  ) {}

  async payOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber, month, year, invoiceType, paymentAmount } = req.body;

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

      const result = await this.processOfflinePaymentUseCase.execute({
        studentId: student.id,
        month: Number(month),
        year: Number(year),
        recordedById: user.id,
        invoiceType: invoiceType as any,
        paymentAmount: paymentAmount !== undefined ? Number(paymentAmount) : undefined,
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
          if (existing.status === "PENDING") {
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

  async payOnlineSimulated(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { studentNumber } = req.body;

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

      let invoiceItems: Array<{ month: number; year: number; invoiceType: string }> = [];
      if (Array.isArray(req.body.invoices)) {
        invoiceItems = req.body.invoices;
      } else {
        const { month, year, invoiceType = "SPP" } = req.body;
        if (!month || !year) {
          res.status(400).json({ success: false, message: "Parameter tidak lengkap" });
          return;
        }
        invoiceItems = [{
          month: Number(month),
          year: Number(year),
          invoiceType: invoiceType
        }];
      }

      // Check enrollment periods for SPP type
      for (const item of invoiceItems) {
        if (item.invoiceType === "SPP") {
          const itemYear = Number(item.year);
          const itemMonth = Number(item.month);
          if (
            itemYear < student.enrollmentYear ||
            (itemYear === student.enrollmentYear && itemMonth < 7) ||
            (itemYear === 2026 && itemMonth < 7)
          ) {
            res.status(400).json({
              success: false,
              message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)",
            });
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
          message: "Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi",
        });
        return;
      }

      let totalAmountToPay = 0;
      const verifiedInvoices: any[] = [];

      for (const item of invoiceItems) {
        const { month: itemMonth, year: itemYear, invoiceType: itemType } = item;

        const existingInvoice = await prisma.invoice.findUnique({
          where: {
            uq_student_billing_period: {
              studentId: student.id,
              month: Number(itemMonth),
              year: Number(itemYear),
              invoiceType: itemType as any,
            },
          },
        });

        if (existingInvoice && (existingInvoice.status as any) === "PAID") {
          res.status(400).json({
            success: false,
            message: `Gagal: Tagihan ${itemType} siswa untuk periode tersebut sudah lunas`,
          });
          return;
        }

        let baseAmount = 0;
        let discountApplied = 0;
        let amountToPay = 0;

        if (existingInvoice) {
          amountToPay = existingInvoice.amount;
          baseAmount = existingInvoice.baseAmount;
          discountApplied = existingInvoice.discountApplied;
        } else {
          if (itemType === "SPP") {
            baseAmount = tariff.amount;
            discountApplied = Math.min(baseAmount, student.discountAmount);
          } else if (itemType === "UANG_PENGEMBANGAN") {
            baseAmount = tariff.developmentFee;
          } else if (itemType === "DAFTAR_ULANG") {
            const reregTariff = await prisma.reRegistrationTariff.findUnique({
              where: {
                uq_rereg_school_unit_enrollment_year: {
                  schoolUnitId: student.schoolUnitId,
                  enrollmentYear: student.enrollmentYear,
                },
              },
            });
            if (reregTariff) {
              if (student.registrationStatus === "BARU") {
                baseAmount = reregTariff.newStudentFee;
              } else if (student.registrationStatus === "NAIK_KELAS") {
                baseAmount = reregTariff.promotionFee;
              } else if (student.registrationStatus === "TINGGAL_KELAS") {
                baseAmount = reregTariff.repeatFee;
              } else {
                baseAmount = reregTariff.newStudentFee;
              }
            } else {
              baseAmount = tariff.reRegistrationFee;
            }
          } else if (itemType === "UANG_PERALATAN") {
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
              equipFee = extraTariff?.equipmentFee ?? 0;
            }
            baseAmount = equipFee;
            discountApplied = Math.min(baseAmount, student.discountEquipment || 0);
          } else if (itemType === "EKSTRAKURIKULER") {
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
              extraFee = extraTariff?.extracurricularFee ?? 0;
            }
            baseAmount = extraFee;
            discountApplied = Math.min(baseAmount, student.discountExtracurricular || 0);
          } else if (itemType === "SERAGAM") {
            baseAmount = tariff.uniformFee;
          } else if (itemType === "FULLDAY") {
            const fulldayTariff = await (prisma as any).fulldayTariff.findUnique({
              where: {
                uq_fullday_school_unit_enrollment_year: {
                  schoolUnitId: student.schoolUnitId,
                  enrollmentYear: student.enrollmentYear,
                },
              },
            });
            baseAmount = fulldayTariff ? fulldayTariff.monthlyFee : 0;
          }
          amountToPay = baseAmount - discountApplied;
        }
        totalAmountToPay += amountToPay;

        verifiedInvoices.push({
          month: Number(itemMonth),
          year: Number(itemYear),
          invoiceType: itemType,
          baseAmount,
          discountApplied,
          amountToPay,
          existingInvoice
        });
      }

      const mockOrderId = `BATCH-MOCK-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        const processedInvoices = [];
        const processedTransactions = [];

        for (let i = 0; i < verifiedInvoices.length; i++) {
          const item = verifiedInvoices[i];
          const uniqueOrderId = `${mockOrderId}-${i}`;

          let invoice;
          if (item.existingInvoice) {
            invoice = await tx.invoice.update({
              where: { id: item.existingInvoice.id },
              data: {
                status: "PAID" as any,
                midtransOrderId: item.existingInvoice.midtransOrderId || uniqueOrderId,
              },
            });
          } else {
            invoice = await tx.invoice.create({
              data: {
                studentId: student.id,
                invoiceType: item.invoiceType as any,
                month: item.month,
                year: item.year,
                baseAmount: item.baseAmount,
                discountApplied: item.discountApplied,
                amount: item.amountToPay,
                status: "PAID" as any,
                midtransOrderId: uniqueOrderId,
              },
            });
          }

          let categoryName = "SPP";
          if (item.invoiceType === "UANG_PENGEMBANGAN") categoryName = "Uang Pengembangan";
          else if (item.invoiceType === "DAFTAR_ULANG") categoryName = "Daftar Ulang";
          else if (item.invoiceType === "UANG_PERALATAN") categoryName = "Uang Peralatan";
          else if (item.invoiceType === "EKSTRAKURIKULER") categoryName = "Uang Ekstrakurikuler";
          else if (item.invoiceType === "SERAGAM") categoryName = "Uang Seragam";

          let category = await tx.category.findFirst({
            where: {
              name: { equals: categoryName, mode: "insensitive" },
              type: "INCOME",
            },
          });
          if (!category) {
            category = await tx.category.create({
              data: {
                name: categoryName,
                type: "INCOME",
                schoolUnitId: null,
              },
            });
          }

          const transaction = await tx.transaction.create({
            data: {
              type: "INCOME" as any,
              categoryId: category.id,
              paymentMethod: "MIDTRANS" as any,
              amount: item.amountToPay,
              description: `Pembayaran ${categoryName} online (simulasi Midtrans) untuk siswa ${student.name}`,
              schoolUnitId: student.schoolUnitId,
              recordedById: null,
              invoiceId: invoice.id,
            },
          });

          processedInvoices.push(invoice);
          processedTransactions.push(transaction);
        }

        return { invoices: processedInvoices, transactions: processedTransactions };
      });

      res.status(200).json({
        success: true,
        message: "Simulasi pembayaran online berhasil diproses",
        data: {
          invoiceId: result.invoices[0]?.id || null,
          studentId: student.id,
          amountPaid: totalAmountToPay,
          midtransOrderId: mockOrderId,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async createPakasirTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentNumber, paymentMethod } = req.body;

      if (!studentNumber || !paymentMethod) {
        res.status(400).json({ success: false, message: "Parameter tidak lengkap" });
        return;
      }

      const student = await prisma.student.findUnique({
        where: { studentNumber },
      });

      if (!student) {
        res.status(404).json({ success: false, message: "Siswa tidak ditemukan" });
        return;
      }

      let invoiceItems: Array<{ month: number; year: number; invoiceType: string }> = [];
      if (Array.isArray(req.body.invoices)) {
        invoiceItems = req.body.invoices;
      } else {
        const { month, year, invoiceType = "SPP" } = req.body;
        if (!month || !year) {
          res.status(400).json({ success: false, message: "Parameter tidak lengkap" });
          return;
        }
        invoiceItems = [{
          month: Number(month),
          year: Number(year),
          invoiceType: invoiceType
        }];
      }

      // Check enrollment periods for SPP type
      for (const item of invoiceItems) {
        if (item.invoiceType === "SPP") {
          const itemYear = Number(item.year);
          const itemMonth = Number(item.month);
          if (
            itemYear < student.enrollmentYear ||
            (itemYear === student.enrollmentYear && itemMonth < 7) ||
            (itemYear === 2026 && itemMonth < 7)
          ) {
            res.status(400).json({
              success: false,
              message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar atau sebelum sistem dimulai (Juli 2026)",
            });
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
          message: "Gagal: Master tarif SPP untuk angkatan siswa ini belum dikonfigurasi",
        });
        return;
      }

      let totalAmountToPay = 0;
      const verifiedInvoices: any[] = [];

      for (const item of invoiceItems) {
        const { month: itemMonth, year: itemYear, invoiceType: itemType } = item;

        const existingInvoice = await prisma.invoice.findUnique({
          where: {
            uq_student_billing_period: {
              studentId: student.id,
              month: Number(itemMonth),
              year: Number(itemYear),
              invoiceType: itemType as any,
            },
          },
        });

        if (existingInvoice && (existingInvoice.status as any) === "PAID") {
          res.status(400).json({
            success: false,
            message: `Gagal: Tagihan ${itemType} siswa untuk periode tersebut sudah lunas`,
          });
          return;
        }

        let baseAmount = 0;
        let discountApplied = 0;
        let amountToPay = 0;

        if (existingInvoice) {
          amountToPay = existingInvoice.amount;
          baseAmount = existingInvoice.baseAmount;
          discountApplied = existingInvoice.discountApplied;
        } else {
          let discountVal = 0;
          if (itemType === "SPP") {
            const rawBaseAmount = tariff ? Number(tariff.amount) : 0;
            baseAmount = isNaN(rawBaseAmount) || rawBaseAmount <= 0 ? 185000 : rawBaseAmount;
            const rawDiscount = student ? Number(student.discountAmount) : 0;
            discountVal = isNaN(rawDiscount) ? 0 : rawDiscount;
          } else if (itemType === "UANG_PENGEMBANGAN") {
            baseAmount = tariff ? Number(tariff.developmentFee) : 0;
          } else if (itemType === "DAFTAR_ULANG") {
            const reregTariff = await prisma.reRegistrationTariff.findUnique({
              where: {
                uq_rereg_school_unit_enrollment_year: {
                  schoolUnitId: student.schoolUnitId,
                  enrollmentYear: student.enrollmentYear,
                },
              },
            });
            if (reregTariff) {
              if (student.registrationStatus === "BARU") {
                baseAmount = reregTariff.newStudentFee;
              } else if (student.registrationStatus === "NAIK_KELAS") {
                baseAmount = reregTariff.promotionFee;
              } else if (student.registrationStatus === "TINGGAL_KELAS") {
                baseAmount = reregTariff.repeatFee;
              } else {
                baseAmount = reregTariff.newStudentFee;
              }
            } else {
              baseAmount = tariff ? Number(tariff.reRegistrationFee) : 0;
            }
          } else if (itemType === "UANG_PERALATAN") {
            let equipFee = 0;
            if (student && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
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
              equipFee = extraTariff?.equipmentFee ?? 0;
            }
            baseAmount = equipFee;
            discountVal = student ? Number(student.discountEquipment || 0) : 0;
          } else if (itemType === "EKSTRAKURIKULER") {
            let extraFee = 0;
            if (student && (student.schoolUnitId === 1 || student.schoolUnitId === 2)) {
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
              extraFee = extraTariff?.extracurricularFee ?? 0;
            }
            baseAmount = extraFee;
            discountVal = student ? Number(student.discountExtracurricular || 0) : 0;
          } else if (itemType === "SERAGAM") {
            baseAmount = tariff ? Number(tariff.uniformFee) : 0;
          } else if (itemType === "FULLDAY") {
            const fulldayTariff = await (prisma as any).fulldayTariff.findUnique({
              where: {
                uq_fullday_school_unit_enrollment_year: {
                  schoolUnitId: student.schoolUnitId,
                  enrollmentYear: student.enrollmentYear,
                },
              },
            });
            baseAmount = fulldayTariff ? fulldayTariff.monthlyFee : 0;
          }

          discountApplied = Math.min(baseAmount, discountVal);
          const calculatedAmount = baseAmount - discountApplied;
          amountToPay = isNaN(calculatedAmount) || calculatedAmount <= 0 
            ? 1000 
            : Math.round(calculatedAmount);
        }

        totalAmountToPay += amountToPay;
        verifiedInvoices.push({
          month: Number(itemMonth),
          year: Number(itemYear),
          invoiceType: itemType,
          baseAmount,
          discountApplied,
          amountToPay,
          existingInvoice
        });
      }

      const projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
      const apiKey = process.env.PAKASIR_API_KEY || "xxx123";

      // Order ID prefix: BATCH-{studentNumber}-{timestamp}
      const orderId = `BATCH-${student.studentNumber}-${Date.now()}`;

      // Map payment method to valid Pakasir method slugs
      let mappedMethod = paymentMethod.toLowerCase();
      if (mappedMethod === "mandiri" || mappedMethod === "va_mandiri") mappedMethod = "bni_va";
      else if (mappedMethod === "bca" || mappedMethod === "va_bca") mappedMethod = "bri_va";
      else if (mappedMethod === "gopay") mappedMethod = "qris";

      // Call Pakasir API
      const pakasirUrl = `https://app.pakasir.com/api/transactioncreate/${mappedMethod}`;
      const pakasirPayload = {
        project: projectSlug,
        order_id: String(orderId),
        amount: Number(totalAmountToPay),
        api_key: apiKey,
      };

      let pakasirData: any = null;
      try {
        const response = await fetch(pakasirUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pakasirPayload),
        });

        if (response.ok) {
          pakasirData = await response.json();
        } else {
          const errText = await response.text();
          console.warn(`Pakasir API returned error status ${response.status}: ${errText}`);
        }
      } catch (err) {
        console.error("Gagal menghubungi API Pakasir:", err);
      }

      // Fallback to mock Pakasir response if API call fails
      if (!pakasirData || !pakasirData.payment) {
        console.warn("Menggunakan response tiruan (mock) Pakasir untuk pengujian local.");
        const calculatedFee = paymentMethod === "qris" 
          ? Math.round(totalAmountToPay * 0.008)
          : 3500;
        pakasirData = {
          payment: {
            project: projectSlug,
            order_id: orderId,
            amount: totalAmountToPay,
            fee: calculatedFee,
            total_payment: totalAmountToPay + calculatedFee,
            payment_method: paymentMethod,
            payment_number: paymentMethod === "qris" 
              ? "00020101021226610016ID.CO.SHOPEE.WWW01189360091800216005230208216005230303UME51440014ID.CO.QRIS.WWW0215ID10243228429300303UME5204792953033605409100003.005802ID5907Pakasir6012KAB. KEBUMEN61055439262230519SP25RZRATEQI2HQ65Q46304A079"
              : `89022${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }
        };
      }

      // Save or update invoices in DB with status PENDING and store unique order_ids
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < verifiedInvoices.length; i++) {
          const item = verifiedInvoices[i];
          const uniqueOrderId = `${orderId}-${i}`;

          if (item.existingInvoice) {
            await tx.invoice.update({
              where: { id: item.existingInvoice.id },
              data: {
                midtransOrderId: uniqueOrderId,
                baseAmount: item.baseAmount,
                discountApplied: item.discountApplied,
                amount: item.amountToPay,
              },
            });
          } else {
            await tx.invoice.create({
              data: {
                studentId: student.id,
                invoiceType: item.invoiceType as any,
                month: item.month,
                year: item.year,
                baseAmount: item.baseAmount,
                discountApplied: item.discountApplied,
                amount: item.amountToPay,
                status: "PENDING" as any,
                midtransOrderId: uniqueOrderId,
              },
            });
          }
        }
      });

      res.status(200).json({
        success: true,
        message: "Transaksi Pakasir berhasil dibuat",
        data: {
          orderId,
          amount: totalAmountToPay,
          payment: pakasirData.payment,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  async checkPakasirStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { order_id, amount } = req.query;

      if (!order_id) {
        res.status(400).json({ success: false, message: "order_id wajib disertakan" });
        return;
      }

      const invoices = await prisma.invoice.findMany({
        where: {
          midtransOrderId: {
            startsWith: order_id as string,
          },
        },
        include: {
          student: {
            select: { name: true, schoolUnitId: true },
          },
        },
      });

      if (invoices.length === 0) {
        logger.warn(`checkPakasirStatus - Tagihan tidak ditemukan untuk order_id: ${order_id}`);
        res.status(404).json({ success: false, message: "Tagihan tidak ditemukan" });
        return;
      }

      const allPaid = invoices.every((inv) => (inv.status as any) === "PAID");
      if (allPaid) {
        res.status(200).json({
          success: true,
          status: "completed",
          message: "Pembayaran terverifikasi (lunas)",
        });
        return;
      }

      const projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
      const apiKey = process.env.PAKASIR_API_KEY || "xxx123";
      
      const totalAmount = amount 
        ? Number(amount) 
        : invoices.reduce((sum, inv) => sum + inv.amount, 0);

      const detailUrl = `https://app.pakasir.com/api/transactiondetail?project=${projectSlug}&amount=${totalAmount}&order_id=${order_id}&api_key=${apiKey}`;

      let transactionStatus = "pending";
      
      try {
        const response = await fetch(detailUrl);
        if (response.ok) {
          const detailData = await response.json() as any;
          if (detailData && detailData.transaction) {
            transactionStatus = detailData.transaction.status;
          }
        }
      } catch (err) {
        logger.error(`Gagal memanggil detail transaksi Pakasir: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (transactionStatus === "completed") {
        logger.info(`checkPakasirStatus - Transaksi ${order_id} terverifikasi selesai di Pakasir, memproses pembaruan DB...`);
        await prisma.$transaction(async (tx) => {
          for (const invoice of invoices) {
            if ((invoice.status as any) === "PAID") continue;

            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: "PAID" as any,
              },
            });

            const existingTx = await tx.transaction.findFirst({
              where: { invoiceId: invoice.id, type: "INCOME" as any },
            });

            if (!existingTx) {
              let categoryName = "SPP";
              if (invoice.invoiceType === "UANG_PENGEMBANGAN") categoryName = "Uang Pengembangan";
              else if (invoice.invoiceType === "DAFTAR_ULANG") categoryName = "Daftar Ulang";
              else if (invoice.invoiceType === "UANG_PERALATAN") categoryName = "Uang Peralatan";
              else if (invoice.invoiceType === "EKSTRAKURIKULER") categoryName = "Uang Ekstrakurikuler";
              else if (invoice.invoiceType === "SERAGAM") categoryName = "Uang Seragam";
              else if (invoice.invoiceType === "FULLDAY") categoryName = "Uang Fullday";
              else if (invoice.invoiceType === "KEGIATAN") categoryName = "Uang Kegiatan";
              else if (invoice.invoiceType === "LAINNYA") categoryName = "Lain-lain";

              let category = await tx.category.findFirst({
                where: {
                  name: { equals: categoryName, mode: "insensitive" },
                  type: "INCOME",
                },
              });
              if (!category) {
                category = await tx.category.create({
                  data: {
                    name: categoryName,
                    type: "INCOME",
                    schoolUnitId: null,
                  },
                });
              }

              await tx.transaction.create({
                data: {
                  type: "INCOME" as any,
                  categoryId: category.id,
                  paymentMethod: "MIDTRANS" as any,
                  amount: invoice.amount,
                  description: `Pembayaran ${categoryName} online (Pakasir) bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
                  schoolUnitId: invoice.student.schoolUnitId,
                  recordedById: null,
                  invoiceId: invoice.id,
                },
              });
            }
          }
        });

        res.status(200).json({
          success: true,
          status: "completed",
          message: "Pembayaran terverifikasi (lunas)",
        });
        return;
      }

      res.status(200).json({
        success: true,
        status: "pending",
        message: "Pembayaran masih tertunda (pending)",
      });
    } catch (error: any) {
      next(error);
    }
  }

  async handlePakasirWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, order_id, status } = req.body;

      logger.info(`Menerima webhook Pakasir: ${JSON.stringify(req.body)}`);

      if (!order_id || !status) {
        logger.warn(`Webhook Pakasir diabaikan: Payload tidak valid ${JSON.stringify(req.body)}`);
        res.status(400).json({ success: false, message: "Payload webhook tidak valid" });
        return;
      }

      if (status !== "completed") {
        logger.info(`Webhook Pakasir untuk order_id: ${order_id} diabaikan karena status adalah "${status}"`);
        res.status(200).json({ success: true, message: "Status transaksi bukan completed, abaikan" });
        return;
      }

      const invoices = await prisma.invoice.findMany({
        where: {
          midtransOrderId: {
            startsWith: order_id,
          },
        },
        include: { student: true },
      });

      if (invoices.length === 0) {
        logger.warn(`Webhook Pakasir - Tagihan tidak ditemukan untuk order_id: ${order_id}`);
        res.status(404).json({ success: false, message: "Tagihan tidak ditemukan" });
        return;
      }

      const allPaid = invoices.every((inv) => (inv.status as any) === "PAID");
      if (allPaid) {
        logger.info(`Webhook Pakasir untuk order_id: ${order_id} - Semua tagihan terkait sudah berstatus PAID`);
        res.status(200).json({ success: true, message: "Tagihan sudah lunas" });
        return;
      }

      logger.info(`Webhook Pakasir - Mulai memproses pembaruan status lunas untuk order_id: ${order_id}`);

      await prisma.$transaction(async (tx) => {
        for (const invoice of invoices) {
          if ((invoice.status as any) === "PAID") continue;

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "PAID" as any,
            },
          });

          const existingTx = await tx.transaction.findFirst({
            where: { invoiceId: invoice.id, type: "INCOME" as any },
          });

          if (!existingTx) {
            let categoryName = "SPP";
            if (invoice.invoiceType === "UANG_PENGEMBANGAN") categoryName = "Uang Pengembangan";
            else if (invoice.invoiceType === "DAFTAR_ULANG") categoryName = "Daftar Ulang";
            else if (invoice.invoiceType === "UANG_PERALATAN") categoryName = "Uang Peralatan";
            else if (invoice.invoiceType === "EKSTRAKURIKULER") categoryName = "Uang Ekstrakurikuler";
            else if (invoice.invoiceType === "SERAGAM") categoryName = "Uang Seragam";
            else if (invoice.invoiceType === "FULLDAY") categoryName = "Uang Fullday";
            else if (invoice.invoiceType === "KEGIATAN") categoryName = "Uang Kegiatan";
            else if (invoice.invoiceType === "LAINNYA") categoryName = "Lain-lain";

            let category = await tx.category.findFirst({
              where: {
                name: { equals: categoryName, mode: "insensitive" },
                type: "INCOME",
              },
            });
            if (!category) {
              category = await tx.category.create({
                data: {
                  name: categoryName,
                  type: "INCOME",
                  schoolUnitId: null,
                },
              });
            }

            await tx.transaction.create({
              data: {
                type: "INCOME" as any,
                categoryId: category.id,
                paymentMethod: "MIDTRANS" as any,
                amount: invoice.amount,
                description: `Pembayaran ${categoryName} online (Pakasir Webhook) bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
                schoolUnitId: invoice.student.schoolUnitId,
                recordedById: null,
                invoiceId: invoice.id,
              },
            });
          }
        }
      });

      logger.info(`Webhook Pakasir - Berhasil memproses pembayaran untuk order_id: ${order_id}`);
      res.status(200).json({ success: true, message: "Webhook berhasil diproses" });
    } catch (error: any) {
      logger.error(`Webhook Pakasir gagal untuk order_id: ${req.body?.order_id || "unknown"} - Error: ${error.message}`);
      next(error);
    }
  }

  async simulatePakasirPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, amount } = req.body;

      if (!orderId || !amount) {
        res.status(400).json({ success: false, message: "orderId dan amount wajib diisi" });
        return;
      }

      const projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
      const apiKey = process.env.PAKASIR_API_KEY || "xxx123";

      const simulateUrl = "https://app.pakasir.com/api/paymentsimulation";
      const payload = {
        project: projectSlug,
        order_id: orderId,
        amount: Number(amount),
        api_key: apiKey,
      };

      let statusSimulated = false;

      try {
        const response = await fetch(simulateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          statusSimulated = true;
        }
      } catch (err) {
        console.error("Gagal menghubungi API simulasi Pakasir:", err);
      }

      if (!statusSimulated) {
        logger.warn("Failing back ke simulasi pembayaran lokal untuk Pakasir.");
        const invoices = await prisma.invoice.findMany({
          where: {
            midtransOrderId: {
              startsWith: orderId,
            },
          },
          include: { student: true },
        });

        if (invoices.length > 0) {
          await prisma.$transaction(async (tx) => {
            for (const invoice of invoices) {
              if ((invoice.status as any) === "PAID") continue;

              await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                  status: "PAID" as any,
                },
              });

              let categoryName = "SPP";
              if (invoice.invoiceType === "UANG_PENGEMBANGAN") categoryName = "Uang Pengembangan";
              else if (invoice.invoiceType === "DAFTAR_ULANG") categoryName = "Daftar Ulang";
              else if (invoice.invoiceType === "UANG_PERALATAN") categoryName = "Uang Peralatan";
              else if (invoice.invoiceType === "EKSTRAKURIKULER") categoryName = "Uang Ekstrakurikuler";
              else if (invoice.invoiceType === "SERAGAM") categoryName = "Uang Seragam";
              else if (invoice.invoiceType === "FULLDAY") categoryName = "Uang Fullday";
              else if (invoice.invoiceType === "KEGIATAN") categoryName = "Uang Kegiatan";
              else if (invoice.invoiceType === "LAINNYA") categoryName = "Lain-lain";

              let category = await tx.category.findFirst({
                where: {
                  name: { equals: categoryName, mode: "insensitive" },
                  type: "INCOME",
                },
              });
              if (!category) {
                category = await tx.category.create({
                  data: {
                    name: categoryName,
                    type: "INCOME",
                    schoolUnitId: null,
                  },
                });
              }

              await tx.transaction.create({
                data: {
                  type: "INCOME" as any,
                  categoryId: category.id,
                  paymentMethod: "MIDTRANS" as any,
                  amount: invoice.amount,
                  description: `Pembayaran ${categoryName} online (Simulasi Pakasir) bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
                  schoolUnitId: invoice.student.schoolUnitId,
                  recordedById: null,
                  invoiceId: invoice.id,
                },
              });
            }
          });
        }
      }

      res.status(200).json({
        success: true,
        message: "Simulasi pembayaran Pakasir berhasil dipicu",
      });
    } catch (error: any) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body;

      if (!status || !["PAID", "PENDING"].includes(status)) {
        res.status(400).json({ success: false, message: "Status tidak valid. Gunakan PAID atau PENDING." });
        return;
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(id) },
        include: { student: true },
      });

      if (!invoice) {
        res.status(404).json({ success: false, message: "Tagihan tidak ditemukan" });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: status as any },
        });

        if (status === "PAID") {
          const existingTx = await tx.transaction.findFirst({
            where: { invoiceId: invoice.id, type: "INCOME" as any },
          });

          if (!existingTx) {
            let category = await tx.category.findFirst({
              where: {
                name: { equals: "SPP", mode: "insensitive" },
                type: "INCOME",
              },
            });
            if (!category) {
              category = await tx.category.create({
                data: {
                  name: "SPP",
                  type: "INCOME",
                  schoolUnitId: null,
                },
              });
            }

            await tx.transaction.create({
              data: {
                type: "INCOME" as any,
                categoryId: category.id,
                paymentMethod: "CASH" as any,
                amount: invoice.amount,
                description: `Pembaruan status lunas manual oleh Admin SPP bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
                schoolUnitId: invoice.student.schoolUnitId,
                recordedById: req.user?.id || null,
                invoiceId: invoice.id,
              },
            });
          }
        } else {
          await tx.transaction.deleteMany({
            where: { invoiceId: invoice.id },
          });
        }

        return updatedInvoice;
      });

      res.status(200).json({
        success: true,
        message: "Status tagihan berhasil diperbarui",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  async deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(id) },
      });

      if (!invoice) {
        res.status(404).json({ success: false, message: "Tagihan tidak ditemukan" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.transaction.deleteMany({
          where: { invoiceId: invoice.id },
        });

        await tx.invoice.delete({
          where: { id: invoice.id },
        });
      });

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

      const filter: any = {};

      // Role authorization
      if (req.user?.role === "UNIT_ADMIN") {
        filter.student = { schoolUnitId: req.user.schoolUnitId };
      } else if (schoolUnitId) {
        filter.student = { schoolUnitId: parseInt(schoolUnitId as string) };
      }

      if (className) {
        if (!filter.student) filter.student = {};
        filter.student.className = className as string;
      }

      if (search) {
        if (!filter.student) filter.student = {};
        filter.student.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { studentNumber: { contains: search as string } }
        ];
      }

      if (invoiceType) {
        filter.invoiceType = invoiceType as any;
      }

      if (status) {
        filter.status = status as any;
      }

      if (month) {
        filter.month = parseInt(month as string);
      }

      if (year) {
        filter.year = parseInt(year as string);
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where: filter,
          include: {
            student: {
              include: {
                parent: true
              }
            },
            transactions: true
          },
          orderBy: [
            { year: "desc" },
            { month: "desc" },
            { id: "desc" }
          ],
          skip,
          take
        }),
        prisma.invoice.count({ where: filter })
      ]);

      res.status(200).json({
        success: true,
        data: invoices,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: take,
          totalPages: Math.ceil(total / take)
        }
      });
    } catch (error: any) {
      next(error);
    }
  }
}
