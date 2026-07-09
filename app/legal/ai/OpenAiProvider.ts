import type { AiProvider } from "./AiProvider";
import { AiProviderError } from "./AiProviderError";
import type { AiProviderMessage } from "./AiProviderMessage";
import type { AiProviderRequest } from "./AiProviderRequest";
import type { AiProviderResponse } from "./AiProviderResponse";
import type { LlmConfiguration } from "./LlmConfiguration";

const PROVIDER_NAME = "openai";

interface OpenAiChatMessage {
  role: string;
  content: string;
}

export class OpenAiProvider implements AiProvider {
  constructor(private readonly configuration: LlmConfiguration) {
    if (configuration.provider !== PROVIDER_NAME) {
      throw new AiProviderError(
        `OpenAiProvider requires provider "openai", got: ${configuration.provider}`,
      );
    }
  }

  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const openAiMessages = this.toOpenAiMessages(request.messages);
    const lastMessage = openAiMessages[openAiMessages.length - 1];

    return {
      text: `[openai placeholder response to: ${lastMessage?.content ?? ""}]`,
      metadata: {
        provider: PROVIDER_NAME,
        model: request.model,
        timeout: String(this.configuration.timeout),
      },
    };
  }

  private toOpenAiMessages(messages: AiProviderMessage[]): OpenAiChatMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }
}
