import type { Role } from "../domain/enums/Role.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: Role;
        schoolUnitId: number | null;
      };
    }
  }
}

export {};
