import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface ObservabilityValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: ObservabilityValidationStep[] = [
  {
    name: "ObservabilityFoundation",
    scriptPath: "app/legal/observability/runObservabilityFoundationValidation.ts",
  },
  {
    name: "ObservabilityIntegration",
    scriptPath: "app/legal/observability/runObservabilityIntegrationValidation.ts",
  },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "validate:observability:foundation",
  "validate:observability:integration",
  "validate:observability",
];

const REQUIRED_SOURCE_FILES = [
  // Logging
  "app/legal/observability/LogLevel.ts",
  "app/legal/observability/LogEntry.ts",
  "app/legal/observability/Logger.ts",
  "app/legal/observability/ConsoleLogger.ts",
  "app/legal/observability/InMemoryLogger.ts",
  // Metrics
  "app/legal/observability/MetricType.ts",
  "app/legal/observability/MetricPoint.ts",
  "app/legal/observability/MetricsCollector.ts",
  "app/legal/observability/InMemoryMetricsCollector.ts",
  // Health
  "app/legal/observability/HealthStatus.ts",
  "app/legal/observability/DependencyHealth.ts",
  "app/legal/observability/HealthCheckResult.ts",
  "app/legal/observability/HealthCheckService.ts",
  "app/legal/observability/InMemoryHealthCheckService.ts",
  // Observability composition
  "app/legal/observability/ObservabilityService.ts",
];

const SELF_FILES = [
  "app/legal/observability/runObservabilityMilestoneValidation.ts",
  "docs/observability.md",
];

const FORBIDDEN_EXTERNAL_SERVICE_REFERENCES = [
  "PostgreSQL",
  "OpenSearch",
  "Docker",
  "OpenAI",
  "Anthropic",
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertPackageJsonScripts(): void {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  assertTruthy(
    existsSync(packageJsonPath),
    "package.json does not exist at project root",
  );

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};

  for (const scriptName of REQUIRED_PACKAGE_JSON_SCRIPTS) {
    assertTruthy(
      typeof scripts[scriptName] === "string",
      `package.json missing required script: ${scriptName}`,
    );
  }
}

function assertNoExternalServicesRequired(): void {
  for (const relativePath of REQUIRED_SOURCE_FILES) {
    const contents = readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
    for (const service of FORBIDDEN_EXTERNAL_SERVICE_REFERENCES) {
      assertTruthy(
        !new RegExp(service, "i").test(contents),
        `${relativePath} unexpectedly references external service: ${service}`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log("[observability] Checking Phase 20 source files exist...");
  for (const relativePath of REQUIRED_SOURCE_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[observability] Checking milestone runner and documentation exist...");
  for (const relativePath of SELF_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[observability] Checking package.json observability validation scripts...");
  assertPackageJsonScripts();

  console.log("[observability] Checking no external services are required...");
  assertNoExternalServicesRequired();

  for (const step of VALIDATION_STEPS) {
    console.log(`[observability] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[observability] ${step.name} validation passed.`);
  }

  console.log(
    "Observability milestone validation succeeded — Phase 20 observability foundation, health checks, and integration are complete.",
  );
}

main();
