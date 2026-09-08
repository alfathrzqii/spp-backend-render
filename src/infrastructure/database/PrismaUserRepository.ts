import prisma from "./prisma.js";
import type {
  IUserRepository,
  CreateUserData,
  UpdateUserData,
  UserWithSchoolUnit,
} from "../../domain/repositories/IUserRepository.js";
import { User } from "../../domain/entities/User.js";
import type { Role } from "../../domain/enums/Role.js";

export class PrismaUserRepository implements IUserRepository {
  private prisma = prisma;

  private mapToDomain(userData: any): User {
    return new User(
      userData.id,
      userData.name,
      userData.email,
      userData.phoneNumber,
      userData.password !== undefined ? userData.password : undefined,
      userData.role as Role,
      userData.schoolUnitId,
      userData.className || null
    );
  }

  async create(data: CreateUserData): Promise<User> {
    const finalEmail = data.email || `${data.phoneNumber}@sekolah.id`;
    const newUser = await this.prisma.user.create({
      data: {
        name: data.name,
        email: finalEmail,
        phoneNumber: data.phoneNumber,
        password: data.passwordHash,
        role: data.role as any,
        schoolUnitId: data.schoolUnitId ?? null,
        className: data.className ?? null,
      },
    });

    return this.mapToDomain(newUser);
  }

  async findAll(filter?: { role?: Role }): Promise<UserWithSchoolUnit[]> {
    const where: any = {};
    if (filter?.role) {
      where.role = filter.role;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        schoolUnitId: true,
        className: true,
        schoolUnit: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    return users.map((u) => {
      const user = this.mapToDomain(u);
      return Object.assign(user, { schoolUnit: u.schoolUnit });
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!userData) {
      return null;
    }

    return this.mapToDomain(userData);
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!userData) {
      return null;
    }

    return this.mapToDomain(userData);
  }

  async findById(id: number): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!userData) {
      return null;
    }

    return this.mapToDomain(userData);
  }

  async update(id: number, data: UpdateUserData): Promise<User> {
    const updatePayload: any = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.phoneNumber !== undefined) updatePayload.phoneNumber = data.phoneNumber;
    if (data.passwordHash !== undefined) updatePayload.password = data.passwordHash;
    if (data.role !== undefined) updatePayload.role = data.role as any;
    if (data.schoolUnitId !== undefined) updatePayload.schoolUnitId = data.schoolUnitId;
    if (data.className !== undefined) updatePayload.className = data.className;

    const updated = await this.prisma.user.update({
      where: { id },
      data: updatePayload,
    });

    return this.mapToDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async countStudentsByParentId(parentId: number): Promise<number> {
    return await this.prisma.student.count({
      where: { parentId },
    });
  }
}
