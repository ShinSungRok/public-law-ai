import { EnvironmentApplicationConfigurationFactory } from "./EnvironmentApplicationConfigurationFactory";

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
  delete process.env.SERVER_HOST;
  delete process.env.SERVER_PORT;
  delete process.env.POSTGRES_HOST;
  delete process.env.POSTGRES_PORT;
  delete process.env.POSTGRES_DATABASE;
  delete process.env.POSTGRES_USER;
  delete process.env.POSTGRES_PASSWORD;
  delete process.env.OPENSEARCH_NODE;
  delete process.env.OPENSEARCH_INDEX_NAME;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_TIMEOUT;
  delete process.env.LLM_MAX_RETRIES;

  const factory = new EnvironmentApplicationConfigurationFactory();
  const configuration = factory.create();

  assertEqual(configuration.server.host, "0.0.0.0", "server.host default mismatch");
  assertEqual(configuration.server.port, 3000, "server.port default mismatch");

  assertEqual(
    configuration.database.host,
    "localhost",
    "database.host default mismatch",
  );
  assertEqual(configuration.database.port, 5432, "database.port default mismatch");
  assertEqual(
    configuration.database.database,
    "public_law_ai",
    "database.database default mismatch",
  );
  assertEqual(
    configuration.database.username,
    "public_law_ai",
    "database.username default mismatch",
  );
  assertEqual(
    configuration.database.password,
    "",
    "database.password default mismatch",
  );

  assertEqual(
    configuration.search.nodeUrl,
    "http://localhost:9200",
    "search.nodeUrl default mismatch",
  );
  assertEqual(
    configuration.search.indexName,
    "public-law-ai-local",
    "search.indexName default mismatch",
  );

  assertEqual(configuration.ai.provider, "fake", "ai.provider default mismatch");
  assertEqual(configuration.ai.model, "fake-model", "ai.model default mismatch");
  assertEqual(configuration.ai.apiKey, "fake-api-key", "ai.apiKey default mismatch");
  assertEqual(configuration.ai.timeout, 30000, "ai.timeout default mismatch");
  assertEqual(configuration.ai.maxRetries, 3, "ai.maxRetries default mismatch");

  process.env.SERVER_PORT = "not-a-number";
  let invalidNumericValueThrew = false;
  try {
    factory.create();
  } catch (error) {
    invalidNumericValueThrew = error instanceof Error;
  }
  assertTruthy(
    invalidNumericValueThrew,
    "expected invalid numeric value to throw Error",
  );
  delete process.env.SERVER_PORT;

  console.log("Environment application configuration factory validation succeeded.");
}

main();
