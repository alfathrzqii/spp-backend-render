import prisma from "./prisma.js";
import type { IUserRepository } from "../../domain/repositories/IUserRepository.js";
import { User } from "../../domain/entities/User.js";

export class PrismaUserRepository implements IUserRepository {
  private prisma = prisma;

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
      userData.phoneNumber,
      userData.password,
      userData.role,
      userData.schoolUnitId
    );
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!userData) {
      return null;
    }

    return new User(
      userData.id,
      userData.name,
      userData.email,
      userData.phoneNumber,
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
      userData.phoneNumber,
      userData.password,
      userData.role,
      userData.schoolUnitId
    );
  }
}
