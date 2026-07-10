import type { SearchEngineType } from "./SearchEngineType";

export interface SearchConfiguration {
  engine: SearchEngineType;
  nodeUrl: string;
  indexName: string;
  username?: string;
  password?: string;
}
