import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import type { User } from "../../domain/entities/User.js";

export class LoginUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new Error("Email atau password salah");
    }

    return user;
  }
}
