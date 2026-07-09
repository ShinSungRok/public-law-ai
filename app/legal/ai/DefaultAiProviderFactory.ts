import type { AiProvider } from "./AiProvider";
import { AiProviderError } from "./AiProviderError";
import type { AiProviderFactory } from "./AiProviderFactory";
import type { AiProviderType } from "./AiProviderType";
import { AnthropicProvider } from "./AnthropicProvider";
import { FakeAiProvider } from "./FakeAiProvider";
import type { LlmConfiguration } from "./LlmConfiguration";
import { OpenAiProvider } from "./OpenAiProvider";

export class DefaultAiProviderFactory implements AiProviderFactory {
  create(
    providerType: AiProviderType,
    configuration?: LlmConfiguration,
  ): AiProvider {
    switch (providerType) {
      case "fake":
        return new FakeAiProvider();
      case "openai":
        if (!configuration) {
          throw new AiProviderError(
            "LlmConfiguration is required to create an openai provider",
          );
        }
        return new OpenAiProvider(configuration);
      case "anthropic":
        if (!configuration) {
          throw new AiProviderError(
            "LlmConfiguration is required to create an anthropic provider",
          );
        }
        return new AnthropicProvider(configuration);
      default:
        throw new AiProviderError(`Unsupported AI provider type: ${providerType}`);
    }
  }
}
