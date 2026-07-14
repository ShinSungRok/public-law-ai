import { EMBEDDING_VECTOR_DIMENSION } from "../../embedding/EmbeddingVectorDimension";

export const OPEN_SEARCH_LEGAL_INDEX_MAPPING = {
  settings: {
    index: {
      knn: true,
    },
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      documentType: { type: "keyword" },
      title: { type: "text" },
      text: { type: "text" },
      sourceType: { type: "keyword" },
      sourceId: { type: "keyword" },
      embedding: {
        type: "knn_vector",
        dimension: EMBEDDING_VECTOR_DIMENSION,
        // Explicit so a real OpenSearch cluster ranks by the same metric
        // FakeOpenSearchClient's searchByVector already uses (cosine
        // similarity) — space_type otherwise defaults to l2 (Euclidean).
        method: {
          name: "hnsw",
          engine: "lucene",
          space_type: "cosinesimil",
        },
      },
    },
  },
} as const;
