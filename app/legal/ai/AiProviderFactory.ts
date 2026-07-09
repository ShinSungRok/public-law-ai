import type { AiProvider } from "./AiProvider";
import type { AiProviderType } from "./AiProviderType";
import type { LlmConfiguration } from "./LlmConfiguration";

export interface AiProviderFactory {
  create(providerType: AiProviderType, configuration?: LlmConfiguration): AiProvider;
}
