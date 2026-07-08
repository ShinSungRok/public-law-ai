import type { SearchResult } from "./model/SearchResult";
import type { ScoreFusionStrategy } from "./ScoreFusionStrategy";

export class DefaultScoreFusionStrategy implements ScoreFusionStrategy {
  fuse(resultGroups: SearchResult[][]): SearchResult[] {
    return resultGroups.flat();
  }
}
