import { AiProviderError } from "./AiProviderError";
import { AnthropicProvider } from "./AnthropicProvider";
import type { LlmConfiguration } from "./LlmConfiguration";

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

async function main(): Promise<void> {
  const configuration: LlmConfiguration = {
    provider: "anthropic",
    model: "claude-sonnet-5",
    apiKey: "fake-api-key",
    timeout: 15000,
    maxRetries: 2,
  };

  const provider = new AnthropicProvider(configuration);

  const response = await provider.complete({
    model: configuration.model,
    messages: [
      { role: "system", content: "You are a helpful legal assistant." },
      { role: "user", content: "What is the statute of limitations?" },
    ],
  });

  assertTruthy(
    typeof response.text === "string" && response.text.length > 0,
    "response missing non-empty text",
  );
  assertEqual(response.metadata.provider, "anthropic", "metadata provider mismatch");
  assertTruthy(response.metadata.model, "metadata missing model");

  let invalidProviderThrew = false;
  try {
    new AnthropicProvider({
      provider: "openai",
      model: "claude-sonnet-5",
      apiKey: "fake-api-key",
      timeout: 15000,
      maxRetries: 2,
    });
  } catch (error) {
    invalidProviderThrew = error instanceof AiProviderError;
  }
  assertTruthy(
    invalidProviderThrew,
    "expected invalid provider configuration to throw AiProviderError",
  );

  console.log("Anthropic provider validation succeeded (no external API call required).");
  console.log(`Response text: ${response.text}`);
  console.log(`Response metadata: ${JSON.stringify(response.metadata)}`);
}

main();
