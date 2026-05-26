export class SppTariff {
  constructor(
    public readonly id: number,
    public readonly schoolUnitId: number,
    public readonly enrollmentYear: number,
    public readonly amount: number
  ) {}
}
