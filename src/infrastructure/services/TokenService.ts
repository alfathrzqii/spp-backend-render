import jwt from "jsonwebtoken";
import type { ITokenService, TokenPayload } from "../../application/ports/ITokenService.js";

export type { TokenPayload };

export class TokenService implements ITokenService {
  private readonly secret: string;

  constructor() {
    this.secret = process.env["JWT_SECRET"] || "default_secret";
  }

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: "15m" });
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }
}
