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
import { runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";
import { buildGroundingMetricsReport } from "./GroundingMetricsReport";
import { GroundingMetricsEvaluationRunner } from "./GroundingMetricsEvaluationRunner";
import {
  formatProductionBenchmarkReport,
  runProductionBenchmark,
  type ProductionBenchmarkVariantConfig,
} from "./ProductionBenchmark";

const INDEX_NAME = "public-law-ai-production-benchmark";
const LATENCY_RUN_COUNT = 3;
// A fixed, already-validated re-ranking configuration (Phase 29 Task 2 found
// this class of configuration to score well) — not retuned here, since this
// task benchmarks the four retrieval variants, it does not re-optimize
// re-ranking.
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

/** Deterministic fake: echoes back the retrieved article text embedded in the prompt (same contract as runGroundingMetricsValidation.ts's GroundedEchoFakeLLMProvider), so grounding is measurable without any real AI Provider call. */
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

function assertNonNegativeLatency(stats: { averageMs: number; minMs: number; maxMs: number }, label: string): void {
  assertTruthy(Number.isFinite(stats.averageMs) && stats.averageMs >= 0, `${label} averageMs must be non-negative`);
  assertTruthy(Number.isFinite(stats.minMs) && stats.minMs >= 0, `${label} minMs must be non-negative`);
  assertTruthy(Number.isFinite(stats.maxMs) && stats.maxMs >= 0, `${label} maxMs must be non-negative`);
  assertTruthy(stats.minMs <= stats.averageMs, `${label} minMs must not exceed averageMs`);
  assertTruthy(stats.averageMs <= stats.maxMs, `${label} averageMs must not exceed maxMs`);
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

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: OpenSearch is replaced with FakeOpenSearchClient, and " +
      "grounding uses a deterministic fake LLM provider -- no real AI Provider call. Runtime, Composition, " +
      "Prompt, BM25 query configuration, vector similarity configuration, Hybrid fusion logic, the " +
      "re-ranking algorithm, Retriever, existing evaluation metric logic, and the AI Provider are never " +
      "modified. Every quality/grounding number is produced by runBm25RetrievalBenchmarkVariant / " +
      "GroundingMetricsEvaluationRunner / buildGroundingMetricsReport (all unmodified) through " +
      "ProductionBenchmark's orchestration, never recomputed by a second code path.",
  );

  const { client, config, embeddingProvider } = await buildHybridReadyClient();
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);

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

  const variantConfigs: ProductionBenchmarkVariantConfig[] = [
    { label: "bm25", retriever: bm25Retriever, ragAnswerUseCase: buildRagAnswerUseCase(bm25Retriever) },
    { label: "vector", retriever: vectorRetriever, ragAnswerUseCase: buildRagAnswerUseCase(vectorRetriever) },
    { label: "hybrid", retriever: hybridRetriever, ragAnswerUseCase: buildRagAnswerUseCase(hybridRetriever) },
    {
      label: "reranked-hybrid",
      retriever: reRankedRetriever,
      ragAnswerUseCase: buildRagAnswerUseCase(reRankedRetriever),
    },
  ];

  console.log("[evaluation] Running the production benchmark (quality + grounding + latency) for all four variants...");
  const report = await runProductionBenchmark(variantConfigs, RAG_EVALUATION_DATASET, repository, {
    latencyRunCount: LATENCY_RUN_COUNT,
  });
  console.log(formatProductionBenchmarkReport(report));

  assertEqual(report.variants.length, 4, "expected exactly four benchmarked variants");
  assertEqual(
    report.variants.map((variant) => variant.label).join(","),
    "bm25,vector,hybrid,reranked-hybrid",
    "expected variants in BM25, Vector, Hybrid, Re-ranked Hybrid order",
  );

  console.log("[evaluation] Checking each variant's quality/grounding numbers match directly-computed benchmark output...");
  for (const [index, variantConfig] of variantConfigs.entries()) {
    const variant = report.variants[index];

    const directQuality = await runBm25RetrievalBenchmarkVariant(
      variantConfig.label,
      variantConfig.retriever,
      RAG_EVALUATION_DATASET,
      repository,
    );
    assertEqual(
      JSON.stringify(variant.quality),
      JSON.stringify(directQuality),
      `expected "${variantConfig.label}" quality to match a direct, unmodified runBm25RetrievalBenchmarkVariant call`,
    );

    assertTruthy(variant.grounding !== undefined, `expected "${variantConfig.label}" to carry grounding (ragAnswerUseCase was configured)`);
    const directGroundingSummary = await new GroundingMetricsEvaluationRunner(
      variantConfig.retriever,
      variantConfig.ragAnswerUseCase!,
    ).runMany(RAG_EVALUATION_DATASET);
    const directGrounding = buildGroundingMetricsReport(RAG_EVALUATION_DATASET, directGroundingSummary.results);
    assertEqual(
      JSON.stringify(variant.grounding),
      JSON.stringify(directGrounding),
      `expected "${variantConfig.label}" grounding to match a direct, unmodified GroundingMetricsEvaluationRunner/buildGroundingMetricsReport call`,
    );

    assertNonNegativeLatency(variant.retrievalLatency, `"${variantConfig.label}" retrieval latency`);
    assertNonNegativeLatency(variant.endToEndLatency, `"${variantConfig.label}" end-to-end latency`);
    assertEqual(variant.retrievalLatency.runCount, LATENCY_RUN_COUNT, `"${variantConfig.label}" retrieval latency run count`);
    assertEqual(variant.endToEndLatency.runCount, LATENCY_RUN_COUNT, `"${variantConfig.label}" end-to-end latency run count`);
  }
  console.log("[evaluation] Quality and grounding numbers match existing benchmark outputs; latency measurements are all non-negative.");

  console.log("[evaluation] Checking the re-ranked-hybrid variant honors candidateTopK/finalTopN (ReRankingSearchEngine, unmodified)...");
  const sampleRetrieval = await reRankedRetriever.retrieve(RAG_EVALUATION_DATASET[0].query);
  assertTruthy(
    sampleRetrieval.documents.length <= RE_RANKING_FINAL_TOP_N,
    `expected at most finalTopN=${RE_RANKING_FINAL_TOP_N} documents from the re-ranked-hybrid retriever`,
  );

  console.log("[evaluation] Checking repeated benchmark execution is deterministic except for measured timing values...");
  const hybridVariantConfig = variantConfigs[2];
  const hybridRerun = await runProductionBenchmark([hybridVariantConfig], RAG_EVALUATION_DATASET, repository, {
    latencyRunCount: LATENCY_RUN_COUNT,
  });
  const hybridOriginal = report.variants[2];
  const hybridRerunResult = hybridRerun.variants[0];
  assertEqual(
    JSON.stringify(hybridOriginal.quality),
    JSON.stringify(hybridRerunResult.quality),
    "expected quality to be identical across repeated production benchmark runs",
  );
  assertEqual(
    JSON.stringify(hybridOriginal.grounding),
    JSON.stringify(hybridRerunResult.grounding),
    "expected grounding to be identical across repeated production benchmark runs",
  );
  assertEqual(hybridOriginal.label, hybridRerunResult.label, "expected label to be identical across repeated production benchmark runs");
  assertNonNegativeLatency(hybridRerunResult.retrievalLatency, "hybrid rerun retrieval latency");
  assertNonNegativeLatency(hybridRerunResult.endToEndLatency, "hybrid rerun end-to-end latency");

  console.log("Production benchmark validation succeeded.");
}

main();
