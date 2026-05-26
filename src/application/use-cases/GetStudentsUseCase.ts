import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";
import type { Student } from "../../domain/entities/Student.js";

export class GetStudentsUseCase {
  constructor(private studentRepository: IStudentRepository) {}

  async execute(filter?: {
    schoolUnitId?: number;
    search?: string;
  }): Promise<(Student & { parent: { name: string; email: string } })[]> {
    return this.studentRepository.findAll(filter);
  }
}
