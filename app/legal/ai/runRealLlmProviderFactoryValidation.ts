import { AiProviderError } from "./AiProviderError";
import { AnthropicProvider } from "./AnthropicProvider";
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
  // AnthropicProvider now calls the real Anthropic API, so this factory-level
  // check stays structural (no injected transport is available through the
  // factory) to avoid making a real network call during validation.
  const anthropicProvider = factory.create("anthropic", anthropicConfiguration);
  assertTruthy(
    anthropicProvider instanceof AnthropicProvider,
    "factory did not construct an AnthropicProvider for provider type \"anthropic\"",
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
