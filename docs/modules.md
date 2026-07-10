# Module Reference

## 1. Purpose

This document summarizes every major module under `app/legal/*`: its
responsibility, its key interfaces/implementations, and how it fits into
the wider system. Each module also has its own `index.ts` barrel export.
See [`docs/architecture.md`](architecture.md) for how these modules relate
to one another and the direction dependencies flow.

## 2. `domain`

The framework-independent, canonical legal data model:
`LegalDocument`, `StatuteDocument`, `StatuteArticle`, `CourtCaseDocument`,
`Citation`, `LegalSourceMetadata`, `DocumentChunk`, `LegalDocumentType`. It
has no dependency on any other `app/legal/*` module, Next.js, or any
external SDK — every other module ultimately builds on these types.
`LegalDocument` is a computed projection assembled from source-specific
repositories, not a persisted entity in its own right.

## 3. `application`

The use-case layer that orchestrates domain types and ports into a single
job: `GenerateRagAnswerUseCase` (retrieval → prompt → AI provider →
citations → `RagAnswer`), `ImportStatutesUseCase`,
`IndexDocumentEmbeddingsUseCase`, and `RagApplicationService` (the thin
service `RagController` calls into). Each use case depends only on
interfaces (`Retriever`, `AiProvider`, repositories), never on a concrete
adapter, so the same use case runs unchanged against fakes or real
infrastructure.

## 4. `repository`

Persistence-agnostic access to legal documents: the `StatuteRepository`,
`CourtCaseRepository`, and `LegalDocumentRepository` interfaces. This
module defines *what* can be asked of storage, deliberately without
knowing whether the answer comes from a JSON file or PostgreSQL —
concrete implementations live in `app/legal/persistence`.

## 5. `pipeline`

Ingestion of public legal data from external sources (e.g. law.go.kr):
`PublicLegalDataDownloader`, `PublicLegalDataParser`, and
`PublicLegalDataPipeline` orchestrate download → parse → normalize into
`ParsedLegalData`/`RawLegalData`. This module also hosts most of the
project's runnable scripts (`runFakePipeline*.ts`,
`runLawGoKrStatuteSearch*.ts`, `runPostgreSQL*.ts`) that exercise ingestion
end to end, both against fakes and against real PostgreSQL/OpenSearch.

## 6. `search`

The search engine abstraction: `SearchEngine`/`SearchQuery`/`SearchHit`,
with `KeywordSearchEngine` (in-memory scoring), `HybridSearchEngine`
(keyword + vector fusion via `ScoreFusionStrategy`/
`ReciprocalRankFusionStrategy`), `VectorSearchEngine`, and
`OpenSearchSearchEngine` (production adapter, under `search/opensearch`).
`SearchResultFilter`/`SearchResultSorter`/`SearchResultMapper` are the
composable pieces every engine implementation shares.

## 7. `retrieval`

The `Retriever` interface consumed directly by the RAG flow, plus
`RetrievalResult`. `KeywordRetriever` queries a `LegalDocumentRepository`
directly; `SearchEngineRetriever` wraps any `SearchEngine` and maps its
`SearchHit[]` back into a `RetrievalResult` — this is the layer
`GenerateRagAnswerUseCase` actually depends on, one level above `search`.

## 8. `rag`

Assembles the final answer: `CitationExtractor`/`DefaultCitationExtractor`
turns search results into `Citation[]` (via `app/legal/citation`), and
`RagAnswerBuilder` combines the AI provider's answer text with those
citations into the `RagAnswer` (`answer` + `citations`) returned to
callers. This module owns no retrieval or prompting logic of its own — it
sits at the end of the pipeline, after `context`/`prompt`/`ai`.

## 9. `embedding`

Chunking, embedding, and vector indexing for semantic/hybrid search:
`ChunkingService`/`SingleChunkChunkingService`, `EmbeddingModel`/
`EmbeddingService`/`FakeEmbeddingModel`, `VectorIndexer`/
`FakeVectorIndexer`, and the `ChunkEmbeddingPipeline`/
`BatchChunkEmbeddingPipeline`/`BatchEmbeddingService` that tie them
together for bulk indexing. Feeds `VectorSearchEngine`/`HybridSearchEngine`
in `app/legal/search`.

## 10. `ai`

The AI provider abstraction: `AiProvider`/`AiProviderRequest`/
`AiProviderResponse` with `FakeAiProvider` (deterministic, no network
call), `OpenAiProvider`, and `AnthropicProvider`, selected by
`AiProviderFactory`/`DefaultAiProviderFactory`. `AiPromptExecutor`/
`DefaultAiPromptExecutor` wraps provider calls with prompt-execution
semantics, and `LlmConfiguration`/`LlmConfigurationFactory` provide the
typed, environment-driven settings each real provider needs.

## 11. `api`

Controllers and DTOs at the REST boundary: `RagController`
(validates and delegates RAG requests, rejecting invalid input via
`InvalidRagRequestError`) and `HealthController`, with their
request/response DTOs (`RagAnswerRequestDto`, `RagAnswerResponseDto`,
`HealthStatusDto`) and `ApiErrorMapper`/`ApiErrorResponseDto` for
consistent error responses. This layer depends on `application`, never on
`http` internals directly beyond the DTOs it exposes.

## 12. `http`

A framework-independent HTTP abstraction: `HttpRequest`/`HttpResponse`/
`HttpRoute`/`HttpRouteRegistry`, `HttpRequestMapper`/`HttpResponseMapper`,
and `RagHttpHandler`/`HealthHttpHandler`/their route factories. Fastify
itself is only touched by `FastifyHttpAdapter`, which binds registry routes
onto any `FastifyLikeServer` — every other module in this layer has no
Fastify (or any framework) import at all, so the whole HTTP layer is
testable without a real server or socket.

## 13. `server`

The production entrypoint: `ProductionServerRuntime`/`ServerRuntime` wrap
`ApplicationBootstrap` with a `start()`/`stop()` lifecycle and register
`SIGINT`/`SIGTERM` graceful-shutdown handlers. `ApiConfiguration`/
`DefaultApiConfigurationFactory` and the `ApiServer`/`ApiRouter` interfaces
(with fake implementations for validation) round out this module. See
`docs/server-runtime.md` for the current limitation that no real
socket-bound listener is wired in yet.

## 14. `composition`

The composition root: `ApplicationContext` is the single object holding
every wired-up controller, use case, and adapter; `ApplicationContextFactory`/
`DefaultApplicationContextFactory` is the only file in the codebase that
imports concrete adapters from every other module (JSON/PostgreSQL
repositories, keyword/OpenSearch search engines, fake/OpenAI/Anthropic AI
providers, the Fastify HTTP adapter) and wires them together.
`ApplicationBootstrap` builds and validates configuration before
constructing the context.

## 15. `observability`

Logging, metrics, and health checks, entirely in-memory: `Logger`/
`ConsoleLogger`/`InMemoryLogger`, `MetricsCollector`/
`InMemoryMetricsCollector`, and `HealthCheckService`/
`InMemoryHealthCheckService` (aggregating per-dependency `HealthStatus`
into an overall status). `ObservabilityService` is a lightweight
composition object grouping all three. Not yet wired into production
runtime — see `docs/observability.md`.

## 16. `reliability`

Resilience primitives, entirely in-memory and deterministic:
`RetryPolicy`/`DefaultRetryPolicy` (bounded retries with a retryable
predicate, no backoff/jitter), `TimeoutPolicy`/`DefaultTimeoutPolicy`
(races an operation against a timer, throws `TimeoutError`),
`CircuitBreaker`/`InMemoryCircuitBreaker` (closed/open/half-open states,
in-process only), and `ErrorClassifier`/`DefaultErrorClassifier`
(deterministic error-to-`ErrorCategory` mapping).
`SecurityReliabilityService`/`DefaultSecurityReliabilityServiceFactory`
compose these plus the `security` module's components into one object.
Not yet wired into production runtime — see `docs/security-reliability.md`.

## 17. `security`

Request-protection abstractions, entirely in-memory and deterministic:
`RateLimiter`/`InMemoryRateLimiter` (fixed-window, per-key counting) and
`InputValidator`/`DefaultInputValidator` (non-empty, max-length, no
null-byte checks). No authentication, authorization, content moderation,
or prompt-injection detection — those remain explicitly out of scope. Not
yet wired into production runtime — see `docs/security-reliability.md`.
