import type { AiProviderMessage } from "./AiProviderMessage";

export interface AiProviderRequest {
  model: string;
  messages: AiProviderMessage[];
  temperature?: number;
  maxTokens?: number;
}
