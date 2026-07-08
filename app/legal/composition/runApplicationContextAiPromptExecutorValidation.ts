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
    context.aiPromptExecutor,
    "aiPromptExecutor missing from application context",
  );

  const response = await context.aiPromptExecutor.execute({
    systemPrompt: "You are a helpful legal assistant.",
    userPrompt: "What is the statute of limitations?",
    model: "fake-model",
  });

  assertTruthy(
    typeof response.text === "string" && response.text.length > 0,
    "aiPromptExecutor response missing non-empty text",
  );
  assertTruthy(response.metadata, "aiPromptExecutor response missing metadata");

  console.log("Application context AI prompt executor validation succeeded.");
  console.log(`Response text: ${response.text}`);
  console.log(`Response metadata: ${JSON.stringify(response.metadata)}`);
}

main();
