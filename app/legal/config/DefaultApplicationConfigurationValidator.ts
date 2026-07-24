import type { LlmProviderType } from "../ai";
import type { ApplicationConfiguration } from "./ApplicationConfiguration";
import type { ApplicationConfigurationValidator } from "./ApplicationConfigurationValidator";
import type { ApplicationEnvironment } from "./ApplicationEnvironment";
import type { LogLevel } from "./LogLevel";

const REAL_AI_PROVIDER_TYPES: LlmProviderType[] = ["openai", "anthropic", "gemini"];

const SUPPORTED_ENVIRONMENTS: ApplicationEnvironment[] = [
  "development",
  "test",
  "production",
];
const SUPPORTED_LOG_LEVELS: LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
];

export class DefaultApplicationConfigurationValidator
  implements ApplicationConfigurationValidator
{
  validate(configuration: ApplicationConfiguration): void {
    const errors: string[] = [];

    if (!SUPPORTED_ENVIRONMENTS.includes(configuration.environment)) {
      errors.push(`environment must be one of: ${SUPPORTED_ENVIRONMENTS.join(", ")}`);
    }
    if (!SUPPORTED_LOG_LEVELS.includes(configuration.logLevel)) {
      errors.push(`logLevel must be one of: ${SUPPORTED_LOG_LEVELS.join(", ")}`);
    }

    if (!configuration.server.host) {
      errors.push("server.host must not be empty");
    }
    if (configuration.server.port <= 0) {
      errors.push("server.port must be positive");
    }

    if (!configuration.database.host) {
      errors.push("database.host must not be empty");
    }
    if (configuration.database.port <= 0) {
      errors.push("database.port must be positive");
    }
    if (!configuration.database.database) {
      errors.push("database.database must not be empty");
    }

    if (!configuration.search.nodeUrl) {
      errors.push("search.nodeUrl must not be empty");
    }
    if (!configuration.search.indexName) {
      errors.push("search.indexName must not be empty");
    }

    if (!configuration.ai.provider) {
      errors.push("ai.provider must exist");
    }
    if (!configuration.ai.model) {
      errors.push("ai.model must not be empty");
    }
    if (configuration.ai.timeout <= 0) {
      errors.push("ai.timeout must be positive");
    }
    if (configuration.ai.maxRetries < 0) {
      errors.push("ai.maxRetries must be zero or positive");
    }
    if (
      REAL_AI_PROVIDER_TYPES.includes(configuration.ai.provider) &&
      !configuration.ai.apiKey
    ) {
      errors.push(
        `ai.apiKey is required for provider: ${configuration.ai.provider}`,
      );
    }

    if (errors.length > 0) {
      throw new Error(`Invalid application configuration: ${errors.join(", ")}`);
    }
  }
}
