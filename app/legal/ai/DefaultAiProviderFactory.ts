import type { AiProvider } from "./AiProvider";
import { AiProviderError } from "./AiProviderError";
import type { AiProviderFactory } from "./AiProviderFactory";
import type { AiProviderType } from "./AiProviderType";
import { FakeAiProvider } from "./FakeAiProvider";

export class DefaultAiProviderFactory implements AiProviderFactory {
  create(providerType: AiProviderType): AiProvider {
    switch (providerType) {
      case "fake":
        return new FakeAiProvider();
      default:
        throw new AiProviderError(`Unsupported AI provider type: ${providerType}`);
    }
  }
}
