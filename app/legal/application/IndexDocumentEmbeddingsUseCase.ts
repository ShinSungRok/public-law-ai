import type { LegalDocument } from "../domain";
import type { BatchChunkEmbeddingPipeline } from "../embedding/BatchChunkEmbeddingPipeline";
import type { VectorIndexer } from "../embedding/VectorIndexer";

export class IndexDocumentEmbeddingsUseCase {
  constructor(
    private readonly batchChunkEmbeddingPipeline: BatchChunkEmbeddingPipeline,
    private readonly vectorIndexer: VectorIndexer,
  ) {}

  async execute(documents: LegalDocument[]): Promise<void> {
    const vectors =
      await this.batchChunkEmbeddingPipeline.embedDocuments(documents);
    await this.vectorIndexer.index(vectors);
  }
}
