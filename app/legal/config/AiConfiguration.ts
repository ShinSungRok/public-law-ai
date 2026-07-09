import type { LlmProviderType } from "../ai";

export interface AiConfiguration {
  provider: LlmProviderType;
  model: string;
  apiKey: string;
  baseUrl?: string;
  timeout: number;
  maxRetries: number;
}
