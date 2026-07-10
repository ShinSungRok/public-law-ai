# Portfolio Guide

## 1. Why this project exists

Most public LLM/RAG portfolio projects stop at "call an embedding API,
stuff a vector DB, prompt a model." This project instead asks: *what does
this look like as a backend an engineering team could actually own?* It
picks a real, non-trivial domain (Korean statutes and court cases, where a
wrong or unsourced answer has real consequences), and builds the backend a
production legal-tech product would need around an LLM call — typed
domain modeling, swappable search/retrieval, provider-agnostic AI
integration, a REST API, and the observability/reliability/security
scaffolding every production service eventually needs — developed and
documented phase by phase, the way a real team would sequence the work.

## 2. AI Backend Engineer skills demonstrated

- **RAG system design** — retrieval (keyword, hybrid, vector/OpenSearch) →
  prompt context assembly → grounded generation → deterministic citation
  extraction, with each stage behind its own interface and independently
  evaluable (`docs/rag-runtime.md`, `docs/evaluation.md`).
- **LLM provider integration done right** — a provider-agnostic `AiProvider`
  interface with real `OpenAiProvider`/`AnthropicProvider` adapters and a
  deterministic `FakeAiProvider` for zero-cost, zero-network validation;
  swapping providers touches configuration, not business logic.
- **Search & retrieval engineering** — a `SearchEngine` abstraction
  spanning keyword, vector, and hybrid (reciprocal rank fusion) strategies,
  with OpenSearch as the production backend and a full embedding/chunking
  pipeline behind it.
- **Evaluation-driven quality** — a generic evaluation framework
  (`EvaluationCase`/`EvaluationResult`/`EvaluationRunner`) with concrete
  precision/recall evaluators for retrieval, search, and RAG-answer
  quality, plus a regression runner that dispatches across targets.
- **Production reliability engineering** — hand-rolled, dependency-free
  retry, timeout, and circuit-breaker primitives with injectable
  clocks/delays for fully deterministic validation — the same concepts
  found in Resilience4j/Polly, built from first principles.
- **API & platform engineering** — a framework-independent HTTP
  abstraction adapted onto Fastify, typed DTOs and centralized error
  mapping, and a single composition root wiring the entire graph together.
- **Documentation and architectural communication** — every phase ships
  with its own doc explaining what was built, why, and what was
  deliberately deferred — the artifact a senior engineer produces
  alongside code, not instead of it.

## 3. Enterprise Architecture highlights

- **Clean / Hexagonal Architecture** with a framework-independent domain
  core (`app/legal/domain`) and ports/adapters at every boundary — see
  `docs/architecture.md`.
- **Single composition root.** Exactly one file
  (`DefaultApplicationContextFactory`) is allowed to know about every
  concrete adapter; everything else depends on interfaces only.
- **Explicit dependency direction** — domain has zero outward dependencies;
  cross-cutting modules (evaluation, observability, reliability, security)
  depend downward on the interfaces they touch, and nothing upward depends
  on them, so adding a cross-cutting concern never forces a change to
  business logic.
- **Fail-fast, validated configuration** — a single typed
  `ApplicationConfiguration`, validated before any runtime component is
  constructed, with `process.env` access isolated to one factory.
- **Deterministic-by-construction validation strategy** — every one of the
  ~85 `pnpm validate:*`/`pnpm lint`/`pnpm build` scripts runs with no
  external services, proving each phase's behavior without flaky
  integration tests or hidden environment coupling.

## 4. Technologies used

TypeScript (strict mode), Next.js 16 (App Router), Node.js, OpenSearch,
PostgreSQL, OpenAI API, Anthropic API, Docker/docker-compose, pnpm, ESLint,
`tsx`.

## 5. Interview talking points

- **"Walk me through a request."** Trace `POST /rag/answer` from
  `FastifyHttpAdapter` through `RagController` → `RagApplicationService` →
  `GenerateRagAnswerUseCase` → retrieval → prompt → AI provider → citation
  extraction → `RagAnswer` (`docs/rag-runtime.md` §2–3).
- **"How do you validate an LLM-backed system without flaky tests or
  burning API credits?"** Every layer is validated against fakes/in-memory
  adapters — retrieval, search, the AI provider, even time-based logic
  (retry/circuit-breaker/rate-limiter) via injected clocks — so the full
  suite runs deterministically, in CI, with zero external dependencies.
- **"How would you add a new search backend / AI provider?"** Implement
  the `SearchEngine`/`AiProvider` interface, register it in
  `DefaultApplicationContextFactory`/`DefaultAiProviderFactory` — no
  change to `Retriever`, `GenerateRagAnswerUseCase`, or anything downstream.
- **"What would you do next?"** Bind a real socket-listening server to
  `ProductionServerRuntime`, wire `SecurityReliabilityService`/
  `ObservabilityService` into the live request path, add authn/authz, and
  add ranking metrics (MRR/NDCG) to evaluation — all named explicitly as
  future work rather than silently missing (`README.md` "Future
  Improvements").
- **"Why phases instead of one big PR?"** Each phase has an explicit scope
  and non-goal list, its own validation runner(s), and its own doc — the
  same discipline a real team applies to keep large systems reviewable and
  reversible one step at a time (`docs/development.md` §4).
