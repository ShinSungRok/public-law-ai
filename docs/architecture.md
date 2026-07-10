# Architecture

## 1. Purpose

This document describes the architectural style this codebase follows, how
`app/legal/*` modules relate to one another, how a request flows through the
system end to end, and which direction dependencies are allowed to point.
It is the map to read alongside [`docs/modules.md`](modules.md) (per-module
detail) and [`docs/rag-runtime.md`](rag-runtime.md) /
[`docs/server-runtime.md`](server-runtime.md) (flow-level detail).

## 2. Clean Architecture

Every module is split into **interfaces** (the "port") and **implementations**
(the "adapter"), e.g. `Retriever` / `KeywordRetriever` /
`SearchEngineRetriever`, `AiProvider` / `FakeAiProvider` / `OpenAiProvider` /
`AnthropicProvider`, `LegalDocumentRepository` / `JsonLegalDocumentRepository`
/ `PostgreSQLLegalDocumentRepository`. Business logic (use cases, prompt
building, citation extraction, RAG answer assembly) depends only on the
interface, never on a concrete adapter. This is what makes it possible to
run the entire application against fakes/in-memory adapters in validation,
and against real infrastructure in production, with **zero changes to the
business logic itself**.

Concrete adapters are selected and wired together in exactly one place: the
**composition root** (`app/legal/composition/DefaultApplicationContextFactory.ts`).
No use case, controller, or domain type ever imports a concrete adapter
directly.

## 3. Hexagonal Architecture

The same interface/implementation split is organized around the
application core as ports and adapters:

- **Inbound ports/adapters** — `HttpRouteRegistry`/`FastifyHttpAdapter`
  (`app/legal/http`) adapt an inbound HTTP request into a call against
  `RagController`/`HealthController` (`app/legal/api`), which in turn call
  application services.
- **Outbound ports/adapters** — `Retriever`, `SearchEngine`,
  `LegalDocumentRepository`, `AiProvider` are all outbound ports; their
  JSON/PostgreSQL/OpenSearch/OpenAI/Anthropic/fake implementations are
  outbound adapters plugged in by the composition root.

Nothing in `app/legal/application`, `app/legal/rag`, `app/legal/context`, or
`app/legal/prompt` knows whether it is being driven by a real HTTP request,
a validation runner, or the production server entrypoint — that is the
point of the hexagon.

## 4. Domain-Driven Design (DDD)

`app/legal/domain` holds the framework-independent, canonical model of the
problem: `LegalDocument`, `StatuteDocument`, `StatuteArticle`,
`CourtCaseDocument`, `Citation`, `LegalSourceMetadata`, `DocumentChunk`. It
has no dependency on Next.js, OpenSearch, PostgreSQL, or any AI SDK.
`LegalDocument` is a **canonical projection**, not a persisted entity — it
is computed from source-specific repositories via `app/legal/mapper`, so
statute/case data never drifts out of sync with a second denormalized copy
(see `docs/phase-2-legal-rag-architecture.md` §4 for the full rationale).

Application-level orchestration lives in `app/legal/application` as
explicit **use cases** (`GenerateRagAnswerUseCase`, `ImportStatutesUseCase`,
`IndexDocumentEmbeddingsUseCase`) — each one open about the single job it
does, composed from domain types and ports, not a generic "service god
object."

## 5. Module relationships

```
domain  ←──────────────┐  (no outward dependencies)
  ↑                     │
mapper, repository      │
  ↑                     │
persistence (json/pg)   │
  ↑                     │
retrieval ←── search ←── embedding
  ↑
context ←── prompt
  ↑
rag ←── citation
  ↑
application ←── ai
  ↑
api ←── http
  ↑
composition  (wires every interface above to a concrete implementation)
  ↑
server  (production entrypoint; boots composition + lifecycle)

config             → read by composition only
evaluation         → depends on retrieval/search/rag/application, read-only, no production code depends on it
observability      → framework-independent, not yet consumed by production runtime
reliability, security → framework-independent, not yet consumed by production runtime
```

Arrows point from a lower-level module toward the higher-level module that
depends on it. `domain` sits at the bottom with no outward dependencies; up
through `composition`, every layer depends only on interfaces from the
layers below it, never on their concrete adapters.

## 6. Runtime flow

**RAG request flow** (see `docs/rag-runtime.md` for full detail):

```
POST /rag/answer
  → FastifyHttpAdapter          (app/legal/http)
  → RagHttpHandler → RagController → RagApplicationService  (app/legal/api, app/legal/application)
  → GenerateRagAnswerUseCase
      → Retriever / SearchEngine        (app/legal/retrieval, app/legal/search)
      → PromptContextBuilder            (app/legal/context)
      → LegalPromptBuilder               (app/legal/prompt)
      → AiProvider / AiPromptExecutor    (app/legal/ai)
      → DefaultCitationExtractor         (app/legal/rag)
      → RagAnswer (answer + citations)
```

**Server boot flow** (see `docs/server-runtime.md` for full detail):

```
EnvironmentApplicationConfigurationFactory  (app/legal/config)
  → DefaultApplicationConfigurationValidator
  → DefaultApplicationContextFactory        (app/legal/composition)
  → ApplicationBootstrap
  → ProductionServerRuntime                 (app/legal/server)
  → Graceful shutdown (SIGINT / SIGTERM)
```

## 7. Dependency direction

- **Domain has zero outward dependencies.** `app/legal/domain` never
  imports from any other `app/legal/*` module.
- **Interfaces before implementations.** Every module that has more than
  one plausible backing implementation (retrieval, search, repository, AI
  provider, HTTP server) defines its interface first; concrete
  implementations live alongside it but are only referenced by name at the
  composition root.
- **Composition is the only place allowed to know about every concrete
  adapter.** `DefaultApplicationContextFactory` is intentionally the one
  file in the codebase that imports JSON/PostgreSQL repositories,
  OpenSearch/keyword search engines, OpenAI/Anthropic/fake AI providers,
  and the Fastify HTTP adapter all at once.
- **Cross-cutting modules stay decoupled from business logic.**
  `evaluation`, `observability`, `reliability`, and `security` depend
  *downward* on the interfaces they exercise or could eventually protect,
  but no business-logic module (`rag`, `retrieval`, `search`, `ai`, `api`,
  `http`, `server`) depends on them — this is deliberate: it means adding a
  new cross-cutting concern (or reordering when it gets wired in) never
  requires touching business logic, only composition.
- **No upward imports.** A lower-level module (e.g. `domain`, `repository`)
  never imports from a higher-level one (e.g. `rag`, `composition`); this
  is what keeps the dependency graph acyclic and each layer independently
  testable.
