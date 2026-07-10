import type { HealthCheckResult } from "./HealthCheckResult";
import type { HealthStatus } from "./HealthStatus";

export interface DependencyHealthCheckOutcome {
  status: HealthStatus;
  message?: string;
}

export type DependencyHealthCheck = () =>
  | DependencyHealthCheckOutcome
  | Promise<DependencyHealthCheckOutcome>;

export interface HealthCheckService {
  registerDependency(name: string, check: DependencyHealthCheck): void;
  runHealthCheck(): Promise<HealthCheckResult>;
}
