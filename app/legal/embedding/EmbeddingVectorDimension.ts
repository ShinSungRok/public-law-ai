// Fixed dimension every EmbeddingProvider in this system must produce.
// OpenSearchLegalIndexMapping's `embedding` field is declared against this
// same constant, so a provider and the vector index it feeds never drift.
export const EMBEDDING_VECTOR_DIMENSION = 8;
