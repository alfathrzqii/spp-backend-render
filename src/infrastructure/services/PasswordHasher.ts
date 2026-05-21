import bcrypt from "bcrypt";

export class PasswordHasher {
  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
