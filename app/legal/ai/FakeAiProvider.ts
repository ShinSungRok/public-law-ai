import type { AiProvider } from "./AiProvider";
import type { AiProviderRequest } from "./AiProviderRequest";
import type { AiProviderResponse } from "./AiProviderResponse";

const PROVIDER_NAME = "fake-ai-provider";

export class FakeAiProvider implements AiProvider {
  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const lastMessage = request.messages[request.messages.length - 1];

    return {
      text: `[fake response to: ${lastMessage?.content ?? ""}]`,
      metadata: {
        provider: PROVIDER_NAME,
        model: request.model,
      },
    };
  }
}
