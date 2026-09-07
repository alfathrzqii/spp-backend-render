import type { IUserRepository, UpdateUserData } from "../../domain/repositories/IUserRepository.js";
import type { IPasswordHasher } from "../ports/IPasswordHasher.js";
import type { User } from "../../domain/entities/User.js";
import type { Role } from "../../domain/enums/Role.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export interface UpdateUserInput {
  name?: string | undefined;
  email?: string | null | undefined;
  phoneNumber?: string | undefined;
  password?: string | undefined;
  role?: Role | undefined;
  schoolUnitId?: number | null | undefined;
  className?: string | null | undefined;
}

export class UpdateUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordHasher: IPasswordHasher
  ) {}

  async execute(id: number, input: UpdateUserInput): Promise<User> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("User tidak ditemukan");
    }

    if (input.phoneNumber && input.phoneNumber !== existing.phoneNumber) {
      const dup = await this.userRepository.findByPhoneNumber(input.phoneNumber);
      if (dup && dup.id !== id) {
        throw new BadRequestError("Nomor HP sudah digunakan oleh akun lain");
      }
    }

    const updatePayload: UpdateUserData = {
      name: input.name ?? existing.name,
      email: input.email !== undefined ? input.email : existing.email,
      phoneNumber: input.phoneNumber ?? (existing.phoneNumber ?? undefined),
      role: input.role ?? existing.role,
      schoolUnitId: input.schoolUnitId !== undefined ? input.schoolUnitId : existing.schoolUnitId,
      className: (input.role ?? existing.role) === "WALI_KELAS"
        ? (input.className !== undefined ? input.className : existing.className)
        : null,
    };

    if (input.password && input.password.trim().length > 0) {
      updatePayload.passwordHash = await this.passwordHasher.hash(input.password);
    }

    return await this.userRepository.update(id, updatePayload);
  }
}
