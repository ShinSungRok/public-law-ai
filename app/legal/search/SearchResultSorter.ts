import type { SearchResult } from "./model/SearchResult";

export interface SearchResultSorter {
  sort(results: SearchResult[]): SearchResult[];
}
