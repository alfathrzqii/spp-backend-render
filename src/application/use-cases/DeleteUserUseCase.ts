import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { User } from "../../domain/entities/User.js";
import { BadRequestError, NotFoundError } from "../../domain/errors/AppError.js";

export class DeleteUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(targetUserId: number, currentUserId: number): Promise<User> {
    if (currentUserId === targetUserId) {
      throw new BadRequestError("Anda tidak diizinkan untuk menghapus akun Anda sendiri");
    }

    const existing = await this.userRepository.findById(targetUserId);
    if (!existing) {
      throw new NotFoundError("User tidak ditemukan");
    }

    if (existing.role === "PARENT") {
      const studentCount = await this.userRepository.countStudentsByParentId(targetUserId);
      if (studentCount > 0) {
        throw new BadRequestError("Gagal menghapus: Akun wali murid masih terikat dengan data siswa aktif");
      }
    }

    await this.userRepository.delete(targetUserId);
    return existing;
  }
}
