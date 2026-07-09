import type { ApplicationConfiguration } from "./ApplicationConfiguration";

export interface ApplicationConfigurationFactory {
  create(): ApplicationConfiguration;
}
