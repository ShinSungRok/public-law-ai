import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const factory = new DefaultApplicationContextFactory();
  const context = factory.create();

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

  const response = await context.aiProvider.complete({
    model: context.llmConfiguration.model,
    messages: [
      { role: "system", content: "You are a helpful legal assistant." },
      { role: "user", content: "What is the statute of limitations?" },
    ],
  });

  assertTruthy(
    typeof response.text === "string" && response.text.length > 0,
    "fake provider response missing non-empty text",
  );
  assertTruthy(response.metadata, "fake provider response missing metadata");

  console.log("Application context LLM configuration validation succeeded.");
  console.log(`LLM configuration provider: ${context.llmConfiguration.provider}`);
  console.log(`Response text: ${response.text}`);
  console.log(`Response metadata: ${JSON.stringify(response.metadata)}`);
}

main();
