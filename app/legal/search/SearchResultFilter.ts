import type { SearchResult } from "./model/SearchResult";

export interface SearchResultFilter {
  filter(results: SearchResult[]): SearchResult[];
}
