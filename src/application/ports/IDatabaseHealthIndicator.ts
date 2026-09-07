export interface IDatabaseHealthIndicator {
  isHealthy(): Promise<boolean>;
}
