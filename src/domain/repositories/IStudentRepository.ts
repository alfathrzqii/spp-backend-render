import { Student } from "../entities/Student.js";

export interface IStudentRepository {
  create(
    studentData: Omit<Student, "id" | "parentId"> & { parentId?: number },
    parentData?: { name: string; email: string; passwordHash: string }
  ): Promise<Student>;
  findAll(filter?: {
    schoolUnitId?: number;
    search?: string;
  }): Promise<(Student & { parent: { name: string; email: string } })[]>;
  findById(id: number): Promise<Student | null>;
  findByStudentNumber(studentNumber: string): Promise<Student | null>;
  update(
    id: number,
    data: Partial<Pick<Student, "name" | "discountPercentage">>
  ): Promise<Student>;
  delete(id: number): Promise<void>;
}
