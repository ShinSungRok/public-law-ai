import { EMBEDDING_VECTOR_DIMENSION } from "./EmbeddingVectorDimension";
import type { EmbeddingProvider } from "./EmbeddingProvider";

export class FakeEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const vector = new Array(EMBEDDING_VECTOR_DIMENSION).fill(0);

    for (let i = 0; i < text.length; i += 1) {
      const charCode = text.charCodeAt(i);
      vector[i % EMBEDDING_VECTOR_DIMENSION] += charCode;
    }

    const length = text.length || 1;
    return vector.map((value) => value / length);
  }
}
