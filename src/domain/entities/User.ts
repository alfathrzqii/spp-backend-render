import type { Role } from "@prisma/client";

export class User {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string,
    public readonly phoneNumber: string | null,
    public readonly password: string,
    public readonly role: Role,
    public readonly schoolUnitId: number | null
  ) {}
}
