# Deployment Guide

## 1. Purpose

This document covers how the application is packaged and configured for
deployment today, and what a real production rollout would still need. No
deployment automation (CI/CD pipeline, cloud infrastructure-as-code) is
included in this repository — this is a guide, not a script.

## 2. Docker

Two independent Docker concerns exist side by side (see
`docs/infrastructure.md` for full detail):

- **`docker-compose.yml`** provisions local infrastructure only —
  PostgreSQL, OpenSearch, and OpenSearch Dashboards — with healthchecks on
  a shared `public-ai-network` bridge network. It does **not** run the
  application; the app is started separately with `pnpm dev`/`pnpm start`.
- **`Dockerfile`** builds the Next.js application itself, as a multi-stage
  build (`base` → `deps` → `builder` → `runner`) producing a slim final
  image that runs `pnpm start` on port `3000`. The build stage never needs
  real AI provider credentials — it never calls OpenAI/Anthropic, and the
  runtime defaults to the fake AI provider unless overridden.

The application service is **not** wired into `docker-compose.yml` yet, so
build and run it independently:

```bash
docker build -t public-ai-platform:local .
docker run --rm -p 3000:3000 public-ai-platform:local
```

## 3. Configuration

All runtime configuration is typed and validated — see
`docs/configuration.md` for the full environment variable table. Key
points for deployment:

- `EnvironmentApplicationConfigurationFactory` is the only place in the
  production composition path that reads `process.env`; every other
  component receives an already-built, already-validated
  `ApplicationConfiguration`.
- Every default is safe for an unconfigured environment — it boots with
  the fake AI provider and no real secrets required. Set `LLM_PROVIDER` to
  `openai` or `anthropic` and provide `LLM_API_KEY` to use a real model.
- `DefaultApplicationConfigurationValidator` fails fast (throws before any
  runtime component is constructed) on any invalid configuration — an
  invalid deployment cannot produce a partially-composed application.
- `.env.example` at the project root is the copy-pasteable starting point
  for every variable.

## 4. Runtime

`pnpm server:start` (`app/legal/server/runProductionServer.ts`) boots the
production entrypoint: it builds and validates `ApplicationConfiguration`,
wires the full `ApplicationContext` via `ApplicationBootstrap`, wraps it in
`ProductionServerRuntime`, prints a startup message, and registers
`SIGINT`/`SIGTERM` handlers that call `runtime.stop()` before exiting. See
`docs/server-runtime.md` for the full lifecycle.

**Current limitation** — `ProductionServerRuntime.start()` composes the
application graph (routes, controllers, AI provider) but does not yet bind
a real, socket-listening HTTP server; `FastifyHttpAdapter` can register
routes onto any `FastifyLikeServer`, but no concrete network-bound
implementation is wired into the production entrypoint yet. Today, running
`pnpm server:start` boots and validates the graph and then exits (unless a
shutdown signal arrives first) — it does not yet keep listening for HTTP
traffic. Wiring an actual listener is a future task.

## 5. Validation

Before any deployment, run the full validation surface that applies to
what changed — at minimum:

```bash
pnpm lint
pnpm build
pnpm validate:server           # server lifecycle + entrypoint + shutdown
pnpm validate:composition      # composition root wiring
pnpm validate:config           # configuration contract + env loading
pnpm validate:rag:e2e          # end-to-end RAG flow
```

Every validator runs with fakes/in-memory implementations, so this whole
suite can run in CI with no external services, credentials, or network
access — it validates the code paths, not the specific infrastructure a
given deployment target will use.

## 6. Production considerations

Not yet addressed by this codebase, and worth calling out explicitly rather
than leaving implicit:

- **No socket-bound production listener** (see §4) — required before this
  can serve real traffic.
- **No authentication or authorization** — every phase through 21
  explicitly excludes this; a real deployment needs one before exposing
  `/rag/answer` publicly.
- **Cross-cutting concerns are composed but not consumed.**
  `ObservabilityService` and `SecurityReliabilityService` exist and are
  independently validated, but no controller, use case, or the server
  runtime calls into them yet — logs/metrics/health checks and
  retry/timeout/circuit-breaker/rate-limiting are not yet active on the
  real request path.
- **No distributed state.** `InMemoryRateLimiter`/`InMemoryCircuitBreaker`
  are process-local; a multi-instance deployment needs a shared store
  (e.g. Redis) for rate limiting and circuit state to be consistent across
  instances — explicitly out of scope through Phase 21.
- **No metrics/log export.** `ConsoleLogger`/`InMemoryMetricsCollector`
  have no Prometheus (or other) export target configured.
- **Docker Compose does not run the application container** — a real
  deployment needs the app service added to `docker-compose.yml` (or an
  equivalent orchestration manifest) alongside its PostgreSQL/OpenSearch
  dependencies.
