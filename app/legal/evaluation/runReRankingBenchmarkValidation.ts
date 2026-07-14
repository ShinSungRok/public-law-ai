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
import { FakeReRanker } from "../search/FakeReRanker";
import { HybridSearchEngine } from "../search/HybridSearchEngine";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import { OpenSearchVectorSearchEngine } from "../search/opensearch/OpenSearchVectorSearchEngine";
import { ReRankingSearchEngine } from "../search/ReRankingSearchEngine";
import type { LegalDocument } from "../domain";
import { runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import {
  compareBm25BenchmarkVariants,
  formatBm25RetrievalBenchmarkComparison,
} from "./Bm25RetrievalBenchmarkComparator";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";
import type { ReRankingTuningCandidateConfig } from "./ReRankingBenchmark";
import { selectBestReRankingCandidate, tuneReRanking } from "./ReRankingBenchmark";

const INDEX_NAME = "public-law-ai-reranking-benchmark";
const BM25_LABEL = "bm25";
const HYBRID_LABEL = "hybrid";
// Small, deterministic candidate set: only pairs where finalTopN <=
// candidateTopK are meaningful (a re-ranker cannot promote more documents
// than it was given), so the full cross product stays small (6 configs).
const CANDIDATE_TOP_K_VALUES = [5, 10, 20];
const FINAL_TOP_N_VALUES = [3, 5];

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

function buildReRankingConfigs(): ReRankingTuningCandidateConfig[] {
  const configs: ReRankingTuningCandidateConfig[] = [];
  for (const candidateTopK of CANDIDATE_TOP_K_VALUES) {
    for (const finalTopN of FINAL_TOP_N_VALUES) {
      if (finalTopN <= candidateTopK) {
        configs.push({ candidateTopK, finalTopN });
      }
    }
  }
  return configs;
}

async function buildHybridReadyClient(): Promise<{
  client: FakeOpenSearchClient;
  config: OpenSearchConfig;
  embeddingProvider: FakeEmbeddingProvider;
}> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = { node: "http://fake-opensearch:9200", indexName: INDEX_NAME };
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
      "Hybrid fusion logic, the re-ranking algorithm, Retriever, evaluation metric logic, and the " +
      "AI Provider are never modified. ReRankingSearchEngine/FakeReRanker/HybridSearchEngine are " +
      "exercised through runBm25RetrievalBenchmarkVariant and compareBm25BenchmarkVariants (both " +
      "unmodified), never reimplemented.",
  );

  const { client, config, embeddingProvider } = await buildHybridReadyClient();
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);

  const bm25Engine = new OpenSearchSearchEngine(client, config);
  const vectorEngine = new OpenSearchVectorSearchEngine(client, config, embeddingProvider);
  const hybridEngine = new HybridSearchEngine([
    { engine: bm25Engine, source: "opensearch" },
    { engine: vectorEngine, source: "opensearch" },
  ]);

  const bm25Retriever: Retriever = new SearchEngineRetriever(bm25Engine);
  const hybridRetriever: Retriever = new SearchEngineRetriever(hybridEngine);

  console.log("[evaluation] Benchmarking BM25 and Hybrid retrieval against RAG_EVALUATION_DATASET...");
  const bm25Result = await runBm25RetrievalBenchmarkVariant(BM25_LABEL, bm25Retriever, RAG_EVALUATION_DATASET, repository);
  const hybridResult = await runBm25RetrievalBenchmarkVariant(HYBRID_LABEL, hybridRetriever, RAG_EVALUATION_DATASET, repository);

  function buildReRankingRetriever(candidateConfig: ReRankingTuningCandidateConfig): Retriever {
    return new SearchEngineRetriever(
      new ReRankingSearchEngine(hybridEngine, new FakeReRanker(), candidateConfig),
    );
  }

  const reRankingConfigs = buildReRankingConfigs();
  console.log(
    `[evaluation] Tuning re-ranking over (candidateTopK, finalTopN) candidates: ` +
      reRankingConfigs.map((c) => `(${c.candidateTopK},${c.finalTopN})`).join(", "),
  );
  const tuning = await tuneReRanking(reRankingConfigs, buildReRankingRetriever, RAG_EVALUATION_DATASET, repository);
  for (const candidate of tuning.candidates) {
    console.log(
      `  candidateTopK=${candidate.candidateTopK} finalTopN=${candidate.finalTopN}: ` +
        `hitRate=${candidate.variant.metrics.hitRate.toFixed(4)} mrr=${candidate.variant.metrics.mrr.toFixed(4)} ` +
        `failures=${candidate.variant.failureReport.failureCount}`,
    );
  }
  console.log(
    `[evaluation] Selected candidateTopK=${tuning.best.candidateTopK} finalTopN=${tuning.best.finalTopN} ` +
      "(see selectBestReRankingCandidate's rule).",
  );

  for (const candidate of tuning.candidates) {
    const isBest = candidate.candidateTopK === tuning.best.candidateTopK && candidate.finalTopN === tuning.best.finalTopN;
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
      `expected selectBestReRankingCandidate's chosen (${tuning.best.candidateTopK},${tuning.best.finalTopN}) to dominate ` +
        `candidate (${candidate.candidateTopK},${candidate.finalTopN}) under the documented rule`,
    );
  }

  const reRankedResult = tuning.best.variant;

  console.log("[evaluation] Comparing re-ranked hybrid retrieval against BM25 and Hybrid baselines...");
  const comparisonVsBm25 = compareBm25BenchmarkVariants(bm25Result, reRankedResult);
  const comparisonVsHybrid = compareBm25BenchmarkVariants(hybridResult, reRankedResult);
  console.log(formatBm25RetrievalBenchmarkComparison(comparisonVsBm25));
  console.log("");
  console.log(formatBm25RetrievalBenchmarkComparison(comparisonVsHybrid));

  assertEqual(comparisonVsBm25.metricDeltas.length, 5, "expected all five retrieval metrics to be compared against BM25");
  assertEqual(comparisonVsHybrid.metricDeltas.length, 5, "expected all five retrieval metrics to be compared against Hybrid");
  assertTruthy(Number.isInteger(comparisonVsBm25.failureCountDelta), "expected failureCountDelta (vs BM25) to be an integer");
  assertTruthy(Number.isInteger(comparisonVsHybrid.failureCountDelta), "expected failureCountDelta (vs Hybrid) to be an integer");

  console.log("[evaluation] Validating candidateTopK/finalTopN are honored directly by each tuned retriever...");
  const sampleQuery = RAG_EVALUATION_DATASET[0].query;
  for (const candidateConfig of reRankingConfigs) {
    const retriever = buildReRankingRetriever(candidateConfig);
    const result = await retriever.retrieve(sampleQuery);
    assertTruthy(
      result.documents.length <= candidateConfig.finalTopN,
      `expected at most finalTopN=${candidateConfig.finalTopN} documents for candidateTopK=${candidateConfig.candidateTopK}`,
    );
    const documentIds = result.documents.map((document) => document.document.id);
    assertEqual(
      new Set(documentIds).size,
      documentIds.length,
      `expected no duplicate documents for candidateTopK=${candidateConfig.candidateTopK}, finalTopN=${candidateConfig.finalTopN}`,
    );
  }
  console.log("[evaluation] candidateTopK/finalTopN constraints and duplicate-free output validated for every configuration.");

  console.log("[evaluation] Checking the re-ranking tuning sweep is deterministic across repeated runs...");
  const tuningRerun = await tuneReRanking(reRankingConfigs, buildReRankingRetriever, RAG_EVALUATION_DATASET, repository);
  assertEqual(
    JSON.stringify(tuning),
    JSON.stringify(tuningRerun),
    "expected the re-ranking tuning sweep to be deterministic across repeated runs",
  );

  console.log("[evaluation] Checking the selected re-ranking variant is deterministic across repeated runs...");
  const reRankedResultRerun = await runBm25RetrievalBenchmarkVariant(
    reRankedResult.label,
    buildReRankingRetriever({ candidateTopK: tuning.best.candidateTopK, finalTopN: tuning.best.finalTopN }),
    RAG_EVALUATION_DATASET,
    repository,
  );
  assertEqual(
    JSON.stringify(reRankedResult),
    JSON.stringify(reRankedResultRerun),
    "expected the selected re-ranking benchmark variant to be deterministic across repeated runs",
  );

  console.log("[evaluation] Checking metric comparisons are reproducible...");
  const comparisonVsBm25Rerun = compareBm25BenchmarkVariants(bm25Result, reRankedResult);
  const comparisonVsHybridRerun = compareBm25BenchmarkVariants(hybridResult, reRankedResult);
  assertEqual(
    JSON.stringify(comparisonVsBm25),
    JSON.stringify(comparisonVsBm25Rerun),
    "expected the re-ranked-vs-BM25 comparison to be reproducible",
  );
  assertEqual(
    JSON.stringify(comparisonVsHybrid),
    JSON.stringify(comparisonVsHybridRerun),
    "expected the re-ranked-vs-Hybrid comparison to be reproducible",
  );

  assertTruthy(
    selectBestReRankingCandidate(tuning.candidates).candidateTopK === tuning.best.candidateTopK &&
      selectBestReRankingCandidate(tuning.candidates).finalTopN === tuning.best.finalTopN,
    "expected selectBestReRankingCandidate to be a pure, deterministic function of its input candidates",
  );

  console.log("Re-ranking benchmark validation succeeded.");
}

main();
