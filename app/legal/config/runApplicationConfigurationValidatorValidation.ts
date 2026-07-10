import type { ApplicationConfiguration } from "./ApplicationConfiguration";
import type { ApplicationEnvironment } from "./ApplicationEnvironment";
import { DefaultApplicationConfigurationValidator } from "./DefaultApplicationConfigurationValidator";
import type { LogLevel } from "./LogLevel";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function buildValidConfiguration(): ApplicationConfiguration {
  return {
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
      password: "",
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
}

async function main(): Promise<void> {
  const validator = new DefaultApplicationConfigurationValidator();

  validator.validate(buildValidConfiguration());

  let invalidServerPortThrew = false;
  try {
    const configuration = buildValidConfiguration();
    configuration.server.port = 0;
    validator.validate(configuration);
  } catch (error) {
    invalidServerPortThrew = error instanceof Error;
  }
  assertTruthy(
    invalidServerPortThrew,
    "expected invalid server port to throw Error",
  );

  let missingDatabaseNameThrew = false;
  try {
    const configuration = buildValidConfiguration();
    configuration.database.database = "";
    validator.validate(configuration);
  } catch (error) {
    missingDatabaseNameThrew = error instanceof Error;
  }
  assertTruthy(
    missingDatabaseNameThrew,
    "expected missing database name to throw Error",
  );

  let missingSearchIndexNameThrew = false;
  try {
    const configuration = buildValidConfiguration();
    configuration.search.indexName = "";
    validator.validate(configuration);
  } catch (error) {
    missingSearchIndexNameThrew = error instanceof Error;
  }
  assertTruthy(
    missingSearchIndexNameThrew,
    "expected missing search indexName to throw Error",
  );

  let realProviderMissingApiKeyThrew = false;
  try {
    const configuration = buildValidConfiguration();
    configuration.ai.provider = "openai";
    configuration.ai.apiKey = "";
    validator.validate(configuration);
  } catch (error) {
    realProviderMissingApiKeyThrew = error instanceof Error;
  }
  assertTruthy(
    realProviderMissingApiKeyThrew,
    "expected real AI provider without apiKey to throw Error",
  );

  let invalidEnvironmentThrew = false;
  try {
    const configuration = buildValidConfiguration();
    configuration.environment = "staging" as ApplicationEnvironment;
    validator.validate(configuration);
  } catch (error) {
    invalidEnvironmentThrew = error instanceof Error;
  }
  assertTruthy(
    invalidEnvironmentThrew,
    "expected invalid environment to throw Error",
  );

  let invalidLogLevelThrew = false;
  try {
    const configuration = buildValidConfiguration();
    configuration.logLevel = "verbose" as LogLevel;
    validator.validate(configuration);
  } catch (error) {
    invalidLogLevelThrew = error instanceof Error;
  }
  assertTruthy(invalidLogLevelThrew, "expected invalid logLevel to throw Error");

  console.log("Application configuration validator validation succeeded.");
}

main();
