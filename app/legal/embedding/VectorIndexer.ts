import type { EmbeddingVector } from "./EmbeddingVector";

export interface VectorIndexer {
  index(vectors: EmbeddingVector[]): Promise<void>;
}
