import { InMemoryHealthCheckService } from "./InMemoryHealthCheckService";
import { InMemoryLogger } from "./InMemoryLogger";
import { InMemoryMetricsCollector } from "./InMemoryMetricsCollector";
import type { HealthCheckResult } from "./HealthCheckResult";
import type { ObservabilityService } from "./ObservabilityService";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

async function validateHealthCheckRegistrationAndDependencies(): Promise<HealthCheckResult> {
  console.log("[observability] Checking health check dependency registration...");
  const healthCheckService = new InMemoryHealthCheckService();

  healthCheckService.registerDependency("fake-database", () => ({
    status: "healthy",
    message: "connection pool responsive",
  }));
  healthCheckService.registerDependency("fake-search-index", () => ({
    status: "degraded",
    message: "elevated latency",
  }));
  healthCheckService.registerDependency("fake-ai-provider", () => ({
    status: "unhealthy",
    message: "circuit open",
  }));

  const result = await healthCheckService.runHealthCheck();

  console.log("[observability] Checking each dependency reports name, status, message, checkedAt...");
  assertEqual(result.dependencies.length, 3, "expected exactly three registered dependencies");
  for (const dependency of result.dependencies) {
    assertTruthy(dependency.name.length > 0, "dependency missing name");
    assertTruthy(
      ["healthy", "degraded", "unhealthy"].includes(dependency.status),
      "dependency status is not a valid HealthStatus",
    );
    assertTruthy(isIsoTimestamp(dependency.checkedAt), "dependency checkedAt is not a valid date");
  }

  const database = result.dependencies.find((dependency) => dependency.name === "fake-database");
  assertEqual(database?.status, "healthy", "fake-database should report healthy");
  assertEqual(database?.message, "connection pool responsive", "fake-database message mismatch");

  const searchIndex = result.dependencies.find(
    (dependency) => dependency.name === "fake-search-index",
  );
  assertEqual(searchIndex?.status, "degraded", "fake-search-index should report degraded");

  const aiProvider = result.dependencies.find(
    (dependency) => dependency.name === "fake-ai-provider",
  );
  assertEqual(aiProvider?.status, "unhealthy", "fake-ai-provider should report unhealthy");

  console.log("[observability] Checking aggregate overall status reflects the worst dependency...");
  assertEqual(result.overallStatus, "unhealthy", "overall status should escalate to unhealthy");
  assertTruthy(isIsoTimestamp(result.checkedAt), "result checkedAt is not a valid date");

  return result;
}

async function validateAggregateHealthyWhenAllHealthy(): Promise<void> {
  console.log("[observability] Checking aggregate status is healthy when all dependencies are healthy...");
  const healthCheckService = new InMemoryHealthCheckService();
  healthCheckService.registerDependency("fake-cache", () => ({ status: "healthy" }));
  healthCheckService.registerDependency("fake-queue", () => ({ status: "healthy" }));

  const result = await healthCheckService.runHealthCheck();
  assertEqual(result.overallStatus, "healthy", "overall status should be healthy");
  assertEqual(result.dependencies.length, 2, "expected exactly two registered dependencies");
}

async function validateAggregateDegradedWithoutUnhealthy(): Promise<void> {
  console.log(
    "[observability] Checking aggregate status is degraded when no dependency is unhealthy...",
  );
  const healthCheckService = new InMemoryHealthCheckService();
  healthCheckService.registerDependency("fake-cache", () => ({ status: "healthy" }));
  healthCheckService.registerDependency("fake-queue", () => ({ status: "degraded" }));

  const result = await healthCheckService.runHealthCheck();
  assertEqual(result.overallStatus, "degraded", "overall status should be degraded");
}

function validateObservabilityServiceComposition(): void {
  console.log(
    "[observability] Checking ObservabilityService exposes Logger, MetricsCollector, and HealthCheckService...",
  );
  const observabilityService: ObservabilityService = {
    logger: new InMemoryLogger("observability-integration"),
    metricsCollector: new InMemoryMetricsCollector(),
    healthCheckService: new InMemoryHealthCheckService(),
  };

  assertTruthy(observabilityService.logger, "ObservabilityService missing logger");
  assertTruthy(observabilityService.metricsCollector, "ObservabilityService missing metricsCollector");
  assertTruthy(observabilityService.healthCheckService, "ObservabilityService missing healthCheckService");

  observabilityService.logger.info("observability service composed");
  observabilityService.metricsCollector.incrementCounter("observability.integration.checks");

  const loggerEntries = (observabilityService.logger as InMemoryLogger).getEntries();
  assertEqual(loggerEntries.length, 1, "expected logger to record one entry");

  const metricPoints = (observabilityService.metricsCollector as InMemoryMetricsCollector).getMetrics();
  assertEqual(metricPoints.length, 1, "expected metrics collector to record one point");
}

async function main(): Promise<void> {
  console.log(
    "[observability] No external services required: PostgreSQL, OpenSearch, Docker, OpenAI, and Anthropic are not used.",
  );

  await validateHealthCheckRegistrationAndDependencies();
  await validateAggregateHealthyWhenAllHealthy();
  await validateAggregateDegradedWithoutUnhealthy();
  validateObservabilityServiceComposition();

  console.log("Observability integration validation succeeded.");
}

main();
