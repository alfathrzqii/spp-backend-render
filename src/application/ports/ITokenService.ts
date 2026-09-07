import type { Role } from "../../domain/enums/Role.js";

export interface TokenPayload {
  id: number;
  email: string;
  role: Role;
  schoolUnitId: number | null;
}

export interface ITokenService {
  generateToken(payload: TokenPayload): string;
  verifyToken(token: string): TokenPayload;
}
