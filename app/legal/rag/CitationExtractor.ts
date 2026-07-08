import type { Citation } from "../domain";
import type { SearchResult } from "../search/model/SearchResult";

export interface CitationExtractor {
  extract(results: SearchResult[]): Citation[];
}
