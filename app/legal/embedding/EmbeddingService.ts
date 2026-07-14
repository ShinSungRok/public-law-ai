import type { EmbeddingProvider } from "./EmbeddingProvider";

export class EmbeddingService {
  constructor(private readonly provider: EmbeddingProvider) {}

  async embed(text: string): Promise<number[]> {
    return this.provider.embed(text);
  }
}
