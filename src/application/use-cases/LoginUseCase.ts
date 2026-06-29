import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { User } from "../../domain/entities/User.js";
import type { PasswordHasher } from "../../infrastructure/services/PasswordHasher.js";

export class LoginUseCase {
  constructor(
    private userRepository: IUserRepository,
    private passwordHasher: PasswordHasher
  ) {}

  async execute(identifier: string, password: string): Promise<User> {
    let user: User | null = null;

    if (identifier.includes("@")) {
      user = await this.userRepository.findByEmail(identifier);
    } else {
      // Asumsi jika bukan email, maka nomor HP (murni angka)
      user = await this.userRepository.findByPhoneNumber(identifier);
    }

    if (!user) {
      throw new Error("Email/Nomor HP atau password salah");
    }

    const isPasswordValid = await this.passwordHasher.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      throw new Error("Email/Nomor HP atau password salah");
    }

    return user;
  }
}
