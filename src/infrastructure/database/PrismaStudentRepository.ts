import prisma from "./prisma.js";
import type {
  IStudentRepository,
  ParentChildStudentDTO,
  StudentWithFullDetailsDTO,
} from "../../domain/repositories/IStudentRepository.js";
import { Student } from "../../domain/entities/Student.js";
import { BadRequestError } from "../../domain/errors/AppError.js";

export class PrismaStudentRepository implements IStudentRepository {
  private prisma = prisma;

  private mapToDomain(s: any): Student {
    return new Student(
      s.id,
      s.studentNumber,
      s.name,
      s.className,
      s.schoolUnitId,
      s.parentId,
      s.enrollmentYear,
      s.discountAmount,
      s.discountEquipment,
      s.discountExtracurricular,
      s.registrationStatus,
      s.isFullday ?? false,
      s.status,
      s.sdExtracurriculars
    );
  }

  async create(
    studentData: Omit<Student, "id" | "parentId"> & { parentId?: number; sdExtracurricularIds?: number[] },
    parentData?: {
      name: string;
      email: string;
      phoneNumber: string;
      passwordHash: string;
    }
  ): Promise<Student> {
    const result = await this.prisma.$transaction(async (tx) => {
      let finalParentId = studentData.parentId;

      if (parentData) {
        const newUser = await tx.user.create({
          data: {
            name: parentData.name,
            email: parentData.email,
            phoneNumber: parentData.phoneNumber,
            password: parentData.passwordHash,
            role: "PARENT",
            schoolUnitId: null,
          },
        });
        finalParentId = newUser.id;
      }

      if (!finalParentId) {
        throw new Error("Parent ID is required if parent data is not provided");
      }

      const studentCreatePayload: any = {
        studentNumber: studentData.studentNumber,
        name: studentData.name,
        className: studentData.className,
        schoolUnitId: studentData.schoolUnitId,
        enrollmentYear: studentData.enrollmentYear,
        discountAmount: studentData.discountAmount,
        discountEquipment: studentData.discountEquipment || 0,
        discountExtracurricular: studentData.discountExtracurricular || 0,
        registrationStatus: studentData.registrationStatus || "BARU",
        isFullday: studentData.isFullday ?? false,
        parentId: finalParentId,
        status: studentData.status || "ACTIVE",
      };

      if (studentData.sdExtracurricularIds) {
        studentCreatePayload.sdExtracurriculars = {
          connect: studentData.sdExtracurricularIds.map((eid) => ({ id: eid })),
        };
      }

      const newStudent = await tx.student.create({
        data: studentCreatePayload,
        include: {
          sdExtracurriculars: true,
        },
      });

      return newStudent;
    });

    return this.mapToDomain(result);
  }

  async findAll(filter?: {
    schoolUnitId?: number;
    search?: string;
    className?: string;
    discount?: string;
    status?: string;
    excludePpdb?: boolean;
  }): Promise<
    (Student & { parent: { name: string; email: string; phoneNumber: string | null } })[]
  > {
    const where: any = {};

    if (filter?.schoolUnitId) {
      where.schoolUnitId = filter.schoolUnitId;
    }

    if (filter?.className) {
      where.className = filter.className;
    } else if (filter?.excludePpdb) {
      where.className = { not: "PPDB" };
    }

    if (filter?.discount) {
      if (filter.discount === "yes") {
        where.discountAmount = { gt: 0 };
      } else if (filter.discount === "no") {
        where.discountAmount = 0;
      }
    }

    if (filter?.status) {
      where.status = filter.status;
    } else {
      where.status = "ACTIVE";
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { studentNumber: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        parent: {
          select: {
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        sdExtracurriculars: true,
      },
    });

    return students.map((s) => {
      const student = this.mapToDomain(s);
      return Object.assign(student, { parent: s.parent });
    });
  }

  async findById(id: number): Promise<Student | null> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        sdExtracurriculars: true,
      },
    });

    if (!student) return null;

    return this.mapToDomain(student);
  }

  async findByStudentNumber(studentNumber: string): Promise<Student | null> {
    const student = await this.prisma.student.findUnique({
      where: { studentNumber },
      include: {
        sdExtracurriculars: true,
      },
    });

    if (!student) return null;

    return this.mapToDomain(student);
  }

  async findByStudentNumberWithDetails(studentNumber: string): Promise<StudentWithFullDetailsDTO | null> {
    const student = await this.prisma.student.findUnique({
      where: { studentNumber },
      include: {
        schoolUnit: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true, email: true, phoneNumber: true } },
        sdExtracurriculars: true,
      },
    });

    if (!student) return null;

    const domain = this.mapToDomain(student);
    return Object.assign(domain, {
      schoolUnit: student.schoolUnit,
      parent: student.parent,
      sdExtracurriculars: student.sdExtracurriculars,
    }) as StudentWithFullDetailsDTO;
  }

  async findStudentsWithDetails(filter?: {
    schoolUnitId?: number | undefined;
    className?: string | undefined;
    notClassName?: string | undefined;
    parentId?: number | undefined;
    status?: string | undefined;
  }): Promise<StudentWithFullDetailsDTO[]> {
    const where: any = {};

    if (filter?.schoolUnitId) {
      where.schoolUnitId = filter.schoolUnitId;
    }

    if (filter?.className) {
      where.className = filter.className;
    } else if (filter?.notClassName) {
      where.className = { not: filter.notClassName };
    }

    if (filter?.parentId) {
      where.parentId = filter.parentId;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        schoolUnit: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true, email: true, phoneNumber: true } },
        sdExtracurriculars: true,
      },
      orderBy: { name: "asc" },
    });

    return students.map((s) => {
      const domain = this.mapToDomain(s);
      return Object.assign(domain, {
        schoolUnit: s.schoolUnit,
        parent: s.parent,
        sdExtracurriculars: s.sdExtracurriculars,
      }) as StudentWithFullDetailsDTO;
    });
  }

  async findByParentId(parentId: number): Promise<ParentChildStudentDTO[]> {
    const list = await this.prisma.student.findMany({
      where: { parentId },
      include: {
        schoolUnit: { select: { name: true } },
      },
    });
    return list as unknown as ParentChildStudentDTO[];
  }

  async update(
    id: number,
    data: {
      name?: string;
      className?: string;
      schoolUnitId?: number;
      enrollmentYear?: number;
      discountAmount?: number;
      discountEquipment?: number;
      discountExtracurricular?: number;
      registrationStatus?: string;
      isFullday?: boolean;
      birthDate?: string | null;
      parentName?: string;
      parentEmail?: string | null;
      parentPhoneNumber?: string;
      status?: string;
      sdExtracurricularIds?: number[];
    }
  ): Promise<Student> {
    const {
      name,
      className,
      schoolUnitId,
      enrollmentYear,
      discountAmount,
      discountEquipment,
      discountExtracurricular,
      registrationStatus,
      isFullday,
      parentName,
      parentEmail,
      parentPhoneNumber,
      status,
      sdExtracurricularIds,
    } = data;

    const studentData: any = {};
    if (name !== undefined) studentData.name = name;
    if (className !== undefined) studentData.className = className;
    if (enrollmentYear !== undefined) studentData.enrollmentYear = enrollmentYear;
    if (discountAmount !== undefined) studentData.discountAmount = discountAmount;
    if (discountEquipment !== undefined) studentData.discountEquipment = discountEquipment;
    if (discountExtracurricular !== undefined) studentData.discountExtracurricular = discountExtracurricular;
    if (registrationStatus !== undefined) studentData.registrationStatus = registrationStatus;
    if (isFullday !== undefined) studentData.isFullday = isFullday;
    if (status !== undefined) studentData.status = status;
    if (schoolUnitId !== undefined) {
      studentData.schoolUnit = {
        connect: { id: schoolUnitId }
      };
    }
    if (sdExtracurricularIds !== undefined) {
      studentData.sdExtracurriculars = {
        set: sdExtracurricularIds.map((eid) => ({ id: eid })),
      };
    }

    const parentUpdateData: any = {};
    if (parentName !== undefined) parentUpdateData.name = parentName;
    if (parentEmail !== undefined) parentUpdateData.email = parentEmail;
    if (parentPhoneNumber !== undefined) parentUpdateData.phoneNumber = parentPhoneNumber;

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...studentData,
        ...(Object.keys(parentUpdateData).length > 0 && {
          parent: {
            update: parentUpdateData,
          },
        }),
      },
      include: {
        sdExtracurriculars: true,
      },
    });

    return this.mapToDomain(updated);
  }

  async delete(id: number): Promise<void> {
    // 1. Cek apakah ada transaksi kas yang terikat dengan tagihan siswa ini
    const transactionCount = await this.prisma.transaction.count({
      where: {
        invoice: {
          studentId: id,
        },
      },
    });

    if (transactionCount > 0) {
      throw new BadRequestError(
        "Tidak dapat menghapus siswa yang sudah memiliki riwayat transaksi buku kas. Ubah status siswa menjadi NONAKTIF atau LULUS."
      );
    }

    // 2. Cek apakah ada tagihan yang sudah lunas (PAID)
    const paidInvoiceCount = await this.prisma.invoice.count({
      where: {
        studentId: id,
        status: "PAID",
      },
    });

    if (paidInvoiceCount > 0) {
      throw new BadRequestError(
        "Tidak dapat menghapus siswa yang memiliki riwayat tagihan terbayar. Ubah status siswa menjadi NONAKTIF atau LULUS."
      );
    }

    // 3. Hapus tagihan yang masih berstatus PENDING (jika siswa belum pernah membayar)
    await this.prisma.invoice.deleteMany({
      where: {
        studentId: id,
      },
    });

    // 4. Hapus data siswa
    await this.prisma.student.delete({
      where: { id },
    });
  }

  async importStudentWithParent(data: {
    studentNumber: string;
    name: string;
    className: string;
    schoolUnitId: number;
    enrollmentYear: number;
    discountAmount: number;
    discountEquipment: number;
    discountExtracurricular: number;
    birthDate?: string;
    parentName: string;
    parentPhoneNumber: string;
    parentEmail?: string;
    parentPasswordHash: string;
  }): Promise<{ student: Student; createdParent: boolean }> {
    return await this.prisma.$transaction(async (tx) => {
      let createdParent = false;
      let parentUser = await tx.user.findUnique({
        where: { phoneNumber: data.parentPhoneNumber },
      });

      if (!parentUser) {
        parentUser = await tx.user.create({
          data: {
            name: data.parentName,
            email: data.parentEmail || `${data.parentPhoneNumber}@sekolah.id`,
            phoneNumber: data.parentPhoneNumber,
            password: data.parentPasswordHash,
            role: "PARENT",
            schoolUnitId: null,
          },
        });
        createdParent = true;
      }

      const existingStudent = await tx.student.findUnique({
        where: { studentNumber: data.studentNumber },
      });

      let studentResult: any;
      if (existingStudent) {
        studentResult = await tx.student.update({
          where: { studentNumber: data.studentNumber },
          data: {
            name: data.name,
            className: data.className,
            schoolUnitId: data.schoolUnitId,
            enrollmentYear: data.enrollmentYear,
            discountAmount: data.discountAmount,
            discountEquipment: data.discountEquipment,
            discountExtracurricular: data.discountExtracurricular,
            registrationStatus: "NAIK_KELAS",
            parentId: parentUser.id,
          },
        });
      } else {
        studentResult = await tx.student.create({
          data: {
            studentNumber: data.studentNumber,
            name: data.name,
            className: data.className,
            schoolUnitId: data.schoolUnitId,
            enrollmentYear: data.enrollmentYear,
            discountAmount: data.discountAmount,
            discountEquipment: data.discountEquipment,
            discountExtracurricular: data.discountExtracurricular,
            registrationStatus: "BARU",
            parentId: parentUser.id,
          },
        });
      }

      return {
        student: this.mapToDomain(studentResult),
        createdParent,
      };
    });
  }
}

