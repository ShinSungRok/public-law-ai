import type { LlmProviderType } from "./LlmProviderType";

export interface LlmConfiguration {
  provider: LlmProviderType;
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeout: number;
  maxRetries: number;
}
