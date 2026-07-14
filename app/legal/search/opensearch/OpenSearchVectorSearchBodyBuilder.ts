const DEFAULT_SIZE = 10;

// Matches the field name OpenSearchLegalIndexMapping declares as `knn_vector`
// and OpenSearchLegalDocumentMapper writes to (Phase 27 Task 1) — the only
// vector field this index has, so it is not made configurable.
const EMBEDDING_FIELD_NAME = "embedding";

/** Builds an OpenSearch k-NN query body for a pre-embedded query vector. */
export function buildOpenSearchVectorSearchBody(
  queryVector: number[],
  limit?: number,
): unknown {
  const size = limit ?? DEFAULT_SIZE;
  return {
    size,
    query: {
      knn: {
        [EMBEDDING_FIELD_NAME]: {
          vector: queryVector,
          k: size,
        },
      },
    },
  };
}
