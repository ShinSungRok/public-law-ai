import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DefaultErrorClassifier } from "./DefaultErrorClassifier";
import { DefaultRetryPolicy } from "./DefaultRetryPolicy";
import { DefaultSecurityReliabilityServiceFactory } from "./DefaultSecurityReliabilityServiceFactory";
import { DefaultTimeoutPolicy } from "./DefaultTimeoutPolicy";
import { InMemoryCircuitBreaker } from "./InMemoryCircuitBreaker";
import { TimeoutError } from "./TimeoutError";
import { DefaultInputValidator } from "../security/DefaultInputValidator";
import { InMemoryRateLimiter } from "../security/InMemoryRateLimiter";

const PRODUCTION_RUNTIME_FILES_TO_CHECK = [
  "app/legal/composition/ApplicationContext.ts",
  "app/legal/composition/DefaultApplicationContextFactory.ts",
  "app/legal/http/FastifyHttpAdapter.ts",
];

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

async function validateFactoryCreatesAllComponents(): Promise<void> {
  console.log("[reliability] Checking factory creates all required components...");
  const factory = new DefaultSecurityReliabilityServiceFactory();
  const service = factory.create();

  assertTruthy(service.retryPolicy, "service missing retryPolicy");
  assertTruthy(service.timeoutPolicy, "service missing timeoutPolicy");
  assertTruthy(service.circuitBreaker, "service missing circuitBreaker");
  assertTruthy(service.rateLimiter, "service missing rateLimiter");
  assertTruthy(service.inputValidator, "service missing inputValidator");
  assertTruthy(service.errorClassifier, "service missing errorClassifier");

  console.log("[reliability] Checking retry policy is available and usable...");
  const retryResult = await service.retryPolicy.execute(async () => "ok", {
    maxAttempts: 1,
    delayMs: 0,
  });
  assertEqual(retryResult, "ok", "retryPolicy from service should be usable");

  console.log("[reliability] Checking timeout policy is available and usable...");
  const timeoutResult = await service.timeoutPolicy.execute(async () => "ok", 50);
  assertEqual(timeoutResult, "ok", "timeoutPolicy from service should be usable");

  console.log("[reliability] Checking circuit breaker is available and usable...");
  assertEqual(
    service.circuitBreaker.getState(),
    "closed",
    "circuitBreaker from service should start closed",
  );

  console.log("[reliability] Checking rate limiter is available and usable...");
  const rateLimitResult = service.rateLimiter.consume("integration-check");
  assertEqual(rateLimitResult.allowed, true, "rateLimiter from service should allow the first request");

  console.log("[reliability] Checking input validator is available and usable...");
  const inputResult = service.inputValidator.validate("legal question");
  assertEqual(inputResult.valid, true, "inputValidator from service should validate normal input");

  console.log("[reliability] Checking error classifier is available and usable...");
  const classified = service.errorClassifier.classify(new TimeoutError("timed out"));
  assertEqual(classified.category, "timeout", "errorClassifier from service should classify TimeoutError");
}

function validateComponentsRemainIndependentlyUsable(): void {
  console.log("[reliability] Checking components remain independently usable outside the service...");

  const standaloneRetryPolicy = new DefaultRetryPolicy(() => Promise.resolve());
  assertTruthy(standaloneRetryPolicy, "DefaultRetryPolicy should be independently constructible");

  const standaloneTimeoutPolicy = new DefaultTimeoutPolicy();
  assertTruthy(standaloneTimeoutPolicy, "DefaultTimeoutPolicy should be independently constructible");

  const standaloneCircuitBreaker = new InMemoryCircuitBreaker({
    failureThreshold: 1,
    resetTimeoutMs: 10,
  });
  assertEqual(
    standaloneCircuitBreaker.getState(),
    "closed",
    "standalone circuit breaker should start closed",
  );

  const standaloneRateLimiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 1000 });
  assertEqual(
    standaloneRateLimiter.consume("solo").allowed,
    true,
    "standalone rate limiter should allow its first request",
  );

  const standaloneInputValidator = new DefaultInputValidator();
  assertEqual(
    standaloneInputValidator.validate("ok").valid,
    true,
    "standalone input validator should validate normal input",
  );

  const standaloneErrorClassifier = new DefaultErrorClassifier();
  assertEqual(
    standaloneErrorClassifier.classify(new Error("boom")).category,
    "internal",
    "standalone error classifier should classify unrecognized errors as internal",
  );
}

function validateNotWiredIntoProductionRuntime(): void {
  console.log(
    "[reliability] Checking production runtime files do not import reliability/security modules yet...",
  );

  for (const relativePath of PRODUCTION_RUNTIME_FILES_TO_CHECK) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (!existsSync(fullPath)) {
      continue;
    }

    const contents = readFileSync(fullPath, "utf8");
    assertTruthy(
      !/from ["']\.\.\/reliability/.test(contents),
      `${relativePath} unexpectedly imports from the reliability module`,
    );
    assertTruthy(
      !/from ["']\.\.\/security/.test(contents),
      `${relativePath} unexpectedly imports from the security module`,
    );
  }
}

async function main(): Promise<void> {
  console.log(
    "[reliability] No external services required: PostgreSQL, OpenSearch, Docker, OpenAI, Anthropic, and Redis are not used.",
  );

  await validateFactoryCreatesAllComponents();
  validateComponentsRemainIndependentlyUsable();
  validateNotWiredIntoProductionRuntime();

  console.log("Security & reliability integration validation succeeded.");
}

main();
