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

Two benchmark runs exist, sharing everything except the embedding provider:
a CI-safe run with deterministic fake embeddings (§6.1), and a run against
Google's real `gemini-embedding-001` model (§6.2). Holding every other
variable fixed (same 29-case dataset, same corpus, same `FakeOpenSearchClient`,
same `FakeReRanker`, same echo fake LLM) makes any quality difference between
the two runs attributable to embedding quality, not a second changed variable.

### 6.1 Fake-embedding results (CI validation)

Produced by `pnpm validate:evaluation:final-benchmark-report`
(`app/legal/evaluation/runFinalBenchmarkReportValidation.ts`) against the 29
in-memory `RAG_EVALUATION_DATASET` cases and `REAL_ARTICLE_DOCUMENTS` corpus
(real 개인정보 보호법/형법 statute article text), with
`FakeOpenSearchClient`/`FakeEmbeddingProvider`/a deterministic echo fake LLM
provider — no external services, safe to run in CI on every change. Latency
is average/min/max over 3 timed passes per variant; re-ranking uses
`candidateTopK=20, finalTopN=5` (the configuration Phase 29 Task 2's tuning
sweep favored).

| Variant | Hit Rate | Recall@1 | Recall@3 | Recall@5 | MRR | Failures | Context Coverage | Retrieval latency (avg) | End-to-end latency (avg) |
|---|---|---|---|---|---|---|---|---|---|
| BM25 | 100% | 73% | 85% | 85% | 0.80 | 4 | 100% | ~4–7ms | ~20–35ms |
| Vector | 73% | 15% | 38% | 46% | 0.30 | 14 | 73% | <1ms | ~8–12ms |
| Hybrid (RRF) | 100% | 62% | 73% | 81% | 0.69 | 5 | 100% | ~5–8ms | ~20–37ms |
| Re-ranked Hybrid | 81% | 62% | 77% | 81% | 0.69 | 5 | 81% | ~8–13ms | ~31–56ms |

(Exact figures vary run to run only in latency — see §8; quality/grounding
figures are deterministic and reproduced verbatim by the validation script.)

**Recommended configuration by this run: `bm25`.** BM25 and Hybrid tie on Hit
Rate (100%); BM25 wins the tie-break with fewer failures (4 vs. 5). As §6.2
confirms, this reflects the fake-embedding limitation below, not a claim that
BM25 outperforms vector/hybrid/re-ranked retrieval in production.

### 6.2 Real-embedding results (Gemini `gemini-embedding-001`, 768-dim)

Produced by `pnpm evaluation:real-embedding-benchmark`
(`app/legal/evaluation/runRealEmbeddingBenchmarkReport.ts`) — the same
dataset/corpus/`FakeOpenSearchClient`/`FakeReRanker`/echo-fake-LLM as §6.1,
with `GeminiEmbeddingProvider` in place of `FakeEmbeddingProvider`. This makes
real, metered Gemini API calls, so it is **not** part of `pnpm validate:*` or
CI — it's a report generated on demand. `latencyRunCount` is 1, not 3: each
additional timing pass costs one real Gemini API call per evaluation case per
vector-backed variant.

| Variant | Hit Rate | Recall@1 | Recall@3 | Recall@5 | MRR | Failures | Context Coverage | Retrieval latency (avg, n=1) | End-to-end latency (avg, n=1) |
|---|---|---|---|---|---|---|---|---|---|
| BM25 | 100% | 73% | 85% | 85% | 0.80 | 4 | 100% | 7.5ms | 34.1ms |
| Vector | 100% | 96% | 100% | 100% | 0.98 | 0 | 100% | 10466ms | 34328ms |
| Hybrid (RRF) | 100% | 73% | 85% | 96% | 0.81 | 1 | 100% | 11988ms | 35374ms |
| Re-ranked Hybrid | 96% | 73% | 88% | 96% | 0.82 | 1 | 96% | 11799ms | 34111ms |

**Recommended configuration by this run: `vector`.** Vector wins outright —
100% Hit Rate, 0 retrieval failures, MRR 0.98 — confirming §6.1's own caveat
that a real embedding model would close or reverse BM25's apparent lead.

Two results are worth calling out explicitly rather than letting the table
speak for itself:

- **Hybrid (RRF) underperforms Vector alone once embeddings are real.** With
  fake embeddings, mixing in BM25 helped (Hybrid beat Vector in §6.1) because
  Vector's ranking was near-random. With real embeddings, Vector's ranking is
  already close to perfect, and Reciprocal Rank Fusion gives BM25's weaker
  ranking equal voting weight — pulling a few correct top-1 results down the
  fused list (Hybrid's Recall@1 is 73%, the same as BM25's, versus Vector's
  96%). RRF fusion weighting, not just "add more signals," is itself a tuning
  question once the underlying signals are this different in quality.
- **The retrieval latency numbers are a single-process, sequential-call
  artifact, not a production per-request latency estimate.** Vector's
  ~10.5s "retrieval latency" is 29 sequential Gemini embedding API calls (one
  per evaluation case, ~350–400ms each) summed by this benchmark's single
  timed pass, not one request's latency. A single production query pays one
  embedding call (~350–400ms) versus BM25's ~4–7ms — a real, meaningful
  latency cost of vector/hybrid retrieval that should inform capacity
  planning, but it is not "10 seconds per request."

**Production decision: Hybrid stays the production default, not Vector.**
`DefaultApplicationContextFactory` wires Hybrid (BM25+vector via RRF)
whenever an `EmbeddingProvider` is configured, and was **not** switched to
vector-only despite this table's recommendation. Reasoning: this evaluation
set is 29 cases against a single
statute (개인정보 보호법) — real production traffic spans many statutes and
includes exact citation/article-number lookups where BM25's keyword matching
is a known strength that a 29-case, single-domain benchmark cannot stress.
Dropping keyword matching from production on the strength of one narrow
benchmark would trade a small, well-understood risk (RRF fusion weighting)
for a large, untested one (no keyword fallback at all). This is a deliberate
"the benchmark recommends X, we ship Y, here is why" decision, not an
oversight — and one to revisit once §8's expanded-dataset task is done.

## 7. Known limitations

§6.1's limitations are also surfaced programmatically via
`KNOWN_BENCHMARK_LIMITATIONS` (`app/legal/evaluation/FinalBenchmarkReport.ts`),
so every `FinalBenchmarkReport` carries these caveats alongside its numbers,
not only in this document:

- **Deterministic fake embeddings (§6.1 only).** `FakeEmbeddingProvider`
  produces a hash-derived vector per text, not output from a real embedding
  model. It has no notion of semantic similarity, so §6.1's
  Vector/Hybrid/Re-ranked-Hybrid quality numbers measure whether the
  *retrieval pipeline* (indexing, querying, fusion, re-ranking) is wired
  correctly — not whether real embeddings would rank documents well. This
  was the working hypothesis for why BM25 outperforms Vector/Hybrid in
  §6.1; §6.2 confirms it directly — a real embedding model (Gemini) does
  close and reverse that gap.
- **Deterministic fake re-ranking (both §6.1 and §6.2).** `FakeReRanker`
  scores candidates by exact query-term overlap against title+text, not a
  real cross-encoder or LLM-based re-ranker, in either run. Re-ranked Hybrid
  numbers prove `ReRankingSearchEngine`'s `candidateTopK`/`finalTopN`
  windowing and identity-preservation wiring is correct — they do not
  predict what a real re-ranking model would score, and §6.2's real
  embeddings make this limitation more visible, not less: Re-ranked Hybrid
  is now the only variant below 100% Hit Rate specifically because the fake
  re-ranker demotes some of Vector's already-correct top results.
- **Fake grounding (both runs).** Grounding metrics run against a
  deterministic echo fake `LLMProvider` (repeats the retrieved text
  verbatim), not a real AI Provider call, in either run — Grounded Answer /
  Citation Coverage measure the grounding *pipeline*, not real generation
  quality.
- **In-memory OpenSearch, small single-domain corpus (both runs).**
  `FakeOpenSearchClient` replaces a real OpenSearch cluster, and the corpus
  is `REAL_ARTICLE_DOCUMENTS` — 16 real statute articles from a single
  statute (개인정보 보호법), not the full 372-document production index. §6.2's
  "Vector beats Hybrid" and "vector should be the production default" signal
  comes from this same narrow corpus/dataset; see §6.2's production-decision
  note for why that signal alone isn't treated as sufficient to change the
  production default. Absolute latency numbers isolate pipeline overhead in
  a single Node process with no concurrent load — see §6.2's latency note
  for what the real-run numbers do and do not measure.

## 8. Future production extensions

- ~~Swap `FakeEmbeddingProvider` for a real embedding model~~ — **done**:
  `GeminiEmbeddingProvider` (`app/legal/embedding/GeminiEmbeddingProvider.ts`),
  results in §6.2.
- **Swap `FakeReRanker` for a real re-ranker** (a cross-encoder model, or an
  LLM-as-a-judge prompt) behind the same `ReRanker` interface — no change to
  `ReRankingSearchEngine` required. Still open; §7 shows this is now the
  more visible of the two remaining fakes.
- **Expand the evaluation dataset beyond a single statute domain
  (개인정보 보호법)** before treating §6.2's vector-over-hybrid result as
  sufficient evidence to change the production default — a 29-case,
  single-domain benchmark can't stress BM25's keyword/citation-matching
  strength the way multi-statute, multi-domain traffic would.
- **Re-run §6.2 against the real OpenSearch cluster and the full 372-document
  production index** (rather than `FakeOpenSearchClient` + the 16-article
  fixture) once the dataset above exists, to get latency and quality numbers
  that reflect actual production conditions.
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
| `pnpm validate:evaluation:final-benchmark-report` | `tsx app/legal/evaluation/runFinalBenchmarkReportValidation.ts` | Phase 30 Task 2: validates `runFinalBenchmarkReport` — production benchmark results are unchanged from a direct `runProductionBenchmark` call, the recommended configuration selection is deterministic, and the whole report is deterministic except for measured timing values. Prints the report reproduced in §6.1. |
| `pnpm evaluation:real-embedding-benchmark` | `tsx app/legal/evaluation/runRealEmbeddingBenchmarkReport.ts` | Not a `validate:*` script — makes real, metered Gemini API calls, so it's run on demand rather than in CI. Same benchmark shape as `runFinalBenchmarkReportValidation.ts` with `GeminiEmbeddingProvider` swapped in for `FakeEmbeddingProvider`. Prints the report reproduced in §6.2. |

Related benchmark scripts from earlier phases (still passing unchanged, and
exercised by this report's underlying `runProductionBenchmark` call):
`pnpm validate:evaluation:bm25-benchmark`, `validate:evaluation:vector-benchmark`,
`validate:evaluation:hybrid-benchmark`, `validate:evaluation:reranking-benchmark`,
`validate:evaluation:grounding`.
