import type { AiConfiguration } from "./AiConfiguration";
import type { DatabaseConfiguration } from "./DatabaseConfiguration";
import type { SearchConfiguration } from "./SearchConfiguration";
import type { ServerConfiguration } from "./ServerConfiguration";

export interface ApplicationConfiguration {
  server: ServerConfiguration;
  database: DatabaseConfiguration;
  search: SearchConfiguration;
  ai: AiConfiguration;
}
