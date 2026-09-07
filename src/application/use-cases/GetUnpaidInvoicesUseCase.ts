import prisma from "../../infrastructure/database/prisma.js";

export interface GetUnpaidInvoicesDTO {
  user: {
    id: number;
    role: string;
    schoolUnitId: number | null;
  };
  year?: number | undefined;
  upToMonth?: number | undefined;
  className?: string | undefined;
  schoolUnitId?: number | undefined;
  invoiceType?: string | undefined;
}

export class GetUnpaidInvoicesUseCase {
  async execute(dto: GetUnpaidInvoicesDTO) {
    const { user } = dto;
    const year = dto.year ?? new Date().getFullYear();
    const upToMonth = dto.upToMonth ?? new Date().getMonth() + 1;

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
      if (dto.className) {
        where.className = dto.className.trim();
      }
    } else if ((user.role as any) === "WALI_KELAS") {
      where.schoolUnitId = user.schoolUnitId;
      where.className = userClassName;
    } else if ((user.role as any) === "PARENT") {
      where.parentId = user.id;
    } else {
      if (dto.schoolUnitId && !isNaN(Number(dto.schoolUnitId))) {
        where.schoolUnitId = Number(dto.schoolUnitId);
      }
      if (dto.className) {
        where.className = dto.className.trim();
      }
    }

    where.status = "ACTIVE";
    if (!dto.className) {
      where.className = { not: "PPDB" };
    }

    const invoiceType = ((dto.invoiceType as string) || "SPP").toUpperCase();

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
            status: unpaidMonthsList.some((m) => m.status === "PARTIALLY_PAID") ? "PARTIALLY_PAID" : "PENDING",
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
            status: unpaidMonthsList.some((m) => m.status === "PARTIALLY_PAID") ? "PARTIALLY_PAID" : "PENDING",
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
            const level =
              student.schoolUnitId === 1
                ? "KB"
                : student.className.trim().toUpperCase().charAt(0) === "B"
                ? "B"
                : "A";
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
            const level =
              student.schoolUnitId === 1
                ? "KB"
                : student.className.trim().toUpperCase().charAt(0) === "B"
                ? "B"
                : "A";
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

        const targetYear =
          invoiceType === "UANG_PENGEMBANGAN" || invoiceType === "SERAGAM"
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

    return {
      invoiceType,
      unpaidList,
      summary,
    };
  }
}
