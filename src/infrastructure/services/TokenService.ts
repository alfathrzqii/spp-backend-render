import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

export interface TokenPayload {
  id: number;
  email: string;
  role: Role;
  schoolUnitId: number | null;
}

export class TokenService {
  private readonly secret: string;

  constructor() {
    this.secret = process.env["JWT_SECRET"] || "default_secret";
  }

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: "1d" });
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }
}
