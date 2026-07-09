import { AiProviderError } from "./AiProviderError";
import type { LlmConfiguration } from "./LlmConfiguration";
import type { LlmConfigurationFactory } from "./LlmConfigurationFactory";
import type { LlmProviderType } from "./LlmProviderType";

const DEFAULT_PROVIDER: LlmProviderType = "fake";
const DEFAULT_MODEL = "fake-model";
const DEFAULT_API_KEY = "fake-api-key";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

const SUPPORTED_PROVIDER_TYPES: LlmProviderType[] = ["openai", "anthropic", "fake"];

function parseProviderType(value: string | undefined): LlmProviderType {
  if (!value) {
    return DEFAULT_PROVIDER;
  }
  if (!SUPPORTED_PROVIDER_TYPES.includes(value as LlmProviderType)) {
    throw new AiProviderError(`Unsupported LLM provider type: ${value}`);
  }
  return value as LlmProviderType;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class EnvironmentLlmConfigurationFactory implements LlmConfigurationFactory {
  create(): LlmConfiguration {
    const provider = parseProviderType(process.env.LLM_PROVIDER);
    const model = process.env.LLM_MODEL || DEFAULT_MODEL;
    const baseUrl = process.env.LLM_BASE_URL || undefined;
    const timeout = parseNumber(process.env.LLM_TIMEOUT, DEFAULT_TIMEOUT);
    const maxRetries = parseNumber(process.env.LLM_MAX_RETRIES, DEFAULT_MAX_RETRIES);

    if (provider === "fake") {
      return {
        provider,
        model,
        apiKey: process.env.LLM_API_KEY || DEFAULT_API_KEY,
        baseUrl,
        timeout,
        maxRetries,
      };
    }

    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(
        `Missing required LLM_API_KEY environment variable for provider: ${provider}`,
      );
    }

    return {
      provider,
      model,
      apiKey,
      baseUrl,
      timeout,
      maxRetries,
    };
  }
}
