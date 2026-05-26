import { PrismaClient } from "@prisma/client";
import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import { Student } from "../../domain/entities/Student.js";

export class PrismaStudentRepository implements IStudentRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(
    studentData: Omit<Student, "id" | "parentId"> & { parentId?: number },
    parentData?: { name: string; email: string; passwordHash: string }
  ): Promise<Student> {
    const result = await this.prisma.$transaction(async (tx) => {
      let finalParentId = studentData.parentId;

      if (parentData) {
        const newUser = await tx.user.create({
          data: {
            name: parentData.name,
            email: parentData.email,
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

      const newStudent = await tx.student.create({
        data: {
          studentNumber: studentData.studentNumber,
          name: studentData.name,
          schoolUnitId: studentData.schoolUnitId,
          enrollmentYear: studentData.enrollmentYear,
          discountPercentage: studentData.discountPercentage,
          parentId: finalParentId,
        },
      });

      return newStudent;
    });

    return new Student(
      result.id,
      result.studentNumber,
      result.name,
      result.schoolUnitId,
      result.parentId,
      result.enrollmentYear,
      result.discountPercentage
    );
  }

  async findAll(filter?: {
    schoolUnitId?: number;
    search?: string;
  }): Promise<(Student & { parent: { name: string; email: string } })[]> {
    const where: any = {};

    if (filter?.schoolUnitId) {
      where.schoolUnitId = filter.schoolUnitId;
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
          },
        },
      },
    });

    return students.map((s) => ({
      ...new Student(
        s.id,
        s.studentNumber,
        s.name,
        s.schoolUnitId,
        s.parentId,
        s.enrollmentYear,
        s.discountPercentage
      ),
      parent: s.parent,
    }));
  }

  async findById(id: number): Promise<Student | null> {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) return null;

    return new Student(
      student.id,
      student.studentNumber,
      student.name,
      student.schoolUnitId,
      student.parentId,
      student.enrollmentYear,
      student.discountPercentage
    );
  }

  async findByStudentNumber(studentNumber: string): Promise<Student | null> {
    const student = await this.prisma.student.findUnique({
      where: { studentNumber },
    });

    if (!student) return null;

    return new Student(
      student.id,
      student.studentNumber,
      student.name,
      student.schoolUnitId,
      student.parentId,
      student.enrollmentYear,
      student.discountPercentage
    );
  }

  async update(
    id: number,
    data: Partial<Pick<Student, "name" | "discountPercentage">>
  ): Promise<Student> {
    const updated = await this.prisma.student.update({
      where: { id },
      data,
    });

    return new Student(
      updated.id,
      updated.studentNumber,
      updated.name,
      updated.schoolUnitId,
      updated.parentId,
      updated.enrollmentYear,
      updated.discountPercentage
    );
  }

  async delete(id: number): Promise<void> {
    await this.prisma.student.delete({
      where: { id },
    });
  }
}
