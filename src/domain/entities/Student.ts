export interface StudentExtracurricular {
  id: number;
  studentId: number;
  sdExtracurricularId: number;
  createdAt?: Date;
  sdExtracurricular?: {
    id: number;
    name: string;
    price: number;
  };
}

export class Student {
  constructor(
    public readonly id: number,
    public readonly studentNumber: string,
    public readonly name: string,
    public readonly className: string,
    public readonly schoolUnitId: number,
    public readonly parentId: number,
    public readonly enrollmentYear: number,
    public readonly discountAmount: number,
    public readonly discountEquipment: number = 0,
    public readonly discountExtracurricular: number = 0,
    public readonly registrationStatus: string = "BARU",
    public readonly isFullday: boolean = false,
    public readonly status: string = "ACTIVE",
    public readonly sdExtracurriculars?: StudentExtracurricular[]
  ) {}
}
