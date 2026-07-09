import type { LlmConfiguration } from "./LlmConfiguration";

export interface LlmConfigurationFactory {
  create(): LlmConfiguration;
}
