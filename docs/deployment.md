# Deployment Guide

## 1. Purpose

This document covers how the application is packaged and configured for
deployment today, and what a real production rollout would still need. No
deployment automation (CI/CD pipeline, cloud infrastructure-as-code) is
included in this repository — this is a guide, not a script.

## 2. Docker

Two independent Docker concerns exist side by side (see
`docs/infrastructure.md` for full detail):

- **`docker-compose.yml`** provisions PostgreSQL, OpenSearch, OpenSearch
  Dashboards, and the application itself (`app`) on a shared
  `public-ai-network` bridge network, with healthchecks gating startup
  order (`app` waits on `postgres`/`opensearch` being healthy).
- **`Dockerfile`** builds the Next.js application itself, as a multi-stage
  build (`base` → `deps` → `builder` → `runner`) producing a slim final
  image from Next's standalone output (`node server.js`) on port `3000`.
  The build stage never needs real AI provider credentials — it never
  calls OpenAI/Anthropic/Gemini, and the runtime defaults to the fake AI
  provider unless overridden.

Bring up the full stack — PostgreSQL, OpenSearch, and the application —
with one command:

```bash
cp .env.example .env   # fill in real values before using a real AI provider
docker compose up -d --build
```

The application container alone can still be built and run independently
(e.g. against externally hosted PostgreSQL/OpenSearch):

```bash
docker build -t public-law-ai-app:local .
docker run --rm -p 3000:3000 --env-file .env public-law-ai-app:local
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
  `openai`, `anthropic`, or `gemini` and provide `LLM_API_KEY` to use a
  real model.
- `DefaultApplicationConfigurationValidator` fails fast (throws before any
  runtime component is constructed) on any invalid configuration — an
  invalid deployment cannot produce a partially-composed application.
- `.env.example` at the project root is the copy-pasteable starting point
  for every variable.

## 4. Runtime

`pnpm server:start` (`app/legal/server/runProductionServer.ts`) boots the
production entrypoint: it builds and validates `ApplicationConfiguration`,
wires the full `ApplicationContext` via `ApplicationBootstrap`, wraps it in
`ProductionServerRuntime`, binds a real socket-listening HTTP server
(`NodeHttpFastifyLikeServer`, built on Node's `http` module), prints a
startup message with the address it's listening on, and registers
`SIGINT`/`SIGTERM` handlers that call `runtime.stop()` (closing the socket)
before exiting. See `docs/server-runtime.md` for the full lifecycle.

## 5. Validation

Before any deployment, run the full validation surface that applies to
what changed — at minimum:

```bash
pnpm lint
pnpm build
pnpm validate:server           # server lifecycle + entrypoint + shutdown + real socket listen
pnpm validate:composition      # composition root wiring
pnpm validate:config           # configuration contract + env loading
pnpm validate:rag:e2e          # end-to-end RAG flow
pnpm validate:security-reliability   # rate limiting/input validation/resilience wiring
```

Every validator runs with fakes/in-memory implementations, so this whole
suite can run in CI with no external services, credentials, or network
access — it validates the code paths, not the specific infrastructure a
given deployment target will use.

## 6. Production considerations

Not yet addressed by this codebase, and worth calling out explicitly rather
than leaving implicit:

- **No authentication or authorization** — every phase through 21
  explicitly excludes this; a real deployment needs one before exposing
  `/rag/answer` publicly. Rate limiting and input validation are active
  (see `docs/security-reliability.md` §10), but neither is a substitute for
  authn/authz.
- **No distributed state.** `InMemoryRateLimiter`/`InMemoryCircuitBreaker`
  are process-local; a multi-instance deployment needs a shared store
  (e.g. Redis) for rate limiting and circuit state to be consistent across
  instances — explicitly out of scope through Phase 21.
- **No metrics/log export.** `ConsoleLogger`/`InMemoryMetricsCollector`
  have no Prometheus (or other) export target configured.
