import type { ApplicationConfiguration } from "./ApplicationConfiguration";

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
  const configuration: ApplicationConfiguration = {
    environment: "development",
    logLevel: "info",
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    database: {
      host: "localhost",
      port: 5432,
      database: "public_law_ai",
      username: "public_law_ai",
      password: "fake-password",
    },
    search: {
      nodeUrl: "http://localhost:9200",
      indexName: "public-law-ai-local",
    },
    ai: {
      provider: "fake",
      model: "fake-model",
      apiKey: "fake-api-key",
      timeout: 30000,
      maxRetries: 3,
    },
  };

  assertEqual(configuration.environment, "development", "environment mismatch");
  assertEqual(configuration.logLevel, "info", "logLevel mismatch");

  assertTruthy(configuration.server.host, "server.host missing");
  assertTruthy(
    typeof configuration.server.port === "number",
    "server.port missing or not a number",
  );

  assertTruthy(configuration.database.host, "database.host missing");
  assertTruthy(
    typeof configuration.database.port === "number",
    "database.port missing or not a number",
  );
  assertTruthy(configuration.database.database, "database.database missing");
  assertTruthy(configuration.database.username, "database.username missing");
  assertTruthy(configuration.database.password, "database.password missing");

  assertTruthy(configuration.search.nodeUrl, "search.nodeUrl missing");
  assertTruthy(configuration.search.indexName, "search.indexName missing");

  assertEqual(configuration.ai.provider, "fake", "ai.provider mismatch");
  assertTruthy(configuration.ai.model, "ai.model missing");
  assertTruthy(configuration.ai.apiKey, "ai.apiKey missing");
  assertTruthy(
    typeof configuration.ai.timeout === "number",
    "ai.timeout missing or not a number",
  );
  assertTruthy(
    typeof configuration.ai.maxRetries === "number",
    "ai.maxRetries missing or not a number",
  );
  assertEqual(
    configuration.ai.baseUrl,
    undefined,
    "expected ai.baseUrl to be optional and unset",
  );

  console.log("Application configuration validation succeeded.");
}

main();
