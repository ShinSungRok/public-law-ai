import type { EmbeddingVector } from "./EmbeddingVector";
import type { VectorIndexer } from "./VectorIndexer";

export class FakeVectorIndexer implements VectorIndexer {
  private readonly indexedVectors: EmbeddingVector[] = [];

  async index(vectors: EmbeddingVector[]): Promise<void> {
    this.indexedVectors.push(...vectors);
  }

  getIndexedVectors(): EmbeddingVector[] {
    return this.indexedVectors;
  }
}
