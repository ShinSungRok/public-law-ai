# Final Benchmark Report

## 1. Purpose

Phase 30 closes out the retrieval-quality work started in Phase 26
(BM25 optimization) by building a single **production benchmark framework**
(Task 1) that compares every retrieval variant on quality *and* latency, and
a **final benchmark report** (Task 2, this document + the code behind it)
that runs that framework, records the actual numbers, picks a recommended
configuration by a documented rule, and states plainly what the numbers do
and do not prove.

This document is the project-wide summary. It intentionally restates —
rather than replaces — detail that already lives in
[`docs/architecture.md`](architecture.md), [`docs/modules.md`](modules.md),
and [`docs/evaluation.md`](evaluation.md); follow those links for the full
write-up of any section below.

## 2. Architecture

See [`docs/architecture.md`](architecture.md) for the complete write-up.
Summary relevant to this report: the codebase follows Clean/Hexagonal
Architecture with a framework-independent domain core. Retrieval is a
strict interface stack —

```
SearchEngine  (app/legal/search)      — BM25 / Vector / Hybrid / Re-ranking, all implement search(query) -> SearchHit[]
    ↑
Retriever     (app/legal/retrieval)   — SearchEngineRetriever wraps any SearchEngine, unchanged since Phase 7
    ↑
GenerateRagAnswerUseCase (app/legal/application) — the only consumer of Retriever
```

Every retrieval strategy this report benchmarks (BM25, Vector, Hybrid,
Re-ranked Hybrid) is a `SearchEngine` implementation plugged into the same,
unmodified `SearchEngineRetriever` — the strategy changes, the seam it plugs
into does not. This is what makes an apples-to-apples benchmark possible
without duplicating retrieval logic per variant.

## 3. Data pipeline

`app/legal/pipeline` ingests statute/case data from law.go.kr into
`LegalDocument`s; `app/legal/embedding` (Phase 27) chunks and embeds those
documents (`ChunkingService` → `EmbeddingService` →
`BatchChunkEmbeddingPipeline`) for vector indexing; `app/legal/search/opensearch`
indexes both the keyword fields and the embedding vector into the same
OpenSearch document (`OpenSearchLegalDocumentIndexer.indexWithEmbedding`),
so BM25 and vector search query the same corpus without a second sync path.
Every benchmark and validation script in this project (including this
report) runs this same pipeline against `FakeOpenSearchClient` (in-memory)
and `FakeEmbeddingProvider` (deterministic hash-based vectors) instead of a
live OpenSearch cluster and a real embedding model — see §7 for what that
does and does not prove.

## 4. Retrieval evolution

| Phase | Capability added | Key files |
|---|---|---|
| 3–5 | `SearchEngine` abstraction + OpenSearch foundations | `search/SearchEngine.ts`, `search/opensearch/` |
| 6 | Production OpenSearch indexing | `search/opensearch/OpenSearchLegalDocumentIndexer.ts` |
| 26 | BM25 query tuning + BM25 benchmark | `search/opensearch/OpenSearchSearchBodyBuilder.ts`, `evaluation/Bm25RetrievalBenchmark.ts` |
| 27 | Embedding pipeline + Vector retrieval | `embedding/`, `search/opensearch/OpenSearchVectorSearchEngine.ts` |
| 28 | Hybrid retrieval (Reciprocal Rank Fusion) + benchmark | `search/HybridSearchEngine.ts`, `search/ReciprocalRankFusionStrategy.ts`, `evaluation/HybridRetrievalBenchmark.ts` |
| 29 | Re-ranking pipeline + benchmark | `search/ReRankingSearchEngine.ts`, `search/FakeReRanker.ts`, `evaluation/ReRankingBenchmark.ts` |
| 30 | Production benchmark framework + final report | `evaluation/ProductionBenchmark.ts`, `evaluation/FinalBenchmarkReport.ts` |

Each step is a `SearchEngine` **decorator or composition**, never a rewrite:
`HybridSearchEngine` wraps a list of existing `SearchEngine`s (BM25, Vector)
behind a `ScoreFusionStrategy`; `ReRankingSearchEngine` wraps any existing
`SearchEngine` (in production, the `HybridSearchEngine` from Phase 28) behind
a `ReRanker`. `SearchEngineRetriever` and `GenerateRagAnswerUseCase` never
changed across any of these phases.

## 5. Evaluation framework

See [`docs/evaluation.md`](evaluation.md) for the full Phase 19 write-up
(evaluation targets, case/result models, retrieval/search/RAG-answer
runners, regression dispatch). Phases 25–30 built directly on top of that
framework without modifying its core types:

- **Retrieval metrics** (`RetrievalMetricsEvaluationRunner`,
  `buildRetrievalMetricsReport`) — Hit Rate, Recall@1/3/5, MRR.
- **Failure analysis** (`analyzeRetrievalFailures`,
  `buildRetrievalFailureReport`) — categorized retrieval failures + counts.
- **Grounding metrics** (`GroundingMetricsEvaluationRunner`,
  `buildGroundingMetricsReport`) — Context Coverage, Grounded Answer,
  Unsupported Claims, Citation Coverage.
- **Benchmark variants** (`Bm25RetrievalBenchmark.runBm25RetrievalBenchmarkVariant`) —
  packages the above (retrieval metrics + failure analysis) into one labeled
  result per retriever, reused unmodified by every later benchmark (Vector,
  Hybrid, Re-ranking, Production).
- **Production benchmark** (`ProductionBenchmark.runProductionBenchmark`,
  Phase 30 Task 1) — runs a benchmark variant plus (where a RAG pipeline is
  configured) grounding, plus retrieval/end-to-end latency (average/min/max
  over repeated timed passes), for each of BM25/Vector/Hybrid/Re-ranked
  Hybrid.
- **Final benchmark report** (`FinalBenchmarkReport.runFinalBenchmarkReport`,
  Phase 30 Task 2) — runs the production benchmark, selects a recommended
  configuration by a documented deterministic rule, and attaches the known
  benchmark limitations (§7) to the same report object the numbers live in.

No task in this chain recomputes a metric another task already owns —
`runFinalBenchmarkReport` calls `runProductionBenchmark` (unmodified), which
calls `runBm25RetrievalBenchmarkVariant` (unmodified), which calls
`buildRetrievalMetricsReport`/`buildRetrievalFailureReport` (unmodified).

## 6. Benchmark results

Produced by `pnpm validate:evaluation:final-benchmark-report`
(`app/legal/evaluation/runFinalBenchmarkReportValidation.ts`) against the 29
in-memory `RAG_EVALUATION_DATASET` cases and `REAL_ARTICLE_DOCUMENTS` corpus
(real 개인정보 보호법/형법 statute article text), with
`FakeOpenSearchClient`/`FakeEmbeddingProvider`/a deterministic echo fake LLM
provider — no external services. Latency is average/min/max over 3 timed
passes per variant; re-ranking uses `candidateTopK=20, finalTopN=5` (the
configuration Phase 29 Task 2's tuning sweep favored).

| Variant | Hit Rate | Recall@1 | Recall@3 | Recall@5 | MRR | Failures | Context Coverage | Retrieval latency (avg) | End-to-end latency (avg) |
|---|---|---|---|---|---|---|---|---|---|
| BM25 | 100% | 73% | 85% | 85% | 0.80 | 4 | 100% | ~4–7ms | ~20–35ms |
| Vector | 73% | 15% | 38% | 46% | 0.30 | 14 | 73% | <1ms | ~8–12ms |
| Hybrid (RRF) | 100% | 62% | 73% | 81% | 0.69 | 5 | 100% | ~5–8ms | ~20–37ms |
| Re-ranked Hybrid | 81% | 62% | 77% | 81% | 0.69 | 5 | 81% | ~8–13ms | ~31–56ms |

(Exact figures vary run to run only in latency — see §8; quality/grounding
figures are deterministic and reproduced verbatim by the validation script.)

**Recommended configuration: `bm25`.**

`selectRecommendedProductionVariant` (`app/legal/evaluation/FinalBenchmarkReport.ts`)
applies the same documented rule as Phase 28's `selectBestHybridRrfCandidate`
and Phase 29's `selectBestReRankingCandidate`: highest Hit Rate first, then
fewest retrieval failures, then highest MRR as the final tie-break. BM25 and
Hybrid tie on Hit Rate (100%); BM25 wins the tie-break with fewer failures
(4 vs. 5).

This is an honest, if perhaps unintuitive, result: it reflects §7's
limitations, not a claim that BM25 outperforms vector/hybrid/re-ranked
retrieval in production. See §7 and §8.

## 7. Known limitations

Also surfaced programmatically via `KNOWN_BENCHMARK_LIMITATIONS`
(`app/legal/evaluation/FinalBenchmarkReport.ts`), so every
`FinalBenchmarkReport` carries these caveats alongside its numbers, not only
in this document:

- **Deterministic fake embeddings.** `FakeEmbeddingProvider` produces a
  hash-derived vector per text, not output from a real embedding model
  (e.g. OpenAI/Cohere `text-embedding-*`). It has no notion of semantic
  similarity, so Vector/Hybrid/Re-ranked-Hybrid quality numbers measure
  whether the *retrieval pipeline* (indexing, querying, fusion, re-ranking)
  is wired correctly — not whether real embeddings would rank documents
  well. This is the primary reason BM25 (a real, deterministic keyword
  algorithm) outperforms Vector/Hybrid/Re-ranked Hybrid above: a real
  embedding model would be expected to close or reverse that gap.
- **Deterministic fake re-ranking.** `FakeReRanker` scores candidates by
  exact query-term overlap against title+text, not a real cross-encoder or
  LLM-based re-ranker. Re-ranked Hybrid numbers above prove
  `ReRankingSearchEngine`'s `candidateTopK`/`finalTopN` windowing and
  identity-preservation wiring is correct — they do not predict what a real
  re-ranking model would score.
- **Fake grounding.** Grounding metrics run against a deterministic echo
  fake `LLMProvider` (repeats the retrieved text verbatim), not a real AI
  Provider call — Grounded Answer / Citation Coverage measure the grounding
  *pipeline*, not real generation quality.
- **In-memory OpenSearch, small fixed corpus.** `FakeOpenSearchClient`
  replaces a real OpenSearch cluster, and the corpus is
  `REAL_ARTICLE_DOCUMENTS` (real statute text, but a small fixed set, not
  the full production index). Absolute latency numbers isolate pipeline
  overhead in a single Node process with no network hop and no concurrent
  load — they are not production request-latency numbers.

## 8. Future production extensions

- **Swap `FakeEmbeddingProvider` for a real embedding model** (OpenAI
  `text-embedding-3-*` or similar) behind the same `EmbeddingProvider`
  interface — no change to `EmbeddingService`, `VectorSearchEngine`, or
  `HybridSearchEngine` required.
- **Swap `FakeReRanker` for a real re-ranker** (a cross-encoder model, or an
  LLM-as-a-judge prompt) behind the same `ReRanker` interface — no change to
  `ReRankingSearchEngine` required.
- **Re-run this benchmark against a real OpenSearch cluster and the full
  production corpus** once the above two are wired in, to get latency and
  quality numbers that reflect actual production conditions rather than an
  in-memory, single-process approximation.
- **Wire the recommended configuration into `DefaultApplicationContextFactory`**
  (the composition root) once a real embedding model and re-ranker are in
  place and re-benchmarked — today's recommendation (`bm25`) is an honest
  reflection of the *fake* embedding/re-ranking limitation above, not a
  production recommendation to skip vector/hybrid/re-ranking.
- **Track latency under concurrent load**, not just single-request timing —
  the current latency numbers are useful for spotting pipeline-stage
  regressions (e.g. re-ranking adding meaningfully more end-to-end latency
  than hybrid alone, visible in §6), not for capacity planning.
- **Ranking metrics (MRR is already covered; NDCG is not)** — see
  `docs/evaluation.md` §9 for the pre-existing note on this gap.

## 9. Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm validate:evaluation:production-benchmark` | `tsx app/legal/evaluation/runProductionBenchmarkValidation.ts` | Phase 30 Task 1: validates `runProductionBenchmark` across BM25/Vector/Hybrid/Re-ranked Hybrid — quality/grounding match direct benchmark calls, latency is non-negative, repeated runs are deterministic except timing. |
| `pnpm validate:evaluation:final-benchmark-report` | `tsx app/legal/evaluation/runFinalBenchmarkReportValidation.ts` | Phase 30 Task 2: validates `runFinalBenchmarkReport` — production benchmark results are unchanged from a direct `runProductionBenchmark` call, the recommended configuration selection is deterministic, and the whole report is deterministic except for measured timing values. Prints the report reproduced in §6. |

Related benchmark scripts from earlier phases (still passing unchanged, and
exercised by this report's underlying `runProductionBenchmark` call):
`pnpm validate:evaluation:bm25-benchmark`, `validate:evaluation:vector-benchmark`,
`validate:evaluation:hybrid-benchmark`, `validate:evaluation:reranking-benchmark`,
`validate:evaluation:grounding`.
