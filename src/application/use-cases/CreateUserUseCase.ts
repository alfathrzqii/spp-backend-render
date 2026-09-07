import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { IPasswordHasher } from "../ports/IPasswordHasher.js";
import type { User } from "../../domain/entities/User.js";
import type { Role } from "../../domain/enums/Role.js";
import { BadRequestError } from "../../domain/errors/AppError.js";

export interface CreateUserInput {
  name: string;
  email?: string | null;
  phoneNumber: string;
  password: string;
  role: Role;
  schoolUnitId?: number | null;
  className?: string | null;
}

export class CreateUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordHasher: IPasswordHasher
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const { name, email, phoneNumber, password, role, schoolUnitId, className } = input;

    if (!name || !phoneNumber || !password || !role) {
      throw new BadRequestError("Nama, No HP, Password, dan Peran wajib diisi");
    }

    const existing = await this.userRepository.findByPhoneNumber(phoneNumber);
    if (existing) {
      throw new BadRequestError("Nomor HP sudah digunakan oleh akun lain");
    }

    const passwordHash = await this.passwordHasher.hash(password);

    return await this.userRepository.create({
      name,
      email: email || null,
      phoneNumber,
      passwordHash,
      role,
      schoolUnitId: schoolUnitId ? Number(schoolUnitId) : null,
      className: role === "WALI_KELAS" ? (className || null) : null,
    });
  }
}
