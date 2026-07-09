import type { ApplicationConfiguration } from "./ApplicationConfiguration";

export interface ApplicationConfigurationValidator {
  validate(configuration: ApplicationConfiguration): void;
}
