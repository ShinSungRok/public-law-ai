import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

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

function assertNoDirectProcessEnvAccess(): void {
  const compositionDir = path.resolve(process.cwd(), "app/legal/composition");
  const runtimeFiles = readdirSync(compositionDir).filter(
    (fileName) => fileName.endsWith(".ts") && !/^run.*Validation\.ts$/.test(fileName),
  );

  const offendingFiles: string[] = [];
  for (const fileName of runtimeFiles) {
    const contents = readFileSync(path.join(compositionDir, fileName), "utf8");
    if (contents.includes("process.env")) {
      offendingFiles.push(fileName);
    }
  }

  assertTruthy(
    offendingFiles.length === 0,
    `expected no direct process.env access in composition runtime files, found in: ${offendingFiles.join(", ")}`,
  );
}

async function main(): Promise<void> {
  delete process.env.APP_ENVIRONMENT;
  delete process.env.LOG_LEVEL;
  delete process.env.SERVER_HOST;
  delete process.env.SERVER_PORT;
  delete process.env.POSTGRES_HOST;
  delete process.env.POSTGRES_PORT;
  delete process.env.POSTGRES_DATABASE;
  delete process.env.POSTGRES_USERNAME;
  delete process.env.POSTGRES_PASSWORD;
  delete process.env.OPENSEARCH_NODE_URL;
  delete process.env.OPENSEARCH_INDEX_NAME;
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_TIMEOUT_MS;
  delete process.env.LLM_MAX_RETRIES;

  const context = new DefaultApplicationContextFactory().create();
  assertTruthy(context, "ApplicationContext missing for valid configuration");
  assertTruthy(context.healthController, "healthController missing");
  assertTruthy(context.ragController, "ragController missing");
  assertTruthy(context.aiProvider, "aiProvider missing");
  assertTruthy(context.aiPromptExecutor, "aiPromptExecutor missing");
  assertTruthy(
    context.applicationConfiguration,
    "applicationConfiguration missing from application context",
  );

  // Simulate Docker-network-style configuration (service names instead of
  // localhost) to verify the runtime relies only on configuration values.
  process.env.POSTGRES_HOST = "postgres";
  process.env.OPENSEARCH_NODE_URL = "http://opensearch:9200";
  const dockerNetworkContext = new DefaultApplicationContextFactory().create();
  assertEqual(
    dockerNetworkContext.applicationConfiguration.database.host,
    "postgres",
    "PostgreSQL host did not resolve through ApplicationConfiguration for a Docker-network hostname",
  );
  assertEqual(
    dockerNetworkContext.applicationConfiguration.search.nodeUrl,
    "http://opensearch:9200",
    "OpenSearch node URL did not resolve through ApplicationConfiguration for a Docker-network hostname",
  );
  assertEqual(
    dockerNetworkContext.llmConfiguration.provider,
    dockerNetworkContext.applicationConfiguration.ai.provider,
    "AI configuration did not continue to come from the validated ApplicationConfiguration",
  );
  delete process.env.POSTGRES_HOST;
  delete process.env.OPENSEARCH_NODE_URL;

  assertNoDirectProcessEnvAccess();

  process.env.LLM_MODEL = "centralized-config-model";
  const centralizedContext = new DefaultApplicationContextFactory().create();
  assertEqual(
    centralizedContext.llmConfiguration.model,
    "centralized-config-model",
    "runtime aiProvider/llmConfiguration did not derive from the single validated ApplicationConfiguration",
  );
  const centralizedResponse = await centralizedContext.aiProvider.complete({
    model: centralizedContext.llmConfiguration.model,
    messages: [{ role: "user", content: "ping" }],
  });
  assertEqual(
    centralizedResponse.metadata.model,
    "centralized-config-model",
    "aiProvider response metadata did not reflect centralized configuration",
  );
  delete process.env.LLM_MODEL;

  process.env.SERVER_PORT = "0";
  let invalidConfigurationThrew = false;
  try {
    new DefaultApplicationContextFactory().create();
  } catch (error) {
    invalidConfigurationThrew = error instanceof Error;
  }
  delete process.env.SERVER_PORT;

  assertTruthy(
    invalidConfigurationThrew,
    "expected invalid application configuration to fail fast with an Error before composing runtime components",
  );

  console.log(
    "Application configuration composition validation succeeded (factory -> validator -> context).",
  );
}

main();
