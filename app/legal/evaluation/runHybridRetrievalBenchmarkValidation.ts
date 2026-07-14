import type { LegalDocument } from "../domain";
import {
  BatchChunkEmbeddingPipeline,
  BatchEmbeddingService,
  ChunkEmbeddingPipeline,
  EmbeddingService,
  FakeEmbeddingProvider,
  SingleChunkChunkingService,
} from "../embedding";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import { DefaultSearchResultFilter } from "../search/DefaultSearchResultFilter";
import { HybridSearchEngine } from "../search/HybridSearchEngine";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import { OpenSearchVectorSearchEngine } from "../search/opensearch/OpenSearchVectorSearchEngine";
import { ReciprocalRankFusionStrategy } from "../search/ReciprocalRankFusionStrategy";
import { ScoreDescendingSearchResultSorter } from "../search/ScoreDescendingSearchResultSorter";
import { runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import {
  compareBm25BenchmarkVariants,
  formatBm25RetrievalBenchmarkComparison,
} from "./Bm25RetrievalBenchmarkComparator";
import { selectBestHybridRrfCandidate, tuneHybridRrfK } from "./HybridRetrievalBenchmark";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";

const BM25_ONLY_INDEX_NAME = "public-law-ai-hybrid-benchmark-bm25-only";
const HYBRID_INDEX_NAME = "public-law-ai-hybrid-benchmark-hybrid";
const BM25_LABEL = "bm25";
const VECTOR_LABEL = "vector";
// Spans from RRF's most rank-sensitive setting (k=1) up to
// ReciprocalRankFusionStrategy's own documented default (k=60) — a small,
// deterministic candidate set, not an exhaustive search.
const RRF_K_CANDIDATES = [1, 5, 10, 30, 60];

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function buildHybridReadyClient(): Promise<{
  client: FakeOpenSearchClient;
  config: OpenSearchConfig;
  embeddingProvider: FakeEmbeddingProvider;
}> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = { node: "http://fake-opensearch:9200", indexName: HYBRID_INDEX_NAME };
  await new OpenSearchIndexManager(client, config).ensureLegalIndex();

  const embeddingProvider = new FakeEmbeddingProvider();
  const batchChunkEmbeddingPipeline = new BatchChunkEmbeddingPipeline(
    new ChunkEmbeddingPipeline(
      new SingleChunkChunkingService(),
      new BatchEmbeddingService(new EmbeddingService(embeddingProvider)),
    ),
  );
  const vectors = await batchChunkEmbeddingPipeline.embedDocuments(REAL_ARTICLE_DOCUMENTS);
  const vectorById = new Map(vectors.map((vector) => [vector.id, vector.vector]));

  const indexer = new OpenSearchLegalDocumentIndexer(client, config);
  for (const document of REAL_ARTICLE_DOCUMENTS) {
    await indexer.indexWithEmbedding(document, vectorById.get(document.id)!);
  }

  return { client, config, embeddingProvider };
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: OpenSearch is replaced with FakeOpenSearchClient. " +
      "Runtime, Composition, Prompt, BM25 query configuration, vector similarity configuration, " +
      "SearchEngine interfaces, evaluation metric logic, and the AI Provider are never modified. " +
      "HybridSearchEngine/ReciprocalRankFusionStrategy are exercised, never reimplemented.",
  );

  const { client, config, embeddingProvider } = await buildHybridReadyClient();
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);

  const bm25Engine = new OpenSearchSearchEngine(client, config);
  const vectorEngine = new OpenSearchVectorSearchEngine(client, config, embeddingProvider);
  const bm25Retriever: Retriever = new SearchEngineRetriever(bm25Engine);
  const vectorRetriever: Retriever = new SearchEngineRetriever(vectorEngine);

  console.log("[evaluation] Benchmarking BM25 and Vector retrieval against RAG_EVALUATION_DATASET...");
  const bm25Result = await runBm25RetrievalBenchmarkVariant(BM25_LABEL, bm25Retriever, RAG_EVALUATION_DATASET, repository);
  const vectorResult = await runBm25RetrievalBenchmarkVariant(VECTOR_LABEL, vectorRetriever, RAG_EVALUATION_DATASET, repository);

  console.log(
    "[evaluation] Checking BM25 retrieval is unaffected by hybrid wiring (documents also carrying an embedding field)...",
  );
  const bm25OnlyClient = new FakeOpenSearchClient();
  const bm25OnlyConfig: OpenSearchConfig = { node: "http://fake-opensearch:9200", indexName: BM25_ONLY_INDEX_NAME };
  await new OpenSearchIndexManager(bm25OnlyClient, bm25OnlyConfig).ensureLegalIndex();
  await new OpenSearchLegalDocumentIndexer(bm25OnlyClient, bm25OnlyConfig).indexAll(REAL_ARTICLE_DOCUMENTS);
  const bm25OnlyResult = await runBm25RetrievalBenchmarkVariant(
    BM25_LABEL,
    new SearchEngineRetriever(new OpenSearchSearchEngine(bm25OnlyClient, bm25OnlyConfig)),
    RAG_EVALUATION_DATASET,
    repository,
  );
  assertEqual(
    JSON.stringify(bm25OnlyResult),
    JSON.stringify(bm25Result),
    "expected BM25 retrieval results to be identical on a keyword-only index and on the hybrid-ready (vector-augmented) index",
  );

  function buildHybridRetriever(k: number): Retriever {
    return new SearchEngineRetriever(
      new HybridSearchEngine(
        [
          { engine: bm25Engine, source: "opensearch" },
          { engine: vectorEngine, source: "opensearch" },
        ],
        new DefaultSearchResultFilter(),
        new ReciprocalRankFusionStrategy(k),
        new ScoreDescendingSearchResultSorter(),
      ),
    );
  }

  console.log(`[evaluation] Tuning RRF k over candidates [${RRF_K_CANDIDATES.join(", ")}]...`);
  const tuning = await tuneHybridRrfK(RRF_K_CANDIDATES, buildHybridRetriever, RAG_EVALUATION_DATASET, repository);
  for (const candidate of tuning.candidates) {
    console.log(
      `  k=${candidate.k}: hitRate=${candidate.variant.metrics.hitRate.toFixed(4)} ` +
        `mrr=${candidate.variant.metrics.mrr.toFixed(4)} failures=${candidate.variant.failureReport.failureCount}`,
    );
  }
  console.log(`[evaluation] Selected RRF k=${tuning.best.k} (see selectBestHybridRrfCandidate's rule).`);

  for (const candidate of tuning.candidates) {
    const isBest = candidate.k === tuning.best.k;
    const hitRateNotBetter = candidate.variant.metrics.hitRate <= tuning.best.variant.metrics.hitRate;
    const failuresTieBreak =
      candidate.variant.metrics.hitRate < tuning.best.variant.metrics.hitRate ||
      candidate.variant.failureReport.failureCount >= tuning.best.variant.failureReport.failureCount;
    const mrrTieBreak =
      candidate.variant.metrics.hitRate < tuning.best.variant.metrics.hitRate ||
      candidate.variant.failureReport.failureCount > tuning.best.variant.failureReport.failureCount ||
      candidate.variant.metrics.mrr <= tuning.best.variant.metrics.mrr;
    assertTruthy(
      isBest || (hitRateNotBetter && failuresTieBreak && mrrTieBreak),
      `expected selectBestHybridRrfCandidate's chosen k=${tuning.best.k} to dominate candidate k=${candidate.k} under the documented rule`,
    );
  }

  const hybridResult = tuning.best.variant;

  console.log("[evaluation] Comparing hybrid retrieval (RRF-fused) against BM25 and Vector baselines...");
  const comparisonVsBm25 = compareBm25BenchmarkVariants(bm25Result, hybridResult);
  const comparisonVsVector = compareBm25BenchmarkVariants(vectorResult, hybridResult);
  console.log(formatBm25RetrievalBenchmarkComparison(comparisonVsBm25));
  console.log("");
  console.log(formatBm25RetrievalBenchmarkComparison(comparisonVsVector));

  assertEqual(comparisonVsBm25.metricDeltas.length, 5, "expected all five retrieval metrics to be compared against BM25");
  assertEqual(comparisonVsVector.metricDeltas.length, 5, "expected all five retrieval metrics to be compared against Vector");
  assertTruthy(Number.isInteger(comparisonVsBm25.failureCountDelta), "expected failureCountDelta (vs BM25) to be an integer");
  assertTruthy(Number.isInteger(comparisonVsVector.failureCountDelta), "expected failureCountDelta (vs Vector) to be an integer");

  console.log("[evaluation] Checking the RRF tuning sweep is deterministic across repeated runs...");
  const tuningRerun = await tuneHybridRrfK(RRF_K_CANDIDATES, buildHybridRetriever, RAG_EVALUATION_DATASET, repository);
  assertEqual(
    JSON.stringify(tuning),
    JSON.stringify(tuningRerun),
    "expected the RRF k tuning sweep to be deterministic across repeated runs",
  );

  console.log("[evaluation] Checking the hybrid benchmark variant is deterministic across repeated runs...");
  const hybridResultRerun = await runBm25RetrievalBenchmarkVariant(
    `hybrid-k${tuning.best.k}`,
    buildHybridRetriever(tuning.best.k),
    RAG_EVALUATION_DATASET,
    repository,
  );
  assertEqual(
    JSON.stringify(hybridResult),
    JSON.stringify(hybridResultRerun),
    "expected the selected hybrid benchmark variant to be deterministic across repeated runs",
  );

  console.log("[evaluation] Checking metric comparisons are reproducible...");
  const comparisonVsBm25Rerun = compareBm25BenchmarkVariants(bm25Result, hybridResult);
  const comparisonVsVectorRerun = compareBm25BenchmarkVariants(vectorResult, hybridResult);
  assertEqual(
    JSON.stringify(comparisonVsBm25),
    JSON.stringify(comparisonVsBm25Rerun),
    "expected the hybrid-vs-BM25 comparison to be reproducible",
  );
  assertEqual(
    JSON.stringify(comparisonVsVector),
    JSON.stringify(comparisonVsVectorRerun),
    "expected the hybrid-vs-Vector comparison to be reproducible",
  );

  assertTruthy(
    selectBestHybridRrfCandidate(tuning.candidates).k === tuning.best.k,
    "expected selectBestHybridRrfCandidate to be a pure, deterministic function of its input candidates",
  );

  console.log("Hybrid retrieval benchmark validation succeeded.");
}

main();
