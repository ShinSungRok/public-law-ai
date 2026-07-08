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
  const configWithBaseUrl: LlmConfiguration = {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "fake-api-key",
    baseUrl: "https://api.example.com/v1",
    timeout: 30000,
    maxRetries: 3,
  };

  assertEqual(configWithBaseUrl.provider, "openai", "provider mismatch");
  assertTruthy(configWithBaseUrl.model, "model missing");
  assertTruthy(configWithBaseUrl.apiKey, "apiKey missing");
  assertTruthy(
    typeof configWithBaseUrl.timeout === "number",
    "timeout missing or not a number",
  );
  assertTruthy(
    typeof configWithBaseUrl.maxRetries === "number",
    "maxRetries missing or not a number",
  );
  assertEqual(
    configWithBaseUrl.baseUrl,
    "https://api.example.com/v1",
    "baseUrl mismatch",
  );

  const configWithoutBaseUrl: LlmConfiguration = {
    provider: "fake",
    model: "fake-model",
    apiKey: "fake-api-key",
    timeout: 5000,
    maxRetries: 0,
  };

  assertEqual(configWithoutBaseUrl.provider, "fake", "provider mismatch");
  assertEqual(
    configWithoutBaseUrl.baseUrl,
    undefined,
    "expected baseUrl to be optional and unset",
  );

  console.log("LLM configuration validation succeeded.");
}

main();
