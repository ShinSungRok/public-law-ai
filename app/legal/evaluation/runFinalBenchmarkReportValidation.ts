import type { AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMCompletionRequest, LLMProvider } from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import {
  BatchChunkEmbeddingPipeline,
  BatchEmbeddingService,
  ChunkEmbeddingPipeline,
  EmbeddingService,
  FakeEmbeddingProvider,
  SingleChunkChunkingService,
} from "../embedding";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
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
import type { SearchEngine } from "../search/SearchEngine";
import {
  formatFinalBenchmarkReport,
  runFinalBenchmarkReport,
  selectRecommendedProductionVariant,
} from "./FinalBenchmarkReport";
import { runProductionBenchmark, type ProductionBenchmarkVariantConfig } from "./ProductionBenchmark";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";

const INDEX_NAME = "public-law-ai-final-benchmark-report";
const LATENCY_RUN_COUNT = 3;
const RE_RANKING_CANDIDATE_TOP_K = 20;
const RE_RANKING_FINAL_TOP_N = 5;

const GROUNDED_MARKER = "Retrieved legal context:";
const RETRIEVED_TEXT_LINE_PATTERN = /^Text: (.+)$/gm;

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

/** Same deterministic echo contract as runProductionBenchmarkValidation.ts's GroundedEchoFakeLLMProvider — no real AI Provider call. */
class GroundedEchoFakeLLMProvider implements LLMProvider {
  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    const isGrounded = request.prompt.includes(GROUNDED_MARKER);
    const retrievedTextLines = [...request.prompt.matchAll(RETRIEVED_TEXT_LINE_PATTERN)].map(
      (match) => match[1],
    );

    return (async function* (): AIResponseStream {
      if (!isGrounded) {
        return;
      }
      yield { text: retrievedTextLines.join(" ") };
    })();
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

function buildRagAnswerUseCase(retriever: Retriever): GenerateRagAnswerUseCase {
  return new GenerateRagAnswerUseCase(
    retriever,
    new GroundedEchoFakeLLMProvider(),
    new RagAnswerBuilder(new DefaultCitationExtractor()),
  );
}

async function buildVariantConfigs(): Promise<ProductionBenchmarkVariantConfig[]> {
  const { client, config, embeddingProvider } = await buildHybridReadyClient();

  const bm25Engine = new OpenSearchSearchEngine(client, config);
  const vectorEngine = new OpenSearchVectorSearchEngine(client, config, embeddingProvider);
  const hybridEngine: SearchEngine = new HybridSearchEngine([
    { engine: bm25Engine, source: "opensearch" },
    { engine: vectorEngine, source: "opensearch" },
  ]);
  const reRankedEngine: SearchEngine = new ReRankingSearchEngine(hybridEngine, new FakeReRanker(), {
    candidateTopK: RE_RANKING_CANDIDATE_TOP_K,
    finalTopN: RE_RANKING_FINAL_TOP_N,
  });

  const bm25Retriever: Retriever = new SearchEngineRetriever(bm25Engine);
  const vectorRetriever: Retriever = new SearchEngineRetriever(vectorEngine);
  const hybridRetriever: Retriever = new SearchEngineRetriever(hybridEngine);
  const reRankedRetriever: Retriever = new SearchEngineRetriever(reRankedEngine);

  return [
    { label: "bm25", retriever: bm25Retriever, ragAnswerUseCase: buildRagAnswerUseCase(bm25Retriever) },
    { label: "vector", retriever: vectorRetriever, ragAnswerUseCase: buildRagAnswerUseCase(vectorRetriever) },
    { label: "hybrid", retriever: hybridRetriever, ragAnswerUseCase: buildRagAnswerUseCase(hybridRetriever) },
    {
      label: "reranked-hybrid",
      retriever: reRankedRetriever,
      ragAnswerUseCase: buildRagAnswerUseCase(reRankedRetriever),
    },
  ];
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: OpenSearch is replaced with FakeOpenSearchClient, and " +
      "grounding uses a deterministic fake LLM provider -- no real AI Provider call. Runtime, Composition, " +
      "Prompt, BM25 query configuration, vector similarity configuration, Hybrid fusion logic, the " +
      "re-ranking algorithm, Retriever, existing evaluation metric logic, and the AI Provider are never " +
      "modified. Every number in this report is produced by runProductionBenchmark (Phase 30 Task 1, " +
      "unmodified) -- FinalBenchmarkReport only selects a recommendation and attaches known limitations.",
  );

  // Two independently indexed/wired sets of variant configs (same fixtures,
  // separate FakeOpenSearchClient instances) so the "existing production
  // benchmark results remain unchanged" check below is a genuine comparison
  // against a fresh, unrelated runProductionBenchmark call, not the same
  // object graph re-read.
  const finalReportVariantConfigs = await buildVariantConfigs();
  const directVariantConfigs = await buildVariantConfigs();

  console.log("[evaluation] Running the final benchmark report across BM25, Vector, Hybrid, and Re-ranked Hybrid...");
  const finalReport = await runFinalBenchmarkReport(
    finalReportVariantConfigs,
    RAG_EVALUATION_DATASET,
    new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS),
    { latencyRunCount: LATENCY_RUN_COUNT },
  );
  console.log(formatFinalBenchmarkReport(finalReport));

  assertEqual(finalReport.productionBenchmark.variants.length, 4, "expected exactly four benchmarked variants");
  assertEqual(
    finalReport.productionBenchmark.variants.map((variant) => variant.label).join(","),
    "bm25,vector,hybrid,reranked-hybrid",
    "expected variants in BM25, Vector, Hybrid, Re-ranked Hybrid order",
  );
  assertTruthy(finalReport.limitations.length > 0, "expected documented benchmark limitations");
  for (const limitation of finalReport.limitations) {
    assertTruthy(limitation.trim().length > 0, "expected every limitation entry to be non-empty");
  }
  assertTruthy(
    finalReport.limitations.some((limitation) => /fake/i.test(limitation) && /embedding/i.test(limitation)),
    "expected the fake-embeddings limitation to be documented",
  );
  assertTruthy(
    finalReport.limitations.some((limitation) => /fake/i.test(limitation) && /re-?rank/i.test(limitation)),
    "expected the fake-re-ranking limitation to be documented",
  );

  console.log("[evaluation] Checking existing production benchmark results remain unchanged (Phase 30 Task 1, unmodified)...");
  const directProductionBenchmark = await runProductionBenchmark(
    directVariantConfigs,
    RAG_EVALUATION_DATASET,
    new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS),
    { latencyRunCount: LATENCY_RUN_COUNT },
  );
  for (const [index, variant] of finalReport.productionBenchmark.variants.entries()) {
    const directVariant = directProductionBenchmark.variants[index];
    assertEqual(
      JSON.stringify(variant.quality),
      JSON.stringify(directVariant.quality),
      `expected "${variant.label}" quality to match an unmodified, independent runProductionBenchmark call`,
    );
    assertEqual(
      JSON.stringify(variant.grounding),
      JSON.stringify(directVariant.grounding),
      `expected "${variant.label}" grounding to match an unmodified, independent runProductionBenchmark call`,
    );
  }

  console.log("[evaluation] Checking the recommended configuration selection is deterministic...");
  const recommendedAgain = selectRecommendedProductionVariant(finalReport.productionBenchmark.variants);
  assertEqual(
    recommendedAgain.label,
    finalReport.recommendedConfiguration.label,
    "expected selectRecommendedProductionVariant to be a pure, deterministic function of its input variants",
  );

  console.log("[evaluation] Checking the final report is deterministic except for measured timing values...");
  const rerunVariantConfigs = await buildVariantConfigs();
  const finalReportRerun = await runFinalBenchmarkReport(
    rerunVariantConfigs,
    RAG_EVALUATION_DATASET,
    new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS),
    { latencyRunCount: LATENCY_RUN_COUNT },
  );
  assertEqual(
    finalReport.recommendedConfiguration.label,
    finalReportRerun.recommendedConfiguration.label,
    "expected the recommended configuration label to be identical across repeated final report runs",
  );
  assertEqual(
    JSON.stringify(finalReport.limitations),
    JSON.stringify(finalReportRerun.limitations),
    "expected documented limitations to be identical across repeated final report runs",
  );
  for (const [index, variant] of finalReport.productionBenchmark.variants.entries()) {
    const rerunVariant = finalReportRerun.productionBenchmark.variants[index];
    assertEqual(
      JSON.stringify(variant.quality),
      JSON.stringify(rerunVariant.quality),
      `expected "${variant.label}" quality to be identical across repeated final report runs`,
    );
    assertEqual(
      JSON.stringify(variant.grounding),
      JSON.stringify(rerunVariant.grounding),
      `expected "${variant.label}" grounding to be identical across repeated final report runs`,
    );
    assertTruthy(
      variant.retrievalLatency.averageMs >= 0 && rerunVariant.retrievalLatency.averageMs >= 0,
      `expected "${variant.label}" retrieval latency to stay non-negative across repeated runs (timing values themselves may differ)`,
    );
  }

  console.log("Final benchmark report validation succeeded.");
}

main();
