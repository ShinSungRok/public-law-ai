# AI Legal Platform

A backend-first, TypeScript RAG (retrieval-augmented generation) platform
that answers Korean legal questions with cited, traceable sources — built in
public, phase by phase, as a portfolio project for AI Backend Engineer
roles.

## Overview

This repository is not a chatbot demo. It is an enterprise-shaped backend
for a legal question-answering product: a typed domain model for statutes
and court cases, pluggable search/retrieval, a provider-agnostic AI layer,
a REST API surface, and cross-cutting observability, reliability, and
security foundations — all built so that every layer can be validated
in-memory, without any external service, API key, or running server.

The project is developed in **phases**. Each phase adds one architectural
capability, ships with its own validation runner(s), and is documented
before the next phase starts. Nothing is marked "done" without a passing,
dependency-free validation script proving it.

## Project goals

- Demonstrate production-grade backend architecture for an LLM-powered
  product, not just a prompt wrapper around an AI API.
- Keep every layer swappable: fake/in-memory implementations back every
  interface today, with real implementations (OpenSearch, PostgreSQL,
  OpenAI, Anthropic) available behind the same interface.
- Make correctness verifiable without external dependencies — anyone can
  clone this repo and run the full validation suite with zero credentials,
  zero Docker, zero network access.
- Build and document incrementally, the way a real engineering team ships:
  small phases, explicit scope boundaries, and a paper trail of what each
  phase did and did not do.

## Technology Stack

| Concern | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime / framework | Next.js 16 (App Router), Node.js |
| Search | OpenSearch (keyword + hybrid + vector search engines) |
| Database | PostgreSQL (`pg`) |
| AI providers | OpenAI, Anthropic (`@anthropic-ai/sdk`), plus a deterministic fake provider |
| HTTP | A framework-independent HTTP abstraction, adapted to a Fastify-like server interface |
| Tooling | pnpm, ESLint, `tsx` (validation runners), Docker / docker-compose |

No external resilience, security, or observability library is used —
retry/timeout/circuit-breaker, rate limiting/input validation, and
logging/metrics/health-checks are all built as small, dependency-free
in-memory abstractions (see [Architecture](#architecture)).

## Architecture

The codebase follows **Clean / Hexagonal Architecture** with **Domain-Driven
Design** boundaries: a framework-independent domain and application core,
surrounded by interfaces ("ports"), with concrete adapters (JSON files,
PostgreSQL, OpenSearch, OpenAI/Anthropic, Fastify) plugged in at the edges
through composition — never imported directly by the core.

See [`docs/architecture.md`](docs/architecture.md) for the full write-up of
layering, module relationships, runtime flow, and dependency direction.

## Module Structure

All application code lives under `app/legal/*`, one directory per module,
each with its own `index.ts` barrel export. See
[`docs/modules.md`](docs/modules.md) for a description of every module;
the top-level shape is:

```
app/legal/
  domain/            canonical legal document types
  repository/        persistence-agnostic document access
  persistence/       JSON / PostgreSQL repository implementations
  pipeline/          ingestion from public legal data sources
  embedding/         chunking + embedding + vector indexing
  search/            search engine abstraction (keyword, hybrid, OpenSearch)
  retrieval/         Retriever abstraction consumed by RAG
  context/ prompt/   prompt context + prompt construction
  citation/ rag/     citation building + RAG answer assembly
  ai/                AI provider abstraction (OpenAI, Anthropic, fake)
  application/       use cases orchestrating the RAG flow
  api/               controllers + request/response DTOs
  http/              framework-independent HTTP abstraction
  server/            production server runtime + lifecycle
  composition/       the composition root (ApplicationContext)
  config/            typed application configuration
  evaluation/        quality/regression evaluation framework
  observability/     logging, metrics, health checks
  reliability/       retry, timeout, circuit breaker, error classification
  security/          rate limiting, input validation
  infra/             local Docker infrastructure validation
```

## Development Roadmap

The project is built phase by phase; each phase is scoped, validated, and
documented before the next begins. See
[`docs/development.md`](docs/development.md) for the phase strategy this
repository follows.

## Completed Phases

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
| 22 | Portfolio packaging (this phase) |

Each completed phase has a corresponding doc under `docs/` and one or more
`pnpm validate:*` scripts that prove it in-memory.

## Validation Strategy

There is no test framework in this repository — instead, every phase ships
one or more **validation runners**: plain TypeScript scripts (`tsx
app/legal/**/run*Validation.ts`) that assert behavior with hand-rolled
`assertTruthy`/`assertEqual` helpers and exit non-zero on failure. Every
runner uses fake or in-memory implementations, so the entire suite runs
with **no PostgreSQL, no OpenSearch, no Docker, no OpenAI/Anthropic API
key, and no running server**.

Each module has its own validation script(s), and most modules also have a
milestone runner that sequences all of that module's validators and checks
that its own `package.json` scripts and docs exist (e.g.
`pnpm validate:evaluation`, `pnpm validate:observability`, `pnpm
validate:security-reliability`). See
[`docs/development.md`](docs/development.md) for the full workflow.

## How to Run

```bash
pnpm install

# Local development (Next.js dev server)
pnpm dev

# Type-check + lint
pnpm lint
pnpm build

# Run any module's validation suite (no external services required), e.g.:
pnpm validate:rag:e2e
pnpm validate:evaluation
pnpm validate:observability
pnpm validate:security-reliability

# Optional: local PostgreSQL + OpenSearch via Docker
cp .env.example .env
pnpm infra:up
```

See [`docs/deployment.md`](docs/deployment.md) for Docker/production
details and [`docs/configuration.md`](docs/configuration.md) for every
environment variable.

## Project Structure

```
app/legal/*        backend modules (see Module Structure above)
app/api/ask/       the original walking-skeleton chat API route
data/sample/legal/ sample statute + court case data
docs/              one document per phase / architectural concern
docker-compose.yml Dockerfile   local infra + application image
```

## Future Improvements

- Bind a real socket-listening HTTP server to `ProductionServerRuntime`
  (currently composes the full application graph but does not yet listen).
- Wire `SecurityReliabilityService` and `ObservabilityService` into the
  actual request path (currently composed but not yet consumed by
  production runtime).
- Ranking metrics (MRR, NDCG) for retrieval/search evaluation.
- A standalone citation-accuracy evaluator.
- Authentication/authorization (explicitly out of scope through Phase 21).

## Portfolio Highlights

See [`docs/portfolio.md`](docs/portfolio.md) for why this project exists,
the AI Backend Engineer skills it demonstrates, and interview talking
points.
