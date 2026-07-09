import type { AiConfiguration } from "./AiConfiguration";
import type { ApplicationEnvironment } from "./ApplicationEnvironment";
import type { DatabaseConfiguration } from "./DatabaseConfiguration";
import type { LogLevel } from "./LogLevel";
import type { SearchConfiguration } from "./SearchConfiguration";
import type { ServerConfiguration } from "./ServerConfiguration";

export interface ApplicationConfiguration {
  environment: ApplicationEnvironment;
  logLevel: LogLevel;
  server: ServerConfiguration;
  database: DatabaseConfiguration;
  search: SearchConfiguration;
  ai: AiConfiguration;
}
