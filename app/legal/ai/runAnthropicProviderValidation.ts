import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { AiProviderError } from "./AiProviderError";
import { AnthropicProvider } from "./AnthropicProvider";
import type { LlmConfiguration } from "./LlmConfiguration";

type FakeStreamEvent = {
  type: string;
  delta: { type: string; text: string };
};

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

function chunkStream(chunks: string[]): AsyncIterable<FakeStreamEvent> {
  return (async function* (): AsyncGenerator<FakeStreamEvent> {
    for (const chunk of chunks) {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: chunk } };
    }
  })();
}

function throwingStream(error: unknown): AsyncIterable<FakeStreamEvent> {
  return (async function* (): AsyncGenerator<FakeStreamEvent> {
    throw error;
  })();
}

function delayedChunkStream(chunks: string[], delayMs: number): AsyncIterable<FakeStreamEvent> {
  return (async function* (): AsyncGenerator<FakeStreamEvent> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    for (const chunk of chunks) {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: chunk } };
    }
  })();
}

function createFakeAnthropicClient(
  streamHandler: (params: Record<string, unknown>) => AsyncIterable<FakeStreamEvent>,
): Anthropic {
  return {
    messages: {
      stream: streamHandler,
    },
  } as unknown as Anthropic;
}

function baseConfiguration(overrides: Partial<LlmConfiguration> = {}): LlmConfiguration {
  return {
    provider: "anthropic",
    model: "claude-sonnet-5",
    apiKey: "fake-api-key-for-validation-only",
    timeout: 5000,
    maxRetries: 2,
    ...overrides,
  };
}

function assertPlaceholderRemoved(): void {
  const source = readFileSync(
    path.resolve(process.cwd(), "app/legal/ai/AnthropicProvider.ts"),
    "utf8",
  );
  assertTruthy(
    !source.includes("placeholder"),
    "AnthropicProvider.ts still contains placeholder response logic",
  );
  assertTruthy(
    source.includes("messages.stream("),
    "AnthropicProvider.ts does not appear to call the real Anthropic streaming API",
  );
}

async function validateRequestMappingAndStreamingConversion(): Promise<void> {
  let capturedParams: Record<string, unknown> | undefined;
  const client = createFakeAnthropicClient((params) => {
    capturedParams = params;
    return chunkStream(["Hello", ", world."]);
  });

  const configuration = baseConfiguration();
  const provider = new AnthropicProvider(configuration, client);

  const response = await provider.complete({
    model: configuration.model,
    messages: [
      { role: "system", content: "You are a helpful legal assistant." },
      { role: "user", content: "What is the statute of limitations?" },
    ],
  });

  assertEqual(
    response.text,
    "Hello, world.",
    "AnthropicProvider did not concatenate streamed chunks in order",
  );
  assertTruthy(
    !response.text.includes("[anthropic placeholder response to:"),
    "AnthropicProvider still returns the placeholder response",
  );
  assertEqual(response.metadata.provider, "anthropic", "metadata provider mismatch");
  assertEqual(response.metadata.model, configuration.model, "metadata model mismatch");

  assertTruthy(capturedParams, "AnthropicProvider did not call messages.stream()");
  assertEqual(capturedParams!.model, configuration.model, "request did not carry the configured model");
  assertEqual(
    capturedParams!.system,
    "You are a helpful legal assistant.",
    "request did not carry the mapped system prompt",
  );
  const mappedMessages = capturedParams!.messages as Array<{ role: string; content: string }>;
  assertEqual(mappedMessages.length, 1, "request should only carry non-system messages");
  assertEqual(mappedMessages[0].role, "user", "request message role was not mapped correctly");
  assertEqual(
    mappedMessages[0].content,
    "What is the statute of limitations?",
    "request message content was not mapped correctly",
  );
  assertTruthy(
    typeof capturedParams!.max_tokens === "number" && (capturedParams!.max_tokens as number) > 0,
    "request is missing a positive max_tokens value",
  );
}

async function validateTimeoutBehavior(): Promise<void> {
  const client = createFakeAnthropicClient(() => delayedChunkStream(["too late"], 80));
  const configuration = baseConfiguration({ timeout: 20, maxRetries: 0 });
  const provider = new AnthropicProvider(configuration, client);

  let threw = false;
  let message = "";
  try {
    await provider.complete({
      model: configuration.model,
      messages: [{ role: "user", content: "ping" }],
    });
  } catch (error) {
    threw = error instanceof AiProviderError;
    message = error instanceof Error ? error.message : "";
  }

  assertTruthy(threw, "expected AnthropicProvider to raise AiProviderError when the request times out");
  assertTruthy(
    message.includes("timed out"),
    "timeout error message did not mention the request timed out",
  );
}

async function validateRetryBehaviorForTransientFailures(): Promise<void> {
  let attempts = 0;
  const client = createFakeAnthropicClient(() => {
    attempts += 1;
    if (attempts < 3) {
      return throwingStream(
        new Anthropic.RateLimitError(429, {}, "rate limited", new Headers()),
      );
    }
    return chunkStream(["recovered"]);
  });

  const configuration = baseConfiguration({ maxRetries: 3 });
  const provider = new AnthropicProvider(configuration, client);

  const response = await provider.complete({
    model: configuration.model,
    messages: [{ role: "user", content: "ping" }],
  });

  assertEqual(
    response.text,
    "recovered",
    "AnthropicProvider did not recover after retrying transient failures",
  );
  assertEqual(attempts, 3, "expected exactly 2 transient failures followed by 1 successful attempt");
}

async function validateAuthenticationFailuresAreNotRetried(): Promise<void> {
  let attempts = 0;
  const client = createFakeAnthropicClient(() => {
    attempts += 1;
    return throwingStream(
      new Anthropic.AuthenticationError(401, {}, "invalid x-api-key", new Headers()),
    );
  });

  const configuration = baseConfiguration({ maxRetries: 3 });
  const provider = new AnthropicProvider(configuration, client);

  let threw = false;
  let message = "";
  try {
    await provider.complete({
      model: configuration.model,
      messages: [{ role: "user", content: "ping" }],
    });
  } catch (error) {
    threw = error instanceof AiProviderError;
    message = error instanceof Error ? error.message : "";
  }

  assertTruthy(threw, "expected authentication failure to raise AiProviderError");
  assertEqual(attempts, 1, "expected authentication failures to not be retried");
  assertTruthy(
    !message.includes(configuration.apiKey),
    "error message leaked the configured API key",
  );
  assertTruthy(
    !message.toLowerCase().includes("x-api-key"),
    "error message leaked raw provider error details",
  );
}

async function validateInvalidProviderConfigurationThrows(): Promise<void> {
  let invalidProviderThrew = false;
  try {
    new AnthropicProvider({
      provider: "openai",
      model: "claude-sonnet-5",
      apiKey: "fake-api-key",
      timeout: 15000,
      maxRetries: 2,
    });
  } catch (error) {
    invalidProviderThrew = error instanceof AiProviderError;
  }
  assertTruthy(
    invalidProviderThrew,
    "expected invalid provider configuration to throw AiProviderError",
  );
}

async function main(): Promise<void> {
  console.log(
    "[ai] Checking AnthropicProvider placeholder response has been removed...",
  );
  assertPlaceholderRemoved();

  console.log("[ai] Checking AnthropicProvider request mapping and streaming conversion...");
  await validateRequestMappingAndStreamingConversion();

  console.log("[ai] Checking AnthropicProvider timeout behavior...");
  await validateTimeoutBehavior();

  console.log("[ai] Checking AnthropicProvider retries transient failures...");
  await validateRetryBehaviorForTransientFailures();

  console.log("[ai] Checking AnthropicProvider does not retry authentication failures...");
  await validateAuthenticationFailuresAreNotRetried();

  console.log("[ai] Checking invalid provider configuration is rejected...");
  await validateInvalidProviderConfigurationThrows();

  console.log(
    "Anthropic provider validation succeeded (no external API call required — all transports were injected fakes).",
  );
}

main();
