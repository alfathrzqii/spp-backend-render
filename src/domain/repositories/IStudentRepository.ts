import { Student } from "../entities/Student.js";

export interface ParentChildStudentDTO {
  id: number;
  studentNumber: string;
  name: string;
  className: string;
  schoolUnitId: number;
  parentId: number;
  enrollmentYear: number;
  discountAmount: number;
  discountEquipment: number;
  discountExtracurricular: number;
  registrationStatus: string;
  isFullday: boolean;
  status: string;
  schoolUnit: {
    name: string;
  };
}

export interface IStudentRepository {
  create(
    studentData: Omit<Student, "id" | "parentId"> & { parentId?: number; sdExtracurricularIds?: number[] },
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
    discount?: string;
    status?: string;
    excludePpdb?: boolean;
  }): Promise<
    (Student & { parent: { name: string; email: string; phoneNumber: string | null } })[]
  >;
  findById(id: number): Promise<Student | null>;
  findByStudentNumber(studentNumber: string): Promise<Student | null>;
  findByParentId(parentId: number): Promise<ParentChildStudentDTO[]>;
  update(
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
  ): Promise<Student>;
  delete(id: number): Promise<void>;
  importStudentWithParent(data: {
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
  }): Promise<{ student: Student; createdParent: boolean }>;
}

