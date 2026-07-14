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
      },
    },
  },
} as const;
