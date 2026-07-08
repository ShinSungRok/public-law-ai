import { DefaultAiPromptExecutor } from "./DefaultAiPromptExecutor";
import { FakeAiProvider } from "./FakeAiProvider";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const aiProvider = new FakeAiProvider();
  const executor = new DefaultAiPromptExecutor(aiProvider);

  const response = await executor.execute({
    systemPrompt: "You are a helpful legal assistant.",
    userPrompt: "What is the statute of limitations?",
    model: "fake-model",
    temperature: 0.2,
    maxTokens: 256,
  });

  assertTruthy(
    typeof response.text === "string" && response.text.length > 0,
    "response missing non-empty text",
  );
  assertTruthy(response.metadata, "response missing metadata");

  console.log("AI prompt executor validation succeeded.");
  console.log(`Response text: ${response.text}`);
  console.log(`Response metadata: ${JSON.stringify(response.metadata)}`);
}

main();
