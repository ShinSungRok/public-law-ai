import type { LegalDocument } from "../domain";
import type { BatchEmbeddingService } from "./BatchEmbeddingService";
import type { ChunkingService } from "./ChunkingService";
import type { EmbeddingVector } from "./EmbeddingVector";

export class ChunkEmbeddingPipeline {
  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly batchEmbeddingService: BatchEmbeddingService,
  ) {}

  async embedDocument(document: LegalDocument): Promise<EmbeddingVector[]> {
    const chunks = this.chunkingService.chunk(document);
    const vectors = await this.batchEmbeddingService.embedAll(
      chunks.map((chunk) => chunk.text),
    );

    return chunks.map((chunk, index) => ({
      id: chunk.id,
      text: chunk.text,
      vector: vectors[index],
    }));
  }
}
