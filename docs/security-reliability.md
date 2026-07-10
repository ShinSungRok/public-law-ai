# Security & Reliability Foundation

## 1. Purpose of Phase 21

Phase 21 introduces reusable Security & Reliability primitives for the AI
Legal Platform: retry, timeout, and circuit-breaker policies for resilient
operation execution, plus rate limiting and input protection abstractions
for guarding request handling.

Task 1 establishes only the **foundation** — the shared types and
deterministic in-memory implementations every future security/reliability
task will build on. It intentionally does not wire any of this into
production runtime, does not add authentication or authorization, and does
not add exponential backoff, jitter, distributed state, content moderation,
or prompt-injection detection yet.

## 2. Retry policy

`app/legal/reliability` defines:

- `RetryOptions` (`RetryOptions.ts`) — `maxAttempts`, `delayMs`, optional
  `isRetryable(error)` predicate.
- `RetryPolicy` (`RetryPolicy.ts`) — the interface every retry policy
  implements: `execute(operation, options)`.
- `DefaultRetryPolicy` (`DefaultRetryPolicy.ts`) — retries `operation` up to
  `maxAttempts` times, delaying between attempts via an injectable
  `RetryDelay` function (defaults to a real `setTimeout`-based delay; tests
  inject an instant delay to avoid real waiting). Retries only continue when
  `isRetryable` allows it (defaults to always retryable); the final error is
  always propagated once attempts are exhausted or a failure is deemed
  non-retryable. No exponential backoff or jitter.

## 3. Timeout policy

- `TimeoutError` (`TimeoutError.ts`) — thrown when an operation exceeds its
  configured timeout.
- `TimeoutPolicy` (`TimeoutPolicy.ts`) — the interface every timeout policy
  implements: `execute(operation, timeoutMs)`.
- `DefaultTimeoutPolicy` (`DefaultTimeoutPolicy.ts`) — races `operation()`
  against a timer; resolves with the operation's result if it completes
  first, otherwise rejects with `TimeoutError`.

## 4. Circuit breaker

- `CircuitBreakerState` (`CircuitBreakerState.ts`) — `"closed" | "open" |
  "half-open"`.
- `CircuitBreaker` (`CircuitBreaker.ts`) — the interface every circuit
  breaker implements: `getState()`, `execute(operation)`.
- `InMemoryCircuitBreaker` (`InMemoryCircuitBreaker.ts`) — tracks
  `failureThreshold` and `resetTimeoutMs` in-memory. Opens once consecutive
  failures reach the threshold; rejects immediately (without calling the
  wrapped operation) while open; transitions to half-open once
  `resetTimeoutMs` has elapsed (checked via an injectable clock function for
  deterministic validation); a successful half-open trial call closes the
  circuit, a failed one reopens it. An explicit `reset()` method is also
  available for deterministic test control. No distributed state — state is
  local to the instance.

## 5. Rate limiting

`app/legal/security` defines:

- `RateLimitResult` (`RateLimitResult.ts`) — `allowed`, `remaining`.
- `RateLimiter` (`RateLimiter.ts`) — the interface every rate limiter
  implements: `consume(key)`.
- `InMemoryRateLimiter` (`InMemoryRateLimiter.ts`) — fixed-window counter
  per key, configured with `maxRequests`/`windowMs`. Each key tracks its own
  window independently; an injectable clock function keeps window rollover
  deterministic in validation.

## 6. Input validation

- `InputValidationResult` (`InputValidationResult.ts`) — `valid`, `errors`.
- `InputValidator` (`InputValidator.ts`) — the interface every input
  validator implements: `validate(input)`.
- `DefaultInputValidator` (`DefaultInputValidator.ts`) — deterministic
  checks only: rejects empty input, input longer than a configured
  `maxLength`, and input containing a null-byte character. No content
  moderation, no prompt-injection detection.

## 7. Error classification

- `ErrorCategory` (`ErrorCategory.ts`) — `"validation" | "timeout" |
  "rate-limit" | "dependency" | "internal"`.
- `ClassifiedError` (`ClassifiedError.ts`) — `category`, `message`, `cause`.
- `ErrorClassifier` (`ErrorClassifier.ts`) — the interface every classifier
  implements: `classify(error)`.
- `DefaultErrorClassifier` (`DefaultErrorClassifier.ts`) — maps a known set
  of `Error.name` values (`TimeoutError`, `RateLimitExceededError`,
  `InputValidationError`, `DependencyError`) to their category, defaulting
  to `"internal"` for anything unrecognized. Deterministic and
  framework-independent — no coupling to `reliability`/`security` classes
  beyond `TimeoutError`'s name, and it does not replace or modify any
  existing application error (`AiProviderError`, `InvalidRagRequestError`,
  etc.).

## 8. Current limitations

- Not wired into production runtime — no controller, use case, retriever,
  search engine, AI provider, or server runtime file constructs or calls a
  `RetryPolicy`/`TimeoutPolicy`/`CircuitBreaker`/`RateLimiter`/
  `InputValidator`/`ErrorClassifier` yet.
- No authentication or authorization of any kind.
- No exponential backoff or jitter on retry.
- No content moderation or prompt-injection detection.
- No distributed rate-limit or circuit-breaker state — everything is local,
  in-memory, and process-scoped.
- No external resilience or security library is used.
- `runSecurityReliabilityFoundationValidation.ts`
  (`pnpm validate:security-reliability:foundation`) only exercises these
  classes in-memory with deterministic (injected or fake) clocks/delays — no
  PostgreSQL, OpenSearch, Docker, OpenAI, Anthropic, or Redis is required.

## 9. Task 2 milestone and integration scope

- **Runtime wiring** — apply `RetryPolicy`/`TimeoutPolicy`/`CircuitBreaker`
  to AI provider and search calls, apply `RateLimiter`/`InputValidator` to
  HTTP request handling, and route caught errors through
  `ErrorClassifier` — without changing existing RAG/search/AI provider
  business logic.
- **Milestone Validation** — a milestone runner (mirroring
  `runObservabilityMilestoneValidation.ts`) that verifies all Phase 21
  source files, scripts, and docs exist and sequences the foundation (and
  any future integration) validators.
- Authentication, authorization, exponential backoff/jitter, distributed
  state, content moderation, and prompt-injection detection remain
  explicitly out of scope until a dedicated future task introduces them.

## 10. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm validate:security-reliability:foundation` | `tsx app/legal/reliability/runSecurityReliabilityFoundationValidation.ts` | Validates `DefaultRetryPolicy`, `DefaultTimeoutPolicy`, `InMemoryCircuitBreaker`, `InMemoryRateLimiter`, `DefaultInputValidator`, and `DefaultErrorClassifier` — in-memory and deterministic only, no external services. |
