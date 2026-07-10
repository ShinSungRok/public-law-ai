import type { DependencyHealth } from "./DependencyHealth";
import type { HealthStatus } from "./HealthStatus";

export interface HealthCheckResult {
  overallStatus: HealthStatus;
  dependencies: DependencyHealth[];
  checkedAt: string;
}
