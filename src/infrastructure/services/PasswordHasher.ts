import bcrypt from "bcrypt";
import type { IPasswordHasher } from "../../application/ports/IPasswordHasher.js";

export class PasswordHasher implements IPasswordHasher {
  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
