import { ApplicationBootstrap } from "./ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(
    new DefaultApplicationContextFactory(),
  );
  const context = bootstrap.bootstrap();

  assertTruthy(context.aiProvider, "aiProvider missing from application context");
  assertTruthy(
    context.aiPromptExecutor,
    "aiPromptExecutor missing from application context",
  );

  const providerResponse = await context.aiProvider.complete({
    model: "fake-model",
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
    model: "fake-model",
  });

  assertTruthy(
    typeof executorResponse.text === "string" && executorResponse.text.length > 0,
    "aiPromptExecutor response missing non-empty text",
  );
  assertTruthy(
    executorResponse.metadata,
    "aiPromptExecutor response missing metadata",
  );

  console.log("AI runtime validation succeeded.");
  console.log(`Provider response text: ${providerResponse.text}`);
  console.log(`Provider response metadata: ${JSON.stringify(providerResponse.metadata)}`);
  console.log(`Executor response text: ${executorResponse.text}`);
  console.log(`Executor response metadata: ${JSON.stringify(executorResponse.metadata)}`);
}

main();
