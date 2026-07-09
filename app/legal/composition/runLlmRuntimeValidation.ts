import { ApplicationBootstrap } from "./ApplicationBootstrap";
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

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(
    new DefaultApplicationContextFactory(),
  );
  const context = bootstrap.bootstrap();

  assertTruthy(
    context.llmConfiguration,
    "llmConfiguration missing from application context",
  );
  assertTruthy(
    context.llmConfigurationFactory,
    "llmConfigurationFactory missing from application context",
  );
  assertTruthy(context.aiProvider, "aiProvider missing from application context");
  assertTruthy(
    context.aiPromptExecutor,
    "aiPromptExecutor missing from application context",
  );
  assertEqual(
    context.llmConfiguration.provider,
    "fake",
    "llmConfiguration.provider expected to default to fake",
  );

  const providerResponse = await context.aiProvider.complete({
    model: context.llmConfiguration.model,
    messages: [
      { role: "system", content: "You are a helpful legal assistant." },
      { role: "user", content: "What is the statute of limitations?" },
    ],
  });

  assertTruthy(
    typeof providerResponse.text === "string" && providerResponse.text.length > 0,
    "aiProvider response missing non-empty text",
  );
  assertTruthy(providerResponse.metadata, "aiProvider response missing metadata");

  const executorResponse = await context.aiPromptExecutor.execute({
    systemPrompt: "You are a helpful legal assistant.",
    userPrompt: "What is the statute of limitations?",
    model: context.llmConfiguration.model,
  });

  assertTruthy(
    typeof executorResponse.text === "string" && executorResponse.text.length > 0,
    "aiPromptExecutor response missing non-empty text",
  );
  assertTruthy(
    executorResponse.metadata,
    "aiPromptExecutor response missing metadata",
  );

  console.log("LLM runtime validation succeeded.");
  console.log(`LLM configuration provider: ${context.llmConfiguration.provider}`);
  console.log(`Provider response text: ${providerResponse.text}`);
  console.log(`Provider response metadata: ${JSON.stringify(providerResponse.metadata)}`);
  console.log(`Executor response text: ${executorResponse.text}`);
  console.log(`Executor response metadata: ${JSON.stringify(executorResponse.metadata)}`);
}

main();
