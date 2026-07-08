import type { AiProviderRequest } from "./AiProviderRequest";
import type { AiProviderResponse } from "./AiProviderResponse";

export interface AiProvider {
  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
}
