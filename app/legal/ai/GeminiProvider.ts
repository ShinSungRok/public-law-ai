import { GoogleGenAI, type Content } from "@google/genai";

import type { AiProvider } from "./AiProvider";
import { AiProviderError } from "./AiProviderError";
import type { AiProviderMessage } from "./AiProviderMessage";
import type { AiProviderRequest } from "./AiProviderRequest";
import type { AiProviderResponse } from "./AiProviderResponse";
import type { LlmConfiguration } from "./LlmConfiguration";

const PROVIDER_NAME = "gemini";

const DEFAULT_RETRY_DELAY_MS = 500;

interface GeminiClient {
  models: {
    generateContentStream(parameters: {
      model: string;
      contents: Content[];
      config?: {
        systemInstruction?: string;
      };
    }): Promise<AsyncGenerator<{ text?: string }>>;
  };
}

/**
 * Google Gemini implementation of the common AiProvider contract.
 *
 * Gemini-specific SDK types and behavior remain contained inside this adapter.
 * Application and RAG layers interact only through AiProvider.
 */
export class GeminiProvider implements AiProvider {
  private readonly client: GeminiClient;

  constructor(
    private readonly configuration: LlmConfiguration,
    client?: GeminiClient,
  ) {
    if (configuration.provider !== PROVIDER_NAME) {
      throw new AiProviderError(
        `GeminiProvider requires provider "gemini", got: ${configuration.provider}`,
      );
    }

    if (!configuration.apiKey.trim()) {
      throw new AiProviderError(
        "GeminiProvider requires a non-empty API key",
      );
    }

    if (!configuration.model.trim()) {
      throw new AiProviderError(
        "GeminiProvider requires a non-empty model",
      );
    }

    if (!Number.isFinite(configuration.timeout) || configuration.timeout <= 0) {
      throw new AiProviderError(
        "GeminiProvider requires a positive timeout",
      );
    }

    if (
      !Number.isInteger(configuration.maxRetries) ||
      configuration.maxRetries < 0
    ) {
      throw new AiProviderError(
        "GeminiProvider requires maxRetries to be a non-negative integer",
      );
    }

    this.client =
      client ??
      (new GoogleGenAI({
        apiKey: configuration.apiKey,
      }) as GeminiClient);
  }

  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const model = request.model.trim() || this.configuration.model;
    const systemInstruction = this.extractSystemInstruction(request.messages);
    const contents = this.toGeminiContents(request.messages);

    if (contents.length === 0) {
      throw new AiProviderError(
        "GeminiProvider requires at least one non-system message",
      );
    }

    const text = await this.executeWithRetry(async () => {
      const stream = await this.withTimeout(
        this.client.models.generateContentStream({
          model,
          contents,
          config: systemInstruction
            ? {
                systemInstruction,
              }
            : undefined,
        }),
      );

      let accumulatedText = "";

      for await (const chunk of stream) {
        if (typeof chunk.text === "string") {
          accumulatedText += chunk.text;
        }
      }

      const normalizedText = accumulatedText.trim();

      if (!normalizedText) {
        throw new AiProviderError(
          "GeminiProvider received an empty response from Gemini",
        );
      }

      return normalizedText;
    });

    return {
      text,
      metadata: {
        provider: PROVIDER_NAME,
        model,
        timeout: String(this.configuration.timeout),
      },
    };
  }

  /**
   * Gemini accepts system instructions separately from conversation contents.
   */
  private extractSystemInstruction(
    messages: AiProviderMessage[],
  ): string | undefined {
    const instructions = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content.trim())
      .filter((content) => content.length > 0);

    return instructions.length > 0
      ? instructions.join("\n\n")
      : undefined;
  }

  /**
   * Converts the common provider message model into Gemini contents.
   *
   * Common role -> Gemini role
   * user        -> user
   * assistant   -> model
   * system      -> config.systemInstruction
   */
  private toGeminiContents(messages: AiProviderMessage[]): Content[] {
    return messages
      .filter((message) => message.role !== "system")
      .map((message): Content => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: message.content,
          },
        ],
      }));
  }

  /**
   * Retries transient provider failures up to configuration.maxRetries.
   *
   * maxRetries means retries after the initial attempt.
   * Example: maxRetries=3 allows at most four total attempts.
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (
          attempt >= this.configuration.maxRetries ||
          !this.isRetryableError(error)
        ) {
          throw this.toAiProviderError(error);
        }

        attempt += 1;

        await this.delay(
          DEFAULT_RETRY_DELAY_MS * 2 ** (attempt - 1),
        );
      }
    }
  }

  /**
   * Enforces the configured request timeout.
   *
   * Promise.race stops waiting for the SDK response. It does not necessarily
   * abort the underlying HTTP request because the shared AiProvider contract
   * does not expose an AbortSignal.
   */
  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new AiProviderError(
            `GeminiProvider request timed out after ${this.configuration.timeout}ms`,
          ),
        );
      }, this.configuration.timeout);
    });

    try {
      return await Promise.race([operation, timeoutPromise]);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Authentication and invalid-request failures should not be retried.
   * Rate limits and server/network failures may be transient.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof AiProviderError) {
      return !this.isTimeoutError(error);
    }

    const status = this.extractStatus(error);

    if (status !== undefined) {
      if (status === 408 || status === 409 || status === 429) {
        return true;
      }

      if (status >= 500) {
        return true;
      }

      if (status >= 400 && status < 500) {
        return false;
      }
    }

    const message = this.extractErrorMessage(error).toLowerCase();

    const nonRetryablePatterns = [
      "api key",
      "authentication",
      "authenticated",
      "permission",
      "forbidden",
      "invalid argument",
      "invalid request",
      "not found",
      "unsupported model",
    ];

    if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
      return false;
    }

    const retryablePatterns = [
      "timeout",
      "timed out",
      "rate limit",
      "too many requests",
      "temporarily unavailable",
      "service unavailable",
      "internal server error",
      "network",
      "connection",
      "econnreset",
      "econnrefused",
      "fetch failed",
      "socket",
    ];

    return retryablePatterns.some((pattern) => message.includes(pattern));
  }

  private isTimeoutError(error: AiProviderError): boolean {
    return error.message.toLowerCase().includes("timed out");
  }

  private extractStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    const candidate = error as {
      status?: unknown;
      statusCode?: unknown;
      response?: {
        status?: unknown;
      };
    };

    if (typeof candidate.status === "number") {
      return candidate.status;
    }

    if (typeof candidate.statusCode === "number") {
      return candidate.statusCode;
    }

    if (typeof candidate.response?.status === "number") {
      return candidate.response.status;
    }

    return undefined;
  }

  private toAiProviderError(error: unknown): AiProviderError {
    if (error instanceof AiProviderError) {
      return error;
    }

    return new AiProviderError(
      `GeminiProvider request failed: ${this.extractErrorMessage(error)}`,
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
