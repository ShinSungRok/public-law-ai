export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}
