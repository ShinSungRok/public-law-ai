import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
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

  const context = new DefaultApplicationContextFactory().create();
  assertTruthy(context, "ApplicationContext missing for valid configuration");
  assertTruthy(context.healthController, "healthController missing");
  assertTruthy(context.ragController, "ragController missing");
  assertTruthy(context.aiProvider, "aiProvider missing");
  assertTruthy(context.aiPromptExecutor, "aiPromptExecutor missing");

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
