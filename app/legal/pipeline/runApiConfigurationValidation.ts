import type { ApiConfiguration } from "../server/ApiConfiguration";
import { DefaultApiConfigurationFactory } from "../server/DefaultApiConfigurationFactory";

function assertNotEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertPositivePort(configuration: ApiConfiguration): void {
  if (configuration.port <= 0) {
    throw new Error("port must be greater than 0");
  }
}

async function main(): Promise<void> {
  const configuration = new DefaultApiConfigurationFactory().create();

  console.log(`serviceName: ${configuration.serviceName}`);
  console.log(`version: ${configuration.version}`);
  console.log(`environment: ${configuration.environment}`);
  console.log(`port: ${configuration.port}`);

  assertNotEmpty(configuration.serviceName, "serviceName");
  assertNotEmpty(configuration.version, "version");
  assertNotEmpty(configuration.environment, "environment");
  assertPositivePort(configuration);

  console.log("API configuration is valid.");
}

main();
