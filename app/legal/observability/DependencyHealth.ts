import type { HealthStatus } from "./HealthStatus";

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  checkedAt: string;
}
