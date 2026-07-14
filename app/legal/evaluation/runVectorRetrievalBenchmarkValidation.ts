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
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import { OpenSearchVectorSearchEngine } from "../search/opensearch/OpenSearchVectorSearchEngine";
import {
  compareBm25BenchmarkVariants,
  formatBm25RetrievalBenchmarkComparison,
} from "./Bm25RetrievalBenchmarkComparator";
import { runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";

const BM25_INDEX_NAME = "public-law-ai-vector-benchmark-bm25";
const VECTOR_INDEX_NAME = "public-law-ai-vector-benchmark-vector";
const BM25_LABEL = "bm25";
const VECTOR_LABEL = "vector";

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

function assertUnitInterval(value: number, message: string): void {
  assertTruthy(
    Number.isFinite(value) && value >= 0 && value <= 1,
    `${message}: expected a value in [0, 1], got ${value}`,
  );
}

/**
 * Indexes REAL_ARTICLE_DOCUMENTS keyword-only (existing `.index()`, Phase <27
 * unmodified) into one FakeOpenSearchClient, and separately keyword+vector
 * (Phase 27 Task 1's `.indexWithEmbedding()`) into another. Comparing BM25
 * search against both proves BM25 scoring is unaffected by documents also
 * carrying an `embedding` field.
 */
async function buildIndexedClients(): Promise<{
  keywordOnlyClient: FakeOpenSearchClient;
  keywordOnlyConfig: OpenSearchConfig;
  vectorClient: FakeOpenSearchClient;
  vectorConfig: OpenSearchConfig;
  embeddingProvider: FakeEmbeddingProvider;
}> {
  const keywordOnlyClient = new FakeOpenSearchClient();
  const keywordOnlyConfig: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: BM25_INDEX_NAME,
  };
  await new OpenSearchIndexManager(keywordOnlyClient, keywordOnlyConfig).ensureLegalIndex();
  await new OpenSearchLegalDocumentIndexer(keywordOnlyClient, keywordOnlyConfig).indexAll(
    REAL_ARTICLE_DOCUMENTS,
  );

  const vectorClient = new FakeOpenSearchClient();
  const vectorConfig: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: VECTOR_INDEX_NAME,
  };
  await new OpenSearchIndexManager(vectorClient, vectorConfig).ensureLegalIndex();

  const embeddingProvider = new FakeEmbeddingProvider();
  const batchChunkEmbeddingPipeline = new BatchChunkEmbeddingPipeline(
    new ChunkEmbeddingPipeline(
      new SingleChunkChunkingService(),
      new BatchEmbeddingService(new EmbeddingService(embeddingProvider)),
    ),
  );
  const vectors = await batchChunkEmbeddingPipeline.embedDocuments(REAL_ARTICLE_DOCUMENTS);
  const vectorById = new Map(vectors.map((vector) => [vector.id, vector.vector]));

  const vectorIndexer = new OpenSearchLegalDocumentIndexer(vectorClient, vectorConfig);
  for (const document of REAL_ARTICLE_DOCUMENTS) {
    const embedding = vectorById.get(document.id);
    assertTruthy(embedding, `expected an embedding for document "${document.id}"`);
    await vectorIndexer.indexWithEmbedding(document, embedding!);
  }

  return { keywordOnlyClient, keywordOnlyConfig, vectorClient, vectorConfig, embeddingProvider };
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: OpenSearch is replaced with FakeOpenSearchClient. " +
      "Runtime, Composition, Prompt, BM25 query configuration, SearchEngine interfaces, evaluation " +
      "metric logic, and the AI Provider are never modified.",
  );

  const { keywordOnlyClient, keywordOnlyConfig, vectorClient, vectorConfig, embeddingProvider } =
    await buildIndexedClients();
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);

  const bm25RetrieverOnKeywordOnlyIndex: Retriever = new SearchEngineRetriever(
    new OpenSearchSearchEngine(keywordOnlyClient, keywordOnlyConfig),
  );
  const bm25RetrieverOnVectorIndex: Retriever = new SearchEngineRetriever(
    new OpenSearchSearchEngine(vectorClient, vectorConfig),
  );
  const vectorRetriever: Retriever = new SearchEngineRetriever(
    new OpenSearchVectorSearchEngine(vectorClient, vectorConfig, embeddingProvider),
  );

  console.log(
    "[evaluation] Checking BM25 retrieval is unaffected by documents also carrying an embedding field...",
  );
  const bm25OnKeywordOnly = await runBm25RetrievalBenchmarkVariant(
    BM25_LABEL,
    bm25RetrieverOnKeywordOnlyIndex,
    RAG_EVALUATION_DATASET,
    repository,
  );
  const bm25OnVectorIndex = await runBm25RetrievalBenchmarkVariant(
    BM25_LABEL,
    bm25RetrieverOnVectorIndex,
    RAG_EVALUATION_DATASET,
    repository,
  );
  assertEqual(
    JSON.stringify(bm25OnKeywordOnly),
    JSON.stringify(bm25OnVectorIndex),
    "expected BM25 retrieval results to be identical whether or not indexed documents also carry an embedding field",
  );

  console.log("[evaluation] Running the vector retrieval benchmark against RAG_EVALUATION_DATASET...");
  const vectorResult = await runBm25RetrievalBenchmarkVariant(
    VECTOR_LABEL,
    vectorRetriever,
    RAG_EVALUATION_DATASET,
    repository,
  );

  console.log("[evaluation] Comparing vector retrieval against the BM25 baseline...");
  const comparison = compareBm25BenchmarkVariants(bm25OnVectorIndex, vectorResult);
  console.log(formatBm25RetrievalBenchmarkComparison(comparison));

  assertEqual(comparison.metricDeltas.length, 5, "expected all five retrieval metrics to be compared");
  for (const delta of comparison.metricDeltas) {
    assertUnitInterval(delta.baselineScore, `${delta.metricName} baseline score`);
    assertUnitInterval(delta.currentScore, `${delta.metricName} vector score`);
  }
  assertTruthy(
    Number.isInteger(comparison.failureCountDelta),
    "expected failureCountDelta to be an integer",
  );

  console.log("[evaluation] Checking vector retrieval is deterministic across repeated runs...");
  const vectorResultRerun = await runBm25RetrievalBenchmarkVariant(
    VECTOR_LABEL,
    vectorRetriever,
    RAG_EVALUATION_DATASET,
    repository,
  );
  assertEqual(
    JSON.stringify(vectorResult),
    JSON.stringify(vectorResultRerun),
    "expected the vector benchmark variant to be deterministic across repeated runs",
  );

  console.log("Vector retrieval benchmark validation succeeded.");
}

main();
