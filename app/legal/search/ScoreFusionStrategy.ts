import type { SearchResult } from "./model/SearchResult";

export interface ScoreFusionStrategy {
  fuse(results: SearchResult[]): SearchResult[];
}
