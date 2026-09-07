import type { IUserRepository, UserWithSchoolUnit } from "../../domain/repositories/IUserRepository.js";
import type { Role } from "../../domain/enums/Role.js";

export class GetUsersUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(filter?: { role?: Role }): Promise<UserWithSchoolUnit[]> {
    return await this.userRepository.findAll(filter);
  }
}
