// Fixed dimension every EmbeddingProvider in this system must produce.
// OpenSearchLegalIndexMapping's `embedding` field is declared against this
// same constant, so a provider and the vector index it feeds never drift.
// 768 matches Gemini's text-embedding-004 default output (GeminiEmbeddingProvider);
// changing this requires deleting and recreating the OpenSearch index, since
// a knn_vector field's dimension is immutable once created.
export const EMBEDDING_VECTOR_DIMENSION = 768;
