import type { EmbeddingModel } from "./EmbeddingModel";

export class EmbeddingService {
  constructor(private readonly model: EmbeddingModel) {}

  async embed(text: string): Promise<number[]> {
    return this.model.embed(text);
  }
}
