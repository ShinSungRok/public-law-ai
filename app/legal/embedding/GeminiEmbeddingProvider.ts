import { GoogleGenAI } from "@google/genai";

import { EmbeddingProviderError } from "./EmbeddingProviderError";
import type { EmbeddingProvider } from "./EmbeddingProvider";
import { EMBEDDING_VECTOR_DIMENSION } from "./EmbeddingVectorDimension";

const MODEL = "gemini-embedding-001";

interface GeminiEmbeddingClient {
  models: {
    embedContent(params: {
      model: string;
      contents: string[];
      config?: { outputDimensionality?: number };
    }): Promise<{ embeddings?: Array<{ values?: number[] }> }>;
  };
}

/**
 * Google Gemini implementation of EmbeddingProvider, reusing the same API
 * key as GeminiProvider (one Gemini account covers both chat completion and
 * embedding). Mirrors GeminiProvider's shape: real @google/genai SDK client
 * by default, with an injectable client so validation never makes a real
 * network call.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: GeminiEmbeddingClient;

  constructor(apiKey: string, client?: GeminiEmbeddingClient) {
    if (!apiKey.trim()) {
      throw new EmbeddingProviderError(
        "GeminiEmbeddingProvider requires a non-empty API key",
      );
    }

    this.client =
      client ?? (new GoogleGenAI({ apiKey }) as unknown as GeminiEmbeddingClient);
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.models.embedContent({
      model: MODEL,
      contents: [text],
      config: { outputDimensionality: EMBEDDING_VECTOR_DIMENSION },
    });

    const values = response.embeddings?.[0]?.values;

    if (!values || values.length === 0) {
      throw new EmbeddingProviderError(
        "GeminiEmbeddingProvider received an empty embedding from Gemini",
      );
    }

    if (values.length !== EMBEDDING_VECTOR_DIMENSION) {
      throw new EmbeddingProviderError(
        `GeminiEmbeddingProvider expected a ${EMBEDDING_VECTOR_DIMENSION}-dimension embedding, got ${values.length}`,
      );
    }

    return values;
  }
}
