# Observability Foundation

## 1. Purpose of Phase 20

Phase 20 introduces Observability for the AI Legal Platform: a consistent
way to emit structured logs and record quality/performance metrics across
the application, so later phases can add health checks and real monitoring
integrations on top of a stable foundation.

Task 1 establishes only the **logging and metrics foundation** — the shared
types and in-memory/console implementations every future observability task
will build on. It intentionally does not wire observability into production
runtime, implement health checks, or export to Prometheus yet.

## 2. Logging foundation

`app/legal/observability` defines:

- `LogLevel` (`app/legal/observability/LogLevel.ts`) — `"debug" | "info" |
  "warn" | "error"`. This is a separate, narrower type from
  `app/legal/config/LogLevel.ts` (`ApplicationConfiguration.logLevel`, which
  also has `"trace"`); the two are unrelated by design — the config value
  configures verbosity, this one labels individual log entries.
- `LogEntry` (`app/legal/observability/LogEntry.ts`) — a structured log
  record: `level`, `message`, `timestamp` (ISO string), optional `context`
  (e.g. a component/module name), optional `metadata`
  (`Record<string, unknown>`).
- `Logger` (`app/legal/observability/Logger.ts`) — the interface every
  logger implements: `debug`/`info`/`warn`/`error`, each taking a `message`
  and optional `metadata`.
- `ConsoleLogger` (`app/legal/observability/ConsoleLogger.ts`) — writes each
  `LogEntry` as JSON to the matching `console.debug`/`info`/`warn`/`error`
  method. No external logging library.
- `InMemoryLogger` (`app/legal/observability/InMemoryLogger.ts`) — appends
  each `LogEntry` to an in-memory array (`getEntries()`), for validation and
  future testing.

Both implementations take an optional `context` string in their constructor,
attached to every entry they produce.

## 3. Metrics foundation

- `MetricType` (`app/legal/observability/MetricType.ts`) — `"counter" |
  "gauge" | "timer"`.
- `MetricPoint` (`app/legal/observability/MetricPoint.ts`) — a recorded
  measurement: `name`, `type`, `value`, `timestamp` (ISO string), optional
  `tags` (`Record<string, string>`).
- `MetricsCollector` (`app/legal/observability/MetricsCollector.ts`) — the
  interface every collector implements: `incrementCounter(name, value?,
  tags?)`, `setGauge(name, value, tags?)`, `recordTimer(name, value, tags?)`.
- `InMemoryMetricsCollector` (`app/legal/observability/InMemoryMetricsCollector.ts`)
  — records every call as a `MetricPoint` in an in-memory array
  (`getMetrics()`). `incrementCounter` defaults `value` to `1` when omitted.

No external metrics library, no histogram type, no Prometheus (or any other)
export yet.

## 4. Health Check architecture

Task 2 adds a Health Check surface on top of the logging/metrics foundation,
still entirely in-memory:

- `HealthStatus` (`app/legal/observability/HealthStatus.ts`) — `"healthy" |
  "degraded" | "unhealthy"`.
- `DependencyHealth` (`app/legal/observability/DependencyHealth.ts`) — the
  health of a single dependency: `name`, `status`, optional `message`,
  `checkedAt` (ISO string).
- `HealthCheckResult` (`app/legal/observability/HealthCheckResult.ts`) — the
  aggregate result of a health check run: `overallStatus`, `dependencies`
  (`DependencyHealth[]`), `checkedAt`.
- `HealthCheckService` (`app/legal/observability/HealthCheckService.ts`) —
  the interface every health check service implements:
  `registerDependency(name, check)` and `runHealthCheck(): Promise<HealthCheckResult>`.
  `DependencyHealthCheck` is a function type
  (`() => DependencyHealthCheckOutcome | Promise<DependencyHealthCheckOutcome>`)
  supplied by the caller per dependency — it never performs a real network
  call; callers pass a fake/in-memory function that returns a `status` and
  optional `message`.
- `InMemoryHealthCheckService` (`app/legal/observability/InMemoryHealthCheckService.ts`)
  — stores registered checks in a `Map`, runs each check when
  `runHealthCheck()` is called, stamps a `checkedAt` per dependency, and
  computes `overallStatus` as the single worst status among all
  dependencies (severity order `healthy < degraded < unhealthy`; no
  registered dependencies means `healthy`).

### Aggregate health

`overallStatus` is not a separate signal — it is derived deterministically
from `dependencies`: the result is `unhealthy` if any dependency is
`unhealthy`, otherwise `degraded` if any dependency is `degraded`, otherwise
`healthy`. This keeps the aggregate rule simple and independent of
dependency registration order.

## 5. ObservabilityService

`ObservabilityService` (`app/legal/observability/ObservabilityService.ts`) is
a lightweight composition object — a plain interface, mirroring
`ApplicationContext` — exposing:

- `logger: Logger`
- `metricsCollector: MetricsCollector`
- `healthCheckService: HealthCheckService`

It only groups these three together for callers that need all of them; it
adds no behavior of its own and is not yet constructed or consumed anywhere
in `ApplicationContext`/`ProductionServerRuntime`.

## 6. Current limitations

- Not wired into production runtime — no controller, use case, retriever,
  search engine, AI provider, or server runtime file constructs or calls a
  `Logger`/`MetricsCollector`/`HealthCheckService`/`ObservabilityService` yet.
- Health checks never perform real network calls — every dependency check in
  the validation runner is a fake in-memory function.
- No Prometheus (or any other) metrics export.
- No histogram metric type.
- No correlation ID and no distributed tracing, no OpenTelemetry.
- No external logging or metrics library is used — only `console` and
  in-memory arrays/maps.
- `runObservabilityFoundationValidation.ts`
  (`pnpm validate:observability:foundation`) and
  `runObservabilityIntegrationValidation.ts`
  (`pnpm validate:observability:integration`) only exercise these classes
  in-memory — no PostgreSQL, OpenSearch, Docker, OpenAI, or Anthropic is
  required.

## 7. Future work

- **Runtime wiring** — construct an `ObservabilityService` from
  `ApplicationContext`/`ProductionServerRuntime` and have the real
  `HealthController` delegate to `HealthCheckService` for dependency status.
- Prometheus export, OpenTelemetry, and distributed tracing remain explicitly
  out of scope until a dedicated future task introduces them.

## 8. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm validate:observability:foundation` | `tsx app/legal/observability/runObservabilityFoundationValidation.ts` | Validates `Logger` (`InMemoryLogger`/`ConsoleLogger`) supports all log levels and structured fields, and `MetricsCollector` (`InMemoryMetricsCollector`) records counter/gauge/timer metrics with expected fields — in-memory only, no external services. |
| `pnpm validate:observability:integration` | `tsx app/legal/observability/runObservabilityIntegrationValidation.ts` | Validates `HealthCheckService` (`InMemoryHealthCheckService`) dependency registration, per-dependency fields, and aggregate `overallStatus` for healthy/degraded/unhealthy combinations, and that `ObservabilityService` exposes a `Logger`, `MetricsCollector`, and `HealthCheckService` — in-memory only, no external services. |
| `pnpm validate:observability` | `tsx app/legal/observability/runObservabilityMilestoneValidation.ts` | Milestone runner: verifies every Phase 20 source file, validation runner, and package.json script exists, then sequences the foundation and integration validators — in-memory only, no external services. |
