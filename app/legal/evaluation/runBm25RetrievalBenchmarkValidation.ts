import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import {
  buildBm25BenchmarkVariantResult,
  runBm25RetrievalBenchmarkVariant,
} from "./Bm25RetrievalBenchmark";
import {
  compareBm25BenchmarkVariants,
  formatBm25RetrievalBenchmarkComparison,
} from "./Bm25RetrievalBenchmarkComparator";
import { LegacyBm25SearchEngine } from "./LegacyBm25SearchEngine";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";
import { analyzeRetrievalFailures } from "./RetrievalFailureAnalyzer";
import { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";

const INDEX_NAME = "public-law-ai-bm25-retrieval-benchmark";
const EPSILON = 1e-9;
const LEGACY_LABEL = "bm25-legacy";
const OPTIMIZED_LABEL = "bm25-optimized";

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

async function buildIndexedClient(): Promise<{
  client: FakeOpenSearchClient;
  config: OpenSearchConfig;
}> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: INDEX_NAME,
  };

  await new OpenSearchIndexManager(client, config).ensureLegalIndex();
  await new OpenSearchLegalDocumentIndexer(client, config).indexAll(REAL_ARTICLE_DOCUMENTS);

  return { client, config };
}

/**
 * Proves runBm25RetrievalBenchmarkVariant produces exactly what
 * buildRetrievalMetricsReport/buildRetrievalFailureReport produce from the
 * same underlying evaluator output — no divergent/duplicated metric logic
 * hiding inside the benchmark's own composition.
 */
async function validateNoDuplicatedMetricLogic(
  retriever: Retriever,
  repository: LegalDocumentRepository,
): Promise<void> {
  const actual = await runBm25RetrievalBenchmarkVariant(
    OPTIMIZED_LABEL,
    retriever,
    RAG_EVALUATION_DATASET,
    repository,
  );

  const retrievalSummary = await new RetrievalMetricsEvaluationRunner(retriever).runMany(
    RAG_EVALUATION_DATASET,
  );
  const failureAnalyses = await analyzeRetrievalFailures(RAG_EVALUATION_DATASET, retriever, repository);
  const expected = buildBm25BenchmarkVariantResult(
    OPTIMIZED_LABEL,
    RAG_EVALUATION_DATASET,
    retrievalSummary.results,
    failureAnalyses,
  );

  assertEqual(
    JSON.stringify(actual),
    JSON.stringify(expected),
    "runBm25RetrievalBenchmarkVariant must produce exactly what buildRetrievalMetricsReport/buildRetrievalFailureReport produce from the same evaluator output",
  );
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: OpenSearch is replaced with FakeOpenSearchClient. " +
      "This benchmark only measures — OpenSearch query configuration, FakeOpenSearchClient scoring, " +
      "Retriever/SearchEngine interfaces, Runtime, Composition, Prompt, and the AI Provider are never modified.",
  );

  const { client, config } = await buildIndexedClient();
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);

  // Legacy: the frozen pre-Phase-26 multi_match shape (LegacyBm25SearchEngine).
  // Optimized: OpenSearchSearchEngine + buildOpenSearchKeywordSearchBody, the
  // real, unmodified production retrieval path.
  const legacyRetriever: Retriever = new SearchEngineRetriever(
    new LegacyBm25SearchEngine(client, config),
  );
  const optimizedRetriever: Retriever = new SearchEngineRetriever(
    new OpenSearchSearchEngine(client, config),
  );

  console.log("[evaluation] Checking the benchmark's composition duplicates no metric logic...");
  await validateNoDuplicatedMetricLogic(optimizedRetriever, repository);

  console.log("[evaluation] Running the BM25 retrieval benchmark (legacy vs. optimized) against RAG_EVALUATION_DATASET...");
  const baseline = await runBm25RetrievalBenchmarkVariant(
    LEGACY_LABEL,
    legacyRetriever,
    RAG_EVALUATION_DATASET,
    repository,
  );
  const current = await runBm25RetrievalBenchmarkVariant(
    OPTIMIZED_LABEL,
    optimizedRetriever,
    RAG_EVALUATION_DATASET,
    repository,
  );
  const comparison = compareBm25BenchmarkVariants(baseline, current);

  console.log(formatBm25RetrievalBenchmarkComparison(comparison));

  console.log("[evaluation] Checking the benchmark is deterministic across repeated runs...");
  const baselineRerun = await runBm25RetrievalBenchmarkVariant(
    LEGACY_LABEL,
    legacyRetriever,
    RAG_EVALUATION_DATASET,
    repository,
  );
  const currentRerun = await runBm25RetrievalBenchmarkVariant(
    OPTIMIZED_LABEL,
    optimizedRetriever,
    RAG_EVALUATION_DATASET,
    repository,
  );
  assertEqual(
    JSON.stringify(baseline),
    JSON.stringify(baselineRerun),
    "expected the legacy benchmark variant to be deterministic across repeated runs",
  );
  assertEqual(
    JSON.stringify(current),
    JSON.stringify(currentRerun),
    "expected the optimized benchmark variant to be deterministic across repeated runs",
  );

  console.log("[evaluation] Checking no retrieval metric regressed...");
  for (const delta of comparison.metricDeltas) {
    assertTruthy(
      delta.currentScore >= delta.baselineScore - EPSILON,
      `expected ${delta.metricName} not to regress versus the legacy baseline`,
    );
  }
  assertTruthy(
    comparison.failureCountDelta <= 0,
    "expected retrieval failure count not to increase versus the legacy baseline",
  );

  console.log("[evaluation] Checking at least one metric strictly improved...");
  assertTruthy(
    comparison.metricDeltas.some((delta) => delta.delta > EPSILON) || comparison.failureCountDelta < 0,
    "expected the optimized BM25 query to strictly improve at least one retrieval metric or reduce failures",
  );

  console.log("BM25 retrieval benchmark validation succeeded.");
}

main();
