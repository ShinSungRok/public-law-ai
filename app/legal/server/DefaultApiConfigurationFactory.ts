import type { ApiConfiguration } from "./ApiConfiguration";

const DEFAULT_SERVICE_NAME = "public-law-ai";
const DEFAULT_VERSION = "0.1.0";
const DEFAULT_ENVIRONMENT = "local";
const DEFAULT_PORT = 3000;

export class DefaultApiConfigurationFactory {
  create(): ApiConfiguration {
    return {
      serviceName: DEFAULT_SERVICE_NAME,
      version: DEFAULT_VERSION,
      environment: DEFAULT_ENVIRONMENT,
      port: DEFAULT_PORT,
    };
  }
}
