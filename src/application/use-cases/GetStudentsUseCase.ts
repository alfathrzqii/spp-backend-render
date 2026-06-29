import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { Student } from "../../domain/entities/Student.js";

export class GetStudentsUseCase {
  constructor(private studentRepository: IStudentRepository) {}

  async execute(filter?: {
    schoolUnitId?: number;
    search?: string;
    className?: string;
  }): Promise<
    (Student & { parent: { name: string; email: string; phoneNumber: string | null } })[]
  > {
    return this.studentRepository.findAll(filter);
  }
}
