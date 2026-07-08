import type { SearchResult } from "./model/SearchResult";
import type { SearchResultFilter } from "./SearchResultFilter";

export class DefaultSearchResultFilter implements SearchResultFilter {
  filter(results: SearchResult[]): SearchResult[] {
    return results;
  }
}
