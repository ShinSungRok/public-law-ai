# Release Notes

## 1. Release purpose

This document marks Public Law AI as feature-complete for its
portfolio scope (Phases 0–22): a backend-first, TypeScript RAG platform for
Korean legal question-answering, built and validated phase by phase with no
external services required to prove correctness. Phase 23 performs no new
development — it is a final project-wide review, validation pass, and
release record.

## 2. Completed architecture

Clean / Hexagonal Architecture with Domain-Driven Design boundaries: a
framework-independent domain core (`app/legal/domain`), interfaces ("ports")
for every swappable concern (retrieval, search, repository, AI provider,
HTTP), concrete adapters (JSON/PostgreSQL, keyword/hybrid/OpenSearch,
OpenAI/Anthropic/Gemini/fake, Fastify) plugged in only at the composition root
(`DefaultApplicationContextFactory`), and cross-cutting modules
(evaluation, observability, reliability, security) that depend downward on
these interfaces without any business-logic module depending back on them.
See `docs/architecture.md` for the full write-up.

## 3. Completed phases

| Phase | Focus |
|---|---|
| 0 | Streaming legal chat walking skeleton |
| 2 | Legal domain model + minimal RAG architecture |
| 3–5 | Search engine abstraction, OpenSearch foundations |
| 6 | Production OpenSearch indexing |
| 7 | Hybrid search (keyword + vector, score fusion) |
| 8 | Embedding pipeline (chunking, embedding, vector indexing) |
| 9 | Production RAG (real retrieval → prompt → answer) |
| 10 | REST API platform (controllers, DTOs, error mapping) |
| 11 | Framework-independent HTTP adapter |
| 12 | Application composition root |
| 13 | AI provider layer |
| 14 | Real LLM integration (OpenAI, Anthropic) |
| 15 | Production configuration (typed, validated, env-driven) |
| 16 | Docker infrastructure (PostgreSQL, OpenSearch) |
| 17 | Production server runtime + graceful shutdown |
| 18 | End-to-end runtime validation |
| 19 | Evaluation & quality framework |
| 20 | Observability foundation (logging, metrics, health checks) |
| 21 | Security & reliability foundation (retry, timeout, circuit breaker, rate limiting, input validation) |
| 22 | Portfolio packaging (README, architecture/module/development/deployment/portfolio docs) |
| 23 | Final production release (this phase) |

Every phase from 6 onward has a corresponding `chore(<module>): complete
phase N ...` milestone commit in `git log`; Phases 0 and 2 predate that
convention but are documented in `docs/phase-2-legal-rag-architecture.md`.

## 4. Validation strategy

There is no test framework in this repository — every phase ships one or
more validation runners (`tsx app/legal/**/run*Validation.ts`) using
hand-rolled `assertTruthy`/`assertEqual` helpers, exercised only against
fake/in-memory implementations (`FakeAiProvider`, `KeywordSearchEngine`, an
in-memory `LegalDocumentRepository`, a fake `FastifyLikeServer`, injected
fake clocks/delays for retry/circuit-breaker/rate-limit logic). Most
modules have a milestone runner (`pnpm validate:<module>`) that sequences
that module's validators and confirms its own scripts/docs exist.
`pnpm validate:release` (see §7) is the final, project-wide milestone
runner that sequences the key milestone runners across modules. See
`docs/development.md` for the full validation workflow.

## 5. Runtime and infrastructure scope

- `docker-compose.yml` provisions PostgreSQL, OpenSearch (+ OpenSearch
  Dashboards), and the application itself (`app`, built from `Dockerfile`)
  on a shared network, gated by healthchecks (see `docs/deployment.md`).
- `pnpm server:start` boots the production entrypoint
  (`ProductionServerRuntime`): validated configuration →
  `ApplicationContext` → graceful-shutdown signal handling.
- Every default configuration value is safe for local development with no
  real secrets — the fake AI provider is the default, and the full
  validation suite requires no PostgreSQL, OpenSearch, Docker, OpenAI,
  Anthropic, Gemini, Redis, or running server.

## 6. Known limitations

- **`ProductionServerRuntime` binds a real socket-listening HTTP server**
  (`NodeHttpFastifyLikeServer`, built on Node's `http` module) via an
  explicit `listen()` step, proven end-to-end by
  `pnpm validate:server:listen` (real socket, real HTTP request, 404 for
  unknown routes, idempotent listen, socket released on `stop()`) — see
  `docs/server-runtime.md` §3.
- **`ObservabilityService` and `SecurityReliabilityService` are wired into
  the live request path** — every request through `FastifyHttpAdapter` is
  logged and measured, and passes through rate limiting and input
  validation; the AI provider call is wrapped in retry/timeout/circuit
  breaker via `ResilientLlmProviderDecorator` (see `docs/observability.md`
  §5 and `docs/security-reliability.md` §10). The existing `GET /health`
  route does not yet surface `HealthCheckService`'s per-dependency
  breakdown over HTTP, and health checks are structural rather than live
  network probes (see `docs/observability.md` §6).
- **No authentication or authorization** of any kind, anywhere in the
  system. Rate limiting and input validation are not a substitute for this.
- **No Prometheus, OpenTelemetry, or distributed tracing** — logging and
  metrics are console/in-memory only, with no external export target.
- **Evaluation uses deterministic in-memory/fake validation, not live
  external-service benchmarks** — retrieval/search/RAG-answer quality
  metrics run against `KeywordRetriever`/`KeywordSearchEngine`/a fake AI
  provider and in-memory documents, not a real OpenSearch index or a real
  OpenAI/Anthropic model (see `docs/evaluation.md`).
- No distributed state for rate limiting or circuit breakers (process-local
  only); no ranking metrics (MRR/NDCG) in evaluation; no standalone
  citation-accuracy evaluator.

## 7. Future production improvements

- Surface `HealthCheckService`'s per-dependency breakdown over a dedicated
  `GET /health/detailed` route.
- Route caught request-path errors through `ErrorClassifier` automatically.
- Add authentication/authorization.
- Add metrics/log export (e.g. Prometheus, OpenTelemetry) and distributed
  tracing.
- Add distributed state for rate limiting/circuit breaking in a
  multi-instance deployment.
- Add ranking metrics (MRR, NDCG) and a standalone citation-accuracy
  evaluator; benchmark against a real OpenSearch index and real AI
  provider.

## 8. Final validation commands

```bash
pnpm lint
pnpm build
pnpm validate:config
pnpm validate:infra
pnpm validate:server
pnpm validate:rag:e2e
pnpm validate:evaluation
pnpm validate:observability
pnpm validate:security-reliability
pnpm validate:portfolio
pnpm validate:release
```

`pnpm validate:release` (`app/legal/release/runProductionReleaseValidation.ts`)
is the single command that reuses and sequences the milestone runners
above, plus confirms required documentation and `package.json` scripts
exist — without duplicating any of their internal validation logic.

## 9. Milestone commit strategy

Each phase closes with a milestone commit once its milestone validation
runner passes, following `chore(<module>): complete phase N <name>` (see
`docs/development.md` §3–4 for the full commit/phase strategy). This
release follows the same discipline: `docs/release.md` and
`runProductionReleaseValidation.ts` are added, the full validation command
list in §8 is run, and only then is the final release commit
(`chore(release): complete ai legal platform production release`) created —
closing Phase 23 and the portfolio scope through Phase 22.
