import type { SearchResult } from "./model/SearchResult";

export interface ScoreFusionStrategy {
  fuse(resultGroups: SearchResult[][]): SearchResult[];
}
