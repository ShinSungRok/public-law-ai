import type { AiProvider } from "./AiProvider";
import type { AiProviderType } from "./AiProviderType";

export interface AiProviderFactory {
  create(providerType: AiProviderType): AiProvider;
}
