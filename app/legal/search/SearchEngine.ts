import type { SearchQuery } from "./SearchQuery";
import type { SearchResult } from "./SearchResult";

export interface SearchEngine {
  search(query: SearchQuery): Promise<SearchResult[]>;
}
