import type { EmbeddingModel } from "./EmbeddingModel";

const VECTOR_DIMENSION = 8;

export class FakeEmbeddingModel implements EmbeddingModel {
  async embed(text: string): Promise<number[]> {
    const vector = new Array(VECTOR_DIMENSION).fill(0);

    for (let i = 0; i < text.length; i += 1) {
      const charCode = text.charCodeAt(i);
      vector[i % VECTOR_DIMENSION] += charCode;
    }

    const length = text.length || 1;
    return vector.map((value) => value / length);
  }
}
