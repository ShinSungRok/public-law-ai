# Phase 2: Legal Data & Minimal RAG Architecture

## 1. What Phase 2 implemented

Phase 2 built the legal domain layer and a minimal, wired-but-not-yet-real
retrieval-augmented generation (RAG) pipeline, replacing the Phase 1
walking-skeleton chat (general-knowledge-only prompt, no retrieval) with a
retrieval step that sits in front of the LLM call:

- A framework-independent legal domain model (`app/legal/domain`).
- Source-to-canonical mappers (`app/legal/mapper`).
- JSON-file-backed repositories behind interfaces that will later be backed
  by PostgreSQL/OpenSearch (`app/legal/repository`).
- A simple keyword-based retriever (`app/legal/retrieval`).
- A deterministic citation builder (`app/legal/citation`).
- A prompt-context assembly layer and prompt builder
  (`app/legal/context`, `app/legal/prompt`).
- A retrieval evaluation framework (`app/legal/evaluation`).
- One real, verified sample statute article (민법 제750조) and one real
  court case (대법원 70다798) in `data/sample/legal`, replacing empty
  placeholders.
- `AIService` wired to call retrieval before building the LLM prompt.

## 2. Current flow

```
User Question
  → KeywordRetriever          (app/legal/retrieval)
  → PromptContextBuilder      (app/legal/context)
  → LegalPromptBuilder        (app/legal/prompt)
  → AIService                 (app/ai/service)
  → LLMProvider                (app/ai/provider)
```

`AIService.answerLegalQuestion` composes these steps internally: it calls
the injected `Retriever`, passes the `RetrievalResult` through
`buildPromptContext`, passes the resulting `PromptContext` through
`buildLegalPromptRequest`, and streams the resulting `LLMCompletionRequest`
through `LLMProvider.streamCompletion`. `app/api/ask/route.ts` and the UI
are unchanged by this — they only ever saw `AIResponseStream` in and out.

## 3. Legal module structure

| Module | Responsibility |
|---|---|
| `domain` | Framework-independent types: `LegalDocument`, `StatuteDocument`, `StatuteArticle`, `CourtCaseDocument`, `Citation`, `LegalSourceMetadata`. |
| `mapper` | Pure functions converting source-specific models (`StatuteArticle`, `CourtCaseDocument`) into the canonical `LegalDocument`. |
| `repository` | `StatuteRepository`, `CourtCaseRepository`, `LegalDocumentRepository` interfaces, plus JSON-file implementations under `repository/json`. |
| `retrieval` | `Retriever` interface and `KeywordRetriever`, a substring/keyword-scoring implementation over `LegalDocumentRepository`. |
| `citation` | `buildCitation` / `buildCitationsFromRetrievedDocuments` — deterministic `Citation` construction from a `LegalDocument`. |
| `context` | `PromptContext` / `ContextDocument` and `buildPromptContext`, converting a `RetrievalResult` into prompt-ready data plus citations. |
| `prompt` | `buildLegalPromptRequest` — formats a `PromptContext` into an `LLMCompletionRequest`, with grounded and ungrounded branches. |
| `evaluation` | `RetrievalTestCase` / `EvaluationResult` / `RetrievalEvaluator` — precision/recall scoring against any `Retriever` implementation. |

`app/legal/index.ts` is the composition root: `createLegalDocumentRepository()`
and `createKeywordRetriever()` wire the JSON-backed implementations behind
the interfaces, and re-export the public types/functions from each module.

## 4. Why `LegalDocument` is a canonical projection, not a database entity

`LegalDocument` never has its own PostgreSQL table and is never persisted by
`JsonFileLegalDocumentRepository` — it's computed on every call by reading
`StatuteRepository`/`CourtCaseRepository` and running the result through the
mappers. This avoids a second, denormalized copy of statute/case data that
could drift out of sync with the source-specific tables. When PostgreSQL
exists, the same rule holds: `LegalDocument` stays a query-time projection
(or an OpenSearch index built from the source tables), not a table of its
own.

## 5. Why `Citation` is deterministic and not LLM-generated

Every `Citation` field (`displayText`, `sourceUrl`, `snippet`) is copied
directly from fields already present on the `LegalDocument` that produced
it — there is no model call anywhere in `buildCitation`. The same input
always produces the same output, and every citation shown to a user is
traceable back to a real source record. This is what prevents the failure
mode a static/hardcoded retriever would invite: an LLM asserting a citation
that looks legitimate but resolves to nothing real.

## 6. Current limitations

- **JSON sample data only** — `data/sample/legal` holds one real statute
  article and one real court case, manually fetched; there is no automated
  ingestion pipeline yet.
- **Keyword retrieval only** — `KeywordRetriever` does substring matching
  with a fixed title/text point score; no ranking model, no synonyms, no
  semantic similarity.
- **No OpenSearch** — nothing is indexed; every retrieval call re-reads and
  re-scores the full JSON-backed document set.
- **No PostgreSQL** — repositories read flat JSON files, not a database.
- **No embeddings** — retrieval is lexical only, no vector search.
- **Not production RAG yet** — with only two sample documents, most queries
  will hit the ungrounded prompt branch (no relevant sources found); the
  pipeline is wired end-to-end but has almost nothing to retrieve from.

## 7. Phase 3 entry criteria

Phase 3 should begin only once the following are in place:

1. Introduce OpenSearch as a search backend.
2. Define an index mapping for `LegalDocument` (per the Phase 2-A search
   index design: full-text fields for title/text, keyword filters for
   dates/type/status).
3. Implement `OpenSearchRetriever` as an alternate `Retriever`
   implementation, without changing the `Retriever` interface or anything
   downstream of it (`PromptContextBuilder`, `LegalPromptBuilder`,
   `AIService`).
4. Use the existing `RetrievalEvaluator` and a shared set of
   `RetrievalTestCase`s to compare `KeywordRetriever` vs. `OpenSearchRetriever`
   head-to-head on precision/recall before deciding which is default.
