import { DefaultErrorClassifier } from "./DefaultErrorClassifier";
import { DefaultRetryPolicy } from "./DefaultRetryPolicy";
import { DefaultTimeoutPolicy } from "./DefaultTimeoutPolicy";
import { InMemoryCircuitBreaker } from "./InMemoryCircuitBreaker";
import { TimeoutError } from "./TimeoutError";
import { DefaultInputValidator } from "../security/DefaultInputValidator";
import { InMemoryRateLimiter } from "../security/InMemoryRateLimiter";

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

const INSTANT_DELAY = (): Promise<void> => Promise.resolve();

async function assertRejects(operation: () => Promise<unknown>, message: string): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error(message);
}

async function validateRetryPolicy(): Promise<void> {
  console.log("[reliability] Checking successful retry operation returns immediately...");
  const retryPolicy = new DefaultRetryPolicy(INSTANT_DELAY);
  let successCallCount = 0;
  const successResult = await retryPolicy.execute(
    async () => {
      successCallCount += 1;
      return "ok";
    },
    { maxAttempts: 3, delayMs: 0 },
  );
  assertEqual(successResult, "ok", "successful operation should return its result");
  assertEqual(successCallCount, 1, "successful operation should only be called once");

  console.log("[reliability] Checking retryable failure is retried until success...");
  let retryableCallCount = 0;
  const retriedResult = await retryPolicy.execute(
    async () => {
      retryableCallCount += 1;
      if (retryableCallCount < 3) {
        throw new Error("transient failure");
      }
      return "recovered";
    },
    { maxAttempts: 5, delayMs: 0, isRetryable: () => true },
  );
  assertEqual(retriedResult, "recovered", "operation should eventually succeed");
  assertEqual(retryableCallCount, 3, "operation should be called until it succeeds");

  console.log("[reliability] Checking non-retryable failure is not retried...");
  let nonRetryableCallCount = 0;
  const nonRetryableError = await assertRejects(
    () =>
      retryPolicy.execute(
        async () => {
          nonRetryableCallCount += 1;
          throw new Error("non-retryable failure");
        },
        { maxAttempts: 5, delayMs: 0, isRetryable: () => false },
      ),
    "non-retryable failure should propagate",
  );
  assertEqual(nonRetryableCallCount, 1, "non-retryable failure should not be retried");
  assertEqual(
    (nonRetryableError as Error).message,
    "non-retryable failure",
    "non-retryable error message mismatch",
  );

  console.log("[reliability] Checking exhausted retries propagate the final error...");
  let exhaustedCallCount = 0;
  const exhaustedError = await assertRejects(
    () =>
      retryPolicy.execute(
        async () => {
          exhaustedCallCount += 1;
          throw new Error(`failure attempt ${exhaustedCallCount}`);
        },
        { maxAttempts: 3, delayMs: 0, isRetryable: () => true },
      ),
    "exhausted retries should propagate the final error",
  );
  assertEqual(exhaustedCallCount, 3, "operation should be attempted exactly maxAttempts times");
  assertEqual(
    (exhaustedError as Error).message,
    "failure attempt 3",
    "exhausted retries should propagate the last attempt's error",
  );
}

async function validateTimeoutPolicy(): Promise<void> {
  console.log("[reliability] Checking successful operation completes within the timeout...");
  const timeoutPolicy = new DefaultTimeoutPolicy();
  const result = await timeoutPolicy.execute(async () => "fast result", 50);
  assertEqual(result, "fast result", "fast operation should resolve with its result");

  console.log("[reliability] Checking slow operation produces TimeoutError...");
  const timeoutError = await assertRejects(
    () =>
      timeoutPolicy.execute(
        () => new Promise((resolve) => setTimeout(() => resolve("too slow"), 50)),
        5,
      ),
    "slow operation should reject with TimeoutError",
  );
  assertTruthy(timeoutError instanceof TimeoutError, "expected a TimeoutError instance");
}

async function validateCircuitBreaker(): Promise<void> {
  console.log("[reliability] Checking circuit breaker starts closed...");
  let now = 0;
  const clock = (): number => now;
  const circuitBreaker = new InMemoryCircuitBreaker(
    { failureThreshold: 2, resetTimeoutMs: 100 },
    clock,
  );
  assertEqual(circuitBreaker.getState(), "closed", "circuit breaker should start closed");

  console.log("[reliability] Checking circuit breaker opens after configured failures...");
  await assertRejects(
    () =>
      circuitBreaker.execute(async () => {
        throw new Error("dependency failure 1");
      }),
    "first failure should propagate",
  );
  assertEqual(circuitBreaker.getState(), "closed", "one failure should not open the circuit");

  await assertRejects(
    () =>
      circuitBreaker.execute(async () => {
        throw new Error("dependency failure 2");
      }),
    "second failure should propagate",
  );
  assertEqual(circuitBreaker.getState(), "open", "circuit should open after the failure threshold");

  console.log("[reliability] Checking circuit breaker rejects while open...");
  let rejectedCallCount = 0;
  const rejectedError = await assertRejects(
    () =>
      circuitBreaker.execute(async () => {
        rejectedCallCount += 1;
        return "should not run";
      }),
    "open circuit should reject without calling the operation",
  );
  assertEqual(rejectedCallCount, 0, "open circuit must not call the wrapped operation");
  assertTruthy((rejectedError as Error).message.includes("open"), "rejection should mention the open circuit");

  console.log("[reliability] Checking circuit breaker transitions through half-open...");
  now += 100;
  assertEqual(circuitBreaker.getState(), "half-open", "circuit should be half-open after the reset timeout");

  console.log("[reliability] Checking successful recovery closes the circuit...");
  const recoveredResult = await circuitBreaker.execute(async () => "recovered");
  assertEqual(recoveredResult, "recovered", "half-open circuit should allow a trial call");
  assertEqual(circuitBreaker.getState(), "closed", "successful trial call should close the circuit");
}

function validateRateLimiter(): void {
  console.log("[reliability] Checking requests within the limit are allowed...");
  const now = 0;
  const clock = (): number => now;
  const rateLimiter = new InMemoryRateLimiter({ maxRequests: 2, windowMs: 1000 }, clock);

  const first = rateLimiter.consume("client-a");
  assertEqual(first.allowed, true, "first request within limit should be allowed");
  assertEqual(first.remaining, 1, "remaining count should decrease after first request");

  const second = rateLimiter.consume("client-a");
  assertEqual(second.allowed, true, "second request within limit should be allowed");
  assertEqual(second.remaining, 0, "remaining count should be zero after limit is reached");

  console.log("[reliability] Checking requests above the limit are rejected...");
  const third = rateLimiter.consume("client-a");
  assertEqual(third.allowed, false, "request above limit should be rejected");
  assertEqual(third.remaining, 0, "rejected request should report zero remaining");

  console.log("[reliability] Checking independent keys are isolated...");
  const otherClient = rateLimiter.consume("client-b");
  assertEqual(otherClient.allowed, true, "a different key should not be affected by client-a's usage");
  assertEqual(otherClient.remaining, 1, "a different key should have its own independent remaining count");
}

function validateInputValidator(): void {
  console.log("[reliability] Checking valid input succeeds...");
  const validator = new DefaultInputValidator({ maxLength: 10 });
  const validResult = validator.validate("short");
  assertEqual(validResult.valid, true, "short input within limits should be valid");
  assertEqual(validResult.errors.length, 0, "valid input should report no errors");

  console.log("[reliability] Checking empty input fails...");
  const emptyResult = validator.validate("");
  assertEqual(emptyResult.valid, false, "empty input should be invalid");
  assertTruthy(emptyResult.errors.length > 0, "empty input should report at least one error");

  console.log("[reliability] Checking oversized input fails...");
  const oversizedResult = validator.validate("this input is definitely too long");
  assertEqual(oversizedResult.valid, false, "oversized input should be invalid");

  console.log("[reliability] Checking null-byte input fails...");
  const nullByteResult = validator.validate("bad\0input");
  assertEqual(nullByteResult.valid, false, "input containing a null byte should be invalid");
}

function validateErrorClassifier(): void {
  console.log("[reliability] Checking error classifier categorizes known error types...");
  const classifier = new DefaultErrorClassifier();

  const timeoutClassification = classifier.classify(new TimeoutError("timed out"));
  assertEqual(timeoutClassification.category, "timeout", "TimeoutError should classify as timeout");

  class RateLimitExceededError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RateLimitExceededError";
    }
  }
  const rateLimitClassification = classifier.classify(new RateLimitExceededError("too many requests"));
  assertEqual(rateLimitClassification.category, "rate-limit", "RateLimitExceededError should classify as rate-limit");

  class InputValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "InputValidationError";
    }
  }
  const validationClassification = classifier.classify(new InputValidationError("bad input"));
  assertEqual(validationClassification.category, "validation", "InputValidationError should classify as validation");

  class DependencyError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DependencyError";
    }
  }
  const dependencyClassification = classifier.classify(new DependencyError("downstream failure"));
  assertEqual(dependencyClassification.category, "dependency", "DependencyError should classify as dependency");

  const internalClassification = classifier.classify(new Error("unexpected failure"));
  assertEqual(internalClassification.category, "internal", "unrecognized errors should classify as internal");
}

async function main(): Promise<void> {
  console.log(
    "[reliability] No external services required: PostgreSQL, OpenSearch, Docker, OpenAI, Anthropic, and Redis are not used.",
  );

  await validateRetryPolicy();
  await validateTimeoutPolicy();
  await validateCircuitBreaker();
  validateRateLimiter();
  validateInputValidator();
  validateErrorClassifier();

  console.log("Security & reliability foundation validation succeeded.");
}

main();
