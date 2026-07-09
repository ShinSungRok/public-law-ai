# Evaluation Framework

## 1. Purpose of Phase 19

Phase 19 introduces an enterprise-level Evaluation & Quality framework for
the AI Legal Platform: a consistent way to describe evaluation test cases,
run them, and report pass/fail quality metrics across the retrieval, search,
RAG answer, and citation layers — plus a regression target for cross-cutting
checks.

Task 1 establishes only the **architecture**: the shared types every future
evaluation task will build on. It intentionally does not implement any
concrete scoring logic yet.

## 2. Evaluation framework scope

`app/legal/evaluation` holds two things side by side:

- A pre-existing, concrete retrieval evaluator (`RetrievalEvaluator`,
  `RetrievalTestCase`, `RetrievalEvaluationResult`) that computes
  precision/recall for a single retriever. This predates Phase 19 and is
  unrelated to it — it is not modified beyond a rename
  (`EvaluationResult` → `RetrievalEvaluationResult`) needed to free up the
  `EvaluationResult` name for the new framework below.
- The new, generic Phase 19 framework types (`EvaluationTarget`,
  `EvaluationCase`, `EvaluationMetric`, `EvaluationResult`,
  `EvaluationSummary`, `EvaluationRunner`) described in this document. These
  are target-agnostic: the same `EvaluationCase`/`EvaluationResult` shapes
  will be reused by every future evaluator (retrieval, search, RAG answer,
  citation, regression), instead of each one inventing its own result shape.

The framework is deliberately isolated from production runtime logic: no
production code path (RAG, search, AI provider, HTTP, server runtime)
imports from `app/legal/evaluation`, and this phase does not change that.

## 3. Evaluation targets

`EvaluationTarget` (`app/legal/evaluation/EvaluationTarget.ts`) is a closed
set of the high-level areas an evaluation case can exercise:

| Target | Meaning |
|---|---|
| `retrieval` | Retriever quality (e.g. `KeywordRetriever`, `SearchEngineRetriever`) |
| `search` | Search engine quality (e.g. `KeywordSearchEngine`, `OpenSearchSearchEngine`) |
| `rag-answer` | End-to-end RAG answer quality |
| `citation` | Citation extraction accuracy |
| `regression` | Cross-cutting checks that don't map to a single layer |

## 4. Evaluation case model

`EvaluationCase` (`app/legal/evaluation/EvaluationCase.ts`) is a reusable,
declarative test case:

```ts
interface EvaluationCase {
  id: string;
  name: string;
  target: EvaluationTarget;
  query: string;
  expectedDocumentIds?: string[];
  expectedAnswerKeywords?: string[];
  expectedCitationDocumentIds?: string[];
  metadata?: Record<string, unknown>;
}
```

Only `id`, `name`, `target`, and `query` are required. The `expected*`
fields are optional so a single case shape can describe a retrieval-only
check, a full RAG-answer check, or a citation-only check without unused
fields.

`EvaluationMetric` (`app/legal/evaluation/EvaluationMetric.ts`) is a single
measured quality item (`name`, `score`, `passed`, optional `details`) —
future evaluators (recall@k, precision@k, keyword coverage, citation
accuracy, ...) will each produce one or more of these per case.

## 5. Evaluation result model

`EvaluationResult` (`app/legal/evaluation/EvaluationResult.ts`) is the
outcome of running one `EvaluationCase`: it aggregates that case's
`EvaluationMetric[]` into a single `caseId` + `target` + `passed` + optional
`details`.

`EvaluationSummary` (`app/legal/evaluation/EvaluationSummary.ts`) aggregates
many `EvaluationResult`s into `totalCount` / `passedCount` / `failedCount` +
the full `results` array, for reporting a whole evaluation run.

`EvaluationRunner` (`app/legal/evaluation/EvaluationRunner.ts`) is the
interface every future concrete evaluator will implement:
`run(evaluationCase): Promise<EvaluationResult>`.

## 6. Current limitation of Task 1

No concrete scoring logic exists yet for `retrieval`, `search`, `rag-answer`,
or `citation` targets under the new framework. `runEvaluationFrameworkValidation.ts`
(`pnpm validate:evaluation:framework`) only proves the type contracts hold
using in-memory sample objects and a trivial `InMemoryEvaluationRunner` — it
does not call any retriever, search engine, AI provider, or citation
extractor. No PostgreSQL, OpenSearch, Docker, OpenAI, or Anthropic is
required.

## 7. Future tasks

- **Retrieval Quality Evaluation** — a concrete `EvaluationRunner` for the
  `retrieval` target, built on the existing `Retriever` abstraction.
- **Search Quality Evaluation** — a concrete `EvaluationRunner` for the
  `search` target, built on the existing `SearchEngine` abstraction.
- **RAG Answer Quality Evaluation** — a concrete `EvaluationRunner` for the
  `rag-answer` target, built on `GenerateRagAnswerUseCase`.
- **Citation Accuracy Evaluation** — a concrete `EvaluationRunner` for the
  `citation` target, built on `CitationExtractor`.
- **Regression Runner** — a runner that executes a fixed suite of
  `EvaluationCase`s across all targets and produces an `EvaluationSummary`.
- **Milestone Validation** — a milestone runner (mirroring
  `runInfraMilestoneValidation.ts` / `runServerRuntimeValidation.ts` /
  `runRagEndToEndValidation.ts`) that sequences all evaluation validators.

## 8. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm validate:evaluation:framework` | `tsx app/legal/evaluation/runEvaluationFrameworkValidation.ts` | Structural validation of the evaluation framework types using in-memory sample objects only. |
