import type { AiProvider } from "./AiProvider";
import { AiProviderError } from "./AiProviderError";
import type { AiProviderMessage } from "./AiProviderMessage";
import type { AiProviderRequest } from "./AiProviderRequest";
import type { AiProviderResponse } from "./AiProviderResponse";
import type { LlmConfiguration } from "./LlmConfiguration";

const PROVIDER_NAME = "anthropic";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequestPayload {
  system?: string;
  messages: AnthropicMessage[];
}

export class AnthropicProvider implements AiProvider {
  constructor(private readonly configuration: LlmConfiguration) {
    if (configuration.provider !== PROVIDER_NAME) {
      throw new AiProviderError(
        `AnthropicProvider requires provider "anthropic", got: ${configuration.provider}`,
      );
    }
  }

  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const anthropicPayload = this.toAnthropicPayload(request.messages);
    const lastMessage =
      anthropicPayload.messages[anthropicPayload.messages.length - 1];

    return {
      text: `[anthropic placeholder response to: ${lastMessage?.content ?? ""}]`,
      metadata: {
        provider: PROVIDER_NAME,
        model: request.model,
        timeout: String(this.configuration.timeout),
      },
    };
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
