import { AiProviderError } from "./AiProviderError";
import { EnvironmentLlmConfigurationFactory } from "./EnvironmentLlmConfigurationFactory";

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
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_TIMEOUT;
  delete process.env.LLM_MAX_RETRIES;

  const factory = new EnvironmentLlmConfigurationFactory();

  const fakeConfiguration = factory.create();
  assertEqual(fakeConfiguration.provider, "fake", "fake provider mismatch");
  assertTruthy(fakeConfiguration.model, "fake configuration missing model");
  assertTruthy(fakeConfiguration.apiKey, "fake configuration missing apiKey");
  assertTruthy(
    typeof fakeConfiguration.timeout === "number",
    "fake configuration missing timeout",
  );
  assertTruthy(
    typeof fakeConfiguration.maxRetries === "number",
    "fake configuration missing maxRetries",
  );

  process.env.LLM_PROVIDER = "openai";
  delete process.env.LLM_API_KEY;

  let realProviderMissingApiKeyThrew = false;
  try {
    factory.create();
  } catch (error) {
    realProviderMissingApiKeyThrew = error instanceof AiProviderError;
  }
  assertTruthy(
    realProviderMissingApiKeyThrew,
    "expected real provider without apiKey to throw AiProviderError",
  );

  console.log("LLM configuration factory validation succeeded.");
}

main();
