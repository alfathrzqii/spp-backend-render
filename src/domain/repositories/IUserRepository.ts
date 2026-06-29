import { User } from "../entities/User.js";

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByPhoneNumber(phoneNumber: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
}
