import { AiProviderError } from "./AiProviderError";
import type { AiProviderType } from "./AiProviderType";
import { DefaultAiProviderFactory } from "./DefaultAiProviderFactory";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const factory = new DefaultAiProviderFactory();

  const provider = factory.create("fake");
  const response = await provider.complete({
    model: "fake-model",
    messages: [
      { role: "system", content: "You are a helpful legal assistant." },
      { role: "user", content: "What is the statute of limitations?" },
    ],
  });

  assertTruthy(
    typeof response.text === "string" && response.text.length > 0,
    "response missing non-empty text",
  );
  assertTruthy(response.metadata, "response missing provider metadata");
  assertTruthy(
    response.metadata.provider === "fake-ai-provider",
    "response metadata missing provider name",
  );

  let unsupportedProviderTypeThrew = false;
  try {
    factory.create("unsupported" as AiProviderType);
  } catch (error) {
    unsupportedProviderTypeThrew = error instanceof AiProviderError;
  }
  assertTruthy(
    unsupportedProviderTypeThrew,
    "expected unsupported provider type to throw AiProviderError",
  );

  console.log("AI provider factory validation succeeded.");
  console.log(`Response text: ${response.text}`);
  console.log(`Response metadata: ${JSON.stringify(response.metadata)}`);
}

main();
