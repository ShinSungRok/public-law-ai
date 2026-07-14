import type { SearchHit } from "../SearchHit";
import type { SearchResult } from "./SearchResult";
import type { SearchSource } from "./SearchSource";

export function toSearchResult(
  searchHit: SearchHit,
  source: SearchSource,
): SearchResult {
  return {
    document: searchHit.document,
    score: searchHit.score,
    source,
  };
}

/** Inverse of toSearchResult — lets a SearchResult-based pipeline (e.g. HybridSearchEngine) still satisfy the SearchEngine/SearchHit contract. */
export function toSearchHit(searchResult: SearchResult): SearchHit {
  return {
    id: searchResult.document.id,
    document: searchResult.document,
    score: searchResult.score,
    highlights: [],
    matchedFields: [],
    metadata: { source: searchResult.source },
  };
}
