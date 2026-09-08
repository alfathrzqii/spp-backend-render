import type { Role } from "../enums/Role.js";

export class User {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string,
    public readonly phoneNumber: string | null,
    public readonly password?: string | undefined,
    public readonly role: Role = "PARENT" as Role,
    public readonly schoolUnitId: number | null = null,
    public readonly className: string | null = null
  ) {}

  toJSON() {
    const { password, ...safeUser } = this;
    return safeUser;
  }
}
