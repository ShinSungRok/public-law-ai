import { FakeAiProvider } from "./FakeAiProvider";
import type { AiProviderRequest } from "./AiProviderRequest";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const provider = new FakeAiProvider();

  const request: AiProviderRequest = {
    model: "fake-model",
    temperature: 0.2,
    maxTokens: 256,
    messages: [
      { role: "system", content: "You are a helpful legal assistant." },
      { role: "user", content: "What is the statute of limitations?" },
    ],
  };

  const response = await provider.complete(request);

  assertTruthy(
    typeof response.text === "string" && response.text.length > 0,
    "response missing non-empty text",
  );
  assertTruthy(response.metadata, "response missing provider metadata");
  assertTruthy(
    response.metadata.provider === "fake-ai-provider",
    "response metadata missing provider name",
  );

  console.log("AI provider contract validation succeeded (no external API call required).");
  console.log(`Response text: ${response.text}`);
  console.log(`Response metadata: ${JSON.stringify(response.metadata)}`);
}

main();
