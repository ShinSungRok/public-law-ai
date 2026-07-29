import { EmbeddingProviderError } from "./EmbeddingProviderError";
import { EMBEDDING_VECTOR_DIMENSION } from "./EmbeddingVectorDimension";
import { GeminiEmbeddingProvider } from "./GeminiEmbeddingProvider";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function fakeVector(seed: number): number[] {
  return new Array(EMBEDDING_VECTOR_DIMENSION).fill(0).map((_, index) => (index + seed) / 1000);
}

async function main(): Promise<void> {
  const fakeClient = {
    models: {
      async embedContent(params: { contents: string[] }) {
        return {
          embeddings: params.contents.map((_, index) => ({ values: fakeVector(index) })),
        };
      },
    },
  };

  const provider = new GeminiEmbeddingProvider("fake-api-key", fakeClient);
  const embedding = await provider.embed("개인정보 보호법 제2조(정의)");

  assertEqual(embedding.length, EMBEDDING_VECTOR_DIMENSION, "embedding dimension mismatch");
  assertTruthy(
    embedding.every((value) => typeof value === "number"),
    "embedding must contain only numbers",
  );

  let emptyKeyThrew = false;
  try {
    new GeminiEmbeddingProvider("", fakeClient);
  } catch (error) {
    emptyKeyThrew = error instanceof EmbeddingProviderError;
  }
  assertTruthy(emptyKeyThrew, "expected an empty API key to throw EmbeddingProviderError");

  let emptyResponseThrew = false;
  try {
    const emptyClient = {
      models: {
        async embedContent() {
          return { embeddings: [{ values: [] }] };
        },
      },
    };
    await new GeminiEmbeddingProvider("fake-api-key", emptyClient).embed("test");
  } catch (error) {
    emptyResponseThrew = error instanceof EmbeddingProviderError;
  }
  assertTruthy(
    emptyResponseThrew,
    "expected an empty embedding response to throw EmbeddingProviderError",
  );

  console.log("Gemini embedding provider validation succeeded (no external API call required).");
  console.log(`Embedding dimension: ${embedding.length}`);
}

main();
