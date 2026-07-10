import type { HealthCheckService } from "./HealthCheckService";
import type { Logger } from "./Logger";
import type { MetricsCollector } from "./MetricsCollector";

export interface ObservabilityService {
  logger: Logger;
  metricsCollector: MetricsCollector;
  healthCheckService: HealthCheckService;
}
