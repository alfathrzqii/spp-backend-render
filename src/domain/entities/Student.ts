export class Student {
  constructor(
    public readonly id: number,
    public readonly studentNumber: string,
    public readonly name: string,
    public readonly className: string,
    public readonly schoolUnitId: number,
    public readonly parentId: number,
    public readonly enrollmentYear: number,
    public readonly discountPercentage: number
  ) {}
}
