import type { Role } from "@prisma/client";

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
