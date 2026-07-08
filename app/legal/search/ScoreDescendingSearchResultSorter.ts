import type { SearchResult } from "./model/SearchResult";
import type { SearchResultSorter } from "./SearchResultSorter";

export class ScoreDescendingSearchResultSorter implements SearchResultSorter {
  sort(results: SearchResult[]): SearchResult[] {
    return [...results].sort((a, b) => b.score - a.score);
  }
}
