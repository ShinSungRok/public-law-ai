import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMCompletionRequest } from "./LLMProvider";
import type { AIResponseStream } from "../model/AIResponse";
import type { AIConfig } from "../config/aiConfig";
import { AIAuthenticationError, AIProviderError } from "../exception/AIException";

export class AnthropicProvider implements LLMProvider {
  private readonly client = new Anthropic();

  constructor(private readonly config: AIConfig) {}

  streamCompletion({ system, prompt }: LLMCompletionRequest): AIResponseStream {
    const { client, config } = this;

    return (async function* (): AIResponseStream {
      try {
        const stream = client.messages.stream({
          model: config.model,
          max_tokens: config.maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            yield { text: event.delta.text };
          }
        }
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) {
          throw new AIAuthenticationError(err);
        }
        if (err instanceof Anthropic.APIError) {
          throw new AIProviderError(err.message, err);
        }
        throw new AIProviderError("Unexpected AI provider error.", err);
      }
    })();
  }
}
