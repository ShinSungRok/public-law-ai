import type { AIResponseChunk, AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMCompletionRequest, LLMProvider } from "../../ai/provider/LLMProvider";
import type { CircuitBreaker } from "./CircuitBreaker";
import type { RetryOptions } from "./RetryOptions";
import type { RetryPolicy } from "./RetryPolicy";
import type { TimeoutPolicy } from "./TimeoutPolicy";

const DEFAULT_RETRY_OPTIONS: RetryOptions = { maxAttempts: 2, delayMs: 250 };
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Wraps an LLMProvider with circuit-breaking, timeout, and retry policies
 * at the orchestration layer.
 *
 * This is a second, generic safety net on top of whatever provider-specific
 * retry/timeout each AiProvider (OpenAiProvider/AnthropicProvider/
 * GeminiProvider) already does internally: the provider-level retry reacts
 * to a single request's transient errors, while the circuit breaker here
 * tracks failures *across* requests so a persistently failing provider
 * stops being hammered with new ones.
 */
export class ResilientLlmProviderDecorator implements LLMProvider {
  constructor(
    private readonly inner: LLMProvider,
    private readonly retryPolicy: RetryPolicy,
    private readonly timeoutPolicy: TimeoutPolicy,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    const { inner, retryPolicy, timeoutPolicy, circuitBreaker, retryOptions, timeoutMs } = this;

    return (async function* (): AIResponseStream {
      const chunks: AIResponseChunk[] = await circuitBreaker.execute(() =>
        retryPolicy.execute(
          () =>
            timeoutPolicy.execute(async () => {
              const collected: AIResponseChunk[] = [];
              for await (const chunk of inner.streamCompletion(request)) {
                collected.push(chunk);
              }
              return collected;
            }, timeoutMs),
          retryOptions,
        ),
      );

      for (const chunk of chunks) {
        yield chunk;
      }
    })();
  }
}
