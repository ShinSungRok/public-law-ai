import type { LegalDocument } from "../domain";
import type { ChunkEmbeddingPipeline } from "./ChunkEmbeddingPipeline";
import type { EmbeddingVector } from "./EmbeddingVector";

export class BatchChunkEmbeddingPipeline {
  constructor(
    private readonly chunkEmbeddingPipeline: ChunkEmbeddingPipeline,
  ) {}

  async embedDocuments(documents: LegalDocument[]): Promise<EmbeddingVector[]> {
    const vectors: EmbeddingVector[] = [];
    for (const document of documents) {
      vectors.push(...(await this.chunkEmbeddingPipeline.embedDocument(document)));
    }
    return vectors;
  }
}
