import type { User } from "../entities/User.js";
import type { Role } from "../enums/Role.js";

export interface CreateUserData {
  name: string;
  email?: string | null | undefined;
  phoneNumber: string;
  passwordHash: string;
  role: Role;
  schoolUnitId?: number | null | undefined;
  className?: string | null | undefined;
}

export interface UpdateUserData {
  name?: string | undefined;
  email?: string | null | undefined;
  phoneNumber?: string | undefined;
  passwordHash?: string | undefined;
  role?: Role | undefined;
  schoolUnitId?: number | null | undefined;
  className?: string | null | undefined;
}

export interface UserWithSchoolUnit extends User {
  schoolUnit?: { name: string } | null;
}

export interface IUserRepository {
  create(data: CreateUserData): Promise<User>;
  findAll(filter?: { role?: Role }): Promise<UserWithSchoolUnit[]>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhoneNumber(phoneNumber: string): Promise<User | null>;
  update(id: number, data: UpdateUserData): Promise<User>;
  delete(id: number): Promise<void>;
  countStudentsByParentId(parentId: number): Promise<number>;
}
