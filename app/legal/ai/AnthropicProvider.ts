import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "./AiProvider";
import { AiProviderError } from "./AiProviderError";
import type { AiProviderMessage } from "./AiProviderMessage";
import type { AiProviderRequest } from "./AiProviderRequest";
import type { AiProviderResponse } from "./AiProviderResponse";
import type { LlmConfiguration } from "./LlmConfiguration";
import { DefaultRetryPolicy } from "../reliability/DefaultRetryPolicy";
import { DefaultTimeoutPolicy } from "../reliability/DefaultTimeoutPolicy";
import { TimeoutError } from "../reliability/TimeoutError";

const PROVIDER_NAME = "anthropic";
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 200;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequestPayload {
  system?: string;
  messages: AnthropicMessage[];
}

export class AnthropicProvider implements AiProvider {
  private readonly client: Anthropic;
  private readonly retryPolicy = new DefaultRetryPolicy();
  private readonly timeoutPolicy = new DefaultTimeoutPolicy();

  constructor(
    private readonly configuration: LlmConfiguration,
    client?: Anthropic,
  ) {
    if (configuration.provider !== PROVIDER_NAME) {
      throw new AiProviderError(
        `AnthropicProvider requires provider "anthropic", got: ${configuration.provider}`,
      );
    }

    this.client =
      client ??
      new Anthropic({
        apiKey: configuration.apiKey,
        baseURL: configuration.baseUrl,
        // Retries are governed by the shared reliability RetryPolicy below,
        // so the SDK's own retry loop is disabled to avoid double-retrying.
        maxRetries: 0,
      });
  }

  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const anthropicPayload = this.toAnthropicPayload(request.messages);

    try {
      const text = await this.retryPolicy.execute(
        () =>
          this.timeoutPolicy.execute(
            () => this.streamToText(request, anthropicPayload),
            this.configuration.timeout,
          ),
        {
          maxAttempts: this.configuration.maxRetries + 1,
          delayMs: RETRY_DELAY_MS,
          isRetryable: (error) => this.isRetryableError(error),
        },
      );

      return {
        text,
        metadata: {
          provider: PROVIDER_NAME,
          model: request.model,
          timeout: String(this.configuration.timeout),
        },
      };
    } catch (error) {
      throw this.toSafeError(error);
    }
  }

  private async streamToText(
    request: AiProviderRequest,
    payload: AnthropicRequestPayload,
  ): Promise<string> {
    const stream = this.client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      temperature: request.temperature,
      system: payload.system,
      messages: payload.messages,
    });

    let text = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        text += event.delta.text;
      }
    }
    return text;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof Anthropic.RateLimitError) {
      return true;
    }
    if (error instanceof Anthropic.InternalServerError) {
      return true;
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return true;
    }
    return false;
  }

  private toSafeError(error: unknown): AiProviderError {
    if (error instanceof TimeoutError) {
      return new AiProviderError(
        `Anthropic request timed out after ${this.configuration.timeout}ms`,
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return new AiProviderError("Anthropic request failed: authentication error");
    }
    if (error instanceof Anthropic.APIError) {
      return new AiProviderError(`Anthropic request failed: ${error.name}`);
    }
    if (error instanceof AiProviderError) {
      return error;
    }
    return new AiProviderError("Anthropic request failed: unexpected error");
  }

  private toAnthropicPayload(
    messages: AiProviderMessage[],
  ): AnthropicRequestPayload {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n");

    const conversationMessages: AnthropicMessage[] = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    return {
      system: system || undefined,
      messages: conversationMessages,
    };
  }
}
