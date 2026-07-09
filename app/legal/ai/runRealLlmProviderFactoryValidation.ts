import { AiProviderError } from "./AiProviderError";
import { DefaultAiProviderFactory } from "./DefaultAiProviderFactory";
import type { LlmConfiguration } from "./LlmConfiguration";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const factory = new DefaultAiProviderFactory();

  const fakeProvider = factory.create("fake");
  const fakeResponse = await fakeProvider.complete({
    model: "fake-model",
    messages: [{ role: "user", content: "What is the statute of limitations?" }],
  });
  assertTruthy(fakeResponse.text, "fake provider response missing text");
  assertTruthy(fakeResponse.metadata, "fake provider response missing metadata");

  const openAiConfiguration: LlmConfiguration = {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "fake-api-key",
    timeout: 15000,
    maxRetries: 2,
  };
  const openAiProvider = factory.create("openai", openAiConfiguration);
  const openAiResponse = await openAiProvider.complete({
    model: openAiConfiguration.model,
    messages: [{ role: "user", content: "What is the statute of limitations?" }],
  });
  assertTruthy(openAiResponse.text, "openai provider response missing text");
  assertTruthy(openAiResponse.metadata, "openai provider response missing metadata");

  const anthropicConfiguration: LlmConfiguration = {
    provider: "anthropic",
    model: "claude-sonnet-5",
    apiKey: "fake-api-key",
    timeout: 15000,
    maxRetries: 2,
  };
  const anthropicProvider = factory.create("anthropic", anthropicConfiguration);
  const anthropicResponse = await anthropicProvider.complete({
    model: anthropicConfiguration.model,
    messages: [{ role: "user", content: "What is the statute of limitations?" }],
  });
  assertTruthy(anthropicResponse.text, "anthropic provider response missing text");
  assertTruthy(
    anthropicResponse.metadata,
    "anthropic provider response missing metadata",
  );

  let missingConfigurationThrew = false;
  try {
    factory.create("openai");
  } catch (error) {
    missingConfigurationThrew = error instanceof AiProviderError;
  }
  assertTruthy(
    missingConfigurationThrew,
    "expected real provider without configuration to throw AiProviderError",
  );

  console.log("Real LLM provider factory validation succeeded.");
}

main();
