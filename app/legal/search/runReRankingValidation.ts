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
import { FakeReRanker } from "./FakeReRanker";
import { HybridSearchEngine } from "./HybridSearchEngine";
import { FakeOpenSearchClient } from "./opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "./opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "./opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "./opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "./opensearch/OpenSearchSearchEngine";
import { OpenSearchVectorSearchEngine } from "./opensearch/OpenSearchVectorSearchEngine";
import { ReRankingSearchEngine } from "./ReRankingSearchEngine";
import type { SearchEngine } from "./SearchEngine";
import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

const INDEX_NAME = "public-law-ai-reranking-validation";

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

/**
 * Candidate-source ranks: doc-1..doc-6, best-BM25-first. Query terms are
 * "alpha beta"; documents are hand-built so FakeReRanker's term-overlap
 * score is fully known ahead of time:
 *   doc-1 "alpha only"              -> overlap 1
 *   doc-2 "alpha beta gamma"        -> overlap 2
 *   doc-3 "gamma delta"             -> overlap 0
 *   doc-4 "beta epsilon"            -> overlap 1
 *   doc-5 "alpha beta gamma delta"  -> overlap 2 (would win if considered)
 *   doc-6 "zeta"                    -> overlap 0
 * candidateTopK=4 must cut the source list down to doc-1..doc-4 *before*
 * re-ranking, so doc-5 (rank 5, higher overlap than doc-1/doc-4) must never
 * appear. Within the remaining candidates, expected re-ranked order is
 * doc-2 (score 2), then doc-1 before doc-4 (tied score 1, doc-1 had the
 * earlier original rank) — finalTopN=2 keeps only doc-2, doc-1.
 */
async function validateCandidateTopKAndFinalTopN(): Promise<void> {
  const doc1 = buildDocument("doc-1", "Doc 1", "alpha only");
  const doc2 = buildDocument("doc-2", "Doc 2", "alpha beta gamma");
  const doc3 = buildDocument("doc-3", "Doc 3", "gamma delta");
  const doc4 = buildDocument("doc-4", "Doc 4", "beta epsilon");
  const doc5 = buildDocument("doc-5", "Doc 5", "alpha beta gamma delta");
  const doc6 = buildDocument("doc-6", "Doc 6", "zeta");

  const sourceHits = [
    buildHit(doc1, 10),
    buildHit(doc2, 9),
    buildHit(doc3, 8),
    buildHit(doc4, 7),
    buildHit(doc5, 6),
    buildHit(doc6, 5),
  ];

  const reRankingEngine = new ReRankingSearchEngine(
    new FixedSearchEngine(sourceHits),
    new FakeReRanker(),
    { candidateTopK: 4, finalTopN: 2 },
  );

  const query: SearchQuery = { text: "alpha beta" };
  const hits = await reRankingEngine.search(query);

  assertEqual(hits.length, 2, "expected finalTopN=2 hits returned");
  assertEqual(
    hits.map((hit) => hit.id).join(","),
    "doc-2,doc-1",
    "expected re-ranked order doc-2 (overlap 2) then doc-1 (overlap 1, earlier original rank than doc-4)",
  );
  assertTruthy(
    !hits.some((hit) => hit.id === "doc-5"),
    "expected doc-5 to be excluded by candidateTopK=4 even though its term overlap score would outrank doc-1/doc-4",
  );

  const originalDoc2Hit = sourceHits[1];
  assertEqual(hits[0].document, originalDoc2Hit.document, "expected re-ranking to preserve the doc-2 document object");
  assertEqual(
    JSON.stringify(hits[0].metadata),
    JSON.stringify(originalDoc2Hit.metadata),
    "expected re-ranking to preserve doc-2 metadata",
  );

  console.log(
    "[search] Re-ranking candidateTopK/finalTopN windowing and document identity preservation validated.",
  );

  const hitsRerun = await reRankingEngine.search(query);
  assertEqual(
    JSON.stringify(hits),
    JSON.stringify(hitsRerun),
    "expected re-ranking order to be deterministic across repeated runs",
  );
  console.log("[search] Re-ranking order is deterministic across repeated runs.");

  const ids = hits.map((hit) => hit.id);
  assertEqual(new Set(ids).size, ids.length, "expected re-ranking to introduce no duplicate documents");
  console.log("[search] Re-ranking introduces no duplicate documents.");
}

/**
 * Wires the real, unmodified HybridSearchEngine (BM25 + Vector via RRF) as
 * the candidate source for ReRankingSearchEngine, retrieves through the
 * existing, unmodified SearchEngineRetriever, and checks the final result
 * is bounded by finalTopN, deduplicated, and deterministic end to end.
 */
async function validateReRankingOverHybridSearchEngineThroughRetriever(): Promise<void> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: INDEX_NAME,
  };
  await new OpenSearchIndexManager(client, config).ensureLegalIndex();

  const documents = [
    buildDocument("rerank-doc-1", "개인정보 보호법 제2조", "개인정보의 정의에 관한 조문이다."),
    buildDocument("rerank-doc-2", "개인정보 보호법 제3조", "개인정보 보호 원칙에 관한 조문이다."),
    buildDocument("rerank-doc-3", "형법 제250조", "살인죄의 처벌에 관한 조문이다."),
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

  const hybridEngine = new HybridSearchEngine([
    { engine: new OpenSearchSearchEngine(client, config), source: "opensearch" },
    { engine: new OpenSearchVectorSearchEngine(client, config, embeddingProvider), source: "opensearch" },
  ]);

  const reRankingEngine = new ReRankingSearchEngine(hybridEngine, new FakeReRanker(), {
    candidateTopK: 10,
    finalTopN: 2,
  });
  const retriever = new SearchEngineRetriever(reRankingEngine);

  const result = await retriever.retrieve("개인정보의 정의는 무엇인가?");
  assertTruthy(result.documents.length > 0, "expected re-ranked hybrid retrieval to return at least one document");
  assertTruthy(
    result.documents.length <= 2,
    "expected re-ranked hybrid retrieval to return at most finalTopN=2 documents",
  );

  const retrievedIds = result.documents.map((retrievedDocument) => retrievedDocument.document.id);
  assertEqual(
    new Set(retrievedIds).size,
    retrievedIds.length,
    "expected no duplicate document ids in re-ranked hybrid retrieval output",
  );

  const resultRerun = await retriever.retrieve("개인정보의 정의는 무엇인가?");
  assertEqual(
    JSON.stringify(result),
    JSON.stringify(resultRerun),
    "expected re-ranked hybrid retrieval through SearchEngineRetriever to be deterministic across repeated runs",
  );

  console.log(
    `[search] Re-ranking over the unmodified HybridSearchEngine, via the unmodified SearchEngineRetriever, returned ${result.documents.length} bounded, deduplicated, deterministic document(s).`,
  );
}

async function main(): Promise<void> {
  console.log(
    "[search] No external services required: OpenSearch is replaced with FakeOpenSearchClient. " +
      "Runtime, Composition, Prompt, BM25 query configuration, vector similarity configuration, " +
      "Hybrid fusion logic, Retriever, evaluation metric logic, and the AI Provider are never modified. " +
      "SearchEngineRetriever is reused unchanged.",
  );

  await validateCandidateTopKAndFinalTopN();
  await validateReRankingOverHybridSearchEngineThroughRetriever();

  console.log("Re-ranking pipeline validation succeeded.");
}

main();
