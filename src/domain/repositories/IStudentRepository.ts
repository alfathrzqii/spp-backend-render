import { Student } from "../entities/Student.js";

export interface IStudentRepository {
  create(
    studentData: Omit<Student, "id" | "parentId"> & { parentId?: number },
    parentData?: {
      name: string;
      email: string;
      phoneNumber: string;
      passwordHash: string;
    }
  ): Promise<Student>;
  findAll(filter?: {
    schoolUnitId?: number;
    search?: string;
    className?: string;
  }): Promise<
    (Student & { parent: { name: string; email: string; phoneNumber: string | null } })[]
  >;
  findById(id: number): Promise<Student | null>;
  findByStudentNumber(studentNumber: string): Promise<Student | null>;
  update(
    id: number,
    data: {
      name?: string;
      className?: string;
      schoolUnitId?: number;
      enrollmentYear?: number;
      discountPercentage?: number;
      birthDate?: string | null;
      parentName?: string;
      parentEmail?: string | null;
      parentPhoneNumber?: string;
    }
  ): Promise<Student>;
  delete(id: number): Promise<void>;
}
