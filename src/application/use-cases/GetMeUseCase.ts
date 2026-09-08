import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import { UnauthorizedError } from "../../domain/errors/AppError.js";

export interface UserProfileDTO {
  id: number;
  name: string;
  email: string;
  role: string;
  schoolUnitId: number | null;
}

export class GetMeUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(userId: number | undefined | null): Promise<UserProfileDTO> {
    if (!userId) {
      throw new UnauthorizedError("Autentikasi gagal: Sesi tidak valid atau telah berakhir");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError("Autentikasi gagal: Sesi tidak valid atau telah berakhir");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolUnitId: user.schoolUnitId,
    };
  }
}
