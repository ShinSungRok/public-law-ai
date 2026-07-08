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
