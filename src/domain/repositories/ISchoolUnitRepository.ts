import type { SchoolUnit } from "../entities/SchoolUnit.js";

export interface ISchoolUnitRepository {
  findById(id: number): Promise<SchoolUnit | null>;
  findAll(): Promise<SchoolUnit[]>;
  ensureExists(id: number, defaultName: string): Promise<SchoolUnit>;
}
