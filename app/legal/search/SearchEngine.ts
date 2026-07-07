import type { SearchResult } from "./SearchResult";

export interface SearchEngine {
  search(query: string): Promise<SearchResult[]>;
}
