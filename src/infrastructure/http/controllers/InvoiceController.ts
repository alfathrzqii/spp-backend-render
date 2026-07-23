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

      if (Number(year) < student.enrollmentYear || (Number(year) === student.enrollmentYear && Number(month) < 7)) {
        res.status(400).json({
          success: false,
          message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar",
        });
        return;
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
        if (req.query.className) {
          where.className = (req.query.className as string).trim();
        }
      } else if ((user.role as any) === "WALI_KELAS") {
        where.schoolUnitId = user.schoolUnitId;
        where.className = userClassName;
      } else if ((user.role as any) === "PARENT") {
        where.parentId = user.id;
      } else {
        if (req.query.schoolUnitId) {
          where.schoolUnitId = Number(req.query.schoolUnitId);
        }
        if (req.query.className) {
          where.className = (req.query.className as string).trim();
        }
      }

      const students = await prisma.student.findMany({
        where,
        include: {
          schoolUnit: { select: { name: true } },
          parent: { select: { name: true, phoneNumber: true, email: true } },
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

        const startMonth = year === student.enrollmentYear ? 7 : 1;
        for (let m = startMonth; m <= upToMonth; m++) {
          const inv = dbInvoices.find((i) => i.month === m);
          if (!inv) {
            totalUnpaidMonths++;
            totalUnpaidAmount += netAmount;
            unpaidMonthsList.push({
              month: m,
              status: "PENDING",
              totalAmount: netAmount,
              unpaidAmount: netAmount,
            });
          } else if ((inv.status as any) === "PENDING") {
            totalUnpaidMonths++;
            totalUnpaidAmount += inv.amount;
            unpaidMonthsList.push({
              month: m,
              status: "PENDING",
              totalAmount: inv.amount,
              unpaidAmount: inv.amount,
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
            unpaidMonths: unpaidMonthsList,
            totalUnpaidAmount,
            totalUnpaidCount: totalUnpaidMonths,
          });
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
        message: "Laporan tunggakan SPP berhasil diambil",
        data: {
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
        if (req.query.schoolUnitId) {
          where.schoolUnitId = Number(req.query.schoolUnitId);
        }
        if (req.query.className) {
          where.className = String(req.query.className);
        }
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

          let studentUnpaidMonths = 0;
          let studentUnpaidAmount = 0;

          const startMonth = year === student.enrollmentYear ? 7 : 1;
          for (let m = startMonth; m <= upToMonth; m++) {
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
          schoolUnitName: schoolUnit?.name || "-",
          className: group.className,
          totalStudents: totalStudentsInClass,
          unpaidStudentsCount: studentsWithUnpaid,
          totalUnpaidMonths: totalUnpaidMonthsClass,
          totalUnpaidNominal: totalUnpaidNominalClass,
          totalUnpaidAmount: totalUnpaidNominalClass,
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

      const baseAmount = tariff.amount;
      const discountApplied = Math.floor((baseAmount * student.discountPercentage) / 100);
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

      const startMonth = year === student.enrollmentYear ? 7 : 1;
      const invoices = Array.from({ length: 12 - startMonth + 1 }, (_, i) => {
        const month = startMonth + i;
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

      if (Number(year) < student.enrollmentYear || (Number(year) === student.enrollmentYear && Number(month) < 7)) {
        res.status(400).json({
          success: false,
          message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar",
        });
        return;
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

        const transaction = await tx.transaction.create({
          data: {
            type: "INCOME" as any,
            categoryId: category.id,
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

  async createPakasirTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentNumber, month, year, paymentMethod } = req.body;

      if (!studentNumber || !month || !year || !paymentMethod) {
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

      if (Number(year) < student.enrollmentYear || (Number(year) === student.enrollmentYear && Number(month) < 7)) {
        res.status(400).json({
          success: false,
          message: "Akses ditolak: Tagihan tidak tersedia untuk periode sebelum siswa terdaftar",
        });
        return;
      }

      // Check if already paid
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

      const rawBaseAmount = tariff ? Number(tariff.amount) : 0;
      const baseAmount = isNaN(rawBaseAmount) || rawBaseAmount <= 0 ? 185000 : rawBaseAmount;

      const rawDiscount = student ? Number(student.discountPercentage) : 0;
      const discountPercent = isNaN(rawDiscount) ? 0 : rawDiscount;

      const discountApplied = Math.floor((baseAmount * discountPercent) / 100);
      const calculatedAmount = baseAmount - discountApplied;
      const amountToPay = isNaN(calculatedAmount) || calculatedAmount <= 0 
        ? 1000 
        : Math.round(calculatedAmount);

      const projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
      const apiKey = process.env.PAKASIR_API_KEY || "xxx123";

      // Order ID format: SPP-{studentNumber}-{month}-{year}-{timestamp}
      const orderId = `SPP-${student.studentNumber}-${month}-${year}-${Date.now()}`;

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
        amount: Number(amountToPay),
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

      // Fallback to mock Pakasir response if API call fails (useful for local development without credentials)
      if (!pakasirData || !pakasirData.payment) {
        console.warn("Menggunakan response tiruan (mock) Pakasir untuk pengujian local.");
        pakasirData = {
          payment: {
            project: projectSlug,
            order_id: orderId,
            amount: amountToPay,
            fee: 1000,
            total_payment: amountToPay + 1000,
            payment_method: paymentMethod,
            payment_number: paymentMethod === "qris" 
              ? "00020101021226610016ID.CO.SHOPEE.WWW01189360091800216005230208216005230303UME51440014ID.CO.QRIS.WWW0215ID10243228429300303UME5204792953033605409100003.005802ID5907Pakasir6012KAB. KEBUMEN61055439262230519SP25RZRATEQI2HQ65Q46304A079"
              : `89022${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }
        };
      }

      // Save or update invoice in DB with status PENDING and store order_id
      await prisma.$transaction(async (tx) => {
        if (existingInvoice) {
          await tx.invoice.update({
            where: { id: existingInvoice.id },
            data: {
              midtransOrderId: orderId,
              baseAmount,
              discountApplied,
              amount: amountToPay,
            },
          });
        } else {
          await tx.invoice.create({
            data: {
              studentId: student.id,
              invoiceType: "SPP" as any,
              month: Number(month),
              year: Number(year),
              baseAmount,
              discountApplied,
              amount: amountToPay,
              status: "PENDING" as any,
              midtransOrderId: orderId,
            },
          });
        }
      });

      res.status(200).json({
        success: true,
        message: "Transaksi Pakasir berhasil dibuat",
        data: {
          orderId,
          amount: amountToPay,
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

      const invoice = await prisma.invoice.findUnique({
        where: { midtransOrderId: order_id as string },
        include: { student: true },
      });

      if (!invoice) {
        res.status(404).json({ success: false, message: "Tagihan tidak ditemukan" });
        return;
      }

      if ((invoice.status as any) === "PAID") {
        res.status(200).json({
          success: true,
          status: "completed",
          message: "Pembayaran terverifikasi (lunas)",
        });
        return;
      }

      const projectSlug = process.env.PAKASIR_PROJECT_SLUG || "depodomain";
      const apiKey = process.env.PAKASIR_API_KEY || "xxx123";
      const amountVal = amount || invoice.amount;

      const detailUrl = `https://app.pakasir.com/api/transactiondetail?project=${projectSlug}&amount=${amountVal}&order_id=${order_id}&api_key=${apiKey}`;

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
        console.error("Gagal memanggil detail transaksi Pakasir:", err);
      }

      if (transactionStatus === "completed") {
        await prisma.$transaction(async (tx) => {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: "PAID" as any },
          });

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
                paymentMethod: "MIDTRANS" as any,
                amount: invoice.amount,
                description: `Pembayaran SPP online (Pakasir) bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
                schoolUnitId: invoice.student.schoolUnitId,
                recordedById: null,
                invoiceId: invoice.id,
              },
            });
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

      console.log("Menerima webhook Pakasir:", req.body);

      if (!order_id || !status) {
        res.status(400).json({ success: false, message: "Payload webhook tidak valid" });
        return;
      }

      if (status !== "completed") {
        res.status(200).json({ success: true, message: "Status transaksi bukan completed, abaikan" });
        return;
      }

      const invoice = await prisma.invoice.findUnique({
        where: { midtransOrderId: order_id },
        include: { student: true },
      });

      if (!invoice) {
        res.status(404).json({ success: false, message: "Tagihan tidak ditemukan" });
        return;
      }

      if ((invoice.status as any) === "PAID") {
        res.status(200).json({ success: true, message: "Tagihan sudah lunas" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID" as any },
        });

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
            paymentMethod: "MIDTRANS" as any,
            amount: Number(amount) || invoice.amount,
            description: `Pembayaran SPP online (Pakasir Webhook) bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
            schoolUnitId: invoice.student.schoolUnitId,
            recordedById: null,
            invoiceId: invoice.id,
          },
        });
      });

      res.status(200).json({ success: true, message: "Webhook berhasil diproses" });
    } catch (error: any) {
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
        console.warn("Failing back ke simulasi pembayaran lokal untuk Pakasir.");
        const invoice = await prisma.invoice.findUnique({
          where: { midtransOrderId: orderId },
          include: { student: true },
        });

        if (invoice && (invoice.status as any) !== "PAID") {
          await prisma.$transaction(async (tx) => {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "PAID" as any },
            });

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
                paymentMethod: "MIDTRANS" as any,
                amount: Number(amount) || invoice.amount,
                description: `Pembayaran SPP online (Simulasi Pakasir Lokal) bulan ${invoice.month} tahun ${invoice.year} untuk siswa ${invoice.student.name}`,
                schoolUnitId: invoice.student.schoolUnitId,
                recordedById: null,
                invoiceId: invoice.id,
              },
            });
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
}
