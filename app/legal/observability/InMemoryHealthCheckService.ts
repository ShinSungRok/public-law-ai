import type { DependencyHealth } from "./DependencyHealth";
import type { HealthCheckResult } from "./HealthCheckResult";
import type {
  DependencyHealthCheck,
  HealthCheckService,
} from "./HealthCheckService";
import type { HealthStatus } from "./HealthStatus";

const STATUS_SEVERITY: Record<HealthStatus, number> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
};

function aggregateStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.length === 0) {
    return "healthy";
  }

  return statuses.reduce((worst, current) =>
    STATUS_SEVERITY[current] > STATUS_SEVERITY[worst] ? current : worst,
  );
}

export class InMemoryHealthCheckService implements HealthCheckService {
  private readonly checks = new Map<string, DependencyHealthCheck>();

  registerDependency(name: string, check: DependencyHealthCheck): void {
    this.checks.set(name, check);
  }

  async runHealthCheck(): Promise<HealthCheckResult> {
    const dependencies: DependencyHealth[] = [];

    for (const [name, check] of this.checks) {
      const outcome = await check();
      dependencies.push({
        name,
        status: outcome.status,
        message: outcome.message,
        checkedAt: new Date().toISOString(),
      });
    }

    return {
      overallStatus: aggregateStatus(
        dependencies.map((dependency) => dependency.status),
      ),
      dependencies,
      checkedAt: new Date().toISOString(),
    };
  }
}
