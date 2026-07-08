import type { EmbeddingService } from "./EmbeddingService";

export class BatchEmbeddingService {
  constructor(private readonly embeddingService: EmbeddingService) {}

  async embedAll(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embeddingService.embed(text));
    }
    return embeddings;
  }
}
