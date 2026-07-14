import type { LegalDocument } from "../domain";
import {
  BatchChunkEmbeddingPipeline,
  BatchEmbeddingService,
  ChunkEmbeddingPipeline,
  EmbeddingService,
  FakeEmbeddingProvider,
  SingleChunkChunkingService,
} from "../embedding";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import { DefaultSearchResultFilter } from "./DefaultSearchResultFilter";
import { HybridSearchEngine } from "./HybridSearchEngine";
import { FakeOpenSearchClient } from "./opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "./opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "./opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "./opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "./opensearch/OpenSearchSearchEngine";
import { OpenSearchVectorSearchEngine } from "./opensearch/OpenSearchVectorSearchEngine";
import { ReciprocalRankFusionStrategy } from "./ReciprocalRankFusionStrategy";
import { ScoreDescendingSearchResultSorter } from "./ScoreDescendingSearchResultSorter";
import type { SearchEngine } from "./SearchEngine";
import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

const INDEX_NAME = "public-law-ai-hybrid-retrieval-validation";
// Matches ReciprocalRankFusionStrategy's own default — recomputed here (not
// imported) only to derive the expected fused scores below; the fusion math
// itself is never reimplemented, only its documented default constant.
const RRF_DEFAULT_K = 60;

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

function assertClose(actual: number, expected: number, message: string): void {
  const epsilon = 1e-9;
  assertTruthy(
    Math.abs(actual - expected) < epsilon,
    `${message}: expected ~${expected}, got ${actual}`,
  );
}

function buildDocument(id: string, title: string, text: string): LegalDocument {
  return {
    id,
    documentType: "STATUTE_ARTICLE",
    title,
    text,
    metadata: {
      sourceSystem: "fake-source",
      sourceId: id,
      sourceUrl: "https://fake.local",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: id },
  };
}

function buildHit(document: LegalDocument, score: number): SearchHit {
  return { id: document.id, document, score, highlights: [], matchedFields: [], metadata: {} };
}

class FixedSearchEngine implements SearchEngine {
  constructor(private readonly hits: SearchHit[]) {}

  async search(): Promise<SearchHit[]> {
    return this.hits;
  }
}

function rrfScore(ranks: number[]): number {
  return ranks.reduce((sum, rank) => sum + 1 / (RRF_DEFAULT_K + rank), 0);
}

/**
 * RRF ordering + duplicate-merge correctness, against hand-computed expected
 * scores. Two fixed SearchEngine stubs stand in for BM25/vector so the
 * expected fusion is fully known ahead of time:
 *   BM25   ranks: A=1, B=2, C=3
 *   Vector ranks: B=1, D=2, A=3
 * A and B appear in both groups (must merge into one hit each); C is
 * BM25-only, D is vector-only. Expected fused order: B > A > D > C.
 */
async function validateRrfOrderingAndDeduplication(): Promise<void> {
  const documentA = buildDocument("doc-A", "Article A", "text A");
  const documentB = buildDocument("doc-B", "Article B", "text B");
  const documentC = buildDocument("doc-C", "Article C", "text C");
  const documentD = buildDocument("doc-D", "Article D", "text D");

  const bm25Engine = new FixedSearchEngine([
    buildHit(documentA, 10),
    buildHit(documentB, 8),
    buildHit(documentC, 5),
  ]);
  const vectorEngine = new FixedSearchEngine([
    buildHit(documentB, 0.9),
    buildHit(documentD, 0.7),
    buildHit(documentA, 0.5),
  ]);

  const hybridEngine = new HybridSearchEngine(
    [
      { engine: bm25Engine, source: "opensearch" },
      { engine: vectorEngine, source: "opensearch" },
    ],
    new DefaultSearchResultFilter(),
    new ReciprocalRankFusionStrategy(),
    new ScoreDescendingSearchResultSorter(),
  );

  const query: SearchQuery = { text: "irrelevant, FixedSearchEngine ignores it" };
  const hits = await hybridEngine.search(query);

  assertEqual(hits.length, 4, "expected duplicate documents A and B to be merged into single hits");
  assertEqual(
    hits.map((hit) => hit.id).join(","),
    "doc-B,doc-A,doc-D,doc-C",
    "expected fused RRF order B > A > D > C",
  );

  const expectedScoreA = rrfScore([1, 3]);
  const expectedScoreB = rrfScore([2, 1]);
  const expectedScoreC = rrfScore([3]);
  const expectedScoreD = rrfScore([2]);
  assertClose(hits[0].score, expectedScoreB, "doc-B fused score");
  assertClose(hits[1].score, expectedScoreA, "doc-A fused score");
  assertClose(hits[2].score, expectedScoreD, "doc-D fused score");
  assertClose(hits[3].score, expectedScoreC, "doc-C fused score");

  console.log("[search] RRF ordering + duplicate merging validated against hand-computed scores.");

  const hitsRerun = await hybridEngine.search(query);
  assertEqual(
    JSON.stringify(hits),
    JSON.stringify(hitsRerun),
    "expected hybrid RRF fusion to be deterministic across repeated runs",
  );
  console.log("[search] Hybrid RRF fusion is deterministic across repeated runs.");
}

/**
 * Wires the real, unmodified OpenSearchSearchEngine (BM25) and
 * OpenSearchVectorSearchEngine (vector) into HybridSearchEngine, retrieves
 * through the existing, unmodified SearchEngineRetriever, and checks the
 * combined result is deduplicated and deterministic end to end.
 */
async function validateHybridRetrievalThroughSearchEngineRetriever(): Promise<void> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: INDEX_NAME,
  };
  await new OpenSearchIndexManager(client, config).ensureLegalIndex();

  const documents = [
    buildDocument("hybrid-doc-1", "개인정보 보호법 제2조", "개인정보의 정의에 관한 조문이다."),
    buildDocument("hybrid-doc-2", "개인정보 보호법 제3조", "개인정보 보호 원칙에 관한 조문이다."),
    buildDocument("hybrid-doc-3", "형법 제250조", "살인죄의 처벌에 관한 조문이다."),
  ];

  const embeddingProvider = new FakeEmbeddingProvider();
  const batchChunkEmbeddingPipeline = new BatchChunkEmbeddingPipeline(
    new ChunkEmbeddingPipeline(
      new SingleChunkChunkingService(),
      new BatchEmbeddingService(new EmbeddingService(embeddingProvider)),
    ),
  );
  const vectors = await batchChunkEmbeddingPipeline.embedDocuments(documents);
  const vectorById = new Map(vectors.map((vector) => [vector.id, vector.vector]));

  const indexer = new OpenSearchLegalDocumentIndexer(client, config);
  for (const document of documents) {
    await indexer.indexWithEmbedding(document, vectorById.get(document.id)!);
  }

  const hybridEngine = new HybridSearchEngine(
    [
      { engine: new OpenSearchSearchEngine(client, config), source: "opensearch" },
      {
        engine: new OpenSearchVectorSearchEngine(client, config, embeddingProvider),
        source: "opensearch",
      },
    ],
    new DefaultSearchResultFilter(),
    new ReciprocalRankFusionStrategy(),
    new ScoreDescendingSearchResultSorter(),
  );
  const retriever = new SearchEngineRetriever(hybridEngine);

  const result = await retriever.retrieve("개인정보의 정의는 무엇인가?");
  assertTruthy(result.documents.length > 0, "expected hybrid retrieval to return at least one document");

  const retrievedIds = result.documents.map((retrievedDocument) => retrievedDocument.document.id);
  assertEqual(
    new Set(retrievedIds).size,
    retrievedIds.length,
    "expected no duplicate document ids in hybrid retrieval output (BM25 and vector both index the same corpus)",
  );

  const resultRerun = await retriever.retrieve("개인정보의 정의는 무엇인가?");
  assertEqual(
    JSON.stringify(result),
    JSON.stringify(resultRerun),
    "expected hybrid retrieval through SearchEngineRetriever to be deterministic across repeated runs",
  );

  console.log(
    `[search] Hybrid retrieval via the unmodified SearchEngineRetriever returned ${result.documents.length} deduplicated, deterministic document(s).`,
  );
}

async function main(): Promise<void> {
  console.log(
    "[search] No external services required: OpenSearch is replaced with FakeOpenSearchClient. " +
      "BM25 query configuration, vector similarity configuration, SearchEngine interfaces, Retriever, " +
      "and the AI Provider are never modified.",
  );

  await validateRrfOrderingAndDeduplication();
  await validateHybridRetrievalThroughSearchEngineRetriever();

  console.log("Hybrid retrieval validation succeeded.");
}

main();
