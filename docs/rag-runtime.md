# RAG Runtime Flow

## 1. Purpose

`app/legal/rag` (together with `app/legal/retrieval`, `app/legal/search`,
`app/legal/context`, `app/legal/prompt`, and `app/legal/application`)
implements the RAG (retrieval-augmented generation) pipeline that turns a
user's legal question into a grounded, cited answer. This document describes
how a query flows end-to-end through that pipeline, and the validation
strategy that exercises it without any real external services.

## 2. End-to-end RAG flow

```
Query
  → Retriever / Search Result       (app/legal/retrieval, app/legal/search)
  → Prompt Context                  (app/legal/context/PromptContextBuilder)
  → AI Provider                     (app/legal/ai, app/ai/provider)
  → Citation Extraction             (app/legal/rag/DefaultCitationExtractor)
  → RagAnswer                       (app/legal/rag/RagAnswerBuilder)
```

`GenerateRagAnswerUseCase` (`app/legal/application/GenerateRagAnswerUseCase.ts`)
is the single place that wires this whole chain together:

1. `Retriever.retrieve(query)` returns a `RetrievalResult` — either from
   `KeywordRetriever` (queries a `LegalDocumentRepository` directly) or from
   `SearchEngineRetriever` (queries a `SearchEngine`, e.g.
   `KeywordSearchEngine` or `OpenSearchSearchEngine`, and maps `SearchHit[]`
   back into a `RetrievalResult`).
2. `buildPromptContext(retrievalResult)` converts each `RetrievedDocument`
   into a `ContextDocument` (`id`, `title`, `text`, `citation`), preserving
   the document's id, title, content, and source information.
3. `buildLegalPromptRequest(promptContext)` renders that context into an
   `LLMCompletionRequest` (`system` + `prompt`) — grounded in retrieved
   documents when present, or an explicit "no sources found" prompt when not.
4. `LLMProvider.streamCompletion(promptRequest)` streams the AI provider's
   response chunks, which are concatenated into the final answer text.
5. `RagAnswerBuilder.build(answer, searchResults)` extracts `Citation[]` via
   `CitationExtractor` (`DefaultCitationExtractor`, built on
   `CitationBuilder`) and assembles the final `RagAnswer` (`answer` +
   `citations`).

## 3. API / controller-level RAG flow

The same `GenerateRagAnswerUseCase` is wired into the composition graph via
`DefaultApplicationContextFactory` (`app/legal/composition`) and exposed over
HTTP:

```
POST /rag/answer
  → RagHttpHandler        (app/legal/http/RagHttpHandler.ts)
  → RagController          (app/legal/api/RagController.ts)
  → RagApplicationService   (app/legal/application/RagApplicationService.ts)
  → GenerateRagAnswerUseCase (the end-to-end flow above)
```

`RagController.answer()` validates the incoming query (rejects empty/blank
queries via `InvalidRagRequestError`) before delegating to
`RagApplicationService`. `createRagHttpRoute()` registers this controller
onto `HttpRouteRegistry`, and `FastifyHttpAdapter` binds the route's handler
onto any `FastifyLikeServer` (see `docs/server-runtime.md` for the current
limitation that no real socket-bound server is wired in yet).

## 4. Fake / in-memory validation strategy

Every validation runner in this document uses only fake or in-memory
components — no real PostgreSQL, OpenSearch, Docker, OpenAI, or Anthropic is
ever required:

- **Documents**: an in-memory `LegalDocumentRepository` implementation
  seeded with a small fixed set of sample `LegalDocument`s.
- **Retrieval / search**: `KeywordRetriever` and `KeywordSearchEngine` — pure
  in-memory keyword scoring, no OpenSearch client.
- **AI provider**: a fake `LLMProvider` that yields a deterministic,
  hardcoded response (the same fixture used by
  `DefaultApplicationContextFactory` itself for `RagController`, and by
  `EnvironmentApplicationConfigurationFactory`'s `LLM_PROVIDER=fake` default
  for `context.aiProvider`) — no network call is made.
- **HTTP**: a fake `FastifyLikeServer`/`FastifyLikeReply` pair that captures
  registered routes and responses in memory, instead of binding a real
  socket.

This mirrors the strategy already used throughout `app/legal/composition`
and `app/legal/http` (e.g. `runApplicationRuntimeValidation.ts`,
`runHttpEndToEndValidation.ts`) and is what makes it possible to validate the
whole RAG pipeline in CI and locally with zero external dependencies or
secrets.

## 5. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm validate:rag:runtime-flow` | `tsx app/legal/rag/runRagRuntimeFlowValidation.ts` | Proves a query flows through retrieval → prompt building → AI provider → citation extraction → final `RagAnswer`, with an assertion at each stage plus a full `GenerateRagAnswerUseCase.execute()` run. |
| `pnpm validate:rag:search-integration` | `tsx app/legal/rag/runSearchToRagIntegrationValidation.ts` | Proves search results (via `SearchEngineRetriever`/`KeywordSearchEngine`) carry the metadata RAG needs, that prompt context preserves document id/title/content/source, and that citations and the final answer trace back to the original search results. |
| `pnpm validate:rag:api-runtime` | `tsx app/legal/rag/runRagApiRuntimeValidation.ts` | Builds a real `ApplicationContext` via `ApplicationBootstrap`/`DefaultApplicationContextFactory`, confirms the `POST /rag/answer` route is registered, and dispatches a fake request through the controller-level runtime components, asserting the response contains both `answer` and `citations`. |
| `pnpm validate:rag:e2e` | `tsx app/legal/rag/runRagEndToEndValidation.ts` | Milestone runner: verifies the three validators above exist and are wired into `package.json`, then runs all three in sequence. |

## 6. Current limitation

Validation deliberately never requires a real OpenSearch cluster or a real
OpenAI/Anthropic API key. `SearchEngineRetriever` and `OpenSearchSearchEngine`
exist for production use against real OpenSearch (see
`docs/infrastructure.md`), and `OpenAiProvider`/`AnthropicProvider` exist for
production use against real providers (see `docs/configuration.md`), but the
RAG runtime validation suite exercises the same code paths through
in-memory/fake substitutes instead, so it can run anywhere with no network
access or credentials.

## 7. Typical workflow

```bash
pnpm validate:rag:runtime-flow
pnpm validate:rag:search-integration
pnpm validate:rag:api-runtime
pnpm validate:rag:e2e   # runs all of the above
```
