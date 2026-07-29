import type { AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMCompletionRequest, LLMProvider } from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import {
  BatchChunkEmbeddingPipeline,
  BatchEmbeddingService,
  ChunkEmbeddingPipeline,
  EmbeddingService,
  GeminiEmbeddingProvider,
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
import { formatProductionBenchmarkReport, runProductionBenchmark, type ProductionBenchmarkVariantConfig } from "./ProductionBenchmark";
import { selectRecommendedProductionVariant } from "./FinalBenchmarkReport";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";

const INDEX_NAME = "public-law-ai-real-embedding-benchmark";
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

/** Same deterministic echo contract used by the fake-embedding benchmark scripts — isolates the embedding-quality variable this script exists to measure, rather than also introducing a real (paid, non-deterministic) LLM call. */
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

async function buildHybridReadyClient(): Promise<{
  client: FakeOpenSearchClient;
  config: OpenSearchConfig;
  embeddingProvider: GeminiEmbeddingProvider;
}> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = { node: "http://fake-opensearch:9200", indexName: INDEX_NAME };
  await new OpenSearchIndexManager(client, config).ensureLegalIndex();

  const embeddingProvider = new GeminiEmbeddingProvider(process.env.LLM_API_KEY!);
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

/**
 * Same benchmark shape as runFinalBenchmarkReportValidation.ts (Phase 30),
 * but with GeminiEmbeddingProvider in place of FakeEmbeddingProvider — every
 * other variable (FakeOpenSearchClient, FakeReRanker, the echo fake LLM
 * provider, the RAG_EVALUATION_DATASET/REAL_ARTICLE_DOCUMENTS fixtures) is
 * held fixed so any change in the numbers versus the fake-embedding report
 * is attributable to embedding quality, not a second variable changing at
 * the same time. latencyRunCount is 1 (not 3): this script's purpose is the
 * quality/recommendation numbers, and each additional pass costs one real
 * Gemini API call per vector-backed variant per evaluation case.
 *
 * This is a report-generation script, not a validation script — it makes
 * real (metered) Gemini API calls and is not part of `pnpm validate:*`.
 */
async function main(): Promise<void> {
  if (!process.env.LLM_API_KEY?.trim()) {
    throw new Error(
      "runRealEmbeddingBenchmarkReport requires LLM_API_KEY (Gemini) in the environment -- source .env first",
    );
  }

  console.log(
    "[benchmark] Real Gemini embeddings (gemini-embedding-001, 768-dim), FakeOpenSearchClient, FakeReRanker, " +
      "and a deterministic echo fake LLM provider. This makes real, metered Gemini API calls.",
  );

  const variantConfigs = await buildVariantConfigs();

  console.log("[benchmark] Running the production benchmark across BM25, Vector, Hybrid, and Re-ranked Hybrid...");
  const report = await runProductionBenchmark(
    variantConfigs,
    RAG_EVALUATION_DATASET,
    new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS),
    { latencyRunCount: 1 },
  );
  console.log(formatProductionBenchmarkReport(report));

  const recommended = selectRecommendedProductionVariant(report.variants);
  console.log("== Recommended Configuration (real embeddings) ==");
  console.log(
    `${recommended.label} (selectRecommendedProductionVariant: highest Hit Rate, then fewest retrieval failures, then highest MRR)`,
  );

  console.log("Real embedding benchmark report complete.");
}

main();
