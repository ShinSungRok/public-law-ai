import { readFileSync } from "node:fs";
import path from "node:path";
import { AnthropicProvider } from "../ai/AnthropicProvider";
import { FakeAiProvider } from "../ai/FakeAiProvider";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

const SAMPLE_QUERY = "개인정보 보호";
const OLD_HARD_CODED_FAKE_ANSWER_MARKER =
  "This is a fake generated answer based on the retrieved legal context.";
const FAKE_AI_PROVIDER_ANSWER_MARKER = "[fake response to:";

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

function readFactorySource(): string {
  return readFileSync(
    path.resolve(
      process.cwd(),
      "app/legal/composition/DefaultApplicationContextFactory.ts",
    ),
    "utf8",
  );
}

function assertFactoryNoLongerHardCodesFakeLlmProvider(): void {
  const source = readFactorySource();
  assertTruthy(
    !source.includes("class FakeLLMProvider"),
    "DefaultApplicationContextFactory.ts still defines a local hard-coded FakeLLMProvider",
  );
  assertTruthy(
    source.includes("AiPromptExecutorLlmProviderAdapter"),
    "DefaultApplicationContextFactory.ts does not use AiPromptExecutorLlmProviderAdapter to bridge the configured AI provider into the RAG use case",
  );
}

function assertSingleConfiguredAiProviderInstance(): void {
  const source = readFactorySource();
  const providerConstructionMatches =
    source.match(/new DefaultAiProviderFactory\(\)\.create\(/g) ?? [];
  assertEqual(
    providerConstructionMatches.length,
    1,
    "expected DefaultApplicationContextFactory to construct the configured AiProvider exactly once",
  );

  const promptExecutorMatches =
    source.match(/new DefaultAiPromptExecutor\(aiProvider\)/g) ?? [];
  assertEqual(
    promptExecutorMatches.length,
    1,
    "expected DefaultAiPromptExecutor to be constructed from the same configured aiProvider instance",
  );

  const adapterMatches =
    source.match(/new AiPromptExecutorLlmProviderAdapter\(\s*aiPromptExecutor/g) ?? [];
  assertEqual(
    adapterMatches.length,
    1,
    "expected the RAG LLMProvider adapter to be built from the same aiPromptExecutor instance exposed on ApplicationContext",
  );
}

async function validateFakeConfigurationBacksRagAnswer(): Promise<void> {
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;

  const context = new DefaultApplicationContextFactory().create();
  assertEqual(
    context.llmConfiguration.provider,
    "fake",
    "expected default LLM_PROVIDER to resolve to fake",
  );
  assertTruthy(
    context.aiProvider instanceof FakeAiProvider,
    "expected ApplicationContext.aiProvider to be a FakeAiProvider for fake configuration",
  );

  const ragAnswer = await context.ragController.answer({ query: SAMPLE_QUERY });
  assertTruthy(
    ragAnswer.answer.includes(FAKE_AI_PROVIDER_ANSWER_MARKER),
    "RAG answer under fake configuration was not produced by the configured FakeAiProvider",
  );
  assertTruthy(
    !ragAnswer.answer.includes(OLD_HARD_CODED_FAKE_ANSWER_MARKER),
    "RAG answer still reflects the old local hard-coded FakeLLMProvider text",
  );
}

async function validateAnthropicConfigurationSelectsAnthropicProviderStructurally(): Promise<void> {
  process.env.LLM_PROVIDER = "anthropic";
  process.env.LLM_MODEL = "claude-sonnet-5";
  process.env.LLM_API_KEY = "fake-api-key-for-validation-only";
  process.env.LLM_TIMEOUT_MS = "15000";
  process.env.LLM_MAX_RETRIES = "2";

  try {
    const context = new DefaultApplicationContextFactory().create();
    assertEqual(
      context.llmConfiguration.provider,
      "anthropic",
      "expected LLM_PROVIDER=anthropic to resolve through llmConfiguration",
    );
    assertTruthy(
      context.aiProvider instanceof AnthropicProvider,
      "expected ApplicationContext.aiProvider to be an AnthropicProvider for anthropic configuration",
    );
    assertTruthy(
      context.aiPromptExecutor,
      "expected ApplicationContext.aiPromptExecutor to be wired for anthropic configuration",
    );

    // AnthropicProvider now calls the real Anthropic API (see
    // app/legal/ai/AnthropicProvider.ts), so this check stays structural
    // (constructor/type wiring only) rather than invoking ragController,
    // which would otherwise make a real Anthropic API call during
    // validation. Streaming/retry/timeout/request-mapping behavior for
    // AnthropicProvider itself is covered with injected fakes in
    // app/legal/ai/runAnthropicProviderValidation.ts.
  } finally {
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_TIMEOUT_MS;
    delete process.env.LLM_MAX_RETRIES;
  }
}

async function main(): Promise<void> {
  console.log(
    "[composition] Checking DefaultApplicationContextFactory no longer hard-codes FakeLLMProvider...",
  );
  assertFactoryNoLongerHardCodesFakeLlmProvider();

  console.log(
    "[composition] Checking exactly one configured AiProvider instance is created per ApplicationContext...",
  );
  assertSingleConfiguredAiProviderInstance();

  console.log(
    "[composition] Checking fake configuration produces a fake-provider-backed RAG answer...",
  );
  await validateFakeConfigurationBacksRagAnswer();

  console.log(
    "[composition] Checking anthropic configuration selects AnthropicProvider structurally (no real API call)...",
  );
  await validateAnthropicConfigurationSelectsAnthropicProviderStructurally();

  console.log("Application context RAG provider wiring validation succeeded.");
}

main();
