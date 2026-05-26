import { PrismaClient } from "@prisma/client";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import { User } from "../../domain/entities/User.js";

export class PrismaUserRepository implements IUserRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findByEmail(email: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!userData) {
      return null;
    }

    return new User(
      userData.id,
      userData.name,
      userData.email,
      userData.password,
      userData.role,
      userData.schoolUnitId
    );
  }

  async findById(id: number): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!userData) {
      return null;
    }

    return new User(
      userData.id,
      userData.name,
      userData.email,
      userData.password,
      userData.role,
      userData.schoolUnitId
    );
  }
}
