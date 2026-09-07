import type { IStudentRepository } from "../../domain/repositories/IStudentRepository.js";

export class GetParentChildrenUseCase {
  constructor(private studentRepository: IStudentRepository) {}

  async execute(parentId: number): Promise<any[]> {
    return await this.studentRepository.findByParentId(parentId);
  }
}
