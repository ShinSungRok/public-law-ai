import type { LegalDocument } from "../domain";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OPEN_SEARCH_LEGAL_INDEX_MAPPING } from "../search/opensearch/OpenSearchLegalIndexMapping";
import { toOpenSearchLegalDocument } from "../search/opensearch/OpenSearchLegalDocumentMapper";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import type { OpenSearchSearchResponse } from "../search/opensearch/OpenSearchSearchResponse";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import { buildOpenSearchKeywordSearchBody } from "../search/opensearch/OpenSearchSearchBodyBuilder";
import { BatchChunkEmbeddingPipeline } from "./BatchChunkEmbeddingPipeline";
import { BatchEmbeddingService } from "./BatchEmbeddingService";
import { ChunkEmbeddingPipeline } from "./ChunkEmbeddingPipeline";
import { EMBEDDING_VECTOR_DIMENSION } from "./EmbeddingVectorDimension";
import { EmbeddingService } from "./EmbeddingService";
import { FakeEmbeddingProvider } from "./FakeEmbeddingProvider";
import { SingleChunkChunkingService } from "./SingleChunkChunkingService";
import type { EmbeddingVector } from "./EmbeddingVector";

const INDEX_NAME = "public-law-ai-vector-indexing-validation";

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
    sourceRef: {
      sourceType: "statute_article",
      sourceId: id,
    },
  };
}

async function fetchIndexedSource(
  client: FakeOpenSearchClient,
  title: string,
) {
  const body = buildOpenSearchKeywordSearchBody({ text: title, limit: 1 });
  const response = (await client.search(INDEX_NAME, body)) as OpenSearchSearchResponse;
  const hit = response.hits.hits[0];
  assertTruthy(hit, `expected a search hit for title "${title}"`);
  return hit._source;
}

async function main(): Promise<void> {
  const vectorDocumentA = buildDocument(
    "vector-doc-1",
    "Fake Statute Article One",
    "This is fake statute article text for vector indexing validation, article one.",
  );
  const vectorDocumentB = buildDocument(
    "vector-doc-2",
    "Fake Statute Article Two",
    "This is fake statute article text for vector indexing validation, article two.",
  );
  const keywordOnlyDocument = buildDocument(
    "keyword-doc-1",
    "Fake Statute Article Three",
    "This is fake statute article text indexed through the unchanged keyword-only path.",
  );

  const embeddingProvider = new FakeEmbeddingProvider();
  const embeddingService = new EmbeddingService(embeddingProvider);
  const batchEmbeddingService = new BatchEmbeddingService(embeddingService);
  const chunkingService = new SingleChunkChunkingService();
  const chunkEmbeddingPipeline = new ChunkEmbeddingPipeline(
    chunkingService,
    batchEmbeddingService,
  );
  const batchChunkEmbeddingPipeline = new BatchChunkEmbeddingPipeline(
    chunkEmbeddingPipeline,
  );

  console.log("[embedding] Generating embeddings for LegalDocuments...");
  const vectors = await batchChunkEmbeddingPipeline.embedDocuments([
    vectorDocumentA,
    vectorDocumentB,
  ]);
  const vectorsRerun = await batchChunkEmbeddingPipeline.embedDocuments([
    vectorDocumentA,
    vectorDocumentB,
  ]);

  assertEqual(
    JSON.stringify(vectors),
    JSON.stringify(vectorsRerun),
    "expected embedding generation to be deterministic across repeated runs",
  );

  for (const vector of vectors) {
    assertEqual(
      vector.vector.length,
      EMBEDDING_VECTOR_DIMENSION,
      `expected embedding for "${vector.id}" to have dimension ${EMBEDDING_VECTOR_DIMENSION}`,
    );
  }

  const vectorById = new Map<string, EmbeddingVector>(
    vectors.map((vector) => [vector.id, vector]),
  );
  const vectorForDocumentA = vectorById.get(vectorDocumentA.id);
  const vectorForDocumentB = vectorById.get(vectorDocumentB.id);
  assertTruthy(vectorForDocumentA, "expected an embedding vector for document A");
  assertTruthy(vectorForDocumentB, "expected an embedding vector for document B");

  console.log("[opensearch] Checking the index mapping declares the dense vector field...");
  const embeddingFieldMapping = (
    OPEN_SEARCH_LEGAL_INDEX_MAPPING.mappings.properties as Record<
      string,
      { type: string; dimension?: number }
    >
  ).embedding;
  assertTruthy(embeddingFieldMapping, "expected mapping to declare an `embedding` field");
  assertEqual(embeddingFieldMapping.type, "knn_vector", "expected embedding field to be a knn_vector");
  assertEqual(
    embeddingFieldMapping.dimension,
    EMBEDDING_VECTOR_DIMENSION,
    "expected embedding field dimension to match EMBEDDING_VECTOR_DIMENSION",
  );

  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: INDEX_NAME,
  };
  const indexManager = new OpenSearchIndexManager(client, config);
  const indexer = new OpenSearchLegalDocumentIndexer(client, config);

  await indexManager.ensureLegalIndex();

  console.log("[opensearch] Indexing documents with dense vectors...");
  await indexer.indexWithEmbedding(vectorDocumentA, vectorForDocumentA!.vector);
  await indexer.indexWithEmbedding(vectorDocumentB, vectorForDocumentB!.vector);

  console.log("[opensearch] Indexing a document through the unchanged keyword-only path...");
  await indexer.index(keywordOnlyDocument);

  console.log("[opensearch] Checking vector-indexed documents carry their embedding...");
  const indexedSourceA = await fetchIndexedSource(client, vectorDocumentA.title);
  assertEqual(
    JSON.stringify(indexedSourceA?.embedding),
    JSON.stringify(vectorForDocumentA!.vector),
    "expected the indexed document's embedding to round-trip exactly",
  );

  console.log("[opensearch] Checking vector indexing is deterministic across repeated runs...");
  await indexer.indexWithEmbedding(vectorDocumentA, vectorForDocumentA!.vector);
  const indexedSourceARerun = await fetchIndexedSource(client, vectorDocumentA.title);
  assertEqual(
    JSON.stringify(indexedSourceARerun),
    JSON.stringify(indexedSourceA),
    "expected re-indexing the same document/embedding to produce an identical stored document",
  );

  console.log("[opensearch] Checking keyword-only indexing is unchanged (no embedding field)...");
  const indexedKeywordSource = await fetchIndexedSource(client, keywordOnlyDocument.title);
  assertTruthy(
    indexedKeywordSource && !("embedding" in indexedKeywordSource),
    "expected a keyword-only indexed document to carry no embedding field",
  );
  assertEqual(
    JSON.stringify(indexedKeywordSource),
    JSON.stringify(toOpenSearchLegalDocument(keywordOnlyDocument)),
    "expected the keyword-only indexed document to match the pre-existing toOpenSearchLegalDocument output exactly",
  );

  console.log("Vector indexing validation succeeded.");
}

main();
