import type { SearchResult } from "./model/SearchResult";
import type { ScoreFusionStrategy } from "./ScoreFusionStrategy";

export class DefaultScoreFusionStrategy implements ScoreFusionStrategy {
  fuse(results: SearchResult[]): SearchResult[] {
    return results;
  }
}
