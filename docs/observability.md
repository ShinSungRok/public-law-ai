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

## 4. Current limitations

- Not wired into production runtime — no controller, use case, retriever,
  search engine, AI provider, or server runtime file constructs or calls a
  `Logger`/`MetricsCollector` yet.
- No health checks.
- No Prometheus (or any other) metrics export.
- No histogram metric type.
- No correlation ID and no distributed tracing.
- No external logging or metrics library is used — only `console` and
  in-memory arrays.
- `runObservabilityFoundationValidation.ts`
  (`pnpm validate:observability:foundation`) only exercises these classes
  in-memory (plus a temporary `console.*` capture to verify `ConsoleLogger`
  output) — no PostgreSQL, OpenSearch, Docker, OpenAI, or Anthropic is
  required.

## 5. Future tasks

- **Health Check & Observability Integration** — wire `Logger`/
  `MetricsCollector` into `ApplicationContext`/`ProductionServerRuntime` and
  add a health check surface built on this foundation.
- **Milestone Validation** — a milestone runner (mirroring
  `runInfraMilestoneValidation.ts` / `runServerRuntimeValidation.ts` /
  `runEvaluationMilestoneValidation.ts`) that sequences all observability
  validators.

## 6. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm validate:observability:foundation` | `tsx app/legal/observability/runObservabilityFoundationValidation.ts` | Validates `Logger` (`InMemoryLogger`/`ConsoleLogger`) supports all log levels and structured fields, and `MetricsCollector` (`InMemoryMetricsCollector`) records counter/gauge/timer metrics with expected fields — in-memory only, no external services. |
