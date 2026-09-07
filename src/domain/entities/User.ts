import type { Role } from "../enums/Role.js";

export class User {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string,
    public readonly phoneNumber: string | null,
    public readonly password: string,
    public readonly role: Role,
    public readonly schoolUnitId: number | null,
    public readonly className: string | null = null
  ) {}
}
