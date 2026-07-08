export interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
}
