import { AiProviderError } from "../ai";
import type { LlmProviderType } from "../ai";
import type { ApplicationConfiguration } from "./ApplicationConfiguration";
import type { ApplicationConfigurationFactory } from "./ApplicationConfigurationFactory";

const DEFAULT_SERVER_HOST = "0.0.0.0";
const DEFAULT_SERVER_PORT = 3000;

const DEFAULT_DATABASE_HOST = "localhost";
const DEFAULT_DATABASE_PORT = 5432;
const DEFAULT_DATABASE_NAME = "public_law_ai";
const DEFAULT_DATABASE_USERNAME = "public_law_ai";
const DEFAULT_DATABASE_PASSWORD = "";

const DEFAULT_SEARCH_NODE_URL = "http://localhost:9200";
const DEFAULT_SEARCH_INDEX_NAME = "public-law-ai-local";

const DEFAULT_AI_PROVIDER: LlmProviderType = "fake";
const DEFAULT_AI_MODEL = "fake-model";
const DEFAULT_AI_API_KEY = "fake-api-key";
const DEFAULT_AI_TIMEOUT = 30000;
const DEFAULT_AI_MAX_RETRIES = 3;

const SUPPORTED_AI_PROVIDER_TYPES: LlmProviderType[] = ["openai", "anthropic", "fake"];

function parseNumber(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${name}: ${value}`);
  }
  return parsed;
}

function parseAiProviderType(value: string | undefined): LlmProviderType {
  if (!value) {
    return DEFAULT_AI_PROVIDER;
  }
  if (!SUPPORTED_AI_PROVIDER_TYPES.includes(value as LlmProviderType)) {
    throw new AiProviderError(`Unsupported AI provider type: ${value}`);
  }
  return value as LlmProviderType;
}

export class EnvironmentApplicationConfigurationFactory
  implements ApplicationConfigurationFactory
{
  create(): ApplicationConfiguration {
    return {
      server: {
        host: process.env.SERVER_HOST || DEFAULT_SERVER_HOST,
        port: parseNumber(
          "SERVER_PORT",
          process.env.SERVER_PORT,
          DEFAULT_SERVER_PORT,
        ),
      },
      database: {
        host: process.env.POSTGRES_HOST || DEFAULT_DATABASE_HOST,
        port: parseNumber(
          "POSTGRES_PORT",
          process.env.POSTGRES_PORT,
          DEFAULT_DATABASE_PORT,
        ),
        database: process.env.POSTGRES_DATABASE || DEFAULT_DATABASE_NAME,
        username: process.env.POSTGRES_USER || DEFAULT_DATABASE_USERNAME,
        password: process.env.POSTGRES_PASSWORD || DEFAULT_DATABASE_PASSWORD,
      },
      search: {
        nodeUrl: process.env.OPENSEARCH_NODE || DEFAULT_SEARCH_NODE_URL,
        indexName: process.env.OPENSEARCH_INDEX_NAME || DEFAULT_SEARCH_INDEX_NAME,
      },
      ai: {
        provider: parseAiProviderType(process.env.LLM_PROVIDER),
        model: process.env.LLM_MODEL || DEFAULT_AI_MODEL,
        apiKey: process.env.LLM_API_KEY || DEFAULT_AI_API_KEY,
        baseUrl: process.env.LLM_BASE_URL || undefined,
        timeout: parseNumber(
          "LLM_TIMEOUT",
          process.env.LLM_TIMEOUT,
          DEFAULT_AI_TIMEOUT,
        ),
        maxRetries: parseNumber(
          "LLM_MAX_RETRIES",
          process.env.LLM_MAX_RETRIES,
          DEFAULT_AI_MAX_RETRIES,
        ),
      },
    };
  }
}
