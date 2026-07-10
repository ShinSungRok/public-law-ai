import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface SecurityReliabilityValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: SecurityReliabilityValidationStep[] = [
  {
    name: "SecurityReliabilityFoundation",
    scriptPath: "app/legal/reliability/runSecurityReliabilityFoundationValidation.ts",
  },
  {
    name: "SecurityReliabilityIntegration",
    scriptPath: "app/legal/reliability/runSecurityReliabilityIntegrationValidation.ts",
  },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "validate:security-reliability:foundation",
  "validate:security-reliability:integration",
  "validate:security-reliability",
];

const REQUIRED_SOURCE_FILES = [
  // Reliability: retry
  "app/legal/reliability/RetryOptions.ts",
  "app/legal/reliability/RetryPolicy.ts",
  "app/legal/reliability/DefaultRetryPolicy.ts",
  // Reliability: timeout
  "app/legal/reliability/TimeoutPolicy.ts",
  "app/legal/reliability/DefaultTimeoutPolicy.ts",
  "app/legal/reliability/TimeoutError.ts",
  // Reliability: circuit breaker
  "app/legal/reliability/CircuitBreaker.ts",
  "app/legal/reliability/CircuitBreakerState.ts",
  "app/legal/reliability/InMemoryCircuitBreaker.ts",
  // Reliability: error classification
  "app/legal/reliability/ErrorCategory.ts",
  "app/legal/reliability/ClassifiedError.ts",
  "app/legal/reliability/ErrorClassifier.ts",
  "app/legal/reliability/DefaultErrorClassifier.ts",
  // Security: rate limiting
  "app/legal/security/RateLimitResult.ts",
  "app/legal/security/RateLimiter.ts",
  "app/legal/security/InMemoryRateLimiter.ts",
  // Security: input protection
  "app/legal/security/InputValidationResult.ts",
  "app/legal/security/InputValidator.ts",
  "app/legal/security/DefaultInputValidator.ts",
  // Composition
  "app/legal/reliability/SecurityReliabilityService.ts",
  "app/legal/reliability/DefaultSecurityReliabilityServiceFactory.ts",
];

const SELF_FILES = [
  "app/legal/reliability/runSecurityReliabilityMilestoneValidation.ts",
  "docs/security-reliability.md",
];

const FORBIDDEN_EXTERNAL_SERVICE_REFERENCES = [
  "PostgreSQL",
  "OpenSearch",
  "Docker",
  "OpenAI",
  "Anthropic",
  "Redis",
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
  console.log("[reliability] Checking Phase 21 source files exist...");
  for (const relativePath of REQUIRED_SOURCE_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[reliability] Checking milestone runner and documentation exist...");
  for (const relativePath of SELF_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[reliability] Checking package.json security-reliability validation scripts...");
  assertPackageJsonScripts();

  console.log("[reliability] Checking no prohibited external dependencies are introduced...");
  assertNoExternalServicesRequired();

  for (const step of VALIDATION_STEPS) {
    console.log(`[reliability] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[reliability] ${step.name} validation passed.`);
  }

  console.log(
    "Security & reliability milestone validation succeeded — Phase 21 security & reliability foundation and integration are complete.",
  );
}

main();
